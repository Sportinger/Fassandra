## Cleanup Plan Outline

**Phase 1: Critical Security & Configuration Remediation** (Sequential)
1.  Implement `.env` Configuration (Root `.env`, `.env.example`, define vars)
2.  Remove Hardcoded Secrets & Config (`compose.yml`, `auth.rs`, `main.rs`, `api.ts`, `Editor.tsx`)
3.  Configure Frontend Build Args (`compose.yml`, `frontend/Dockerfile`)
4.  Fix WebSocket Authentication (`ws.rs`, `Editor.tsx`)

**Phase 2: Backend API Consistency & Robustness** (Parallel within phase)
1.  Standardize API Responses (JSON, fix `{"0": ...}`), update frontend `api.ts`
2.  Implement Consistent SQL Macros (`main.rs`, `lib.rs`)
3.  Add Timeouts (DB ops in `lib.rs`, handlers in `main.rs`)
4.  Improve Backend & Frontend Error Handling (Hide details, map errors, fix `api.ts`, update UI components)

**Phase 3: Build, Deployment & Scripting Cleanup** (Parallel within phase)
1.  Optimize Dockerfiles (Caching, context, non-root, migrations)
2.  Consolidate CORS (Remove from `nginx.conf`, configure in `main.rs`)
3.  Fix Root Scripts (typo, `--volumes`, `stop` cmd, cross-platform notes)

**Phase 4: Collaboration Core Refinement** (Requires Phases 1-3)
1.  Refactor `Editor.tsx` (Real user data, init logic, content strategy, error handling, styles)
2.  Refactor `ws.rs` (Memory leak, lagged errors, close msg, user ID in broadcast)

**Phase 5: Frontend Structure & UX Enhancements** (Requires stable core)
1.  Implement Routing (`react-router-dom`)
2.  Refactor State Updates in Render (`App.tsx`)
3.  Add Password Confirmation (`Register.tsx`)
4.  Optimize List Updates (`ScriptList.tsx`)
5.  Styling Cleanup (CSS classes)
6.  Address Minor/Remaining Issues (Unused code, stricter lint, etc.) 