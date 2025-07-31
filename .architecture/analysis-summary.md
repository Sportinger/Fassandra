# Architecture Analysis Summary - Deep Investigation

## 1. Frontend-Backend API Mappings

### API Client Architecture
- **Primary Client**: `/frontend/src/api.ts` - Refactored version using ApiService
- **ApiService**: `/frontend/src/services/ApiService.ts` - Generic service with JWT auth
- **Legacy Client**: `/frontend/src/api-original.ts` - Original implementation

### Key API Endpoints Discovered

#### Authentication (No JWT required)
- `POST /login` - User authentication
- `POST /register` - New user registration

#### Script Operations (JWT required)
- `GET /api/scripts` - Get all user scripts
- `POST /api/scripts` - Create new script
- `GET /api/scripts/:id` - Get script with blocks
- `PATCH /api/scripts/:id` - Update script title
- `DELETE /api/scripts/:id` - Delete script
- `PATCH /api/scripts/:id/content` - Save TipTap HTML content
- `POST /api/scripts/:id/snapshot` - Store content snapshot
- `GET /api/scripts/:id/snapshot` - Get content snapshot

#### Page Breaks (JWT required)
- `GET /api/scripts/:id/page-breaks` - Get page break info
- `PUT /api/scripts/:id/page-breaks` - Update page breaks

#### Sharing (JWT required)
- `POST /api/s/:id/share` - Share script with user
- `GET /api/s/:id/shares` - Get script shares
- `DELETE /api/s/:id/shares/:shareId` - Remove script share
- `PATCH /api/s/:id/public` - Toggle public status

#### Thumbnails (JWT required, rate-limited)
- `POST /api/s/thumbnails/generate` - Generate all missing thumbnails
- `POST /api/s/thumbnails/regenerate` - Force regenerate all thumbnails
- `POST /api/s/:id/thumbnail` - Generate single thumbnail

## 2. Page Break Handler Implementation

### Architecture
- **Handler**: `/backend/src/handlers/page_break_handlers.rs`
- **Router**: Created via `create_page_break_router()`
- **Purpose**: Manages pagination for printed scripts

### Key Features
- Stores page numbers for individual blocks
- Provides content preview (first 100 chars)
- Maintains block order within scripts
- Access control via script ownership verification

### Data Structures
```rust
BlockPageUpdate {
    block_id: Uuid,
    page_number: i32
}

BlockPageInfo {
    block_id: Uuid,
    block_type: String,
    content_preview: String,
    page_number: i32,
    block_order: i32
}
```

## 3. Thumbnail Service Architecture

### Components
1. **Application Service**: `/backend/src/application/thumbnail_application_service.rs`
   - Orchestrates thumbnail workflows
   - Validates permissions and ownership
   - Handles bulk operations

2. **Core Service**: `/backend/src/services/thumbnail.rs`
   - Generates SVG thumbnails (150x267px, 9:16 ratio)
   - Formats content based on block types
   - Escapes HTML for XSS prevention
   - Base64 encodes SVG data

### Thumbnail Generation Process
1. Fetches script with blocks
2. Formats first 8 blocks (100 words max)
3. Creates SVG with transparent background
4. Stores as base64 data URL in database

### Security Features
- HTML escaping in SVG content
- Ownership verification before generation
- Rate limiting on thumbnail endpoints

## 4. Script Sharing Permission System

### Permission Levels
- **read**: View-only access
- **write**: Edit access (full collaboration)

### Components
1. **Models**: `/backend/src/models/script_share.rs`
   - SharePermission enum
   - ScriptShare entity

2. **Application Service**: `/backend/src/application/script_sharing_application_service.rs`
   - Validates sharing operations
   - Prevents self-sharing
   - Manages share lifecycle

### Key Features
- Username-based sharing (not email)
- Owner can manage all shares
- Public toggle for anonymous access
- Audit trail with created_by/created_at

### Access Control Flow
1. Verify script ownership
2. Validate target user exists
3. Check not self-sharing
4. Create/update share record
5. Return share with username

## Database Relationships

### Thumbnail Dependencies
- `thumbnail-application-service` → `script-service` (ownership validation)
- `thumbnail-core-service` → `script-repository` (content fetching)
- `scripts` table has `thumbnail` TEXT field

### Sharing Dependencies
- `script-sharing-application-service` → `script-service` (ownership)
- `script-sharing-application-service` → `user-repository` (user lookup)
- `script_shares` table links scripts to users with permissions

### Page Break Dependencies
- `page-break-handler` → `block-repository` (updates page_number)
- `blocks` table has `page_number` INTEGER field

## Key Architectural Patterns

1. **Layered Architecture**
   - HTTP handlers → Application Services → Domain Services → Repositories

2. **Security First**
   - JWT authentication on all protected endpoints
   - Rate limiting on resource-intensive operations
   - XSS prevention in thumbnail generation

3. **Clean Separation**
   - Business logic in application services
   - HTTP concerns in handlers
   - Domain rules in domain services

4. **Error Handling**
   - Typed errors (AppError)
   - Proper status codes
   - User-friendly messages

## Performance Considerations

1. **Thumbnail Generation**
   - Limited to first 100 words
   - Maximum 8 blocks
   - Batch operations available

2. **Rate Limiting**
   - Applied to file uploads
   - Applied to thumbnail generation
   - Protects against abuse

3. **Database Queries**
   - Optimized with proper indexes
   - Batch operations where possible
   - Pagination support planned