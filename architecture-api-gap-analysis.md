# API Gap Analysis: 96 Components vs 23 Documented Endpoints

## Summary
The backend has 96 components but only 23 documented API endpoints. This analysis reveals significant undocumented functionality.

## Documented Endpoints (23)
1. **Authentication** (4 endpoints)
   - POST /login
   - POST /register  
   - GET /health
   - POST /api/debug/console-logs

2. **Script CRUD** (6 endpoints)
   - GET /api/scripts
   - POST /api/scripts
   - GET /api/scripts/:id
   - PATCH /api/scripts/:id
   - DELETE /api/scripts/:id

3. **Script Features** (9 endpoints)
   - POST /api/scripts/:id/snapshot
   - GET /api/scripts/:id/snapshot
   - GET /scripts/:script_id/page-breaks
   - PUT /scripts/:script_id/page-breaks
   - POST /api/s/upload
   - POST /api/s/create_script_from_parsed
   - POST /api/s/:script_id/share
   - GET /api/s/:script_id/shares
   - DELETE /api/s/:script_id/shares/:share_id

4. **Real-time** (1 endpoint)
   - WS /api/collab/:script_id

5. **Frontend Routes** (2 endpoints)
   - GET /editor/:id/:title?
   - GET /scripts

## Undocumented Backend Functionality

### 1. **Missing Script Management Endpoints**
Found in `/backend/src/handlers/script.rs`:
- PATCH /api/s/:script_id/public (toggle public visibility)
- POST /api/s/:script_id/thumbnail (generate thumbnail)
- POST /api/s/thumbnails/generate (batch generate)
- POST /api/s/thumbnails/regenerate (regenerate all)

### 2. **Internal Services Without Endpoints**
These services exist but have no direct API exposure:

**CollaborationService** (`backend/src/domain/collaboration_service.rs`)
- Real-time collaboration state management
- Conflict resolution
- User presence tracking
- Likely used internally by WebSocket handler

**ContentService** (`backend/src/domain/content_service.rs`)
- Content processing and transformation
- Format conversion
- Content validation
- Used internally by snapshot and script services

**SnapshotService** (`backend/src/domain/snapshot_service.rs`)
- HTML parsing and extraction
- YJS document processing
- Content versioning
- Partially exposed via snapshot endpoints

### 3. **Background Services (No HTTP Endpoints)**
Found in `backend/src/core/service_manager.rs`:

**Async DB Writer Service**
- Handles persistence of YJS updates
- Batch writes for performance
- No direct API, triggered by WebSocket messages

**Snapshotting Service V2**
- Periodic snapshot generation
- Runs every 10 seconds
- Automatic background processing
- No direct API control

**Rate Limiter Cleanup Service**
- Cleans up expired rate limit entries
- Runs every 30 minutes
- Internal maintenance task

### 4. **External Integration Services**
**Gemini API Integration** (`backend/src/external/gemini_api.rs`)
- PDF upload and analysis
- Script content analysis
- AI-powered processing
- Used internally by script upload endpoint

### 5. **Missing Administrative/Monitoring Endpoints**
No endpoints found for:
- User management (beyond registration)
- System metrics/monitoring
- Rate limit status
- Active WebSocket connections
- Background job status
- Database health checks

### 6. **Authentication/Authorization Helpers**
Functions without direct endpoints:
- `check_script_access` - Internal authorization
- `check_script_ownership` - Internal authorization
- Token validation (used by middleware)

### 7. **Repository Layer (No Direct Endpoints)**
Database operations handled internally:
- User repository
- Script repository
- Snapshot repository
- Page break repository

## Architecture Insights

1. **Layered Architecture**: The 96 components follow a clean architecture pattern:
   - **Presentation Layer**: HTTP handlers (23 endpoints)
   - **Application Layer**: Application services (orchestration)
   - **Domain Layer**: Business logic services
   - **Infrastructure Layer**: External integrations, persistence

2. **Internal vs External**: Many components are internal services that:
   - Support the 23 public endpoints
   - Handle background processing
   - Manage real-time collaboration
   - Process content transformations

3. **Service Composition**: Public endpoints often use multiple internal services:
   - Script upload uses: ScriptApplicationService + Gemini API + ThumbnailService
   - WebSocket uses: CollaborationService + ContentService + Persistence

## Recommendations

1. **Document Internal APIs**: Even if not publicly exposed, document internal service contracts

2. **Consider Admin Endpoints**: Add monitoring/admin endpoints for:
   - Background job status
   - System health metrics
   - Active connections
   - Service statistics

3. **API Gateway Pattern**: The current architecture would benefit from:
   - Centralized API documentation
   - Service discovery
   - Rate limit visibility

4. **Missing User Features**: No endpoints for:
   - User profile management
   - User preferences
   - Account settings
   - Usage statistics

The gap between 96 components and 23 endpoints is explained by the layered architecture where most components are internal services, background workers, and support modules that enable the core functionality exposed through the public API.