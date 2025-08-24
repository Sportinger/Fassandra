## YJS WebSocket Sync Migration Plan (yrs-compatible)

Status: Proposal
Scope: Implement full y-websocket/yrs sync on the backend; keep current DB persistence and compaction. Exclude observability, offline, and scale tests as requested.

### Recommended rollout strategy

- Fix-first, then migrate incrementally:
  1) Quick fixes to restore reliability without protocol changes.
  2) Add WS sync implementation behind a feature flag.
  3) Flip clients to WS-sync path and remove the temporary fixes.

Rationale: minimizes risk and keeps production usable while we implement WS sync.

---

## Phase 0 – Quick fixes (ship immediately)

Tasks (backend + frontend):
1) Backend: remove binary heartbeat frames
   - File: `backend/src/networking/websocket.rs`
   - Remove `Message::Binary(vec![0x00, 0x00])` and keep WS ping/pong only.
   - Deliverable: PR with change; verify client no longer logs YJS decode errors on connect.

2) Frontend: bootstrap Y.Doc from REST before WS connect
   - File: `frontend/src/components/editor/hooks/useEditorCore.ts`
   - Before creating `WebsocketProvider`, call `getYjsState(scriptId)`, `Y.applyUpdate(doc, state)` if non-empty.
   - Deliverable: PR; verify solo session can refresh and see content.

Constraints: No protocol changes; minimal code churn. This unblocks users while Phase 1 is built.

---

## Phase 1 – Implement y-websocket/yrs sync on server

Goal: Server speaks the Yjs sync protocol so WS alone can bootstrap and catch up state.

### 1. Protocol handling module

Tasks:
1.1) Introduce `backend/src/networking/yjs_protocol.rs`
   - Responsibilities:
     - Parse incoming yrs sync messages (SyncStep1, SyncStep2, Update, Awareness) using `yrs` decoding.
     - Generate outgoing responses for SyncStep1 (send state vector) and SyncStep2 (send missing updates or full state as update).
     - Filter and forward non-awareness Updates to persistence channel.
   - Public API:
     - `handle_incoming_message(ctx, bytes) -> Vec<OutgoingFrame>`
     - `build_sync_initial_frames(script_id) -> Vec<OutgoingFrame>` (optional helper)

1.2) Define `OutgoingFrame` enum
   - Variants: `Binary(Vec<u8>)`, `Text(String)` (future use)
   - Used by `websocket.rs` to send frames.

### 2. State vector aware loading

Tasks:
2.1) Add helper in compaction service to compute diff updates for a given state vector
   - File: `backend/src/services/yjs_compaction_service.rs`
   - Function: `load_missing_updates(pool, script_id, client_state_vector: &[u8]) -> Result<Vec<Vec<u8>>>`
   - Steps:
     - Reconstruct `Doc` from base + recent updates (existing `load_document`).
     - Decode client SV, compute `encode_state_as_update_v1(&client_sv)` to produce diff update bytes.
     - Return a Vec with a single merged update (yrs supports sending one update representing the diff). 
   - Note: For large diffs, sending one merged update is fine.

2.2) Add helper to get server state vector
   - Function: `load_state_vector(pool, script_id) -> Result<Vec<u8>>`
   - Implement by reconstructing document then returning `doc.state_vector().encode_v1()`.

### 3. WebSocket integration

Tasks:
3.1) Wire protocol in `backend/src/networking/websocket.rs`
   - On connect:
     - Option A (client-initiated): wait for SyncStep1 from client; respond with SyncStep2 containing server SV.
     - Then, when client sends its SV (SyncStep2), compute and send `diff update` back.
   - On binary message:
     - Use `yjs_protocol::handle_incoming_message` to classify:
       - Awareness: relay only.
       - Update: persist and relay.
       - Sync steps: respond appropriately (send SV or diffs).
   - Keep existing broadcast to other clients.

3.2) Feature flag
   - Env var: `YJS_WS_SYNC=on|off` (default off initially).
   - If off: behavior stays as Phase 0 (no sync frames responded to).
   - If on: enable full protocol responses.

### 4. Frontend adjustments (minimal)

Tasks:
4.1) Keep REST bootstrap temporarily
   - If `YJS_WS_SYNC=off` (server not ready), bootstrap remains necessary.
   - If `YJS_WS_SYNC=on`, the WS handshake can handle bootstrap; we can later remove REST seeding (Phase 2).

4.2) Remove custom `clientID`
   - File: `frontend/src/services/yjsDocumentManager.ts`
   - Don’t override `doc.clientID`; let Yjs handle it.

---

## Phase 2 – Cleanups and simplifications

After enabling WS sync and verifying stability:

Tasks:
5) Remove REST bootstrap path (optional)
   - Simplify client init to rely purely on WS sync.

6) Delete custom clientID generator
   - Keep the standard Yjs ID behavior.

7) Revisit default fragment bootstrap
   - Ensure only `default` is created; unnecessary fragments removed in builder / loader.

---

## Deliverables by task

- P0.1: Backend PR – remove binary heartbeat.
- P0.2: Frontend PR – apply REST state before WS connect.
- P1.1: New module `yjs_protocol.rs` with parse/encode + tests (unit style).
- P1.2: Compaction helpers for state vector and diff update.
- P1.3: WebSocket glue code: respond to SyncStep1/2; gate via `YJS_WS_SYNC`.
- P1.4: Frontend keep REST bootstrap; optional config to skip when sync enabled.
- P2.x: Remove bootstrap and clientID override once WS sync is stable.

---

## Notes & constraints

- Database schema remains unchanged: `yjs_base_states` + `yjs_recent_updates`.
- Awareness should never be persisted; only relayed.
- Persist every non-awareness update as is; compaction continues on a schedule.
- This plan intentionally excludes observability/offline/scale testing per request.


