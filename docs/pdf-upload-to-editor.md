# PDF Upload → Parsing → Editor Rendering (End-to-End)

This document explains how a PDF is uploaded, parsed, converted to a Yjs document, persisted, and then rendered in the TipTap-based editor. It covers both the current pipeline and legacy/alternative routes or tools found in the repo.

Audience: contributors working on upload/parsing, ingestion, Yjs persistence, or editor bootstrapping.

---

## High-Level Flow

1) Frontend sends multipart upload with the PDF to the backend route `/api/s/upload-pdf`.
2) Backend saves the file under `uploads/scripts/`, splits it into 5‑page chunk PDFs using `split_pdf.sh`.
3) Backend starts a “Claude Code” parsing session (single active session enforced) pointed at the chunk directory.
4) Claude CLI runs with an embedded prompt, iterates each chunk PDF, extracts structure, emits per‑chunk JSON, appends to a memory file via `json_mem.sh`, then calls `yjs_to_db.sh` once at the end to persist.
5) The Rust `yjs_to_db` binary reads the JSON and uses `YjsScriptBuilderService` to build a Y.Doc update stream, persisting it into `yjs_recent_updates` and initializing/compacting into `yjs_base_states`.
6) Frontend editor bootstraps by fetching the compacted Yjs state and any recent updates, then connects via y-websocket for live collaboration.

---

## Frontend: Upload and Session Progress

- Primary upload UI:
  - `frontend/src/components/ScriptUploader.tsx` (modal/flow)
  - `frontend/src/components/scripts/ScriptList/index.tsx` (background upload, progress UI)

- Upload request:
  - POST `/api/s/upload-pdf` (multipart form with `file` field)
  - Code: ScriptList `performRealBackgroundUpload()` calls `fetch('/api/s/upload-pdf', …)` and reads `{ session_id }`.

- Session progress and completion:
  - After upload, the client requests a WS token (`/api/ws-token`) and connects a `ClaudeSessionService` (frontend) to:
    - WebSocket: `GET /api/s/session/:session_id/ws` for real‑time session updates
    - Fallback polling: `GET /api/s/:session_id` endpoints (status/logs) as needed
  - Client displays progress lines like:
    - `[PROGRESS] Starting chunked parsing - Total pages: Y, Chunks: Z`
    - `[PROGRESS] Page X of Y processed`
    - `[CHUNK_COMPLETE] Chunk X of Z processed (pages A-B)`
  - On completion, the server sends `{ type: 'complete', script_id }`, the UI refreshes the scripts list and removes the placeholder.

---

## Backend API: Upload, Session, and Script Data

Routers
- `backend/src/core/server.rs` nests routes:
  - Upload/Share/Thumbnails: `nest("/api/s", script_routes(...))`
  - Parsing session monitor: `nest("/api/s/session", claude_session_routes())`
  - Script CRUD + Yjs state/updates + collaboration WS under `/api`.

Current endpoints of interest
- POST `/api/s/upload-pdf`
  - Handler: `backend/src/handlers/script_upload_handler.rs::upload_and_parse_script`
  - Multipart handling; writes to `uploads/scripts/`.
  - Splits into chunk PDFs via `/app/split_pdf.sh`.
  - Starts a Claude parsing session: `ClaudeSessionService::start_session(chunk_dir_abs, user_email, callback)`.
  - Returns `{ session_id }`.

- WS `/api/s/session/:session_id/ws`
  - Handler: `backend/src/handlers/claude_websocket.rs::claude_session_ws`
  - Bridges backend session updates to the frontend via WebSocket messages.

- GET `/api/scripts`
  - Lists user scripts. Used by script list after parsing completes.

- GET `/api/scripts/:id`
  - Wrapper handler returns metadata plus `yjs_state` as base64. Code: `get_script_with_yjs_wrapper` in `server.rs`, reading via `ScriptApplicationService::get_script_with_yjs`.

- GET `/api/scripts/:id/yjs`
  - Returns the binary Yjs state (application/octet-stream). Code: `get_script_yjs_state` in `server.rs`, which loads the current Y.Doc from compaction service and encodes as update.

- GET `/api/scripts/:id/updates?since=<id>`
  - Returns base64 recent (uncompacted) updates to apply on top. Code: `get_script_recent_updates` in `server.rs`.

Legacy/older endpoints
- POST `/api/s/parse-pdf/*path`
  - Handler: `parse_existing_script` in `script_upload_handler.rs`. SSE placeholder, disabled logic; kept for documentation/possible reuse.
- Frontend exports an API `POST /api/s/create_script_from_parsed` in `frontend/src/api.ts`, but no matching backend route is present. See application method below for historical context.

---

## Backend: Upload Handler and File Processing

File handling: `backend/src/handlers/script_upload_handler.rs::upload_and_parse_script`
- Saves multipart `file` to `uploads/scripts/<uuid>_<original>.pdf`.
- Derives chunk directory name: `<uuid>_<stem>_chunks/` under `uploads/scripts/`.
- Resolves absolute host paths and maps them to container paths for tools by replacing host `…/backend` prefix with `/app` (works both in-container and on-host dev).
- Splits the PDF into 5‑page chunk PDFs via:
  - `/app/split_pdf.sh <container_pdf_path> <container_chunk_dir> 5`
  - Script path: `backend/scripts/split_pdf.sh` (copied to `/app/split_pdf.sh` in Docker image)
  - Uses `pdfinfo`, `pdfseparate`, `pdfunite` to split and emit logs like `[CHUNK] Created: … (pages A-B)`.

Starts Claude session:
- Looks up the user’s email (for ownership).
- Calls `ClaudeSessionService::start_session(chunk_dir_abs, user_email, callback)`.
- Returns `session_id` to client. Backend keeps a single active session at a time (rejects if one is running).

---

## Parsing Orchestration: ClaudeSessionService

File: `backend/src/services/claude_session_service.rs`

Responsibilities
- Owns session state (status, progress, output, script_id).
- Ensures only one active session. Exposes cancellation.
- Spawns a task to run Claude CLI, feed a precise prompt, and parse its streaming output lines for progress markers and final completion.

Container path mapping and exec working dir
- Detects if running in container and computes `effective_input_path` (`/app/...`) versus host path.
- Chooses an execution CWD where helper scripts are available: `.` or `backend` or `/app`.

Prompt and required behavior
- Prompt text embedded via `include_str!("prompt.md")`: `backend/src/services/prompt.md`.
- Key constraints Claude must follow:
  - Directory of pre‑split 5‑page PDFs. Determine total chunks Z and total pages Y.
  - Emit progress markers: `[PROGRESS] …` and `[CHUNK_COMPLETE] …` with precise formats.
  - For each chunk i (pages A..B), extract script elements and write chunk JSON with schema (see below).
  - Validate with `jq`, then append to persistent memory via `/app/json_mem.sh`: `init`, then repeated `add` appends.
  - After the final chunk, import exactly once via `./yjs_to_db.sh /tmp/script_data.json <username>`.
  - On success, output exactly: `iam done with my job rom`.

CLI execution
- Prefers `/app/claude-executor.sh` if present; otherwise runs `claude --print --output-format stream-json --verbose --dangerously-skip-permissions`.
- Sets appropriate `HOME`/`XDG_CONFIG_HOME` so the CLI uses existing auth (respects `CLAUDE_HOME`, `XDG_CONFIG_HOME`, `CLAUDE_CONFIG_DIR`).

Output parsing and status
- Parses totals: `Starting chunked parsing - Total pages: Y, Chunks: Z` → emits `ChunkInfo`.
- Parses per‑page: `Page X of Y processed` → emits `PageProgress`.
- Parses per‑chunk: `[CHUNK_COMPLETE] Chunk X of Z processed (pages A-B)` → emits `ChunkProgress`.
- Tracks whether final success token is printed; collects/propagates errors.
- Attempts to extract a `script_id` from child output (e.g., `Script ID: <uuid>` from importer). If none found, generates a new one to close the session successfully.

WebSocket bridge
- `backend/src/handlers/claude_websocket.rs` subscribes to `SessionUpdate` and relays as JSON to `ws: /api/s/session/:session_id/ws`.

---

## JSON Chunk Schema (Claude Output → Import Input)

Location: described in `backend/src/services/prompt.md` and validated/consumed by `yjs_to_db`.

Chunk (always mode "chunked"):
```
{
  "mode": "chunked",
  "chunk": { "number": i, "total": Z, "pages_start": A, "pages_end": B },
  "metadata": { "title": "…", "author": "…", "total_pages": Y }, // only in first chunk
  "content": [
    { "type": "scene", "content": "INT. …", "page": p, "scene_number": "…" },
    { "type": "dialogue", "speaker": "NAME", "content": "text…", "page": p },
    { "type": "stage_direction" | "monologue" | "joint_dialogue" | "reading", … }
  ],
  "context": { "last_scene": "…", "last_speaker": "…" }
}
```

Notes
- All items must include correct original `page` (offset by chunk window A..B).
- `scene` items must have non‑empty `content` (the heading) plus a string `scene_number` (continuous across chunks).
- `dialogue` paragraphs are split: each PDF paragraph is a separate block; line breaks preserved with `\n`.

---

## Importer: yjs_to_db.sh and yjs_to_db (Rust)

- Script: `backend/yjs_to_db.sh`
  - Validates JSON via `jq` (or Python fallback).
  - Locates `yjs_to_db` binary and executes: `yjs_to_db <json> <username> [script_id]`.
  - Prints success and script id.

- Binary: `backend/src/bin/yjs_to_db.rs`
  - Connects to DB using `DATABASE_URL`.
  - Accepts: a single chunk object, an array of chunk objects, or `{ "chunks": [ … ] }`.
  - For each chunk, calls `YjsScriptBuilderService::build_script_from_json(json, script_id?, username)` and aggregates results.
  - On first chunk with metadata, creates the script record and initializes an empty base state.
  - Prints `Success: Script inserted as YJS document` and `Script ID: …`.

Service: `YjsScriptBuilderService` (`backend/src/services/yjs_script_builder_service.rs`)
- Parses chunk into strongly typed structs.
- Determines/creates the script id; resolves user id from username.
- Loads or creates a Y.Doc initialized with TipTap‑compatible fragments (`default`, `prosemirror`, `metadata`).
- Converts `content` items into a minimal TipTap‑compatible structure in the `default` fragment, including:
  - `pageIndicator` nodes when page changes (`Page N`),
  - `sceneBlock` nodes for scenes (with heading text),
  - `dialogueBlock` nodes → nested `speaker` + `dialogueText` with one `paragraph` per `\n` part,
  - simple `paragraph` nodes for stage directions / reading / unknown.
- Also writes legacy plaintext markers into the `prosemirror` text for fallback/migration.
- Computes a DIFF update (`encode_state_as_update_v1` against prior state vector), stores into `yjs_recent_updates` with `expires_at`.
- If `chunk.number == chunk.total` (last chunk), it immediately compacts base+updates into `yjs_base_states` and marks recent updates compacted.

Compaction and document loading
- Background compaction service: `backend/src/services/yjs_compaction_service.rs` periodically folds recent updates into `yjs_base_states` and soft‑deletes (marks `is_compacted`).
- Loading for APIs: `load_document(pool, script_id)` returns a Y.Doc with base state + recent updates applied. Server then encodes this back to a single update for transport.

Script metadata and title
- When importing chunked data via `YjsScriptBuilderService`, the first chunk’s metadata title is used to create/overwrite the `scripts` row.
- When creating from "parsed" structures (manual route, below), upload filenames are preferred and sanitized for titles.

---

## Frontend Editor Bootstrapping (Yjs)

Hook: `frontend/src/components/editor/hooks/useEditorCore.ts`
- Step 1: Try binary state: `GET /api/scripts/:id/yjs` → `Y.applyUpdate(doc, state)`.
- Step 2: Fallback to base64 field: `GET /api/scripts/:id` and decode `yjs_state`.
- Step 3: Fetch recent updates: `GET /api/scripts/:id/updates` and `Y.applyUpdate` for each.
- Step 4: Open y-websocket provider to `/api/collab/:script_id` with auth token; sync begins and live collaboration starts.
- Editor components render TipTap view; `pageIndicator` nodes drive page counting UI; `dialogueBlock`, `sceneBlock` are styled by CSS.

Collaboration WebSocket server
- `backend/src/networking/websocket.rs`:
  - WS route: `/api/collab/:script_id`.
  - Auth: `WsAuthUser` enforces access (owner, public, or shared).
  - Broadcasts all binary frames to other clients; filters awareness ping frames (type 0x04) from persistence.
  - Persists Yjs Update/Sync frames by extracting update payload and enqueueing `YjsPersistenceEvent` to async DB writer (`async_db_writer.rs`).

Async DB writer
- `backend/src/services/async_db_writer.rs` saves Yjs updates to `yjs_recent_updates` with `expires_at`, logs metadata, and leaves compaction to the compaction service.

---

## Legacy/Alternative Routes and Tools

Older/disabled SSE endpoint
- POST `/api/s/parse-pdf/*path` → `parse_existing_script` in `script_upload_handler.rs`
  - Checks if the file exists and spawns a placeholder task.
  - Intended to stream parsing events via Server‑Sent Events (SSE).
  - Currently disabled (comments reference a previous `ClaudeCodeParserService`).

Manual script creation from a parsed structure (App layer only)
- `ScriptApplicationService::create_script_from_parsed` in `backend/src/application/script_application_service.rs`.
  - Accepts a `ParsedScript` (from `analysis/structs.rs`) and creates DB records.
  - Uses filename (if provided) to derive a human title (cleans `*.pdf`, replaces `_`/`-`, capitalizes, truncates to 100 chars), otherwise extracts/shortens `parsed_script.title`.
  - Builds a Y.Doc into `default` fragment analogous to the importer and persists as base state.
  - No public HTTP route currently exposes this API (frontend has a placeholder `create_script_from_parsed` export).

Alternate Node‑based Yjs parser (not in active path)
- Directory: `yjs-parser/`
  - Provides a Node tool to construct TipTap‑compatible Yjs updates using JS Yjs libs (aligning with frontend behavior).
  - README describes replacing the Rust `yjs_to_db` path with Node `npm run import-script …`.
  - Not currently invoked by the upload pipeline; kept for potential migration or investigations.

---

## Key Files and Paths

- Frontend
  - Upload UI: `frontend/src/components/ScriptUploader.tsx`
  - Background upload + WS: `frontend/src/components/scripts/ScriptList/index.tsx`
  - Editor bootstrap + WS: `frontend/src/components/editor/hooks/useEditorCore.ts`
  - API layer: `frontend/src/api.ts`

- Backend (HTTP + WS)
  - Script routes: `backend/src/handlers/script.rs`
  - Upload handler: `backend/src/handlers/script_upload_handler.rs`
  - Session WS bridge: `backend/src/handlers/claude_websocket.rs`
  - Router setup: `backend/src/core/server.rs`
  - Collab WS server: `backend/src/networking/websocket.rs`
  - Async DB writer: `backend/src/services/async_db_writer.rs`

- Backend (parsing + import)
  - Claude session service: `backend/src/services/claude_session_service.rs`
  - Prompt (embedded): `backend/src/services/prompt.md`
  - Chunk splitter: `backend/scripts/split_pdf.sh` (runtime: `/app/split_pdf.sh`)
  - JSON memory helper: `backend/json_mem.sh` (runtime: `/app/json_mem.sh`)
  - Import shim: `backend/yjs_to_db.sh` (runtime: `/app/yjs_to_db.sh`)
  - Import binary: `backend/src/bin/yjs_to_db.rs`
  - Yjs builder: `backend/src/services/yjs_script_builder_service.rs`
  - Yjs compaction: `backend/src/services/yjs_compaction_service.rs`

---

## Error Handling and Limits

Frontend validation
- `ScriptUploader.tsx` rejects non‑PDFs, files > 50MB, files < 1KB.

Backend validation
- Upload handler writes file in chunks; if no `*.pdf` field is found → `400`.
- `ScriptApplicationService::validate_pdf_upload()` (used in other flows) enforces: size ≤ 50MB, ≥ 1KB, `.pdf` extension, `%PDF-` header, warns on MIME.
- Splitter (`split_pdf.sh`) validates presence of `pdfinfo`, `pdfseparate`, `pdfunite` and checks non‑empty page count.
- Claude session runner times out after 10 minutes, tracks errors, supports cancellation via `/api/s/session/:id/cancel`.
- Importer validates JSON (jq/python). `yjs_to_db` returns non‑zero on error; session marks failure.

Transport fallbacks
- Editor bootstrap falls back from binary state (`/api/scripts/:id/yjs`) to base64 (`/api/scripts/:id`) and then applies recent updates.
- Server applies a migration if `default` fragment is empty but legacy `prosemirror` text has content (builds simple paragraphs) to ensure the editor always renders something.

---

## Sequence (Detailed)

1) User selects PDF in UI → `ScriptUploader` creates a placeholder and defers real upload to `ScriptList`.
2) `ScriptList` POST `/api/s/upload-pdf` with multipart FormData.
3) Backend saves `uploads/scripts/<uuid>_<name>.pdf`, creates chunk dir, runs `/app/split_pdf.sh` to write `…_chunk_001.pdf`, `…_chunk_002.pdf`, …
4) Backend finds user email; calls `ClaudeSessionService::start_session(<chunk_dir_abs>, <email>)`.
5) Claude CLI executes prompt:
   - Lists and sorts chunk PDFs; computes totals; emits `[PROGRESS] Starting chunked parsing - Total pages: Y, Chunks: Z`.
   - Loops i=1..Z: reads `…_chunk_i.pdf`, emits page progress; builds chunk JSON; `jq -e`; `/app/json_mem.sh add` to `/tmp/script_data.json`; logs `[CHUNK_COMPLETE] …`.
   - After last chunk, calls `./yjs_to_db.sh /tmp/script_data.json <username>`.
   - Importer loads chunks, builds Yjs updates, compacts final doc to base; prints `Script ID: <uuid>`.
   - Claude prints terminal token `iam done with my job rom`.
6) `ClaudeSessionService` parses stdout lines → relays WS updates to `/api/s/session/:session_id/ws` → frontend updates progress UI.
7) On completion → UI refreshes scripts list (`GET /api/scripts`), user opens editor.
8) Editor bootstraps Y.Doc via `/api/scripts/:id/yjs` (+ `/updates`), then connects to `/api/collab/:script_id` for real‑time sync; updates are persisted asynchronously.

---

## Operational Notes

- Docker image installs Node 22.x and `@anthropic-ai/claude-code` CLI for the parsing step (see `backend/Dockerfile.prod`). The helper scripts are copied to `/app/`.
- Path mapping logic in handlers/services converts host paths containing `/backend` to `/app/...` for consistent in‑container execution.
- Only one Claude session runs at a time; attempts to start while one is active return `429` with a friendly message.
- WebSocket server filters awareness messages from persistence but still broadcasts them for cursors/awareness UX.
- Compaction runs periodically; manual `/api/scripts/:id/compact` exists as a no‑op signal endpoint.

---

## Gaps and Legacy Artifacts

- `parse_existing_script` SSE endpoint exists but the actual parsing implementation is commented out; used historically for direct file‑path parsing.
- App‑layer `create_script_from_parsed()` builds scripts from `analysis/structs.rs::Script`. No public HTTP route currently exposes it. Frontend’s `createScriptFromParsed()` export is a leftover.
- `yjs-parser/` (Node) provides an alternate approach to build Yjs updates with the JS Yjs stack; not wired into the live upload route.

---

If you need deeper pointers (e.g., exact logging, progress parsing regexes, or state vector diffs), see the files referenced above; the code contains detailed tracing and comments.

