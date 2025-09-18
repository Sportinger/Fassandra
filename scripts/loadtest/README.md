# Fassandra Local Load Harness

This folder contains a standalone Node.js script that spins up multiple Yjs clients and drives the collaborative editor through the same WebSocket endpoint the browser uses. It is useful for short local probes (e.g. 60 concurrent editors for one minute) before moving to a managed load platform.

## Prerequisites
- Node.js 20+
- Matching user accounts in the target environment (one credential can back multiple virtual clients, but having unique users produces more realistic awareness traffic).

Install dependencies once at the project root:

```bash
npm install
```

## Configure a scenario
1. Copy `scripts/loadtest/config.example.json` to `scripts/loadtest/config.json`.
2. Update the fields:
   - `baseUrl`: HTTPS origin that exposes `/login` and `/api/*` (production or staging frontend).
   - `wsUrl` (optional): override when WebSockets terminate on a different host. If omitted the script derives `wss://` from `baseUrl`.
   - `scriptId`: UUID of the script to exercise. All virtual users join this document.
   - `virtualUsers`: number of concurrent clients to spawn (e.g. 60).
   - `sessionDurationMs`: how long each client should stay connected and edit.
   - `rampUpMs`: spread client start times across this window.
   - `editsPerMinute`, `minThinkTimeMs`, `maxThinkTimeMs`: pacing of edits. Leave `min/max` undefined to auto-derive from `editsPerMinute`.
   - `users`: list of `{ email, password, displayName? }`. The script cycles through this array when spawning clients.
   - `rejectUnauthorized`: set to `false` if you are targeting a self-signed TLS endpoint.

## Run a load burst

```bash
node scripts/loadtest/run-collab-load.mjs --config scripts/loadtest/config.json
```

The script logs high-level progress and, on completion, prints how many update operations were applied and how many clients failed. Increase verbosity by setting `"verbose": true` in the config file to watch connection state transitions.

## What the script does
- Logs in each virtual user via `/login`, preserving the issued cookies.
- Fetches a WebSocket token (`/api/ws-token`) and the latest binary Yjs state for the target script.
- Creates a `y-websocket` provider per client, joins `/api/collab/:scriptId`, and advertises awareness metadata.
- Performs randomized paragraph edits (inserts/deletes) for the configured session duration.

## Tips
- Start with a handful of clients on a staging environment to validate credentials and permissions before aiming at production.
- Keep bursts short (≤60 s) to avoid accumulating large Yjs updates when running against production data.
- Monitor backend logs and metrics while the script runs; the harness exits silently if the WebSocket server rejects connections, so application-side observability is essential.

