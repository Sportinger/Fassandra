# Pessoa Theater Collaboration Platform - Codebase Analysis Report

## Executive Summary

The Pessoa Theater Collaboration Platform is a full-stack web application designed for collaborative theater script editing and management. Built with a Rust backend (Actix-web framework) and React/TypeScript frontend, it leverages YJS for real-time collaborative editing, WebSockets for live synchronization, and PostgreSQL for data persistence. The platform supports web and mobile access (via Capacitor for Android) and uses Docker for containerized deployment.

## Architecture Overview

### Technology Stack

- **Backend**: Rust with Actix-web framework
- **Frontend**: React 18 with TypeScript, Vite bundler
- **Database**: PostgreSQL 15
- **Real-time Collaboration**: YJS (Yjs library) with WebSocket transport
- **Mobile**: Capacitor framework for Android APK builds
- **Deployment**: Docker containers with Caddy reverse proxy
- **Authentication**: JWT-based with cookie storage and CSRF protection

### Project Structure

```
pessoa/
├── backend/                 # Rust backend application
│   ├── src/
│   │   ├── application/    # Application services layer
│   │   ├── auth/           # Authentication & authorization
│   │   ├── core/           # Core server setup & routing
│   │   ├── domain/         # Domain business logic
│   │   ├── handlers/       # HTTP request handlers
│   │   ├── infrastructure/ # Config & middleware
│   │   ├── models/         # Data models & entities
│   │   ├── networking/     # WebSocket implementation
│   │   ├── repositories/   # Data access layer
│   │   └── services/       # Business services
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # Frontend services
│   │   └── utils/          # Utility functions
├── yjs-parser/             # YJS document parsing utilities
├── scripts/                # Deployment & maintenance scripts
└── docker-compose.*.yml    # Docker configurations
```

## API Endpoints Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | User registration | No |
| POST | `/login` | User login | No |
| POST | `/logout` | User logout | Yes |
| GET | `/api/me` | Get current user info | Yes |
| GET | `/api/csrf-token` | Get CSRF token | Yes |
| GET | `/api/ws-token` | Get WebSocket token | Yes |

### Script Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/scripts` | List user scripts | Yes |
| POST | `/api/scripts` | Create new script | Yes |
| GET | `/api/scripts/{id}` | Get script with YJS state | Yes |
| PATCH | `/api/scripts/{id}` | Update script title | Yes |
| DELETE | `/api/scripts/{id}` | Delete script | Yes |

### YJS Collaboration Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/scripts/{id}/yjs` | Get YJS document state | Yes |
| GET | `/api/scripts/{id}/updates` | Get recent YJS updates | Yes |
| POST | `/api/scripts/{id}/compact` | Trigger YJS compaction | Yes |
| GET | `/api/parsing/{session_id}/status` | Get parsing status | Yes |

### Script Sharing Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/s/{script_id}/share` | Share script with user | Yes |
| GET | `/api/s/{script_id}/shares` | Get script shares | Yes |
| DELETE | `/api/s/{script_id}/shares/{share_id}` | Remove share | Yes |
| PATCH | `/api/s/{script_id}/public` | Toggle public status | Yes |

### File Upload & Processing Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/s/upload-pdf` | Upload & parse PDF script | Yes |
| POST | `/api/s/parse-pdf/*path` | Parse existing PDF | Yes |

### Thumbnail Generation Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/s/{script_id}/thumbnail` | Generate thumbnail | Yes |
| POST | `/api/s/thumbnails/generate` | Generate all missing | Yes |
| POST | `/api/s/thumbnails/regenerate` | Regenerate all | Yes |

### Claude Session Monitoring Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/s/session/{session_id}` | Get session status | Yes |
| GET | `/api/s/session/{session_id}/logs` | Get session logs | Yes |
| POST | `/api/s/session/{session_id}/cancel` | Cancel session | Yes |
| GET | `/api/s/session/{session_id}/ws` | WebSocket connection | Yes |

### WebSocket Endpoints

| Protocol | Endpoint | Description | Auth Required |
|----------|----------|-------------|---------------|
| WS | `/api/collab/{script_id}` | Real-time collaboration | Yes |

### Health & Monitoring

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check with service status | No |
| POST | `/api/debug/console-logs` | Submit client logs | Yes |

## Database Schema

### Core Tables

#### users
- `id` (UUID, Primary Key)
- `email` (Text, Unique)
- `username` (Text)
- `password_hash` (Text)
- `role` (Text, Default: 'reader')
- `created_at` (Timestamp)

#### scripts
- `id` (UUID, Primary Key)
- `title` (Text)
- `created_by` (UUID, References users)
- `created_at` (Timestamp)
- `is_public` (Boolean, Default: false)
- `thumbnail` (Text, nullable)

### YJS Collaboration Tables

#### yjs_base_states
- `script_id` (UUID, Primary Key, References scripts)
- `base_state` (Bytea) - Compacted YJS document state
- `state_vector` (Bytea) - YJS state vector for incremental updates
- `compacted_at` (Timestamp)
- `last_compacted_update_id` (BigInt)
- `update_count` (Integer)
- `document_size` (Integer)

#### yjs_recent_updates
- `id` (BigSerial, Primary Key)
- `script_id` (UUID, References scripts)
- `update_data` (Bytea) - YJS update binary data
- `user_id` (UUID, nullable)
- `created_at` (Timestamp)
- `expires_at` (Timestamp)
- `is_compacted` (Boolean)

#### yjs_compaction_log
- `id` (Serial, Primary Key)
- `script_id` (UUID)
- `updates_compacted` (Integer)
- `size_before` (Integer)
- `size_after` (Integer)
- `duration_ms` (Integer)
- `created_at` (Timestamp)

### Sharing Tables

#### script_shares
- `id` (UUID, Primary Key)
- `script_id` (UUID, References scripts)
- `shared_with` (UUID, References users)
- `permission` (Text) - 'viewer' or 'editor'
- `created_at` (Timestamp)

## Key Services & Business Logic

### Backend Services

1. **ScriptApplicationService** (`/backend/src/application/script_application_service.rs`)
   - Handles CRUD operations for scripts
   - Manages YJS document initialization
   - Coordinates with repositories and domain services

2. **YjsCompactionService** (`/backend/src/services/yjs_compaction_service.rs`)
   - Performs periodic compaction of YJS updates
   - Optimizes storage by merging updates into base states
   - Manages document loading and state reconstruction

3. **YjsBaseStateService** (`/backend/src/services/yjs_base_state_service.rs`)
   - Manages base YJS document states
   - Handles state persistence and retrieval

4. **ClaudeSessionService** (`/backend/src/services/claude_session_service.rs`)
   - Manages AI-powered script parsing sessions
   - Monitors Claude Code processes for PDF parsing
   - Provides real-time status updates via WebSocket

5. **WebSocket Handler** (`/backend/src/networking/websocket.rs`)
   - Manages real-time collaboration connections
   - Broadcasts YJS updates between clients
   - Handles awareness updates for user presence
   - Implements heartbeat/ping-pong for connection health

### Frontend Services

1. **YjsDocumentManager** (`/frontend/src/services/yjsDocumentManager.ts`)
   - Singleton manager for YJS documents
   - Ensures document persistence across reconnections
   - Manages reference counting and cleanup

2. **ApiService** (`/frontend/src/services/ApiService.ts`)
   - Centralized HTTP client with JWT authentication
   - Implements retry logic and error handling
   - Manages CSRF token validation

3. **ScriptEventBus** (`/frontend/src/services/ScriptEventBus.ts`)
   - Event-driven communication between components
   - Handles script lifecycle events

## Real-time Collaboration Features

### YJS Integration

The platform uses YJS (a CRDT library) for conflict-free collaborative editing:

1. **Document Structure**: Each script is represented as a YJS document containing:
   - `xmlFragment`: The main content tree for TipTap editor
   - Page indicators, scene blocks, dialogue blocks, and cues

2. **Synchronization Flow**:
   ```
   Client A → YJS Update → WebSocket → Server → Broadcast → Other Clients
                              ↓
                         Persistence to DB
   ```

3. **Compaction Strategy**:
   - Recent updates stored temporarily in `yjs_recent_updates`
   - Periodic compaction merges updates into `yjs_base_states`
   - Reduces storage and improves load performance

### WebSocket Protocol

- **Connection**: Authenticated via JWT token
- **Message Types**:
  - Sync messages (YJS protocol)
  - Awareness updates (user presence)
  - Heartbeat/ping-pong (connection health)
- **Session Management**: Tracks active clients per script
- **Cleanup**: Automatic removal of inactive sessions

## Security Features

1. **Authentication**:
   - JWT tokens with secure HttpOnly cookies
   - CSRF protection with double-submit cookies
   - WebSocket authentication via token validation

2. **Authorization**:
   - Role-based access control (admin, editor, reader)
   - Script ownership verification
   - Share permission management

3. **Rate Limiting**:
   - Per-IP and per-user rate limits
   - Enhanced limits for file uploads
   - WebSocket connection throttling

4. **Security Headers**:
   - Content Security Policy (CSP)
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security (HSTS)

## Deployment Infrastructure

### Docker Architecture

```yaml
Services:
  - caddy (Reverse Proxy)
    - SSL termination
    - Load balancing
    - Static file serving
  
  - frontend (React App)
    - Nginx serving built assets
    - SPA routing configuration
  
  - backend (Rust API)
    - Actix-web server
    - WebSocket handling
    - File processing
  
  - db (PostgreSQL)
    - Data persistence
    - Connection pooling
  
  - pgadmin (Database Admin)
    - Database management UI
```

### Environment Configuration

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Token signing key
- `CORS_ORIGINS`: Allowed origins list
- `GEMINI_API_KEY`: AI service integration
- `ADMIN_EMAIL/USERNAME/PASSWORD`: Admin credentials

### Deployment Scripts

- `/scripts/deploy.prod.sh`: Production deployment
- `/scripts/deploy.dev.sh`: Development deployment
- `/scripts/secure-production-setup.sh`: Security hardening
- `/scripts/check-production-security.sh`: Security audit

## Mobile Support

### Capacitor Integration

The platform supports Android deployment via Capacitor:

1. **Build Process**:
   - Frontend built for production
   - Assets copied to Android project
   - APK generated with gradle

2. **Native Features**:
   - File system access for uploads
   - Camera/microphone permissions
   - Offline capability with service workers

3. **Build Commands**:
   - `build-android-prod.sh`: Production APK
   - `build-android-cloud.sh`: Cloud build
   - `debug-android-app.sh`: Debug tools

## Performance Optimizations

1. **YJS Compaction**: Reduces document size by merging updates
2. **API Caching**: Frontend caches with TTL management
3. **Lazy Loading**: Code splitting for routes and components
4. **WebSocket Pooling**: Reuses connections for multiple operations
5. **Database Indexing**: Optimized queries with proper indexes
6. **Request Debouncing**: Prevents excessive API calls

## Development Workflow

### Local Development

```bash
# Backend
cd backend
cargo run

# Frontend
cd frontend
npm run dev

# Docker
docker-compose -f docker-compose.dev.yml up
```

### Testing

- Backend: SQLx compile-time query verification
- Frontend: Vitest for unit tests, Playwright for E2E
- Database: Migration testing with rollback support

### CI/CD Considerations

The codebase is structured for CI/CD with:
- Dockerized builds for consistency
- Environment-based configuration
- Health checks for monitoring
- Graceful shutdown handling
- Structured logging with tracing

## Key Observations & Recommendations

### Strengths

1. **Clean Architecture**: Well-separated concerns with application, domain, and infrastructure layers
2. **Type Safety**: Rust backend and TypeScript frontend provide compile-time guarantees
3. **Real-time Collaboration**: Robust YJS implementation with compaction optimization
4. **Security**: Comprehensive authentication and authorization mechanisms
5. **Scalability**: Docker-based deployment with load balancing capability

### Areas for Potential Enhancement

1. **API Documentation**: Consider adding OpenAPI/Swagger documentation
2. **Test Coverage**: Expand unit and integration test suites
3. **Monitoring**: Implement structured metrics collection (Prometheus/Grafana)
4. **Caching Layer**: Consider Redis for session management and caching
5. **Background Jobs**: Implement job queue for async processing (thumbnail generation, PDF parsing)
6. **API Versioning**: Prepare for backward compatibility with versioned endpoints
7. **Database Migrations**: Consider implementing down migrations for rollback capability
8. **WebSocket Scaling**: Plan for horizontal scaling with Redis pub/sub for WebSocket distribution

## Conclusion

The Pessoa Theater Collaboration Platform demonstrates a modern, well-architected full-stack application with strong emphasis on real-time collaboration, security, and user experience. The codebase follows best practices for both Rust and React development, with clear separation of concerns and comprehensive error handling. The YJS integration provides a solid foundation for conflict-free collaborative editing, while the Docker-based deployment ensures consistency across environments.

The platform is production-ready with room for growth in areas like monitoring, caching, and horizontal scaling as user adoption increases.