# Repository Guidelines

## Project Structure & Module Organization
- backend: Rust (Axum + SQLx). Entry at `backend/src/main.rs`; migrations in `backend/migrations`; helpers in `backend/scripts`.
- frontend: React + Vite + TypeScript + Capacitor. App in `frontend/src`; public assets in `frontend/public`.
- tests: Playwright E2E specs in `tests/`; frontend unit tests run with Vitest.
- scripts: Root `scripts/` (e.g., `reset_database.js`, `doctor.js`), plus platform scripts under `frontend/scripts` and `backend/scripts`.
- yjs-parser: Import/debug tools for Yjs documents.

## Build, Test, and Development Commands
- Full stack (Docker): `docker compose -f docker-compose.dev.yml up --build`
- Backend (local): `cd backend && cargo run` (requires `DATABASE_URL`, `JWT_SECRET`, `BACKEND_PORT`)
  - Tests/quality: `cargo test`, `cargo fmt`, `cargo clippy`
- Frontend: `cd frontend && npm ci && npm run dev` (build: `npm run build`, preview: `npm run preview`)
  - Unit tests: `npm run test` or `npm run test:coverage`
- E2E: at repo root `npm ci && npm run playwright:install && npm run test:e2e`

## Coding Style & Naming Conventions
- TypeScript/React: 2-space indent; components PascalCase in `src/components/...`; hooks start with `use*`.
- Linting: `frontend` uses ESLint; pre-commit via Husky/lint-staged blocks `console.*` in staged files.
- Rust: edition 2021; format with `cargo fmt`; idiomatic naming (snake_case fn/mod, CamelCase types).

## Testing Guidelines
- Frontend unit: Vitest (+ jsdom). Name files `*.test.ts(x)` near sources.
- Backend unit/integration: `cargo test` (async tests via `tokio-test`, mocks via `mockall`).
- E2E: Playwright specs in `tests/*.spec.js`. Run with `npm run test:e2e`.
- Aim for meaningful coverage on critical editor, auth, and Yjs flows.

## Commit & Pull Request Guidelines
- Commits: imperative, concise summaries (e.g., “Enhance WebSocket Yjs sync”).
- PRs: clear description, linked issues, screenshots for UI, and a short test plan.
- Checks before PR: `frontend`: `npm run lint && npm run test`; `backend`: `cargo fmt -- --check && cargo test`; root E2E when relevant.

## Security & Configuration Tips
- Never commit secrets. Use `.env.dev`/`.env.prod` (root) and `frontend/.env.*`.
- Backend env: `DATABASE_URL`, `JWT_SECRET`, `BACKEND_PORT`; optional admin bootstrap: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PLACEHOLDER_HASH`.
- CORS/WS: configure `ALLOWED_ORIGINS`, `VITE_API_BASE_URL`, `VITE_WS_BASE_URL` for local/dev.
