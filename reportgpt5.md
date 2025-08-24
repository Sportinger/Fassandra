## Yjs persistence investigation (GPT‑5)

Date: 2025-08-24

### Executive summary

- Problem reproduced on production: typing in the editor, navigating back or refreshing results in empty content on reopen.
- Root causes identified:
  - The backend WebSocket handler does not implement the y-websocket/Yrs sync protocol. It only relays/broadcasts messages and persists non-awareness updates, so new clients cannot fetch initial state via WS.
  - The frontend does not preload the current Yjs state from the REST endpoint before connecting; it relies on WS sync that the server does not provide.
  - The backend periodically sends an invalid “heartbeat” binary payload `[0x00, 0x00]` to clients, which triggers Yjs decode errors on the client and likely disrupts the sync flow.
- Minimal remediation (quick win):
  1) On the frontend, fetch `/api/scripts/:id/yjs` and `Y.applyUpdate(ydoc, state)` before creating `WebsocketProvider`.
  2) On the backend, stop sending the binary heartbeat `[0x00, 0x00]`; keep only WS ping/pong.
- Longer-term: implement proper y-websocket server handshake (SyncStep1/2 + Update exchange) or adopt an existing compatible server.

---

### Reproduction (prod)

- Site: `mylayer.org`
- Login: a@b.c / a@b.d123abCD
- Steps:
  1) Open an existing script “Test”.
  2) Type: “Hello from GPT‑5”.
  3) Navigate back to Scripts and re-open, or refresh the page.
- Result: editor shows an empty paragraph; text is gone.
- Console observations while interacting:
  - Outgoing WS messages present (sizes ~46, 270, 17 bytes) when typing.
  - Frequent client-side Yjs decode error: “Unexpected end of array” after connection.

Interpretation: client does send content updates; server persists them; but on reconnection a single client cannot retrieve initial state via websocket, and the decode errors hint at malformed frames being received.

---

### Dataflow overview

#### Frontend

- `frontend/src/services/yjsDocumentManager.ts`
  - Creates a persistent `Y.Doc` per `scriptId`, initializes XmlFragment `default`.
  - Logs updates; no persistence layer (IndexedDB) enabled.
- `frontend/src/components/editor/hooks/useEditorCore.ts`
  - Gets the `Y.Doc` from the manager; creates `WebsocketProvider(WS_BASE_URL, scriptId, doc, ...)`.
  - Binds TipTap `Collaboration.configure({ document: ydoc, field: 'default' })`.
  - Does not fetch the initial Yjs state from the backend before connecting.
  - Installs an onerror handler that logs Yjs decode errors (we observed “Unexpected end of array”).
- `frontend/src/api.ts`
  - Provides `getYjsState(scriptId)` (binary) and `getScriptWithYjs(scriptId)` (base64). Not used by editor to seed the `Y.Doc`.

Implication: after full page reload, the Y.Doc is empty until the client gets state via WS handshake, which the server does not implement.

#### Backend

- `backend/src/networking/websocket.rs`
  - Accepts WS connections, relays broadcast to other sessions, and pushes non-awareness binary messages to the async DB writer for persistence.
  - Does not implement y-websocket/Yrs sync handshake (no SyncStep1/SyncStep2/Update responses to seed new clients).
  - Sends periodic ping frames (good), and also binary heartbeats `vec![0x00, 0x00]` (problematic for Yjs decoding on clients).
- `backend/src/services/async_db_writer.rs`
  - Writes updates into `yjs_recent_updates` with `expires_at` and `is_compacted=false`.
- `backend/src/services/yjs_compaction_service.rs`
  - Periodically compacts recent updates into `yjs_base_states`, marks compacted updates.
  - Public loader `load_document(pool, script_id)` reconstructs a document from base + uncompacted updates.
- `backend/src/core/server.rs` → `/api/scripts/:id/yjs`
  - Returns current Yjs state (binary) produced by `load_document`.

Implication: persistence appears wired correctly (updates appended then compacted). Loading via REST is implemented; loading via WS protocol is not.

---

### What the logs indicate

- On connect the client sends 4-byte sync frames and 49-byte frames; shortly after, the client logs:
  - `[YJS_DECODE_ERROR] ... Unexpected end of array`.
- The server periodically sends `Binary([0x00, 0x00])` as a “heartbeat”. This is not a valid, complete Yjs Sync frame and can cause exactly that decode error.
- When typing, the client sends multiple non-awareness updates (17–272 bytes), suggesting outflow is fine. Without a proper handshake or REST seeding, a solo client won’t see persisted content after reload.

---

### Root causes

1) Missing y-websocket sync on server: new/solo clients cannot obtain document state via WS alone.
2) Invalid server heartbeat frame: `[0x00, 0x00]` triggers Yjs decode errors and interferes with clean protocol handling.
3) No frontend bootstrap from REST: editor never applies `/api/scripts/:id/yjs` to seed local `Y.Doc` before connecting.

---

### Recommendations

#### Immediate fixes (low risk)

1) Seed the client `Y.Doc` before connecting WS

In `useEditorCore` (right before creating `WebsocketProvider`), fetch and apply the state:

```ts
import * as Y from 'yjs';
import { getYjsState } from '../../api';

// ... inside init effect before WebsocketProvider
try {
  const stateBuffer = await getYjsState(stableScriptId);
  const state = new Uint8Array(stateBuffer);
  if (state.byteLength > 0) {
    Y.applyUpdate(doc, state);
    logger.info('useEditorCore', '[BOOTSTRAP] Applied server Yjs state', { bytes: state.byteLength });
  }
} catch (e) {
  logger.error('useEditorCore', '[BOOTSTRAP] Failed to fetch/apply Yjs state', e);
}
```

2) Remove invalid binary heartbeat from the server

In `backend/src/networking/websocket.rs`, delete the `Message::Binary(vec![0x00, 0x00])` heartbeat and keep the ping frame only. This avoids client-side decode errors and keeps the socket alive via standard WS ping/pong.

#### Medium-term

- Implement proper y-websocket/Yrs sync protocol on the server:
  - Decode incoming Sync messages (SyncStep1), respond with SyncStep2 and missing Update messages per state vector.
  - On client connect, serve initial state via WS (not just REST) so a solo client can fully sync via provider.
  - Alternatively, adopt/port an existing y-websocket-compatible server for Rust/yrs.

#### Additional checks

- Verify DB persistence by querying `yjs_recent_updates` for the script after typing; ensure rows are appended and not pruned prematurely by `expires_at`.
- Confirm `yjs_compaction_service` periodically compacts and that `/api/scripts/:id/yjs` size grows accordingly.

---

### Risk assessment

- Applying REST bootstrap and removing the binary heartbeat are safe, localized changes. They should immediately restore persistence across refresh for solo sessions.
- Implementing WS sync requires protocol changes; test thoroughly with multiple clients and large documents.

---

### Closing note

Given the current architecture (DB persistence + compaction + REST loader), the fastest reliable fix is to bootstrap the editor from `/api/scripts/:id/yjs` and stop sending invalid Yjs frames from the server. WS-based full sync can be introduced afterward for a pure real-time path.


