# Script Parsing Refactor Plan - YJS Architecture

## Executive Summary
Complete refactor of the PDF parsing pipeline to align with YJS document architecture, eliminating block-based storage and implementing chunked parsing for large scripts.

## Current State Analysis

### Existing Architecture
1. **claude_session_service.rs**: Orchestrates PDF parsing via Claude Code
2. **json_to_db_service.rs**: Inserts parsed JSON into `blocks` table
3. **prompt.md**: Instructions for Claude Code to parse PDFs into JSON
4. **Block-based storage**: Individual database records per content item

### Critical Conflicts with YJS Refactor
- YJS refactor plans to DROP `blocks` table entirely
- New architecture uses binary YJS documents (`yjs_base_states` + `yjs_recent_updates`)
- No conversion mechanism exists between blocks and YJS format
- Frontend expects `xmlFragment` field in YJS document

## New Architecture Design

### Core Components

#### 1. YJS Document Structure
```typescript
// YJS Document Structure for Scripts
{
  xmlFragment: Y.XmlFragment, // Main content (TipTap/ProseMirror format)
  metadata: Y.Map {
    title: string,
    subtitle?: string,
    adaptation_by?: Y.Array<string>,
    created_by: string,
    total_pages: number,
    parsing_status: 'in_progress' | 'completed' | 'failed',
    last_chunk_processed: number
  },
  sections: Y.Array<Y.Map>, // Section metadata
  speakers: Y.Array<string>, // List of all speakers
  parsing_log: Y.Array<string> // Progress and error tracking
}
```

#### 2. Chunked Parsing Strategy

##### Chunk Size Configuration
```rust
pub struct ParsingConfig {
    chunk_size: usize, // Default: 10 pages
    max_retries: u8,   // Default: 3
    timeout_per_chunk: Duration, // Default: 2 minutes
    enable_incremental: bool, // Default: true
}
```

##### Chunk Processing Flow
1. **Initial Parse**: Extract total page count from PDF
2. **Chunk Division**: Split into 10-page chunks
3. **Incremental Processing**: Parse each chunk sequentially
4. **YJS Updates**: Apply each chunk as YJS update
5. **Progress Tracking**: Update metadata after each chunk
6. **Error Recovery**: Retry failed chunks individually

### Implementation Phases

## Phase 1: Infrastructure Setup (Week 1)

### Task 1.1: Create YJS JSON Service
**File**: `backend/src/services/yjs_json_service.rs`
```rust
pub struct YjsJsonService {
    pool: Arc<PgPool>,
    compaction_service: Arc<CompactionService>,
}

impl YjsJsonService {
    // Convert JSON to YJS document
    pub async fn json_to_yjs_document(
        &self,
        json_str: &str,
        script_id: Uuid,
        is_incremental: bool
    ) -> Result<Vec<u8>>;
    
    // Apply incremental update to existing document
    pub async fn apply_json_chunk(
        &self,
        script_id: Uuid,
        chunk_json: &str,
        chunk_number: usize
    ) -> Result<()>;
    
    // Initialize new script document
    pub async fn init_script_document(
        &self,
        script_id: Uuid,
        title: String,
        username: String,
        total_pages: usize
    ) -> Result<()>;
}
```

### Task 1.2: Create Chunked Parser Service
**File**: `backend/src/services/chunked_parser_service.rs`
```rust
pub struct ChunkedParserService {
    yjs_service: Arc<YjsJsonService>,
    config: ParsingConfig,
}

impl ChunkedParserService {
    pub async fn parse_script_chunked(
        &self,
        pdf_path: String,
        username: String,
        session_id: Uuid,
        progress_callback: impl Fn(ParsingProgress)
    ) -> Result<Uuid>;
}
```

### Task 1.3: Update Database Schema
**File**: `backend/migrations/[timestamp]_parsing_refactor.sql`
```sql
-- Add parsing-specific columns to yjs_base_states
ALTER TABLE yjs_base_states 
ADD COLUMN parsing_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN last_chunk_processed INT DEFAULT 0,
ADD COLUMN total_chunks INT DEFAULT 0,
ADD COLUMN parsing_started_at TIMESTAMPTZ,
ADD COLUMN parsing_completed_at TIMESTAMPTZ;

-- Create parsing progress table
CREATE TABLE parsing_progress (
    id SERIAL PRIMARY KEY,
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    chunk_number INT NOT NULL,
    pages_start INT NOT NULL,
    pages_end INT NOT NULL,
    status VARCHAR(20) NOT NULL, -- pending, processing, completed, failed
    retry_count INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(script_id, chunk_number)
);

-- Index for finding next chunk to process
CREATE INDEX idx_parsing_progress_next 
ON parsing_progress(script_id, status, chunk_number);
```

## Phase 2: Claude Code Integration (Week 1-2)

### Task 2.1: Update Claude Prompt
**File**: `backend/src/services/prompt_v2.md`
```markdown
# Enhanced Prompt with Chunking Support

## New Instructions for Chunked Parsing

When parsing large PDFs (>10 pages), use chunked mode:

1. **Initial Analysis**:
   - Extract total page count
   - Identify script metadata (title, author, etc.)
   - Output: `[CHUNK_INIT] Total pages: X, Chunks needed: Y`

2. **Chunk Processing**:
   - Process pages in groups of 10
   - Maintain context between chunks (current scene, speaker)
   - Output format per chunk:
   ```json
   {
     "chunk_number": 1,
     "pages": [1, 10],
     "context": {
       "current_scene": "1",
       "current_speaker": "ALLE"
     },
     "content": [...] // Same format as before
   }
   ```

3. **Progress Reporting**:
   - `[CHUNK_START] Processing chunk X of Y (pages A-B)`
   - `[CHUNK_COMPLETE] Chunk X completed successfully`
   - `[CHUNK_ERROR] Chunk X failed: reason`

4. **Context Preservation**:
   - Track scene/speaker state between chunks
   - Include context in next chunk request
```

### Task 2.2: Update Claude Session Service
**File**: `backend/src/services/claude_session_service.rs`
```rust
// Add chunk management to session service
impl ClaudeSessionService {
    pub async fn start_chunked_session(
        &self,
        pdf_path: String,
        username: String,
        chunk_size: usize,
        update_callback: impl Fn(Uuid, SessionUpdate)
    ) -> Result<Uuid>;
    
    async fn process_chunk(
        &self,
        session_id: Uuid,
        chunk_number: usize,
        pages: (usize, usize),
        context: Option<ChunkContext>
    ) -> Result<ChunkResult>;
}
```

## Phase 3: JSON to YJS Conversion (Week 2)

### Task 3.1: Content Converter
**File**: `backend/src/services/json_to_yjs_converter.rs`
```rust
pub struct JsonToYjsConverter {
    // Convert script JSON to TipTap/ProseMirror format
    pub fn convert_to_tiptap(&self, json: &ScriptData) -> Result<String>;
    
    // Create YJS updates from TipTap content
    pub fn create_yjs_updates(&self, content: &str) -> Result<Vec<u8>>;
}
```

### Task 3.2: TipTap Format Generator
```rust
// Generate TipTap-compatible JSON structure
fn generate_tiptap_block(content_item: &ContentItem) -> serde_json::Value {
    match content_item.content_type.as_str() {
        "dialogue" => json!({
            "type": "dialogueBlock",
            "attrs": {
                "speaker": content_item.speaker,
                "pageNumber": content_item.page_number
            },
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": content_item.line
                }]
            }]
        }),
        "scene" => json!({
            "type": "sceneBlock",
            "attrs": {
                "sceneNumber": content_item.scene_number,
                "sceneTitle": content_item.scene_title,
                "pageNumber": content_item.page_number
            }
        }),
        // ... other block types
    }
}
```

## Phase 4: Incremental Updates (Week 2-3)

### Task 4.1: Incremental YJS Updates
```rust
impl YjsJsonService {
    pub async fn append_chunk_to_document(
        &self,
        script_id: Uuid,
        chunk_content: Vec<ContentItem>,
        chunk_metadata: ChunkMetadata
    ) -> Result<()> {
        // 1. Load current document state
        let doc = self.load_document(script_id).await?;
        
        // 2. Apply chunk as YJS update
        let update = self.create_update_from_chunk(chunk_content)?;
        
        // 3. Store in yjs_recent_updates
        self.store_update(script_id, update).await?;
        
        // 4. Update metadata
        self.update_parsing_progress(script_id, chunk_metadata).await?;
        
        Ok(())
    }
}
```

### Task 4.2: Real-time Progress Updates
```rust
// WebSocket notification for progress
pub struct ParsingProgress {
    script_id: Uuid,
    chunk_current: usize,
    chunk_total: usize,
    pages_processed: usize,
    pages_total: usize,
    status: ParsingStatus,
    estimated_time_remaining: Duration,
}
```

## Phase 5: Error Recovery & Resilience (Week 3)

### Task 5.1: Chunk-level Error Recovery
```rust
impl ChunkedParserService {
    async fn handle_chunk_failure(
        &self,
        script_id: Uuid,
        chunk_number: usize,
        error: Error
    ) -> Result<RecoveryAction> {
        // 1. Log error to parsing_progress
        // 2. Determine if retryable
        // 3. If retryable and under retry limit, retry chunk
        // 4. If not retryable, mark as failed and continue
        // 5. Allow manual retry later
    }
}
```

### Task 5.2: Partial Script Recovery
```rust
// Allow continuing from last successful chunk
pub async fn resume_parsing(
    &self,
    script_id: Uuid,
    from_chunk: Option<usize>
) -> Result<()>;
```

## Phase 6: Migration & Cleanup (Week 3-4)

### Task 6.1: Block to YJS Migration Script
**File**: `backend/src/bin/migrate_blocks_to_yjs.rs`
```rust
// One-time migration for existing scripts
async fn migrate_script(script_id: Uuid) -> Result<()> {
    // 1. Load all blocks
    // 2. Convert to TipTap format
    // 3. Create YJS document
    // 4. Store in yjs_base_states
    // 5. Mark migration complete
}
```

### Task 6.2: Gradual Migration Strategy
1. Run new system in parallel with old
2. New scripts use YJS
3. Old scripts migrated on-demand
4. Background migration for inactive scripts
5. Verify data integrity
6. Remove block tables after full migration

## Implementation Order

### Week 1: Foundation
1. Create YJS JSON service
2. Update database schema
3. Create chunked parser service
4. Update Claude prompt for chunking

### Week 2: Core Functionality
1. Implement JSON to YJS conversion
2. Update claude_session_service
3. Create incremental update mechanism
4. Test with small scripts

### Week 3: Robustness
1. Implement error recovery
2. Add resume capability
3. Create progress tracking UI
4. Test with large scripts (>100 pages)

### Week 4: Migration
1. Create migration scripts
2. Run parallel systems
3. Migrate existing scripts
4. Performance testing
5. Documentation

## Testing Strategy

### Unit Tests
- JSON to YJS conversion
- Chunk processing logic
- Error recovery mechanisms

### Integration Tests
- End-to-end parsing with chunks
- Resume after failure
- Concurrent parsing sessions

### Performance Tests
- Large script parsing (500+ pages)
- Multiple concurrent sessions
- Memory usage monitoring

## Rollback Plan

1. Keep blocks table during transition
2. Feature flag for YJS parsing
3. Ability to regenerate blocks from YJS
4. Backup all data before migration
5. Staged rollout by user group

## Success Metrics

- Parse 100-page script in < 5 minutes
- Resume parsing after failure within 10 seconds
- Memory usage < 100MB per script
- Support 10 concurrent parsing sessions
- 99% parsing success rate

## Open Questions

1. Should we support custom chunk sizes per script?
2. How to handle PDF extraction errors mid-chunk?
3. Should parsing history be retained indefinitely?
4. How to handle script updates/re-parsing?
5. Integration with existing thumbnail generation?

## Next Steps

1. Review and approve plan
2. Set up development branch
3. Begin Phase 1 implementation
4. Create test PDF corpus
5. Define acceptance criteria