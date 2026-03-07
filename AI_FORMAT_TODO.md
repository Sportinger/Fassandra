# AI Format Feature - Continuation Notes

## Current State (2026-01-17)

The AI Format feature is deployed to dev.fassandra.de but needs improvements for better UX.

## BUG TO FIX FIRST

After a long processing time, the endpoint returns:
```json
{"error":"Internal server error","details":null}
```

**Debug steps:**
1. Check backend logs: `ssh admin@fassandra.de 'cd /home/admin/app && docker compose -f docker-compose.dev.server.yml logs --tail=200 dev-backend'`
2. Look for the actual error in the Claude CLI call or JSON parsing
3. Possible causes:
   - Claude CLI timeout
   - Invalid JSON response from Claude
   - Error in `rebuild_yjs_from_parsed_json`
   - Database connection issues

## What's Working
- Backend endpoint: `POST /api/s/:script_id/ai-format`
- Frontend modal triggers the API call
- Claude CLI is called on the server to parse text
- Yjs document is rebuilt with structured content

## What Needs Improvement

### Real-time Progress Feedback
Currently the modal just shows "Processing..." with no detailed information about what's happening in the backend.

**Desired behavior:**
1. Show real-time status updates from the backend (e.g., "Extracting text...", "Calling Claude...", "Parsing response...", "Rebuilding document...")
2. Stream the Claude CLI output to the frontend so the user can see what Claude is doing
3. Show a copy of the console/logs in the modal for debugging

**Implementation ideas:**
- Use Server-Sent Events (SSE) or WebSocket for real-time updates
- The backend already has SSE infrastructure from the PDF upload feature (`parse_existing_script` uses SSE)
- Could reuse `SessionUpdate` pattern from `claude_session_service.rs`

### Files to Modify
- `backend/src/handlers/script_upload_handler.rs` - Change `ai_format_script` to use SSE
- `frontend/src/components/editor/components/AIFormatModal/index.tsx` - Add SSE listener for progress updates

## Related Code References
- SSE example: `backend/src/handlers/script_upload_handler.rs:parse_existing_script` (line ~230)
- Session updates: `backend/src/services/claude_session_service.rs`
- Claude WebSocket: `backend/src/handlers/claude_websocket.rs`

## Prompt File
- Location: `backend/src/services/prompt_text_parser.md`
- Supports multiple languages (Spanish, French, German, Italian, English)
- Outputs structured JSON with scenes, dialogue, and stage_directions
