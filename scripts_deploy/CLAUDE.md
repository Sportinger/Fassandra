# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fassandra is a collaborative theater script platform with real-time editing powered by Yjs and WebSockets. The stack consists of:
- **Backend**: Rust/Axum with PostgreSQL, JWT auth, WebSocket collaboration
- **Frontend**: React + Vite with TipTap editor, Yjs collaboration
- **Infrastructure**: Docker-based deployment with Caddy reverse proxy

This `scripts_deploy` directory contains deployment automation scripts for both development and production environments.

## Repository Context

This is the **scripts_deploy** subdirectory. The main project structure is:
```
/home/admin/Desktop/Fassandra/
├── backend/              # Rust backend (Axum, SQLx, Yjs)
├── frontend/             # React + Vite + TipTap editor
├── yjs-parser/           # Node.js utilities for Yjs document parsing
├── scripts_deploy/       # THIS DIRECTORY - deployment scripts
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Caddyfile
└── .env.prod
```

## Deployment Commands

### Local Development
```bash
# Start local dev environment (from scripts_deploy/)
./deploy.dev.sh

# Force rebuild without cache
./deploy.dev.sh --no-cache

# Access points after deployment:
# - Frontend: https://192.168.2.141:8080 (self-signed cert)
# - Backend: http://192.168.2.141:3000
# - WebSocket: ws://192.168.2.141:8090/api/collab
# - PgAdmin: http://192.168.2.141:5050
```

The dev deployment script:
1. Cleans existing containers
2. Builds containers with docker-compose
3. Starts all services (db, backend, frontend, pgadmin)
4. Performs health checks

### Production Deployment

**Fast deployment** (default - rebuilds frontend only, restarts backend):
```bash
./deploy.prod.sh
```

**Full rebuild** (when Cargo.toml or backend code changes):
```bash
./deploy.prod.sh --rebuild-backend --rebuild-frontend
```

**Restart only** (no code changes):
```bash
./deploy.prod.sh --restart-only
```

**Complete reset deployment** (builds locally, transfers images):
```bash
./deploy.prod.reset.sh

# Force rebuild without cache
./deploy.prod.reset.sh --no-cache
```

The production deployment uses:
- **Server**: 91.99.69.115 (root user)
- **Domain**: fassandra.de
- **App directory**: /home/admin/app
- **Fast deploy**: Uses rsync to sync code, rebuilds in Docker on server
- **Reset deploy**: Builds images locally, transfers as tar.gz, loads on server

### Android Build
```bash
# Build and deploy Android app with production endpoints
./build-android-prod.sh

# Debug Android app logs
./debug-android-app.sh
```

### Security Hardening
```bash
# Check production security status (run on production server)
./check-production-security.sh

# Setup production security (UFW, fail2ban, auto-updates)
sudo ./secure-production-setup.sh
```

### Maintenance
```bash
# Cleanup old Yjs updates and uploads
./maintenance/cleanup.sh
```
Requires `DATABASE_URL` environment variable. Prunes compacted Yjs updates and old uploads older than 30 days (configurable via `DAYS_YJS` and `DAYS_UPLOADS`).

## Backend Architecture

**Location**: `/home/admin/Desktop/Fassandra/backend/`

### Tech Stack
- **Language**: Rust (2021 edition)
- **Web Framework**: Axum 0.7.5 with WebSocket support
- **Database**: PostgreSQL 15 via SQLx
- **Auth**: JWT tokens in httpOnly cookies
- **Real-time**: Yjs document storage with WebSocket sync
- **Observability**: Prometheus metrics

### Key Directories
- `src/handlers/` - HTTP route handlers
- `src/services/` - Business logic (scripts, auth, Yjs, collaboration)
- `src/repositories/` - Database access layer
- `src/auth/` - JWT and authentication
- `src/models/` - Domain models
- `src/telemetry/` - Metrics and logging
- `migrations/` - SQLx database migrations

### Backend Commands
```bash
# Run locally (requires Postgres)
cd backend
cargo run

# Build for production
cargo build --release

# Run migrations
sqlx migrate run

# Hash a password for admin setup
cargo run --bin hash_password -- "password123"

# Test Yjs operations
cargo run --bin yjs_to_db
```

### Key API Endpoints
- Auth: `/register`, `/login`, `/logout`, `/api/me`, `/api/csrf-token`, `/api/ws-token`
- Scripts: `/api/scripts` (GET, POST), `/api/scripts/:id` (GET, PATCH, DELETE)
- Yjs: `/api/scripts/:id/yjs`, `/api/scripts/:id/updates`, `/api/scripts/:id/compact`
- WebSocket: `/api/collab/:script_id` - Yjs sync protocol
- Sharing: `/api/s/:script_id/share`, `/api/s/:script_id/shares`, `/api/s/:script_id/public`
- Upload: `/api/s/upload-pdf` - PDF upload and parsing

### Environment Variables (Backend)
- `DATABASE_URL` - Postgres connection string
- `JWT_SECRET` - Secret for JWT signing
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - Bootstrap admin account
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `BACKEND_PORT` - Server port (default: 3000)

## Frontend Architecture

**Location**: `/home/admin/Desktop/Fassandra/frontend/`

### Tech Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6.3
- **Editor**: TipTap 2.11 (ProseMirror-based)
- **Real-time**: Yjs + y-websocket provider
- **Mobile**: Capacitor 7.4 for Android

### Key Directories
- `src/components/` - React components (Editor, ScriptsList, etc.)
- `src/services/` - API client, WebSocket management
- `src/contexts/` - React contexts (Auth, etc.)
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript types
- `src/styles/` - Global styles and themes

### Frontend Commands
```bash
cd frontend

# Development server
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Android build
npm run android:build
```

### Environment Variables (Frontend)
- `VITE_API_BASE_URL` - Backend API URL (e.g., https://fassandra.de)
- `VITE_WS_BASE_URL` - WebSocket URL (e.g., wss://fassandra.de/api/collab)
- `VITE_GOOGLE_CLIENT_ID` - OAuth client ID

## Docker Architecture

### Development (docker-compose.dev.yml)
- **db**: PostgreSQL 15, exposed on 127.0.0.1:5432
- **backend**: Hot-reload via cargo-watch, source mounted, port 3000
- **frontend**: Vite dev server with HMR, source mounted, port 8080
- **pgadmin**: Database admin UI, port 5050
- All services use named volumes for caching (cargo_cache, target_cache, etc.)
- Memory limits: 2GB max, 512MB reserved per service

### Production (docker-compose.prod.yml)
- **caddy**: Reverse proxy, handles HTTPS, ports 80/443
- **frontend**: Static build served by Caddy, no exposed ports
- **backend**: Rust binary, no exposed ports (via Caddy)
- **db**: PostgreSQL 15, not exposed externally
- **pgadmin**: Database admin (should be removed or SSH-tunneled in production)
- Backend mounts:
  - `/app/uploads` - File uploads persistence
  - `/app/yjs-parser` - Node.js parser utilities
  - Claude Code config for AI-assisted editing features

## Yjs Document Storage

The backend implements a hybrid Yjs storage strategy:
1. **Recent updates table** (`yjs_recent_updates`) - stores incremental updates
2. **Compaction on-demand** - merges updates into base state
3. **Binary state export** - full document state via `/api/scripts/:id/yjs`

WebSocket provider (`y-websocket`) syncs updates between clients and backend.

## Testing

Backend test utilities:
```bash
# Run test binaries
cargo run --bin test_yjs_memory
cargo run --bin test_claude_session
cargo run --bin test_yjs_parsing
```

No formal test framework configured; tests are in `src/bin/test_*.rs`.

## Security Considerations

1. **CORS**: Backend enforces strict CORS via `ALLOWED_ORIGINS`
2. **Auth**: JWT in httpOnly cookies prevents XSS token theft
3. **CSRF**: `/api/csrf-token` endpoint provides tokens for state-changing operations
4. **WebSocket auth**: Requires JWT token from `/api/ws-token` for WS upgrade
5. **Production firewall**: Only 22, 80, 443 should be open (see `secure-production-setup.sh`)
6. **Rate limiting**: Applied to expensive routes (upload, thumbnails)
7. **Database**: Never expose Postgres port externally (bind to 127.0.0.1 only)

## Common Development Workflows

### Making Backend Changes
1. Edit code in `backend/src/`
2. In dev environment, changes auto-reload via cargo-watch
3. For production: `./deploy.prod.sh --rebuild-backend`

### Making Frontend Changes
1. Edit code in `frontend/src/`
2. In dev environment, Vite HMR reloads instantly
3. For production: `./deploy.prod.sh` (rebuilds frontend by default)

### Database Changes
1. Create migration: `sqlx migrate add <name>` in `backend/`
2. Edit migration SQL in `migrations/`
3. Deploy (migrations run automatically on backend startup)

### Debugging Production Issues
```bash
# SSH to production
ssh root@91.99.69.115

# Check logs
cd /home/admin/app
docker compose -f docker-compose.prod.yml logs -f

# Check specific service
docker compose -f docker-compose.prod.yml logs -f backend

# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart service
docker compose -f docker-compose.prod.yml restart backend
```

## Deployment Flow Comparison

### Fast Deploy (deploy.prod.sh)
1. Rsync backend, frontend, yjs-parser, config files to server
2. SSH to server
3. Rebuild frontend Docker image on server
4. Restart backend container (no rebuild)
5. Restart Caddy
- **Use when**: Frontend changes, small backend changes that don't require rebuild

### Reset Deploy (deploy.prod.reset.sh)
1. Build backend + frontend images locally
2. Save images as tar.gz
3. Transfer to server via SCP
4. Load images on server
5. Start services with docker compose
- **Use when**: Major changes, dependency updates, fresh deployment

## Known Configurations

- **Dev IP**: 192.168.2.141
- **Prod IP**: 91.99.69.115
- **Domain**: fassandra.de
- **License**: AGPL-3.0-or-later

## Troubleshooting

### CORS Issues
Ensure frontend origin is in backend `ALLOWED_ORIGINS`. Dev typically includes:
- https://localhost
- http://localhost
- capacitor://localhost
- http://192.168.2.141:8080
- https://192.168.2.141:8080

### WebSocket Connection Fails
1. Check `/api/ws-token` endpoint returns valid JWT
2. Verify `VITE_WS_BASE_URL` points to correct backend
3. Check WebSocket upgrade logs in backend

### Database Not Ready
Wait for PostgreSQL healthcheck:
```bash
docker exec <db_container> pg_isready -U fassandra_user
```

### Out of Memory
Backend/frontend have 2GB memory limits. If exceeded:
- Check for memory leaks in Yjs document storage
- Run maintenance cleanup: `./maintenance/cleanup.sh`
- Consider increasing limits in docker-compose files
