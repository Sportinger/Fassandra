# God Object Refactoring Strategy 🏗️

## 🎯 Executive Summary

The Pessoa backend suffers from severe **god object epidemic** - multiple modules violating Single Responsibility Principle (SRP). This document outlines a systematic refactoring strategy to break down these monoliths into maintainable, testable components.

## 📊 Current State Analysis

### 🔴 Critical God Objects (Priority Order)

| File | Lines | Bloat KB | Severity | Complexity |
|------|-------|----------|----------|------------|
| `snapshotting_service.rs` | 1074 | 34.2 | **CRITICAL** | ⭐⭐⭐⭐⭐ |
| `lib.rs` | 1071 | 15.8 | **CRITICAL** | ⭐⭐⭐⭐⭐ |
| `main.rs` | 719 | 8.9 | **MAJOR** | ⭐⭐⭐⭐ |
| `script_handlers.rs` | 430 | 6.2 | **MAJOR** | ⭐⭐⭐ |

### 🧬 God Object Anatomy

```rust
// Current Anti-Pattern Example
impl SnapshotService {
    // YJS document processing (200+ lines)
    async fn process_yjs_updates() { /* ... */ }
    
    // HTML parsing (300+ lines)  
    async fn parse_html_content() { /* ... */ }
    
    // Database operations (200+ lines)
    async fn save_to_database() { /* ... */ }
    
    // Content extraction (300+ lines)
    async fn extract_content() { /* ... */ }
}
```

## 🎯 Refactoring Strategy

### Phase 1: Foundation Setup (Week 1)
**Goal**: Create clean architectural foundation

#### 1.1 Repository Pattern Implementation
```rust
// Create: src/repositories/mod.rs
pub mod script_repository;
pub mod block_repository;
pub mod user_repository;
pub mod snapshot_repository;

// Create: src/repositories/script_repository.rs
#[async_trait]
pub trait ScriptRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Script>, AppError>;
    async fn create(&self, script: &Script) -> Result<(), AppError>;
    async fn update(&self, script: &Script) -> Result<(), AppError>;
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
}

pub struct PostgresScriptRepository {
    pool: PgPool,
}

#[async_trait]
impl ScriptRepository for PostgresScriptRepository {
    // Clean, focused implementations
}
```

#### 1.2 Domain Services Layer
```rust
// Create: src/domain/mod.rs
pub mod script_service;
pub mod collaboration_service;
pub mod snapshot_service;
pub mod content_service;

// Create: src/domain/script_service.rs
pub struct ScriptService {
    script_repo: Arc<dyn ScriptRepository>,
    content_service: Arc<dyn ContentService>,
}

impl ScriptService {
    pub async fn create_script(&self, request: CreateScriptRequest) -> Result<Script, AppError> {
        // Pure business logic, no direct SQL
    }
}
```

### Phase 2: Snapshotting Service Demolition (Week 2)
**Target**: `snapshotting_service.rs` (1074 lines → 4 focused services)

#### 2.1 Service Decomposition
```rust
// Create: src/services/yjs_processor.rs
pub struct YjsProcessor {
    // Only YJS document processing
}

// Create: src/services/html_parser.rs  
pub struct HtmlParser {
    // Only HTML parsing and sanitization
}

// Create: src/services/content_extractor.rs
pub struct ContentExtractor {
    // Only content extraction logic
}

// Create: src/services/snapshot_coordinator.rs
pub struct SnapshotCoordinator {
    yjs_processor: Arc<dyn YjsProcessor>,
    html_parser: Arc<dyn HtmlParser>,
    content_extractor: Arc<dyn ContentExtractor>,
    snapshot_repo: Arc<dyn SnapshotRepository>,
}
```

#### 2.2 Breaking Down the Monster Function
```rust
// Current: create_snapshot_for_script() - 800+ lines
// New: Multiple focused functions

impl SnapshotCoordinator {
    pub async fn create_snapshot(&self, script_id: Uuid) -> Result<(), AppError> {
        let updates = self.fetch_pending_updates(script_id).await?;
        let processed = self.yjs_processor.process_updates(updates).await?;
        let content = self.content_extractor.extract_content(&processed).await?;
        let parsed = self.html_parser.parse_and_sanitize(&content).await?;
        self.snapshot_repo.save_snapshot(script_id, parsed).await?;
        Ok(())
    }

    // Each method: 20-50 lines, single responsibility
    async fn fetch_pending_updates(&self, script_id: Uuid) -> Result<Vec<Update>, AppError> {
        // Focused database query
    }
}
```

### Phase 3: Core Library Refactoring (Week 3)
**Target**: `lib.rs` (1071 lines → Clean application composition)

#### 3.1 Application Layer
```rust
// Create: src/application/mod.rs
pub mod script_app_service;
pub mod collaboration_app_service;
pub mod user_app_service;

// Create: src/application/script_app_service.rs
pub struct ScriptAppService {
    script_service: Arc<dyn ScriptService>,
    permission_service: Arc<dyn PermissionService>,
    event_bus: Arc<dyn EventBus>,
}

impl ScriptAppService {
    pub async fn handle_create_script(&self, request: CreateScriptRequest) -> Result<ScriptResponse, AppError> {
        // Orchestrate domain services
        self.permission_service.check_create_permission(&request.user_id).await?;
        let script = self.script_service.create_script(request).await?;
        self.event_bus.publish(ScriptCreatedEvent::new(script.id)).await?;
        Ok(ScriptResponse::from(script))
    }
}
```

#### 3.2 Clean Application Composition
```rust
// Refactored: src/lib.rs (1071 lines → ~200 lines)
pub mod repositories;
pub mod domain;
pub mod application;
pub mod infrastructure;

pub struct AppState {
    script_app_service: Arc<ScriptAppService>,
    collaboration_app_service: Arc<CollaborationAppService>,
    user_app_service: Arc<UserAppService>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, AppError> {
        // Clean dependency injection
        let db_pool = create_pool(&config.database_url).await?;
        
        // Repositories
        let script_repo = Arc::new(PostgresScriptRepository::new(db_pool.clone()));
        let user_repo = Arc::new(PostgresUserRepository::new(db_pool.clone()));
        
        // Domain services
        let script_service = Arc::new(ScriptService::new(script_repo));
        let permission_service = Arc::new(PermissionService::new(user_repo));
        
        // Application services
        let script_app_service = Arc::new(ScriptAppService::new(
            script_service,
            permission_service,
        ));
        
        Ok(Self {
            script_app_service,
            // ... other services
        })
    }
}
```

### Phase 4: Handler Refactoring (Week 4)
**Target**: `script_handlers.rs` (430 lines → Clean HTTP controllers)

#### 4.1 Clean HTTP Controllers
```rust
// Refactored: src/handlers/script_handlers.rs (430 → ~150 lines)
pub struct ScriptHandlers {
    app_service: Arc<ScriptAppService>,
}

impl ScriptHandlers {
    pub async fn create_script(
        State(state): State<AppState>,
        Json(request): Json<CreateScriptRequest>,
    ) -> Result<Json<ScriptResponse>, AppError> {
        // Just HTTP → Application layer delegation
        let response = state.script_app_service.handle_create_script(request).await?;
        Ok(Json(response))
    }
    
    pub async fn get_script(
        State(state): State<AppState>,
        Path(id): Path<Uuid>,
    ) -> Result<Json<ScriptResponse>, AppError> {
        let response = state.script_app_service.handle_get_script(id).await?;
        Ok(Json(response))
    }
}
```

#### 4.2 Router Composition
```rust
// Clean router setup
pub fn create_script_routes() -> Router<AppState> {
    Router::new()
        .route("/scripts", post(ScriptHandlers::create_script))
        .route("/scripts/:id", get(ScriptHandlers::get_script))
        .route("/scripts/:id", put(ScriptHandlers::update_script))
        .route("/scripts/:id", delete(ScriptHandlers::delete_script))
        .layer(RateLimitLayer::new(/* config */))
        .layer(AuthLayer::new())
}
```

### Phase 5: Main Application Cleanup (Week 5)
**Target**: `main.rs` (719 lines → Clean application bootstrap)

#### 5.1 Clean Application Bootstrap
```rust
// Refactored: src/main.rs (719 → ~150 lines)
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configuration
    let config = Config::from_env()?;
    
    // Application setup
    let app_state = AppState::new(config).await?;
    
    // Router composition
    let app = create_app_router(app_state);
    
    // Server startup
    let listener = TcpListener::bind(&config.server_addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

fn create_app_router(state: AppState) -> Router {
    Router::new()
        .nest("/api/v1", create_api_routes())
        .nest("/ws", create_websocket_routes())
        .with_state(state)
        .layer(create_middleware_stack())
}
```

## 📋 Implementation Checklist

### Phase 1: Foundation Setup ✅
- [ ] Create repository pattern interfaces
- [ ] Implement PostgreSQL repositories
- [ ] Create domain service layer
- [ ] Set up dependency injection framework
- [ ] Create application service layer

### Phase 2: Snapshotting Service Demolition ✅
- [ ] Extract YJS processor service
- [ ] Extract HTML parser service  
- [ ] Extract content extractor service
- [ ] Create snapshot coordinator
- [ ] Break down monster function (800+ lines)
- [ ] Add comprehensive tests for each service

### Phase 3: Core Library Refactoring ✅
- [ ] Create application services
- [ ] Implement clean composition root
- [ ] Extract routing logic
- [ ] Remove direct SQL from lib.rs
- [ ] Add integration tests

### Phase 4: Handler Refactoring ✅
- [ ] Create focused HTTP controllers
- [ ] Remove business logic from handlers
- [ ] Implement clean error handling
- [ ] Add authorization middleware
- [ ] Create handler tests

### Phase 5: Main Application Cleanup ✅
- [ ] Clean application bootstrap
- [ ] Extract configuration management
- [ ] Implement graceful shutdown
- [ ] Add health checks
- [ ] Create deployment scripts

## 🧪 Testing Strategy

### Unit Tests (Each Service)
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_yjs_processor_handles_updates() {
        let mock_repo = MockSnapshotRepository::new();
        let processor = YjsProcessor::new(mock_repo);
        
        let updates = vec![/* test data */];
        let result = processor.process_updates(updates).await;
        
        assert!(result.is_ok());
    }
}
```

### Integration Tests (Service Composition)
```rust
#[tokio::test]
async fn test_complete_snapshot_workflow() {
    let test_db = setup_test_database().await;
    let services = create_test_services(test_db).await;
    
    // Test complete workflow
    let script_id = create_test_script().await;
    services.snapshot_coordinator.create_snapshot(script_id).await.unwrap();
    
    // Verify results
    let snapshot = services.snapshot_repo.find_by_script_id(script_id).await.unwrap();
    assert!(snapshot.is_some());
}
```

### End-to-End Tests (HTTP API)
```rust
#[tokio::test]
async fn test_script_creation_api() {
    let app = create_test_app().await;
    
    let response = app
        .post("/api/v1/scripts")
        .json(&CreateScriptRequest { /* ... */ })
        .send()
        .await;
    
    assert_eq!(response.status(), StatusCode::CREATED);
}
```

## 🚀 Migration Strategy

### Safe Migration Approach
1. **Dual Implementation**: Keep old code while building new
2. **Feature Flag**: Switch between implementations
3. **Gradual Rollout**: Migrate one endpoint at a time
4. **Monitoring**: Track performance and errors
5. **Rollback Plan**: Quick revert if issues arise

### Migration Steps
```rust
// Step 1: Feature flag
#[cfg(feature = "new_architecture")]
use crate::services::new_script_service::ScriptService;

#[cfg(not(feature = "new_architecture"))]
use crate::legacy::script_service::ScriptService;

// Step 2: Gradual migration
async fn handle_create_script(request: CreateScriptRequest) -> Result<ScriptResponse, AppError> {
    if feature_enabled("new_script_service") {
        new_script_service.create_script(request).await
    } else {
        legacy_script_service.create_script(request).await
    }
}
```

## 📊 Success Metrics

### Code Quality Metrics
- **Lines per file**: Target < 300 lines
- **Cyclomatic complexity**: Target < 10 per function
- **Test coverage**: Target > 80%
- **Dependency coupling**: Minimize circular dependencies

### Performance Metrics
- **Response time**: Maintain < 200ms for API calls
- **Memory usage**: Reduce by 30% through better allocation
- **Database queries**: Eliminate N+1 queries
- **CPU usage**: Reduce by 25% through better algorithms

### Maintainability Metrics
- **Build time**: Keep < 60 seconds
- **Test execution**: Keep < 30 seconds
- **Documentation**: 100% public API documented
- **Code review**: < 2 hours average review time

## 🎯 Expected Outcomes

### ✅ Immediate Benefits
- **Testability**: Each service can be unit tested in isolation
- **Maintainability**: Clear separation of concerns
- **Readability**: Code is self-documenting
- **Debugging**: Easier to trace issues

### ✅ Long-term Benefits
- **Scalability**: Services can scale independently
- **Team Productivity**: Parallel development possible
- **Technical Debt**: Significantly reduced
- **Performance**: Optimized for specific use cases

## 🚧 Risk Assessment

### High Risk
- **Database Migration**: Schema changes during refactoring
- **WebSocket Integration**: Real-time features disruption
- **Performance Regression**: New architecture overhead

### Mitigation Strategies
- **Database**: Use migrations with rollback capability
- **WebSocket**: Maintain compatibility layer
- **Performance**: Continuous monitoring and optimization

## 🎭 Theater Professional Standards

This refactoring aligns with theater professional standards:
- **Reliability**: Each service does one thing well
- **Predictability**: Clear interfaces and contracts
- **Maintainability**: Easy to modify and extend
- **Performance**: Optimized for real-time collaboration

---

## 🚀 Getting Started

1. **Review this document** with the team
2. **Set up development environment** with feature flags
3. **Start with Phase 1** - Repository pattern
4. **Run tests continuously** - Never break working code
5. **Monitor performance** - Keep theater users happy

**Remember**: We're building a foundation that theater professionals can depend on. Quality over speed. 🎭 