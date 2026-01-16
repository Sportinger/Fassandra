# Import Functionality Refactor

**Started:** 2026-01-16

## Goal

Rebuild the document import functionality step by step.

## Important Rules

1. **Do NOT delete any existing components** - even if they seem unused temporarily
2. **Work incrementally** - one step at a time
3. **Keep for future use:**
   - Claude parsing (`claude_session_service.rs`)
   - Prompt file (`prompt.md`)
   - JSON memory script (`json_mem.sh`)
   - Any other parsing/processing logic

## Plan

We will likely use a **different approach and flow** than the current implementation. The architecture below is just for reference of what exists today - not what we're building toward.

### New Target Flow (Simple)

```
Upload PDF
    ↓
Backend extracts raw text (using pdftotext)
    ↓
Create new script + store text as Yjs document (plain paragraphs)
    ↓
Discard PDF (don't keep original)
    ↓
Editor opens with the raw text
```

### Key Decisions

- **One script per PDF** - each upload creates a new script/document
- **Don't keep original PDF** - extract text then discard
- **Raw text only** - no parsing into scenes/dialogue (for now)
- **Reuse existing Yjs storage** - just store as simple paragraphs
- **Text extraction tool:** `pdftotext` (poppler-utils)

### What We Keep (for future use)
- Claude parsing service
- prompt.md
- JSON scripts
- Complex document structure logic

### What We Skip (for now)
- PDF chunking into 5-page parts
- Claude AI parsing
- JSON schemas
- Scene/dialogue/stage direction structure

### REMINDER: Do NOT Delete Existing Code

During implementation, **do not delete any existing components**. We may reuse them or need them for reference. Skip over them, work around them, but keep them in place.

**Especially important to keep:**
- `backend/src/services/prompt.md` - The Claude parsing prompt. We WILL add Claude parsing back in the future to structure the raw text into scenes/dialogue/stage directions. This prompt is essential for that.

---

## Current Architecture (Reference - NOT the target)

### Flow
```
User Upload (PDF)
    ↓
ScriptUploader validation (frontend)
    ↓
POST /api/s/upload-pdf
    ↓
Save PDF + Split into 5-page chunks
    ↓
Start Claude Session
    ↓
Claude CLI: Parse chunks → JSON
    ↓
Accumulate JSON: /tmp/script_data.json
    ↓
Run yjs_to_db: Convert JSON → Yjs updates
    ↓
Store in database (scripts, yjs_base_states, yjs_recent_updates)
    ↓
Frontend: WebSocket/polling tracks progress
    ↓
Editor loads the document
```

### Key Files

| Component | Location |
|-----------|----------|
| Upload modal UI | `frontend/src/components/ScriptUploader.tsx` |
| Upload list/handler | `frontend/src/components/scripts/ScriptList/index.tsx` |
| Backend upload endpoint | `backend/src/handlers/script_upload_handler.rs` |
| PDF splitter | `backend/scripts/split_pdf.sh` |
| Claude session service | `backend/src/services/claude_session_service.rs` |
| Parsing prompt | `backend/src/services/prompt.md` |
| JSON accumulator | `backend/json_mem.sh` |
| DB import script | `backend/yjs_to_db.sh` |
| Yjs builder service | `backend/src/services/yjs_script_builder_service.rs` |

### Database Tables
- `scripts` - metadata (title, author, etc.)
- `yjs_base_states` - compacted document state
- `yjs_recent_updates` - incremental changes

## Progress

### Step 1: Simple PDF Import (DONE - 2026-01-16)

**Backend changes:**
- Added new endpoint: `POST /api/s/upload-pdf-simple`
- File: `backend/src/handlers/script_upload_handler.rs`
  - Added `SimpleUploadResponse` struct
  - Added `upload_pdf_simple()` handler function
  - Added `create_simple_yjs_document()` helper function
- File: `backend/src/handlers/script.rs`
  - Added route for `/upload-pdf-simple`
  - Imported `upload_pdf_simple` from script_upload_handler

**Frontend changes:**
- File: `frontend/src/components/scripts/ScriptList/index.tsx`
  - Added `performSimpleUpload()` function
  - Modified `addUploadPlaceholder` to use simple upload instead of Claude upload

**How it works:**
1. User uploads PDF via the UI
2. Backend receives PDF, extracts text using `pdftotext -layout`
3. Creates script record in `scripts` table
4. Creates Yjs document with plain paragraphs in `yjs_base_states` table
5. Deletes the PDF file
6. Returns script_id to frontend
7. Frontend refreshes script list

**To test:**
1. Start the dev environment: `docker-compose -f docker-compose.dev.yml up --build`
2. Open the app in browser
3. Click upload, select a PDF
4. Verify the script appears in the list with extracted text

### Next Steps
- [ ] Step 2: Test and fix any issues
- [ ] Step 3: (future) Add Claude parsing for structure

## Notes

- Only PDF files supported (1KB - 50MB)
- PDFs split into 5-page chunks for processing
- Single Claude session allowed at a time (10 min timeout)
- WebSocket for live progress, polling as fallback
