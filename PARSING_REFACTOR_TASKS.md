# Direct YJS Parsing Implementation Tasks

## Overview
Direct implementation without backward compatibility. We can break things and rebuild them properly.

## Task List

### Task 1: Complete YJS Refactor Infrastructure
**Dependencies**: None
**Files**: As per YJS_REFACTOR_IMPLEMENTATION.md Tasks 1-6
- [ ] Fix sync message bug (Task 1)
- [ ] Run database migration for YJS tables (Task 2)
- [ ] Deploy compaction service (Tasks 3-6)
- [ ] Remove snapshot service completely

### Task 2: Drop Block-based System
**Dependencies**: Task 1
**Actions**:
- [ ] Backup existing blocks table (just in case)
- [ ] Drop blocks table and related tables
- [ ] Remove block_repository.rs
- [ ] Remove all block-related models
- [ ] Remove convertBlocksToTiptapContent from frontend

### Task 3: Create YJS Document Builder Service
**Dependencies**: Task 1
**File**: `backend/src/services/yjs_document_builder.rs`
```rust
pub struct YjsDocumentBuilder {
    doc: Y.Doc,
    
    pub fn new(script_id: Uuid) -> Self;
    pub fn set_metadata(title, author, pages) -> Self;
    pub fn add_scene(number, title, page) -> Self;
    pub fn add_dialogue(speaker, text, page) -> Self;
    pub fn add_stage_direction(text, page) -> Self;
    pub fn add_chunk(json: ScriptChunk) -> Self;
    pub fn build() -> Vec<u8>; // Returns YJS update
}
```

### Task 4: Rewrite json_to_db_service.rs
**Dependencies**: Task 3
**New Name**: `yjs_script_builder_service.rs`
**Changes**:
```rust
// OLD: Inserts blocks into database
// NEW: Creates YJS document and stores in yjs_base_states

pub async fn build_script_from_json(
    json: &str,
    script_id: Uuid,
    username: &str
) -> Result<()> {
    // 1. Parse JSON
    // 2. Create YJS document using builder
    // 3. Store initial state in yjs_base_states
    // 4. Return success
}
```

### Task 5: Update Claude Prompt for Chunking
**Dependencies**: None
**File**: `backend/src/services/prompt.md`
**Add**:
```markdown
## Chunked Parsing Mode

For scripts > 10 pages, process in chunks:

### Chunk Output Format:
```json
{
  "mode": "chunked",
  "chunk": {
    "number": 1,
    "total": 5,
    "pages_start": 1,
    "pages_end": 10
  },
  "metadata": {
    // Only in first chunk
    "title": "Script Title",
    "total_pages": 50
  },
  "content": [
    // Same format as before
  ],
  "context": {
    // Carry forward to next chunk
    "last_scene": "1",
    "last_speaker": "CHARACTER"
  }
}
```

Output after each chunk: `[CHUNK_COMPLETE] Chunk 1/5 done`
Final output: "iam done with my job rom"
```

### Task 6: Create Chunked Parsing Orchestrator
**Dependencies**: Tasks 4, 5
**File**: `backend/src/services/chunked_parsing_orchestrator.rs`
```rust
pub struct ChunkedParsingOrchestrator {
    pub async fn parse_script(
        pdf_path: &str,
        username: &str,
        session_id: Uuid
    ) -> Result<Uuid> {
        let script_id = Uuid::new_v4();
        
        // 1. Initialize YJS document with metadata
        // 2. Loop through chunks
        // 3. For each chunk:
        //    - Call Claude with chunk range
        //    - Parse response
        //    - Apply as YJS update
        //    - Update progress
        // 4. Compact when done
        
        script_id
    }
}
```

### Task 7: Modify Claude Session Service
**Dependencies**: Task 6
**File**: `backend/src/services/claude_session_service.rs`
**Changes**:
- Replace direct json_to_db calls with orchestrator
- Add chunk progress tracking
- Update progress callbacks for chunks

### Task 8: Update Frontend to Load YJS Directly
**Dependencies**: Tasks 1-7 backend complete
**Files**: 
- `frontend/src/api.ts`
- `frontend/src/components/editor/hooks/useEditorCore.ts`

```typescript
// api.ts - Change from blocks to YJS
export const getScriptYjsState = async (scriptId: string): Promise<Uint8Array> => {
    const response = await apiService.get(`/api/scripts/${scriptId}/yjs`);
    return response.data;
};

// useEditorCore.ts - Load YJS state directly
if (isYDocEmpty(doc)) {
    const yjsState = await getScriptYjsState(scriptId);
    Y.applyUpdate(doc, yjsState);
}
```

### Task 9: Handle Script Loading Without Blocks
**Dependencies**: Task 8
**Changes**:
- Update script_application_service.rs `get_script_with_blocks`
- Return YJS state instead of blocks
- Frontend applies YJS updates directly

### Task 10: Create Direct YJS API Endpoints
**Dependencies**: Task 9
**File**: `backend/src/core/server.rs`
```rust
// New endpoints
GET /api/scripts/:id/yjs -> Returns base YJS state
GET /api/scripts/:id/updates?since=X -> Returns recent updates
POST /api/scripts/:id/compact -> Trigger manual compaction
```

### Task 11: Add Chunked Parsing Status Endpoint
**Dependencies**: Task 6
**Endpoint**: `GET /api/parsing/:session_id/status`
```json
{
  "session_id": "...",
  "script_id": "...",
  "status": "processing",
  "chunks_completed": 3,
  "chunks_total": 10,
  "pages_processed": 30,
  "pages_total": 100,
  "current_chunk": 4,
  "errors": []
}
```

### Task 12: Test with Various Script Sizes
**Dependencies**: All previous tasks
**Test Cases**:
- [ ] Small script (< 10 pages) - single chunk
- [ ] Medium script (50 pages) - 5 chunks
- [ ] Large script (200+ pages) - 20+ chunks
- [ ] Script with parsing errors mid-chunk
- [ ] Interrupted parsing (kill Claude mid-process)

### Task 13: Clean Up Old Code
**Dependencies**: Task 12 (testing complete)
**Remove**:
- [ ] All block-related code
- [ ] Old snapshot system
- [ ] Block conversion utilities
- [ ] Migration code (no users to migrate)

### Task 14: Update Database Cleanup
**Dependencies**: Task 13
**SQL**:
```sql
-- Final cleanup after verification
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS script_snapshots_meta CASCADE;
DROP TABLE IF EXISTS parsing_metadata CASCADE;

-- Add indexes for YJS tables
CREATE INDEX idx_yjs_base_script_id ON yjs_base_states(script_id);
CREATE INDEX idx_yjs_updates_script_created ON yjs_recent_updates(script_id, created_at);
```

## Implementation Order

### Phase 1: YJS Foundation (Tasks 1-3)
Can start immediately. Sets up YJS infrastructure.

### Phase 2: Parsing Rewrite (Tasks 4-7)
Core parsing logic conversion to YJS.

### Phase 3: Frontend Integration (Tasks 8-11)
Update frontend to work with YJS directly.

### Phase 4: Testing & Cleanup (Tasks 12-14)
Verify everything works, then remove old code.

## Simplified Architecture

```
PDF → Claude Code → JSON Chunks → YJS Updates → Database
                         ↓
                  [Chunk 1] → yjs_recent_updates
                  [Chunk 2] → yjs_recent_updates
                  [Chunk N] → yjs_recent_updates
                         ↓
                  Compaction → yjs_base_states
```

## Key Simplifications

1. **No Migration**: Just drop and rebuild
2. **No Backward Compatibility**: Frontend must be updated
3. **No Parallel Systems**: One way forward
4. **Direct YJS**: Skip blocks entirely
5. **Chunked by Default**: All parsing uses chunks

## Chunk Processing Logic

```rust
async fn process_chunk(chunk_json: &str, script_id: Uuid) -> Result<()> {
    // 1. Parse chunk JSON
    let chunk: ScriptChunk = serde_json::from_str(chunk_json)?;
    
    // 2. Load current YJS document
    let doc = load_or_create_doc(script_id).await?;
    
    // 3. Apply chunk content as YJS operations
    let update = {
        let txn = doc.transact_mut();
        let xml = txn.get_or_insert_xml_fragment("xmlFragment");
        
        for item in chunk.content {
            match item.content_type {
                "dialogue" => add_dialogue_block(&xml, &item),
                "scene" => add_scene_block(&xml, &item),
                // etc...
            }
        }
        
        txn.encode_update_v1()
    };
    
    // 4. Store update
    store_yjs_update(script_id, update).await?;
    
    Ok(())
}
```

## Error Handling Strategy

Since we're parsing in chunks:
1. Each chunk is independent after context
2. Failed chunks can be retried
3. Partial scripts are valid (can edit what's parsed)
4. Manual recovery possible

## Benefits of Direct Implementation

1. **Simpler**: No migration complexity
2. **Cleaner**: No legacy code paths
3. **Faster**: Direct YJS operations
4. **Maintainable**: Single parsing pipeline
5. **Scalable**: Chunked from the start

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Lose existing data | Backup blocks table first |
| Parsing breaks | Test thoroughly before dropping blocks |
| Large scripts fail | Chunking handles memory issues |
| Frontend breaks | Update frontend in same deployment |

## Success Criteria

- [ ] Can parse 200-page script successfully
- [ ] Chunks process incrementally
- [ ] YJS document loads in editor
- [ ] No blocks table in system
- [ ] Memory usage stays under 100MB
- [ ] Parsing progress visible in real-time