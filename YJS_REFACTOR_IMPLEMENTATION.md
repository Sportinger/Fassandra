# YJS Refactor - Implementation Tasks

## Overview
Complete refactor of YJS snapshot system to fix data loss and memory issues. Moving from dual-source polling system to single-source event-driven architecture with compaction.

## Implementation Order

### Task 1: Critical Bug Fix [IMMEDIATE]
Fix sync message persistence bug causing memory explosions.

**File:** `backend/src/networking/websocket.rs`
**Line:** ~404
```rust
// CHANGE FROM:
if msg_type == 0x00 {
    false // Don't persist sync messages
}

// TO:
if msg_type == 0x00 {  // YJS sync protocol messages
    tracing::debug!("[WS_SYNC_PROTOCOL] Skipping sync message");
    return; // Skip entire processing for sync messages
} else if msg_type == 0x01 || msg_type == 0x02 {  // Actual updates
    should_persist = true;   // Only persist content updates
}
```

### Task 2: Database Migration
Create new tables and prepare for migration.

**File:** `backend/migrations/[timestamp]_yjs_compaction_refactor.sql`
```sql
-- Create compaction tables
CREATE TABLE yjs_base_states (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    base_state BYTEA NOT NULL,
    state_vector BYTEA NOT NULL,
    compacted_at TIMESTAMPTZ DEFAULT NOW(),
    last_compacted_update_id BIGINT,
    update_count INT DEFAULT 0,
    document_size INT DEFAULT 0
);

-- Modify existing table
ALTER TABLE yjs_document_updates RENAME TO yjs_recent_updates;

ALTER TABLE yjs_recent_updates 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
ADD COLUMN IF NOT EXISTS is_compacted BOOLEAN DEFAULT FALSE;

-- Add indexes
CREATE INDEX idx_yjs_recent_expires ON yjs_recent_updates(expires_at) WHERE NOT is_compacted;
CREATE INDEX idx_yjs_recent_script_uncompacted ON yjs_recent_updates(script_id, id) WHERE NOT is_compacted;

-- Audit log
CREATE TABLE yjs_compaction_log (
    id SERIAL PRIMARY KEY,
    script_id UUID NOT NULL,
    updates_compacted INT NOT NULL,
    size_before INT NOT NULL,
    size_after INT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize base states for existing scripts
INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id)
SELECT DISTINCT script_id, '\x00'::bytea, '\x00'::bytea, 0
FROM yjs_recent_updates
ON CONFLICT DO NOTHING;
```

### Task 3: Create Compaction Service
New service to handle YJS compaction.

**File:** `backend/src/services/yjs_compaction_service.rs`
```rust
// Full implementation as per plan
// Key functions:
// - run() - Main service loop
// - find_scripts_needing_compaction()
// - compact_script()
// - load_document() - Public function for loading
```

### Task 4: Update Async DB Writer
Change table name and add expiry.

**File:** `backend/src/services/async_db_writer.rs`
**Changes:**
- Replace `yjs_document_updates` with `yjs_recent_updates`
- Add `expires_at` field to INSERT

### Task 5: Remove Snapshot Service
Delete unnecessary files and references.

**Delete:**
- `backend/src/services/snapshotting_service_v2.rs`
- `backend/src/domain/snapshot/` (entire directory)
- `backend/src/repositories/snapshot_repository.rs`

**Update:** `backend/src/services/mod.rs`
- Remove snapshot service exports
- Add compaction service export

### Task 6: Update Service Manager
Replace snapshot service with compaction service.

**File:** `backend/src/core/service_manager.rs`
```rust
// REMOVE:
// tokio::spawn(run_snapshotting_service(pool.clone(), Duration::from_millis(500)));

// ADD:
let compaction_service = Arc::new(CompactionService::new(pool.clone()));
tokio::spawn(async move {
    compaction_service.run().await;
});
```

### Task 7: Update Script Application Service
Change how scripts are loaded.

**File:** `backend/src/application/script_application_service.rs`
**Function:** `get_script_with_blocks()`
```rust
// Change to use load_document() from compaction service
// Return YJS state instead of blocks
```

### Task 8: Update API Endpoints
Modify script loading endpoint.

**File:** `backend/src/core/server.rs`
- Update `get_script_with_blocks_wrapper` to return YJS state
- Remove snapshot endpoints

### Task 9: Frontend API Updates
Update API client to handle new response format.

**File:** `frontend/src/api.ts`
```typescript
// Change getScriptWithBlocks to getScriptWithYjs
export const getScriptWithYjs = async (scriptId: string): Promise<ScriptWithYjs> => {
    return apiCache.cachedFetch(
        `/api/scripts/${scriptId}`,
        () => apiService.get(`/api/scripts/${scriptId}`, { scriptId }),
        { ttl: CACHE_CONFIG.scripts.detail }
    );
};
```

### Task 10: Frontend Editor Updates
Update editor to load YJS state directly.

**File:** `frontend/src/components/editor/hooks/useEditorCore.ts`
```typescript
// Update loadDocument to use YJS state from API
// Remove block-based initialization
```

### Task 11: Database Cleanup
Remove old tables and data after verification.

**File:** `backend/migrations/[timestamp]_cleanup_old_snapshot_system.sql`
```sql
-- Only run after verification!
-- Archive old data first
CREATE TABLE blocks_archive AS SELECT * FROM blocks;
CREATE TABLE script_snapshots_meta_archive AS SELECT * FROM script_snapshots_meta;

-- Drop old tables
DROP TABLE blocks CASCADE;
DROP TABLE script_snapshots_meta CASCADE;

-- Clean up compacted updates
DELETE FROM yjs_recent_updates 
WHERE is_compacted = true 
AND created_at < NOW() - INTERVAL '7 days';
```

### Task 12: Add Monitoring
Create monitoring views and health checks.

**File:** `backend/migrations/[timestamp]_add_monitoring.sql`
```sql
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
    SUM(updates_compacted) as total_updates_compacted
FROM yjs_compaction_log
GROUP BY DATE(created_at);
```

## Testing Commands

```bash
# Run migrations
cd backend
sqlx migrate run

# Test compaction service
cargo test yjs_compaction

# Test full flow
npm run test:integration

# Monitor health
psql -c "SELECT * FROM yjs_health WHERE pending_updates > 100;"
```

## Verification Checklist

- [ ] Sync messages no longer saved to DB
- [ ] Compaction runs every 5 minutes
- [ ] Documents load in < 200ms
- [ ] Memory usage stays under 100MB
- [ ] No data loss on abrupt disconnection
- [ ] WebSocket still syncs in real-time
- [ ] Old updates get compacted
- [ ] Compacted updates get cleaned up

## Rollback Commands

```bash
# If issues arise, rollback:
cd backend
sqlx migrate revert

# Restore old service
git checkout HEAD -- backend/src/services/snapshotting_service_v2.rs
git checkout HEAD -- backend/src/domain/snapshot/

# Restart services
docker-compose restart backend
```

## Notes

- Start with Task 1 (critical bug fix) - can be deployed immediately
- Tasks 2-6 can be done in parallel
- Tasks 7-10 must be done together (API contract change)
- Task 11 only after 1 week of stable operation
- Keep backups of all data before Task 11