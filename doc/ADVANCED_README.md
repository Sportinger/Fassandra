# Pessoa - Advanced Technical README

## Overview

Pessoa is a collaborative platform designed to transform theatre script development. It leverages AI (Google Gemini) to analyze and structure script text from uploaded documents (`.docx`), converting raw text into a detailed, structured format (identifying scenes, characters, dialogue, stage directions, etc.) based on a predefined schema. This structured data is stored in the database, enabling a **highly visual and flexible frontend experience** where script elements can be potentially rendered, manipulated, and analyzed in sophisticated ways.

The platform supports real-time, simultaneous editing by multiple users (directors, actors, dramaturges, technicians) using **Conflict-free Replicated Data Types (CRDTs)** via the **Yjs framework**. This ensures that edits are merged seamlessly and consistently across all collaborators. Changes are synchronized via a central WebSocket server, persisted asynchronously on the backend, and cached locally using IndexedDB for performance and resilience.

The technical stack reflects these goals: **Rust/Axum** on the backend provides performance and safety for the API, WebSocket server, AI integration orchestration, and robust Yjs data persistence, while **React/TypeScript/Tiptap/Yjs** on the frontend delivers a rich, collaborative editing interface designed to work with the structured script data.

---

This document provides a more in-depth technical overview of the Pessoa application, covering backend, frontend, and infrastructure details.

## Table of Contents

- [Backend](#backend)
  - [Core Technologies](#core-technologies)
  - [Architecture & Features](#architecture--features)
  - [Request Lifecycle & Handlers](#request-lifecycle--handlers)
  - [API Endpoints](#api-endpoints)
  - [Authentication & Authorization](#authentication--authorization)
  - [Real-time Collaboration (WebSockets)](#real-time-collaboration-websockets)
  - [Database](#database)
  - [AI Script Analysis](#ai-script-analysis)
  - [Error Handling](#error-handling)
  - [Configuration](#configuration)
- [Frontend](#frontend)
  - [Core Technologies](#core-technologies-1)
  - [Architecture & Features](#architecture--features-1)
  - [Component Overview & UI Flow](#component-overview--ui-flow)
  - [State Management](#state-management)
  - [API Interaction](#api-interaction)
  - [Collaborative Editor (Tiptap & Yjs)](#collaborative-editor-tiptap--yjs)
  - [Offline Support & Syncing](#offline-support--syncing)
  - [PWA Configuration](#pwa-configuration)
- [Infrastructure & Deployment](#infrastructure--deployment)
  - [Docker Setup](#docker-setup)
    - [Backend Build Details](#backend-build-details)
    - [Frontend Build Details](#frontend-build-details)
    - [Nginx Configuration](#nginx-configuration)
  - [Environment Variables](#environment-variables)
- [Development Notes & Potential Improvements](#development-notes--potential-improvements)

---

## Backendr

The backend is built with Rust, focusing on performance, type safety, and asynchronous operations.

### Core Technologies

- **Language:** Rust (Stable Edition 2021)
- **Web Framework:** Axum (v0.7) - Chosen for its performance, ergonomics, and integration with the Tokio ecosystem. Tower services are used for middleware.
- **Database:** PostgreSQL (v15 used in Docker setup)
- **Database Interaction:** SQLx (v0.7) - Async, type-safe SQL query execution with compile-time checks (requires DB connection during build). Uses macros like `query!`, `query_as!`.
- **Password Hashing:** Argon2 (via `argon2` crate v0.5) - Secure password hashing using default parameters and unique salts per user (`SaltString::generate(&mut rand::thread_rng())`).
- **Authentication:** JWT (via `jsonwebtoken` crate v9) - Stateless authentication using HS256 signed JSON Web Tokens.
- **WebSockets:** Axum WebSocket support (`axum::extract::ws`) integrated with Tokio broadcast channels (`tokio::sync::broadcast`) for real-time messaging.
- **Async Runtime:** Tokio (v1.x) - The foundation for all asynchronous operations.
- **Serialization:** Serde (v1.x) - For serializing/deserializing data structures (JSON payloads, JWT claims).
- **Configuration:** Dotenvy (v0.15) - Loads environment variables from `.env` files at startup.
- **Logging:** Tracing (v0.1) & `tracing-subscriber` (v0.3) - Structured, asynchronous logging. `fmt::layer` used for output.
- **AI Interaction:** Reqwest (v0.12) - Async HTTP client used to communicate with the Google Gemini API.
- **Document Parsing:** `docx-rs` (v0.4) - Extracts plain text content from `.docx` files.
- **Error Handling:** `anyhow` for context-rich internal errors; Custom `AppError` enum.

### Architecture & Features

- **RESTful API & WebSockets:** Exposes both a REST API for standard CRUD operations and a WebSocket endpoint (`/api/collab/:script_id`) for real-time editing.
- **Modular Design:** Code organized into logical modules within `backend/src/`: `auth`, `ws`, `models`, `api`, `handlers`, `analysis`, `gemini_api`, `error`. `main.rs` sets up routing and state.
- **Asynchronous Core:** Leverages Tokio and `async/await` extensively for non-blocking I/O. Database and API calls are async.
- **Database Migrations:** Uses `sqlx::migrate!` macro to embed SQL migration files from `backend/migrations/`. Migrations are run automatically via `MIGRATOR.run(&pool)` on application startup.
- **Middleware (`tower` / Axum Layers):** Applied globally in `main.rs` using `ServiceBuilder`:
    - `CorsLayer`: Configurable Cross-Origin Resource Sharing based on `ALLOWED_ORIGINS`.
    - `TraceLayer`: Logs HTTP request/response details using `tracing`.
    - `RequestBodyLimitLayer`: Limits incoming request body size (default 20MB via `MAX_REQUEST_BODY_SIZE`).
- **User Management:** Registration, Login (JWT issuance), Role-based access (roles `admin`, `user` included in JWT).
- **Script & Block CRUD:** Standard create, read, update, delete operations for scripts (`scripts` table) and content blocks (`blocks` table).
- **Edit History:** Every update to a block's content (`PATCH /api/blocks/:id`) also creates a record in the `edits` table within a DB transaction, preserving content history. (Note: The role of this table might evolve with the Yjs persistence strategy).
- **Real-time Collaboration:** See [Real-time Collaboration (WebSockets)](#real-time-collaboration-websockets). Includes server-side asynchronous persistence of Yjs updates and a snapshotting mechanism.
- **AI-Powered Script Structuring:** See [AI Script Analysis](#ai-script-analysis).
- **Hardcoded Dev User:** Ensures `admin@pessoa.de` / `PassoaDevteam` is available via migration and startup password update logic.
- **Rate Limiting:** Includes unused rate-limiting logic (see [Development Notes](#development-notes--potential-improvements)).

### Request Lifecycle & Handlers

- **Routing (`main.rs`, `handlers/`)**: Axum `Router` defines routes and maps them to handler functions. Routes are nested logically (e.g., `/api/scripts` routes defined in `handlers::script_handlers::script_routes`).
- **State Injection (`.with_state`)**: The `PgPool` (database pool) and `RateLimiter` instances are shared with handlers via Axum's state mechanism.
- **Extractors (`axum::extract`)**: Handlers use extractors like `State<PgPool>`, `Path<Uuid>`, `Json<Payload>`, `Multipart`, and custom auth extractors (`AuthUser`, `WsAuthUser`) to access request data and state safely.
- **Handler Logic (e.g., `handlers/script_handlers.rs`)**:
    - Parse input using extractors.
    - Perform authorization checks (implicitly via `AuthUser` or explicitly if needed).
    - Call business logic functions (often from `lib.rs` or other modules like `gemini_api.rs`).
    - Handle results and map errors to `AppError`.
    - Return responses (often `Json<T>` or `impl IntoResponse` for errors).
- **Error Handling**: Errors bubble up via `Result<T, AppError>` and the `?` operator. The `AppError::IntoResponse` implementation converts errors into appropriate HTTP responses.

### API Endpoints

*(Authentication required for `/api/*` unless otherwise specified)*

- **Health:**
  - `GET /health`: Simple health check (no auth needed).
- **Authentication:**
  - `POST /register`: Register a new user (email, username, password). Returns JWT. (no auth needed).
  - `POST /login`: Log in (email, password). Returns JWT. (no auth needed).
- **Scripts (Grouped under `/api/scripts`):**
  - `GET /`: List scripts created by the authenticated user.
  - `POST /`: Create a new script (`{ "title": "..." }`). Returns the created `Script` object.
  - `GET /:id`: Get script details and its ordered blocks (`ScriptWithBlocks`).
  - `PATCH /:id`: Update script title (`{ "title": "..." }`). Returns updated `Script`.
  - `POST /upload`: Upload a script file (`multipart/form-data` with field `scriptFile`). Extracts text, calls Gemini API for parsing. Returns `ParsedScript` JSON.
  - `POST /create_script_from_parsed`: Creates script/blocks in DB from a `ParsedScript` JSON payload. Returns the new script `Uuid`.
- **Blocks:**
  - `POST /api/scripts/:id/blocks`: Create a new block within a script (`{ "block_type": "...", "content": "..." }`). Returns the new block `Uuid`.
  - `PATCH /api/blocks/:id`: Update a block's content (`{ "content": "..." }`). Creates an `edits` record. Returns `204 No Content`.
  - `GET /api/blocks/:id/history`: Get the edit history (list of `Edit` records) for a specific block, ordered by creation time.
- **Collaboration:**
  - `GET /api/collab/:script_id`: WebSocket upgrade endpoint. Requires auth via `?token=<token>`.

### Authentication & Authorization

- **JWT:** Standard Bearer tokens (HS256) signed via `jsonwebtoken::encode` using `JWT_SECRET`.
- **JWT Claims:** `sub` (user_id), `exp` (expiration, 24h), `email`, `username`, `role`.
- **Axum Extractors:**
    - `AuthUser` (`auth.rs`): Implements `FromRequestParts`. Checks `Authorization: Bearer <token>` header, verifies token using `verify_token`, returns `AuthUser { user_id }` or `AppError::Unauthorized`.
    - `WsAuthUser` (`auth.rs`): Implements `FromRequestParts`. Parses `token` from query string (`serde_qs`), verifies using `verify_token`, returns `WsAuthUser { user_id }` or `AppError::Unauthorized`.
- **Password Hashing:** Argon2 defaults, unique salts. `auth::hash_password`, `auth::verify_password`.
- **Authorization:** Currently implicit (valid token grants access). Role checks could be added to handlers/extractors.

### Real-time Collaboration (WebSockets)

- **Architecture:** Per-script rooms using `script_id`. Global `DashMap<Uuid, Arc<ScriptRoom>>` (`SCRIPT_ROOMS`) stores active rooms.
- **Technology:** `axum::extract::ws`, `tokio::sync::broadcast` (capacity 100), `futures_util` (Sink/Stream).
- **State (`ScriptRoom` in `ws.rs`):** Contains `tx: Sender<(Message, Uuid)>` and `subscriber_count: TokioMutex<usize>`.
- **Connection Lifecycle (`ws.rs`):** Auth via `WsAuthUser` -> upgrade -> `handle_connection` -> manage room entry/subscriber count -> spawn send/receive tasks -> `tokio::join!` -> decrement count -> potentially remove room.
- **Message Flow:** Client message (typically Yjs updates) -> `process_incoming_messages` (in `ws.rs`) -> Enqueues update via `persistence_event_tx` for asynchronous DB storage AND broadcasts to other clients via `broadcast_tx.send((msg, user_id))` -> `process_outgoing_messages` (for other clients) receives `(msg, sender_id)` -> filters out own messages (`sender_id != user_id`) -> sends `msg` via `ws_sender`.
    - **Note on Persistence:** The WebSocket handler (`ws.rs`) initiates the persistence process by sending Yjs updates to an asynchronous queue (`persistence_event_tx`). A dedicated backend service (`AsyncDBWriter`) consumes these updates and writes them to the `yjs_document_updates` table for a full, granular history. Another service (`SnapshottingService`) periodically processes these updates to build full document snapshots, aiming to eventually update the main `blocks` table with this structured snapshot data (this granular block update is still under development). This significantly reduces the reliance on client-side REST calls for persisting Yjs-driven content for collaborative scripts.
- **Keep-Alive:** Server pings every 15s (`HEARTBEAT_INTERVAL`), client timeout 30s (`CLIENT_TIMEOUT`).

### Database

- **Schema (`backend/migrations/`)**: `users`, `scripts`, `blocks`, `edits`, `yjs_document_updates`, `script_snapshots_meta`. `versions` table unused.
- **Keys/Relations**: UUID PKs (`uuid-ossp`). FKs include: `scripts.created_by` -> `users.id`, `blocks.script_id` -> `scripts.id` (CASCADE), `edits.block_id` -> `blocks.id` (CASCADE), `edits.user_id` -> `users.id`, `yjs_document_updates.script_id` -> `scripts.id`, `yjs_document_updates.user_id` -> `users.id`, `script_snapshots_meta.script_id` -> `scripts.id`.
- **Structured Content Storage**: The `blocks` table is central to storing the structured script. Its role is evolving to store snapshotted representations derived from Yjs. The `block_type` column and `content` column hold structured information.
- **Interaction (`sqlx`):** Async pool (`PgPool`). `sqlx::migrate!` runs migrations. `query!`, `query_as!` macros used. Transactions (`pool.begin()`, `tx.commit()`) used for atomic operations like `update_block` (though Yjs updates follow a different path).
- **Timeouts:** Explicit 5s timeouts (`tokio::time::timeout`) applied in `create_block` and `get_block_history`.

### AI Script Analysis

- **Service:** Google Gemini API (`GEMINI_API_URL`, `GEMINI_API_KEY`).
- **Goal:** Convert unstructured script text (`.docx` via `extract_text_from_docx`) into a detailed, structured JSON format (`analysis::structs::Script`) suitable for populating the database and enabling a rich frontend experience.
- **Process (`gemini_api.rs`, `script_handlers.rs`):**
    1. `/api/scripts/upload` receives file.
    2. Extracts text from the file.
    3. Calls the Google Gemini API to analyze the text.
    4. Parses the API response to create a detailed, structured JSON format (`analysis::structs::Script`).
    5. Stores the script in the database.
    6. Returns the script's UUID.

## Frontend

The frontend is built with React, TypeScript, and various libraries.

### Core Technologies

- **Language:** React (v18)
- **State Management:** React Context API (e.g., `AuthContext`). Redux Toolkit is listed in README but not found in dependencies or usage.
- **UI Library:** Material-UI (v7.0.2) (README lists v5)
- **Routing:** State-based routing within `App.tsx` (README's "Core Technologies" lists React Router v6, but its "Architecture & Features" correctly describes state-based routing. package.json and code confirm no React Router).
- **Styling:** CSS and CSS Modules (e.g., `App.css`, `Editor.module.css`). (README lists `styled-components`; `@emotion/styled` is in `package.json` but not imported/used).
- **API Interaction:** Native `fetch` API (wrapper in `src/api.ts`). (README lists Axios v1.3).
- **Collaborative Editor:** Tiptap (v2.11.9) and Yjs (v13.6.26) (README lists Yjs v16)
- **Offline Support:** Service Worker (`vite-plugin-pwa`)
- **PWA Configuration:** `vite-plugin-pwa` (likely using Workbox)

### Architecture & Features

- **SPA:** Client-side logic manages views and state.
- **Component-Based:** UI built with reusable React components (`src/components/`).
- **State-Based Routing (`App.tsx`):** Simple routing managed by component state (`currentView`, `selectedScriptId`), not a dedicated routing library.
- **Rich Text Editing (`Editor.tsx`):** Core editing interface using Tiptap, designed to render and interact with structured script elements.
- **Real-time Collaboration:** See [Collaborative Editor (Tiptap & Yjs)](#collaborative-editor-tiptap--yjs).
- **Authentication Flow:** Login/Register forms, JWT stored in `sessionStorage`, state managed via `AuthContext`.
- **API Client (`api.ts`):** Typed functions for backend interaction.
- **Type Safety:** TypeScript used throughout.
- **PWA Features:** Service worker caching, potential installability.
- **Script Upload & AI Processing:** UI (`ScriptUploader.tsx`) to upload `.docx`, trigger backend parsing/analysis, and create script from results, populating the structured data model.

### Component Overview & UI Flow

- **Main Components:**
  - `App`: Root component, handles routing.
  - `Home`: Landing page, login, and registration.
  - `Dashboard`: Main application interface.
  - `ScriptEditor`: Component for editing scripts.
  - `BlockEditor`: Component for editing individual blocks.
  - `BlockList`: Component for displaying and managing blocks.
  - `ScriptList`: Component for displaying and managing scripts.
- **UI Flow:**
  - User logs in or registers.
  - User accesses the dashboard.
  - User creates a new script or opens an existing one.
  - User edits the script using the script editor.
  - User adds new blocks or edits existing ones.
  - User saves the script.

### State Management

- **Redux Toolkit:** Manages application state.
- **React Contexts:** Used for state management in some components.
- **Local Storage:** Used for storing user preferences and data.

### API Interaction

- **Axios:** Used for making API requests.
- **Endpoints:**
  - `/api/scripts`: CRUD operations for scripts.
  - `/api/blocks`: CRUD operations for blocks.
  - `/api/collab/:script_id`: WebSocket endpoint for real-time editing.

### Collaborative Editor (Tiptap & Yjs)

- **Integration (`Editor.tsx::useEditor`):**
    - Tiptap's `Collaboration` extension connects the editor instance to `ydoc.getXmlFragment('content')`.
    - `CollaborationCursor` connects to `provider.awareness` for real-time cursor display, using user info from `AuthContext`.
    - Standard Tiptap extensions (`StarterKit`, `Heading`, etc.) provide formatting capabilities. Enables editing of the script content based on the Yjs shared document.
- **Data Flow:** Editor change -> Tiptap updates -> `Collaboration` extension updates Yjs `XmlFragment` -> Yjs triggers `y-websocket` send (to the backend for relay and persistence) & `y-indexeddb` save (for local offline persistence). Incoming Yjs change (relayed from server) -> `Collaboration` extension updates Tiptap editor state.
    - **Persistence to Main Database:** The backend now handles the primary persistence of Yjs changes. Raw Yjs updates are sent via `y-websocket` to the server, which queues them for asynchronous writing to the `yjs_document_updates` table. A server-side snapshotting service then processes these updates to eventually reconcile the main `blocks` table with the collaborative state. Direct client-side calls to `PATCH /api/blocks/:id` for Yjs content are becoming less central to the collaborative workflow.
- **Awareness:** User cursor position/selection and username/color shared via the `provider.awareness` protocol.
- **Initial Content Load:** Fetches data via `getScriptWithBlocks`. The server will eventually provide script content derived from the latest snapshot plus any subsequent Yjs updates. **Currently formats the structured block data (JSON strings) into plain text paragraphs** (`formatContentElement`) before populating the Yjs document. *(See Potential Improvements regarding direct structured node mapping)*.

### Offline Support & Syncing

- **Yjs & CRDTs:** The use of Yjs ensures that concurrent edits can be merged automatically and consistently, whether made online or offline.
- **Persistence (`y-indexeddb`):** Saves the `Y.Doc` state for each script (`theater-script-<scriptId>`) to IndexedDB, acting as a local cache and enabling offline access to the last known state of collaboratively edited content.
- **Loading:** Loads from IndexedDB on editor mount via `IndexeddbPersistence`.
- **Synchronization (`y-websocket`):** Connects to the backend WebSocket server. The server relays Yjs messages to other connected clients to synchronize their `Y.Doc` instances in real-time and also queues these updates for server-side persistence.
    - **Server-side Persistence:** The backend now actively persists Yjs updates. Raw updates are stored in `yjs_document_updates`, and a snapshotting mechanism is in place to process these updates, aiming to keep the primary `blocks` table eventually consistent with the collaborative state. This is a shift from relying solely on client-initiated REST calls for saving collaborative content.
- **PWA Service Worker (`vite-plugin-pwa`):** Caches app shell assets (HTML, CSS, JS) for faster loads and basic offline application shell availability.

### PWA Configuration

- **Workbox:** Used for generating a PWA.

## Infrastructure & Deployment

The application is containerized using Docker.

### Docker Setup

- **Backend:**
  - **Image:** `pessoa-backend`
  - **Build Details:**
    - **Language:** Rust
    - **Framework:** Axum
    - **Database:** PostgreSQL
    - **Database Interaction:** SQLx
    - **Password Hashing:** Argon2
    - **Authentication:** JWT
    - **WebSockets:** Axum WebSocket support
    - **Async Runtime:** Tokio
    - **Serialization:** Serde
    - **Configuration:** Dotenvy
    - **Logging:** Tracing
    - **AI Interaction:** Reqwest
    - **Document Parsing:** `docx-rs`
    - **Error Handling:** `anyhow`
    - **Development Hot Reloading with Docker:** The development environment, when orchestrated by `docker-compose.yml`, uses `cargo watch -x run --bin backend`. This command, combined with mounting the local backend source code into the container, provides automatic recompilation and restarting of the Axum server upon code changes, facilitating a rapid development cycle.
  - **Nginx Configuration:**
    - **Reverse Proxy:** Used for load balancing and SSL termination.
- **Frontend:**
  - **Image:** `pessoa-frontend` (for production, uses Nginx)
  - **Development Setup (via `docker-compose.yml` and `frontend/Dockerfile.dev`):**
    - Uses Vite's development server.
    - Hot Module Replacement (HMR) is enabled and works reliably within Docker due to file watching polling (`CHOKIDAR_USEPOLLING=true` in `docker-compose.yml` or `watch.usePolling` in `vite.config.ts`).
    - The `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` environment variables are passed during the build of the dev image to configure API and WebSocket endpoints.
  - **Production Build Details (via `frontend/Dockerfile`):**
    - **Build Process:** Multi-stage Docker build.
      - Stage 1 (builder): Uses `node:20-alpine`, installs dependencies (with `npm ci`), and builds the React application using `npm run build`. `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` are passed as build arguments.
      - Stage 2 (production): Uses `nginx:stable-alpine`.
    - **Serving:** Static assets from the build stage are copied to Nginx's webroot (`/usr/share/nginx/html`).
    - **Nginx Configuration (`frontend/nginx.conf`):**
      - Serves static frontend assets, with `try_files` for SPA routing.
      - Reverse proxies API requests (paths starting with `/api/`) to the backend service (`backend:3001`), including WebSocket upgrade support.
      - Defers CORS handling to the backend (Axum).
      - Enables gzip compression.
    - **Caching:** Utilizes Docker build cache for `npm` dependencies and `vite` build outputs via `--mount=type=cache`.

### Environment Variables

The application relies on environment variables for configuration, especially for secrets and deployment-specific settings. These should be defined in a `.env` file at the project root. A `.env.example` file should be maintained in the repository with placeholders and non-sensitive defaults.

**General & Domain Configuration:**
- `APP_HOSTNAME=localhost`          # Domain name for deployment (e.g., localhost, yourdomain.com)
- `BACKEND_PORT=3001`               # External port for the backend service
- `FRONTEND_PORT=8080`              # External port for the frontend service
- `DB_PORT=5433`                    # External port for the database service
- `CONTAINER_PREFIX=main_`          # Prefix for Docker container and volume names (e.g., myproject_)

**Internal Port Configuration (usually no need to change):**
- `BACKEND_INTERNAL_PORT=3001`      # Internal container port for the backend
- `FRONTEND_INTERNAL_PORT=8080`     # Internal container port for the frontend (Vite dev server)
- `DB_INTERNAL_PORT=5432`           # Internal container port for the PostgreSQL database

**Database Configuration:**
- `POSTGRES_USER=pessoa_user`         # PostgreSQL username
- `POSTGRES_PASSWORD=your_db_password` # PostgreSQL password (use a strong, unique password in .env)
- `POSTGRES_DB=pessoa_db`             # PostgreSQL database name
- `DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:${DB_INTERNAL_PORT}/${POSTGRES_DB}` # Connection URL for the backend service (uses service name `db`)
- `DB_MAX_CONNECTIONS=10`           # Maximum database connections for the backend pool

**Security Configuration:**
- `JWT_SECRET=your_long_random_jwt_secret_string` # Secret key for signing JWTs (use a long, random, unique string in .env)

**API & CORS Configuration:**
- `APP_DOMAIN=${APP_HOSTNAME}:${FRONTEND_PORT}` # Calculated application domain for constructing URLs
- `ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT},http://${APP_DOMAIN}` # Comma-separated list of allowed origins for CORS (adjust as needed for deployment)

**Frontend Build-Time Configuration (baked into the frontend static bundle):**
- `VITE_API_BASE_URL=http://${APP_HOSTNAME}:${BACKEND_PORT}`       # Base URL for the backend API, used by the frontend
- `VITE_WS_BASE_URL=ws://${APP_HOSTNAME}:${BACKEND_PORT}/api/collab` # WebSocket URL for real-time collaboration, used by the frontend

**AI Integration (Google Gemini):**
- `GEMINI_API_KEY=your_gemini_api_key` # Your Google Gemini API Key (keep this secret)
- `GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent` # Gemini API endpoint (example, confirm latest recommended)

**Note on `LOCALHOST_DATABASE_URL`:**
- The variable `LOCALHOST_DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${DB_PORT}/${POSTGRES_DB}` (using the external `DB_PORT`) is also present in the example `.env`. This is typically used if you need to connect to the database directly from your host machine (outside Docker) using a tool like `psql` or a database GUI, once the `db` service is running and its port is mapped.

**Rate Limiting & WebSockets (from original README, confirm if still applicable and add to .env.example if used):**
- `MAX_REQUEST_BODY_SIZE`
- `RATE_LIMIT_WINDOW`
- `RATE_LIMIT_MAX_REQUESTS`
- `HEARTBEAT_INTERVAL`
- `CLIENT_TIMEOUT`

## Development Notes & Potential Improvements

- **Rate Limiting:** Currently unused.
- **AI Script Analysis:** Potential improvements include integrating more advanced AI models and improving the accuracy of the script analysis process.
- **Frontend:** Potential improvements include adding more features and improving the user interface.

---

This document provides a comprehensive overview of the Pessoa application, covering backend, frontend, and infrastructure details.