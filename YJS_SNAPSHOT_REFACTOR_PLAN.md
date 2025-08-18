# YJS Snapshot System Complete Refactoring Plan

## Executive Summary

Refactor the current problematic YJS snapshot system that causes data loss and memory explosions into a robust, event-driven system with smart compaction. The new system will eliminate the dual source of truth problem, remove the 500ms polling, and prevent data loss.

## Current Problems
1. **Data Loss**: Empty YJS states overwrite content
2. **Memory Explosions**: Replaying thousands of updates causes 15GB+ memory usage
3. **Dual Source of Truth**: YJS updates vs blocks table conflict
4. **Performance**: 500ms polling wastes resources
5. **Unbounded Growth**: Updates accumulate forever

## New Architecture

### Core Principles
- **Single Source of Truth**: YJS is the only source
- **Event-Driven**: No polling, react to changes
- **Compaction**: Old updates consolidated into base states
- **Append-Only**: Never lose data
- **Bounded Resources**: Memory and storage stay controlled

### System Components
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   WebSocket  │────▶│  Recent     │
│   (YJS)     │◀────│   Handler    │     │  Updates    │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  Compaction  │────▶│  Base       │
                    │  Service     │     │  State      │
                    └──────────────┘     └─────────────┘
```

## Phase 1: Database Changes (Week 1)

### 1.1 Create New Tables

```sql
-- Store compacted YJS document state
CREATE TABLE yjs_base_states (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    base_state BYTEA NOT NULL,
    state_vector BYTEA NOT NULL,  -- YJS state vector for incremental updates
    compacted_at TIMESTAMPTZ DEFAULT NOW(),
    last_compacted_update_id BIGINT,
    update_count INT DEFAULT 0,
    document_size INT DEFAULT 0
);

-- Rename and modify existing table for recent updates only
ALTER TABLE yjs_document_updates RENAME TO yjs_recent_updates;

ALTER TABLE yjs_recent_updates 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
ADD COLUMN IF NOT EXISTS is_compacted BOOLEAN DEFAULT FALSE;

-- Index for efficient cleanup
CREATE INDEX idx_yjs_recent_expires ON yjs_recent_updates(expires_at) WHERE NOT is_compacted;
CREATE INDEX idx_yjs_recent_script_uncompacted ON yjs_recent_updates(script_id, id) WHERE NOT is_compacted;

-- Audit table for debugging
CREATE TABLE yjs_compaction_log (
    id SERIAL PRIMARY KEY,
    script_id UUID NOT NULL,
    updates_compacted INT NOT NULL,
    size_before INT NOT NULL,
    size_after INT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Migration Script

```sql
-- Migrate existing data (run during low traffic)
BEGIN;

-- Create initial base states from existing updates
INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id)
SELECT DISTINCT script_id, 
       '\x00'::bytea,  -- Empty initial state
       '\x00'::bytea,  -- Empty state vector
       0
FROM yjs_document_updates;

-- Mark all existing updates for compaction
UPDATE yjs_recent_updates 
SET expires_at = NOW() + INTERVAL '7 days'  -- Give time for migration
WHERE expires_at IS NULL;

COMMIT;
```

## Phase 2: Backend Changes (Week 1-2)

### 2.1 Critical Bug Fix (IMMEDIATE)

```rust
// backend/src/networking/websocket.rs - Line 404
// FIX THE SYNC MESSAGE BUG IMMEDIATELY!
if msg_type == 0x00 {  // YJS sync protocol messages
    tracing::debug!("[WS_SYNC_PROTOCOL] Skipping sync message");
    false  // NEVER persist these
} else if msg_type == 0x01 || msg_type == 0x02 {  // Actual updates
    true   // Persist content updates
} else {
    false  // Skip unknown types
}
```

### 2.2 New Compaction Service

Create `backend/src/services/yjs_compaction_service.rs`:

```rust
use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use yrs::{Doc, Options, Transact, StateVector};
use tokio::time::{Duration, interval};
use tracing::{info, error, debug};

pub struct CompactionService {
    pool: Arc<PgPool>,
    max_updates_before_compact: usize,
    max_age_before_compact: Duration,
}

impl CompactionService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            pool,
            max_updates_before_compact: 500,
            max_age_before_compact: Duration::from_secs(1800), // 30 minutes
        }
    }

    /// Main service loop - runs every 5 minutes
    pub async fn run(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(300));
        
        loop {
            interval.tick().await;
            
            match self.find_scripts_needing_compaction().await {
                Ok(scripts) => {
                    for script_id in scripts {
                        if let Err(e) = self.compact_script(script_id).await {
                            error!("Failed to compact script {}: {}", script_id, e);
                        }
                    }
                }
                Err(e) => error!("Failed to find scripts for compaction: {}", e),
            }
        }
    }

    async fn find_scripts_needing_compaction(&self) -> Result<Vec<Uuid>, anyhow::Error> {
        let scripts = sqlx::query!(
            r#"
            SELECT DISTINCT r.script_id
            FROM yjs_recent_updates r
            LEFT JOIN yjs_base_states b ON r.script_id = b.script_id
            WHERE r.is_compacted = false
            GROUP BY r.script_id, b.compacted_at
            HAVING 
                COUNT(*) > $1  -- Too many updates
                OR MIN(r.created_at) < NOW() - INTERVAL '30 minutes'  -- Old updates
                OR b.compacted_at IS NULL  -- Never compacted
                OR b.compacted_at < NOW() - INTERVAL '30 minutes'  -- Stale base
            "#,
            self.max_updates_before_compact as i64
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(scripts.into_iter().map(|r| r.script_id).collect())
    }

    async fn compact_script(&self, script_id: Uuid) -> Result<(), anyhow::Error> {
        let start = std::time::Instant::now();
        
        // Start transaction
        let mut tx = self.pool.begin().await?;
        
        // 1. Load current base state
        let base_state = sqlx::query!(
            "SELECT base_state, state_vector FROM yjs_base_states WHERE script_id = $1",
            script_id
        )
        .fetch_optional(&mut *tx)
        .await?;
        
        // 2. Load uncompacted updates
        let updates = sqlx::query!(
            r#"
            SELECT id, update_data 
            FROM yjs_recent_updates 
            WHERE script_id = $1 AND is_compacted = false
            ORDER BY id ASC
            "#,
            script_id
        )
        .fetch_all(&mut *tx)
        .await?;
        
        if updates.is_empty() {
            debug!("No updates to compact for script {}", script_id);
            return Ok(());
        }
        
        // 3. Create YJS document and apply base + updates
        let doc = Doc::with_options(Options {
            skip_gc: false,  // Enable garbage collection
            ..Default::default()
        });
        
        // Apply base state if exists
        if let Some(base) = base_state {
            if !base.base_state.is_empty() {
                let update = yrs::Update::decode_v1(&base.base_state)?;
                doc.transact_mut().apply_update(update);
            }
        }
        
        // Apply new updates
        let mut last_update_id = 0i64;
        for update in &updates {
            let yjs_update = yrs::Update::decode_v1(&update.update_data)?;
            doc.transact_mut().apply_update(yjs_update);
            last_update_id = update.id;
        }
        
        // 4. Generate new compacted state
        let new_base_state = doc.transact().encode_state_as_update_v1(&StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();
        
        // 5. Save new base state
        sqlx::query!(
            r#"
            INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (script_id) 
            DO UPDATE SET 
                base_state = EXCLUDED.base_state,
                state_vector = EXCLUDED.state_vector,
                last_compacted_update_id = EXCLUDED.last_compacted_update_id,
                update_count = EXCLUDED.update_count,
                document_size = EXCLUDED.document_size,
                compacted_at = NOW()
            "#,
            script_id,
            new_base_state,
            state_vector,
            last_update_id,
            updates.len() as i32,
            new_base_state.len() as i32
        )
        .execute(&mut *tx)
        .await?;
        
        // 6. Mark updates as compacted (soft delete)
        sqlx::query!(
            "UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1 AND id <= $2",
            script_id,
            last_update_id
        )
        .execute(&mut *tx)
        .await?;
        
        // 7. Log compaction
        let duration_ms = start.elapsed().as_millis() as i32;
        sqlx::query!(
            r#"
            INSERT INTO yjs_compaction_log (script_id, updates_compacted, size_before, size_after, duration_ms)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            script_id,
            updates.len() as i32,
            updates.iter().map(|u| u.update_data.len() as i32).sum::<i32>(),
            new_base_state.len() as i32,
            duration_ms
        )
        .execute(&mut *tx)
        .await?;
        
        // Commit transaction
        tx.commit().await?;
        
        info!(
            "Compacted script {} - {} updates into {} bytes in {}ms",
            script_id,
            updates.len(),
            new_base_state.len(),
            duration_ms
        );
        
        Ok(())
    }
}

/// Public function to load a document efficiently
pub async fn load_document(pool: &PgPool, script_id: Uuid) -> Result<Doc, anyhow::Error> {
    // 1. Load base state
    let base = sqlx::query!(
        "SELECT base_state FROM yjs_base_states WHERE script_id = $1",
        script_id
    )
    .fetch_optional(pool)
    .await?;
    
    // 2. Load recent uncompacted updates
    let recent_updates = sqlx::query!(
        r#"
        SELECT update_data 
        FROM yjs_recent_updates 
        WHERE script_id = $1 AND is_compacted = false
        ORDER BY id ASC
        "#,
        script_id
    )
    .fetch_all(pool)
    .await?;
    
    // 3. Reconstruct document
    let doc = Doc::new();
    
    // Apply base if exists
    if let Some(base) = base {
        if !base.base_state.is_empty() {
            let update = yrs::Update::decode_v1(&base.base_state)?;
            doc.transact_mut().apply_update(update);
        }
    }
    
    // Apply recent updates
    for update in recent_updates {
        let yjs_update = yrs::Update::decode_v1(&update.update_data)?;
        doc.transact_mut().apply_update(yjs_update);
    }
    
    Ok(doc)
}
```

### 2.3 Update WebSocket Handler

Modify `backend/src/networking/websocket.rs`:

```rust
// Remove the 500ms snapshot trigger completely!
// Just save updates and broadcast

async fn handle_binary_message(
    bin: Vec<u8>,
    script_id: &str,
    session_id: &str,
    persistence_tx: &TokioMpscSender<YjsPersistenceEvent>,
) -> Result<(), anyhow::Error> {
    // Critical: Filter sync messages
    if !bin.is_empty() && bin[0] == 0x00 {
        debug!("Skipping YJS sync protocol message");
        return Ok(());
    }
    
    // Only persist content updates
    if !is_awareness_update(&bin) {
        persistence_tx.send(YjsPersistenceEvent {
            script_id: script_id.to_string(),
            update_data: bin.clone(),
            user_id: Some(user_id),
            received_at: Utc::now(),
        }).await?;
    }
    
    // Always broadcast for real-time sync
    broadcast_to_sessions(&bin, script_id, session_id).await;
    
    Ok(())
}
```

### 2.4 Remove Old Services

Delete or disable:
- `backend/src/services/snapshotting_service_v2.rs` - REMOVE ENTIRELY
- `backend/src/domain/snapshot/` - REMOVE ENTIRE DIRECTORY
- `backend/src/repositories/snapshot_repository.rs` - REMOVE

### 2.5 Update Service Manager

Modify `backend/src/core/service_manager.rs`:

```rust
pub async fn start_services(pool: Arc<PgPool>) {
    // Remove snapshot service
    // tokio::spawn(run_snapshotting_service(pool.clone(), Duration::from_millis(500))); // DELETE THIS
    
    // Add compaction service
    let compaction_service = Arc::new(CompactionService::new(pool.clone()));
    tokio::spawn(async move {
        compaction_service.run().await;
    });
    
    // Keep async DB writer for saving updates
    // ... existing code ...
}
```

## Phase 3: API Changes (Week 2)

### 3.1 Update Script Loading Endpoint

Modify `backend/src/application/script_application_service.rs`:

```rust
pub async fn get_script_with_blocks(
    &self,
    script_id: Uuid,
    user_id: Uuid,
) -> Result<ScriptWithYjs, AppError> {
    // Check access
    if !self.check_script_access(script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }
    
    // Load script metadata
    let script = self.get_script(script_id).await?;
    
    // Load YJS document efficiently
    let doc = load_document(self.pool.as_ref(), script_id).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load document: {}", e)))?;
    
    // Extract content for initial render (if needed)
    let content = extract_content_from_yjs(&doc);
    
    Ok(ScriptWithYjs {
        script,
        yjs_state: doc.transact().encode_state_as_update_v1(&StateVector::default()),
        content_preview: content,
    })
}
```

### 3.2 Remove Block-related Endpoints

Remove or deprecate:
- `/api/scripts/:id/blocks` - No longer needed
- `/api/scripts/:id/snapshot` - Remove snapshot endpoints

## Phase 4: Frontend Changes (Week 2)

### 4.1 Update Document Loading

Modify `frontend/src/components/editor/hooks/useEditorCore.ts`:

```typescript
// Change from loading blocks to loading YJS state directly
const loadDocument = async (scriptId: string) => {
    const response = await api.getScriptWithYjs(scriptId);
    
    // Initialize YJS with the base state
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, response.yjs_state);
    
    // Connect WebSocket for real-time sync
    const provider = new WebsocketProvider(
        wsUrl,
        scriptId,
        ydoc
    );
    
    return { ydoc, provider };
};
```

### 4.2 Remove Block Rendering

Update components that render blocks to work directly with YJS document.

## Phase 5: Cleanup & Monitoring (Week 3)

### 5.1 Database Cleanup

```sql
-- After verification (1 week after deployment)
BEGIN;

-- Archive old updates to cold storage
CREATE TABLE yjs_updates_archive AS 
SELECT * FROM yjs_recent_updates WHERE is_compacted = true;

-- Delete compacted updates older than 7 days
DELETE FROM yjs_recent_updates 
WHERE is_compacted = true 
AND created_at < NOW() - INTERVAL '7 days';

-- Drop the blocks table (after confirming everything works)
-- DROP TABLE blocks CASCADE;

-- Drop old snapshot tables
-- DROP TABLE script_snapshots_meta CASCADE;

COMMIT;
```

### 5.2 Add Monitoring

```sql
-- Create monitoring views
CREATE VIEW yjs_health AS
SELECT 
    script_id,
    COUNT(*) FILTER (WHERE NOT is_compacted) as pending_updates,
    MAX(created_at) as last_update,
    pg_size_pretty(SUM(length(update_data))::bigint) as total_size
FROM yjs_recent_updates
GROUP BY script_id;

CREATE VIEW compaction_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as compactions,
    AVG(duration_ms) as avg_duration_ms,
    SUM(updates_compacted) as total_updates_compacted,
    pg_size_pretty(SUM(size_before)::bigint) as size_before,
    pg_size_pretty(SUM(size_after)::bigint) as size_after
FROM yjs_compaction_log
GROUP BY DATE(created_at);
```

### 5.3 Add Alerts

```rust
// Add to compaction service
async fn check_health(&self) {
    // Alert if too many pending updates
    let unhealthy = sqlx::query!(
        r#"
        SELECT script_id, COUNT(*) as count
        FROM yjs_recent_updates
        WHERE is_compacted = false
        GROUP BY script_id
        HAVING COUNT(*) > 5000
        "#
    )
    .fetch_all(self.pool.as_ref())
    .await?;
    
    for script in unhealthy {
        error!("Script {} has {} uncompacted updates!", script.script_id, script.count);
        // Send alert to monitoring system
    }
}
```

## Phase 6: Testing & Rollout (Week 3-4)

### 6.1 Testing Plan

1. **Unit Tests**: Test compaction logic with various document sizes
2. **Integration Tests**: Test full flow from write to compaction to read
3. **Load Tests**: Simulate 30 concurrent users on 100-page documents
4. **Failure Tests**: Test recovery from compaction failures

### 6.2 Rollout Strategy

```yaml
Week 1:
  - Deploy database changes
  - Deploy WebSocket sync message fix
  - Start collecting metrics

Week 2:  
  - Deploy compaction service (read-only mode)
  - Monitor compaction performance
  - Verify compacted states match original

Week 3:
  - Enable compaction writes
  - Switch reads to use compacted states
  - Monitor for issues

Week 4:
  - Remove old snapshot service
  - Clean up old data
  - Full production rollout
```

### 6.3 Rollback Plan

Each phase can be rolled back independently:

```sql
-- Rollback database changes
ALTER TABLE yjs_recent_updates RENAME TO yjs_document_updates;
ALTER TABLE yjs_document_updates DROP COLUMN expires_at;
ALTER TABLE yjs_document_updates DROP COLUMN is_compacted;
DROP TABLE yjs_base_states;
DROP TABLE yjs_compaction_log;
```

## Success Metrics

1. **Performance**
   - Document load time < 200ms (currently 30s+)
   - Memory usage < 100MB per document (currently 15GB)
   - CPU usage reduced by 80%

2. **Reliability**
   - Zero data loss incidents
   - 99.9% uptime for document access
   - Successful recovery from all failure modes

3. **Storage**
   - 90% reduction in storage size
   - Automatic cleanup of old data
   - Predictable growth patterns

## Risk Mitigation

1. **Data Loss Prevention**
   - Keep all data for 7 days minimum
   - Archive before deletion
   - Incremental rollout with monitoring

2. **Performance Issues**
   - Test with production-size documents
   - Add circuit breakers to compaction
   - Rate limit compaction operations

3. **Compatibility**
   - Keep old endpoints during transition
   - Version API responses
   - Gradual frontend migration

## Timeline Summary

- **Week 0**: Fix critical sync message bug (IMMEDIATE)
- **Week 1**: Database changes + backend core
- **Week 2**: API updates + frontend changes  
- **Week 3**: Testing + monitoring
- **Week 4**: Full rollout + cleanup

## Conclusion

This refactor will:
1. Eliminate data loss completely
2. Reduce memory usage by 99%
3. Improve performance by 100x
4. Simplify the codebase significantly
5. Enable reliable real-time collaboration

The key is moving from a dual-source, polling-based system to a single-source, event-driven architecture with smart compaction.