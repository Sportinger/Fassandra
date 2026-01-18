# AI Format Chunking Implementation Plan

## Problem Statement

Large documents (~100k chars) timeout after 5 minutes when processing with Claude CLI. Even with progress feedback, 5 minutes is unacceptable UX.

## Solution Overview

Split document into chunks, process each with Claude CLI, and update the document live as each chunk completes. User watches the document transform in real-time.

## Key Features

1. **Chunking with overlap** - Split document into ~8-10k char chunks with ~1k char overlap for context
2. **Live updates** - Update Yjs document after each chunk completes (user sees progress)
3. **Document locking** - Prevent editing during processing to avoid conflicts
4. **Cancel support** - User can cancel mid-process, document reverts to original
5. **Undo support** - After completion, user can revert to pre-format state

---

## Technical Design

### 1. Document Snapshot (Backup)

Before processing starts, save the current Yjs state:

```rust
// Save current state as backup
let backup_state = doc.transact().encode_state_as_update_v1(&StateVector::default());
// Store in memory or database for later restore
```

**Storage options:**
- In-memory (simplest, lost on restart)
- Database table `yjs_format_backups` (script_id, backup_state, created_at, expires_at)

### 2. Document Chunking

Split the extracted text into manageable chunks:

```rust
fn split_into_chunks(text: &str, chunk_size: usize, overlap: usize) -> Vec<ChunkWithContext> {
    // chunk_size: ~8000-10000 chars
    // overlap: ~1000 chars from previous chunk

    // Returns chunks with:
    // - context: last ~1000 chars of previous chunk (for Claude context)
    // - text: the actual text to parse
    // - is_first: bool (first chunk has no context)
    // - is_last: bool (last chunk marker)
}
```

**Chunk structure:**
```rust
struct ChunkWithContext {
    chunk_index: usize,
    total_chunks: usize,
    context: Option<String>,  // Previous chunk's ending (~1000 chars)
    text: String,             // Text to parse
    is_first: bool,
    is_last: bool,
}
```

### 3. Modified Claude Prompt

Update the prompt to handle chunks with context:

```markdown
You are parsing a CHUNK of a larger script document.

{{#if context}}
---CONTEXT (previous chunk ending, DO NOT re-parse, for reference only)---
{{context}}
---END CONTEXT---
{{/if}}

---PARSE THE FOLLOWING TEXT---
{{text}}
---END TEXT---

{{#if is_first}}
This is the FIRST chunk. Start scene numbering from 1.
{{else}}
Continue from previous chunk. If the text starts mid-dialogue,
the speaker from context is still speaking.
Previous chunk ended at scene number: {{previous_scene_number}}
{{/if}}

Return JSON for ONLY the text between ---PARSE--- markers.
```

### 4. Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Format with AI"                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. Backend: Save Yjs snapshot (backup)                          │
├─────────────────────────────────────────────────────────────────┤
│ 3. Backend: Extract text, split into chunks                     │
├─────────────────────────────────────────────────────────────────┤
│ 4. Backend: Send SSE stream to frontend with status             │
├─────────────────────────────────────────────────────────────────┤
│ 5. For each chunk:                                              │
│    a. Check if cancelled → if yes, restore backup & exit        │
│    b. Send SSE: "Processing chunk N/M..."                       │
│    c. Call Claude CLI with chunk + context                      │
│    d. Parse JSON response                                       │
│    e. Append parsed content to Yjs document                     │
│    f. Send SSE: "Chunk N complete"                              │
│    g. Track last scene number for next chunk                    │
├─────────────────────────────────────────────────────────────────┤
│ 6. On completion:                                               │
│    a. Send SSE: "complete"                                      │
│    b. Keep backup available for undo                            │
├─────────────────────────────────────────────────────────────────┤
│ 7. On cancel:                                                   │
│    a. Kill Claude CLI process                                   │
│    b. Restore from backup                                       │
│    c. Send SSE: "cancelled"                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 5. API Changes

**New endpoint structure** (change from simple POST to SSE):

```
POST /api/s/:script_id/ai-format-stream
Returns: Server-Sent Events stream

Events:
- { "type": "started", "total_chunks": 5, "backup_id": "uuid" }
- { "type": "chunk_started", "chunk": 1, "total": 5 }
- { "type": "chunk_complete", "chunk": 1, "total": 5, "items_parsed": 15 }
- { "type": "complete", "total_items": 73 }
- { "type": "error", "message": "...", "chunk": 2 }
- { "type": "cancelled" }
```

**Cancel endpoint:**
```
POST /api/s/:script_id/ai-format-cancel
Body: { "backup_id": "uuid" }
```

**Undo endpoint:**
```
POST /api/s/:script_id/ai-format-undo
Body: { "backup_id": "uuid" }
```

### 6. Frontend Changes

**AIFormatModal updates:**

```typescript
// States
type ProcessingState =
  | { status: 'idle' }
  | { status: 'processing', chunk: number, total: number, backupId: string }
  | { status: 'complete', backupId: string }
  | { status: 'cancelled' }
  | { status: 'error', message: string };

// SSE listener for progress
const eventSource = new EventSource(`/api/s/${scriptId}/ai-format-stream`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI based on event type
};

// Cancel handler
const handleCancel = async () => {
  await apiService.post(`/api/s/${scriptId}/ai-format-cancel`, { backup_id: backupId });
  eventSource.close();
};

// Undo handler (available after completion)
const handleUndo = async () => {
  await apiService.post(`/api/s/${scriptId}/ai-format-undo`, { backup_id: backupId });
};
```

**Document locking:**
- When processing starts, set `isLocked: true` in editor state
- Pass to TipTap editor: `editable={!isLocked}`
- Show lock indicator in UI

### 7. Yjs Incremental Updates

Instead of replacing the entire document at the end, append content after each chunk:

```rust
// After each chunk is processed
fn append_chunk_to_yjs(
    doc: &Doc,
    parsed_content: &[ContentItem],
    chunk_index: usize,
) -> Result<(), AppError> {
    let mut txn = doc.transact_mut();
    let fragment = txn.get_or_insert_xml_fragment("default");

    // If first chunk, clear existing content
    if chunk_index == 0 {
        // Clear fragment
    }

    // Append new content items
    for item in parsed_content {
        // Add scene/dialogue/stage_direction elements
    }

    // Encode and broadcast update via WebSocket
}
```

---

## File Changes Required

### Backend

1. **`backend/src/handlers/script_upload_handler.rs`**
   - Add `ai_format_stream` handler (SSE endpoint)
   - Add `ai_format_cancel` handler
   - Add `ai_format_undo` handler
   - Add `split_into_chunks` function
   - Add `save_backup` / `restore_backup` functions
   - Modify `call_claude_for_parsing` to accept chunk context

2. **`backend/src/handlers/script.rs`**
   - Register new routes

3. **`backend/src/services/prompt_text_parser.md`**
   - Update prompt template for chunk processing with context

4. **Database migration (optional)**
   - Add `yjs_format_backups` table if using DB storage

### Frontend

1. **`frontend/src/components/editor/components/AIFormatModal/index.tsx`**
   - Add SSE listener for progress updates
   - Add cancel button and handler
   - Add undo button (after completion)
   - Show chunk progress (1/5, 2/5, etc.)

2. **`frontend/src/components/editor/components/EditorView.tsx`**
   - Add `isLocked` state
   - Pass to editor `editable` prop

3. **`frontend/src/components/editor/components/Editor.tsx`**
   - Handle locked state from parent

---

## Implementation Order

### Phase 1: Backend Chunking + SSE
1. [ ] Implement `split_into_chunks` function
2. [ ] Update prompt template for chunks
3. [ ] Create `ai_format_stream` SSE endpoint
4. [ ] Add backup save/restore functions
5. [ ] Add cancel endpoint
6. [ ] Test with curl/httpie

### Phase 2: Frontend Progress UI
7. [ ] Add SSE listener in AIFormatModal
8. [ ] Show chunk progress (1/5, 2/5...)
9. [ ] Add cancel button
10. [ ] Test cancel flow

### Phase 3: Document Locking
11. [ ] Add locked state to editor
12. [ ] Disable editing when locked
13. [ ] Show lock indicator

### Phase 4: Undo Support
14. [ ] Add undo endpoint
15. [ ] Add undo button in UI (after completion)
16. [ ] Test undo flow

### Phase 5: Testing & Polish
17. [ ] Test with small document
18. [ ] Test with large document
19. [ ] Test cancel mid-process
20. [ ] Test undo after completion
21. [ ] Error handling edge cases

---

## Open Questions

1. **Backup storage**: Memory vs Database? (recommend: start with memory, add DB later if needed)
2. **Backup expiration**: How long to keep undo available? (recommend: until page refresh or 30 minutes)
3. **Chunk size tuning**: Start with 8000 chars, adjust based on testing
4. **Parallel chunks**: Process chunks in parallel? (recommend: sequential first, parallel as optimization)

---

## Success Criteria

- [ ] Large documents (100k chars) process successfully without timeout
- [ ] User sees live progress as chunks complete
- [ ] User can cancel at any time and document reverts cleanly
- [ ] User can undo formatting after completion
- [ ] No data loss in any scenario
