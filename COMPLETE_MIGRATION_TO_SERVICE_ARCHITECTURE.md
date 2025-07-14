# Complete Migration to Service-Oriented Architecture

## 🎯 Mission: Eliminate Monolithic lib.rs Dependencies

**Goal**: Complete the migration from the monolithic `lib.rs` approach to a clean service-oriented architecture, allowing us to safely remove the old database access patterns.

## 📊 Current State Analysis

### ✅ **Already Migrated (New Service Architecture)**
- **Script Upload**: `/api/s/upload` → `ScriptApplicationService::upload_and_parse_script()`
- **Script Creation from AI**: `/api/s/create_script_from_parsed` → `ScriptApplicationService::create_script_from_parsed()`
- **Script Sharing**: `/api/s/:script_id/share` → `ScriptSharingApplicationService::share_script()`
- **Share Management**: `/api/s/:script_id/shares` → `ScriptSharingApplicationService`
- **Thumbnail Generation**: `/api/s/:script_id/thumbnail` → `ThumbnailApplicationService`

### ❌ **Still Using Monolithic Approach**
- **Script Listing**: `GET /api/scripts` → `api::scripts::get_user_scripts()` (direct DB)
- **Script Creation**: `POST /api/scripts` → `api::scripts::create_script()` (direct DB)
- **Script Update**: `PATCH /api/scripts/:id` → `api::scripts::update_script()` (direct DB)
- **Script Delete**: `DELETE /api/scripts/:id` → `api::scripts::delete_script()` (direct DB)
- **Content Snapshots**: `/api/scripts/:id/snapshot` → `api::scripts::store_content_snapshot()` (direct DB)

### 🔗 **Dependencies Still in lib.rs**
- `create_script_from_parsed()` - Used by `ScriptApplicationService`
- `create_script_services()` - Used by `ServiceManager`
- Various database helper functions
- Script layout management functions

## 🚧 Migration Strategy

### **Phase 1: Service Layer Enhancement**
Enhance the existing `ScriptApplicationService` to handle all CRUD operations through the repository pattern, not direct database calls.

### **Phase 2: Route Migration**
Migrate all `/api/scripts*` routes to use the enhanced service layer instead of direct database functions.

### **Phase 3: Cleanup**
Remove the old monolithic functions and consolidate everything into the clean service architecture.

## 📋 Detailed Implementation Plan

### **Step 1: Analyze Current Dependencies**
- Map all current `/api/scripts` operations to required service methods
- Identify which functions in `lib.rs` are still actively used
- Document current error handling patterns

### **Step 2: Enhance ScriptApplicationService**
Add missing CRUD methods to `ScriptApplicationService`:
```rust
// Add these methods to ScriptApplicationService
pub async fn list_user_scripts(&self, user_id: Uuid) -> Result<Vec<Script>, AppError>
pub async fn create_script(&self, title: String, user_id: Uuid) -> Result<Script, AppError>
pub async fn update_script(&self, script_id: Uuid, title: String, user_id: Uuid) -> Result<Script, AppError>
pub async fn delete_script(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError>
pub async fn store_content_snapshot(&self, script_id: Uuid, content: String, format: String, user_id: Uuid) -> Result<(), AppError>
pub async fn get_content_snapshot(&self, script_id: Uuid, user_id: Uuid) -> Result<ContentSnapshot, AppError>
```

### **Step 3: Migrate Routes One by One**
Update each route in `server.rs` to use `ScriptServices` instead of direct `api::scripts` calls:

1. **GET /api/scripts** → `services.script_service.list_user_scripts()`
2. **POST /api/scripts** → `services.script_service.create_script()`
3. **PATCH /api/scripts/:id** → `services.script_service.update_script()`
4. **DELETE /api/scripts/:id** → `services.script_service.delete_script()`
5. **POST /api/scripts/:id/snapshot** → `services.script_service.store_content_snapshot()`
6. **GET /api/scripts/:id/snapshot** → `services.script_service.get_content_snapshot()`

### **Step 4: Remove Old API Module**
Once all routes are migrated, remove:
- `backend/src/api/scripts.rs` (entire file)
- `backend/src/api/mod.rs` (if no other api modules remain)

### **Step 5: Refactor lib.rs Dependencies**
Move remaining functions from `lib.rs` to appropriate service layers:
- `create_script_from_parsed()` → Move to `ScriptApplicationService`
- `create_script_services()` → Move to `ServiceManager`
- Helper functions → Move to appropriate repositories

### **Step 6: Final Cleanup**
Transform `lib.rs` from a monolithic database access layer to a clean module export file:
```rust
// New lib.rs should only contain module exports
pub mod error;
pub mod models;
pub mod handlers;
pub mod services;
pub mod repositories;
pub mod domain;
pub mod application;
pub mod config;
pub mod auth;
pub mod server;
// ... other modules
```

## 🔒 Security Considerations

- **Authentication**: Ensure all new service methods properly verify user permissions
- **Authorization**: Maintain existing ownership checks for script operations
- **Input Validation**: Preserve all existing validation logic
- **Rate Limiting**: Keep rate limiting on resource-intensive operations

## 🧪 Testing Strategy

### **Before Migration**
- Document current behavior with integration tests
- Ensure all existing tests pass

### **During Migration**
- Test each route as it's migrated
- Verify error handling maintains same behavior
- Check authentication/authorization still works

### **After Migration**
- Run complete test suite: `node run-complete-test.js --workflow`
- Verify all API endpoints work identically
- Test error scenarios and edge cases

## 📊 Expected Outcomes

### **Code Quality Improvements**
- **Consistency**: All routes use the same service-oriented pattern
- **Maintainability**: Clear separation of concerns
- **Testability**: Easier to unit test individual services
- **Scalability**: Service layer can be easily extended

### **Architecture Benefits**
- **Clean Dependencies**: No more direct database calls in handlers
- **Repository Pattern**: Consistent data access pattern
- **Domain Services**: Business logic properly encapsulated
- **Error Handling**: Consistent error patterns across all routes

### **Performance**
- **No Performance Impact**: Same underlying database operations
- **Better Caching**: Service layer can implement caching strategies
- **Connection Pooling**: Consistent connection management

## 🚨 Risk Assessment

### **Low Risk**
- **Existing Tests**: Current behavior is well-tested
- **Incremental Migration**: Each route can be migrated independently
- **Rollback Capability**: Changes can be easily reverted if needed

### **Medium Risk**
- **Authentication Changes**: Need to verify all security checks are preserved
- **Error Handling**: Must maintain exact same error responses for API compatibility

### **Mitigation Strategies**
- **Gradual Migration**: One route at a time
- **Thorough Testing**: Test each change immediately
- **Documentation**: Keep track of all changes made

## 🎭 Theater Professional Impact

**Zero Impact**: This is purely an internal refactoring. Theater professionals will experience:
- ✅ **Same API Endpoints**: All URLs and request/response formats unchanged
- ✅ **Same Performance**: No performance degradation
- ✅ **Same Features**: All functionality preserved
- ✅ **Better Reliability**: Cleaner code means fewer bugs

## 📈 Success Metrics

- [ ] **All routes migrated** to service-oriented architecture
- [ ] **Zero API breaking changes** - all existing clients work unchanged
- [ ] **Complete test suite passes** - `node run-complete-test.js --workflow`
- [ ] **lib.rs reduced** from 1156 lines to ~50 lines (module exports only)
- [ ] **Consistent error handling** across all endpoints
- [ ] **Authentication/authorization preserved** in all operations

## 🎉 Post-Migration Benefits

Once complete, the system will have:
- **Clean Architecture**: Repository → Domain Service → Application Service → Handler
- **Consistent Patterns**: All CRUD operations follow the same structure
- **Easy Testing**: Each layer can be unit tested independently
- **Future Ready**: Easy to add new features or modify existing ones
- **Maintainable**: Clear separation of concerns and single responsibility

---

**This migration represents the final step in transforming the Pessoa backend from a monolithic "god object" architecture to a clean, maintainable, service-oriented system worthy of production theater professionals.** 