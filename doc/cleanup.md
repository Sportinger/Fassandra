# Backend Code Cleanup Issues

## `backend/src/main.rs`

*   Handlers defined directly in `main.rs` instead of dedicated modules.
*   Raw SQL query strings used instead of `sqlx` macros (potential lack of compile-time checks).
*   `expect()` used for database connection/migrations (acceptable at startup, but check runtime error handling).
*   Hardcoded CORS origins (`http://localhost:8080`, `http://127.0.0.1:8080`).
*   Hardcoded server port (`3001`).
*   Hardcoded database `max_connections` (5).
*   Unnecessary `package-lock.json` present in the `backend/` directory.
*   Missing `tokio::time::timeout` around database calls and potentially handlers.

## `backend/src/lib.rs`

*   Raw SQL query strings used in `create_script`, `create_block`, `update_block` instead of `sqlx` macros.
*   Missing `tokio::time::timeout` around database operations.
*   Unused `User.role` field.
*   Inconsistent nullability/usage of `Script.created_by` (Option) and `Edit.user_id` (Option) vs. required `user_id` in `update_block`. Clarify ownership rules.

## `backend/src/auth.rs`

*   **Critical Security:** Hardcoded JWT `SECRET` (`b"secret"`). Load from environment variable.
*   Potential panic in JWT expiration calculation (`.expect("valid timestamp")`). Use `map_err` or `ok_or`.
*   JWT generation/password hashing error mapping (`AppError::BadRequest`) might leak internal details. Map to a generic internal server error.
*   Consider explicitly configuring Argon2 parameters instead of using `Argon2::default()`.

## `backend/src/error.rs`

*   **Security Risk:** Leaking detailed database errors (`sqlx::Error`) to the client via the `AppError::Db` variant's `IntoResponse` implementation. Response body for 500 errors should be generic.
*   Consider adding more specific error variants instead of reusing `BadRequest(String)` for internal server issues like token generation or password hashing failures.
*   Missing specific error variants for potential issues (e.g., JWT, environment variable loading, WebSocket errors).

## `backend/src/ws.rs`

*   **Security Risk:** Optional WebSocket authentication (`Option<AuthUser>`) allows unauthenticated access. Enforce authentication.
*   Placeholder UUID generation for unauthenticated users is insecure and provides no accountability.
*   **Memory Leak:** Broadcast channels in the static `CHANNELS` DashMap are never removed after creation.
*   Potential message loss for slow receivers due to fixed broadcast channel capacity (`CHANNEL_CAP = 32`). Log or handle `Lagged` errors.
*   WebSocket message handling ignores `Text`, `Ping`/`Pong`, and `Close` messages. Implement `Close` handling at minimum.
*   Errors from `broadcast::Sender::send` are ignored (`let _ = ...`).
*   `user_id` is not included in broadcast messages, preventing receivers from knowing the originator.
*   Consider explicit task abortion (`.abort()`) in `tokio::select!` block for cleaner shutdown.

## `frontend/package.json`

*   Incorrect MUI version specified (`@mui/material: ^7.0.2`). Latest stable is v5.x. Should be corrected (e.g., `^5.15.20`).
*   `y-webrtc` included but backend only shows WebSocket (`ws.rs`). Clarify if WebRTC transport is intended/used; remove if not.
*   Using React 19; requires careful testing for compatibility with UI libraries (MUI) and other dependencies.

## `frontend/vite.config.ts`

*   Missing Vite development server proxy (`server.proxy`). API calls to backend will likely fail CORS checks during development without this.
*   Minimal `VitePWA` configuration relies on defaults. Explicitly configure the manifest (icons, name, etc.) and consider caching strategies/`registerType` ('autoUpdate' vs 'prompt').

## `frontend/src/App.tsx`

*   Manual view routing using `useState` and conditional rendering. Introduce a routing library like `react-router-dom` for proper navigation, history, and deeplinking.
*   **Anti-pattern:** State setters (`setCurrentView`, `setSelectedScriptId`) called directly within render logic. Move state updates to `useEffect` or event handlers.

## `backend/migrations/0001_create_tables.sql`

*   Missing explicit indexes on foreign keys (`scripts.created_by`, `blocks.script_id`, `edits.block_id`, `edits.user_id`, `versions.script_id`) and potentially other queried columns (e.g., `blocks.created_at`, `edits.created_at`).
*   Relies on `uuid-ossp` extension; ensure availability or use built-in `gen_random_uuid()`.
*   `versions` table defined in schema but not used in reviewed backend code. Clarify purpose or remove.

## `backend/Dockerfile`

*   Inefficient Docker layer caching for Cargo dependencies due to `COPY . .` before `cargo build`. Restructure `COPY` and `RUN cargo build` steps for better caching.
*   Copies entire workspace into builder stage, not just backend files.
*   Final container runs as `root`. Create and use a non-root user.
*   Missing `migrations/` directory in the final image, needed for runtime migration execution.

## Miscellaneous Backend

*   Removed stray `package-lock.json` from `backend/` directory.

## `frontend/src/AuthContext.tsx`

*   **Security Note:** JWT stored in `localStorage` is vulnerable to XSS attacks. Consider alternatives (HttpOnly cookies, in-memory) if XSS is a significant concern.
*   No client-side JWT expiration check. Frontend relies solely on backend rejection. Consider decoding token to check `exp` claim for proactive logout/refresh.

## `frontend/src/components/Editor.tsx`

*   Hardcoded user names/colors for collaboration cursors.
*   Hardcoded WebSocket URLs and fragile hostname-based detection logic. Use Vite env vars.
*   WebSocket connection attempted even without auth token (`token || ''`).
*   Complex conditional initialization of TipTap collaboration extensions based on `contentReady` state.
*   Suboptimal initial content loading strategy (API fetch after WS connect) with potential race conditions.
*   Fragile initial content conversion (plain text split by `\n\n` to Yjs XML).
*   Lack of user-facing error handling for WS connection, IndexedDB sync, or initial content fetch failures.
*   Large inline `<style>` block should be extracted to CSS file.

## `frontend/src/components/Login.tsx`

*   Displays raw API error messages (`err.message`) on login failure. Map known errors (e.g., 401) to user-friendly messages and use generic messages for unexpected errors.
*   Consider using CSS classes instead of inline style for error message.

## `frontend/src/components/Register.tsx`

*   Missing "Confirm Password" field and validation.
*   Displays raw API error messages (`err.message`) on registration failure. Map known errors (e.g., email exists) to user-friendly messages.
*   Consider using CSS classes instead of inline style for error message.

## `frontend/src/components/ScriptList.tsx`

*   Fragile detection of authorization errors via string check (`err.message?.includes('Unauthorized')`). Use specific error types/status codes from API wrapper for auto-logout.
*   Displays raw API error messages for script fetch/create failures. Map to user-friendly messages.
*   Inefficient list update after creating script (refetches entire list). Update state directly.
*   Consider using CSS classes instead of inline style for error message.

## `frontend/src/api.ts`

*   Hardcoded API base URL and fragile hostname-based detection logic. Use Vite env vars (`import.meta.env.VITE_API_BASE_URL`).
*   `fetchApi` helper leaks raw backend error details in thrown Error messages. Map status codes to specific error types and avoid exposing backend details.
*   Backend API inconsistency: `/login`, `/register` likely return plain text token; should return JSON. `fetchApi` has brittle handling for this.
*   Backend API inconsistency: `/api/scripts` likely returns `{"0": [...]}` due to tuple struct serialization. Frontend `getScripts` has specific workaround. Backend should return standard JSON array or object.

## Frontend Build & Deployment (`frontend/Dockerfile`, `frontend/nginx.conf`)

*   `Dockerfile`: Inefficient Docker layer caching for `npm ci` and `npm run build`. Restructure `COPY` commands.
*   `Dockerfile`: Copies entire workspace into builder stage.
*   `nginx.conf`: Redundant/conflicting CORS headers (`add_header Access-Control-...`) set by Nginx. CORS should be handled solely by the Axum backend.
*   `nginx.conf`: Consider adding browser caching headers for static assets.

## `frontend/eslint.config.js`

*   Uses recommended rule sets. Consider enabling stricter TypeScript ESLint rules (`recommended-requiring-type-checking` or `strict`) for more thorough checks.

## `docker-compose.yml`

*   **Security:** Hardcoded secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`). Use `.env` file and variable substitution (`${VAR_NAME}`).
*   Frontend API URL (`VITE_API_BASE_URL`) is not passed via build args. Uncomment and configure `build.args` in `frontend` service.

## Root Scripts (`start`, `stop`, `rebuild`)

*   Scripts use `#!/bin/bash`; may not be compatible with all Windows environments without WSL/Git Bash.
*   `rebuild` script: Typo `--volumnes` -> `--volumes`.
*   `rebuild` script: Uses `down --volumes`, which **deletes database data**. Remove `--volumes` unless reset is intended.
*   `stop` script: Uses individual `docker stop`. Simpler and cleaner to use `docker compose down`.

## Overall Patterns & Concerns (Summary)

*   **Systemic Security Deficiencies:** Multiple instances of hardcoded secrets, insecure auth patterns (optional WS auth, localStorage JWT), and information leakage via errors indicate a need for systematic security hardening across the stack.
*   **Inconsistent Configuration Management:** Over-reliance on hardcoding (ports, URLs, CORS origins) and fragile detection logic instead of consistent use of environment variables and build arguments.
*   **API & Backend Robustness Issues:** Backend API shows inconsistencies (response formats, SQL methods) and lacks robustness (DB timeouts, error detail leakage).
*   **Collaboration Feature Fragility:** The core real-time editor feature (`Editor.tsx`, `ws.rs`) appears complex and fragile regarding initialization, auth, state management (memory leaks), and data syncing.
*   **Build/Deployment Process Immaturity:** Dockerfiles need optimization (caching, context) and correctness fixes (migrations, non-root users). Nginx config conflicts with backend CORS. Root scripts are not robust or fully cross-platform.
*   **Poor Error Handling Propagation:** Leaking internal error details is a recurring issue from backend error types through the frontend API layer to the UI components. 