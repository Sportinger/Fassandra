# 🛠️ Backend Architecture

Comprehensive documentation for Pessoa's Rust-based backend system built with Axum and PostgreSQL.

## 🎯 Overview

Pessoa's backend is a high-performance, async Rust application built with Axum framework. It provides REST APIs, WebSocket real-time collaboration, AI integration, and robust data persistence with PostgreSQL.

## 🏗️ Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Rust** | 1.70+ | Core language for performance and safety |
| **Axum** | 0.6+ | Modern async web framework |
| **PostgreSQL** | 15+ | Primary database with JSONB support |
| **SQLx** | 0.7+ | Async SQL toolkit with compile-time checks |
| **Tokio** | 1.0+ | Async runtime for high-performance concurrency |
| **YJS** | - | Binary format for real-time collaboration |
| **Docker** | 20+ | Containerization and deployment |

## 📁 Project Structure

```
backend/src/
├── main.rs                        # 🚀 Application entry point
├── lib.rs                         # 📚 Core library and exports
├── service_manager.rs             # 🔧 Centralized service management
├── services.rs                    # 🔄 Service abstractions and DI
├── error.rs                       # ❌ Error handling and types
├── error_helpers.rs               # 🛠️ Error handling utilities
├── auth.rs                        # 🔐 Authentication and JWT
├── ws.rs                          # 🔗 WebSocket handling
├── persistence_event.rs           # 💾 Event-driven persistence
├── async_db_writer.rs             # ✍️ Async database operations
├── snapshotting_service.rs        # 📸 Content snapshotting
├── thumbnail.rs                   # 🖼️ Thumbnail generation
├── gemini_api.rs                  # 🤖 AI integration
├── api/
│   ├── mod.rs
│   ├── scripts.rs                 # 📝 Script management API
│   └── ws.rs                      # 🔗 WebSocket API handlers
├── handlers/
│   ├── mod.rs
│   └── script_handlers.rs         # 📋 HTTP request handlers
├── models/
│   ├── mod.rs
│   ├── user.rs                    # 👤 User data model
│   ├── script.rs                  # 📄 Script data model
│   ├── script_layout.rs           # 🎨 Layout configuration
│   ├── script_share.rs            # 🤝 Sharing permissions
│   ├── block.rs                   # 📦 Content blocks (legacy)
│   ├── edit.rs                    # ✏️ Edit history
│   ├── yjs_update.rs              # 🔄 YJS update storage
│   └── snapshot_meta.rs           # 📊 Snapshot metadata
├── analysis/
│   ├── mod.rs
│   ├── errors.rs                  # 🚨 Analysis error types
│   ├── parser.rs                  # 📖 Document parsing
│   └── structs.rs                 # 🏗️ Analysis data structures
├── prompts/
│   └── script_analysis.prompt     # 🤖 AI analysis prompt template
└── tests/
    ├── auth.rs                    # 🔐 Authentication tests
    ├── scripts.rs                 # 📝 Script API tests
    ├── ws.rs                      # 🔗 WebSocket tests
    └── common.rs                  # 🛠️ Test utilities
```

## 🔧 Service Manager Architecture

### 🎯 Centralized Service Management

The ServiceManager pattern eliminates tight coupling and provides dependency injection:

```rust
/// Central service orchestration with proper lifecycle management
#[derive(Debug)]
pub struct ServiceManager {
    // Core dependencies
    pub database_pool: Arc<PgPool>,
    pub rate_limiter: Arc<RateLimiter>,
    pub persistence_tx: mpsc::Sender<YjsPersistenceEvent>,
    
    // Background service handles
    service_handles: Vec<JoinHandle<()>>,
}

impl ServiceManager {
    /// Initialize all services with proper error handling
    pub async fn new(
        pool: PgPool,
        rate_limit_window: Duration,
        rate_limit_max: usize,
    ) -> Result<Self> {
        // Initialize core components
        let database_pool = Arc::new(pool);
        let rate_limiter = Arc::new(RateLimiter::new(rate_limit_window, rate_limit_max));
        let (persistence_tx, persistence_rx) = mpsc::channel(1024);
        
        let mut service_manager = ServiceManager {
            database_pool,
            rate_limiter,
            persistence_tx,
            service_handles: Vec::new(),
        };
        
        // Start all background services
        service_manager.start_background_services(persistence_rx).await?;
        
        Ok(service_manager)
    }
    
    /// Start background services with proper error handling
    async fn start_background_services(
        &mut self, 
        persistence_rx: mpsc::Receiver<YjsPersistenceEvent>
    ) -> Result<()> {
        // 1. Async database writer service
        let db_pool_writer = self.database_pool.clone();
        let writer_handle = tokio::spawn(async move {
            run_async_db_writer(persistence_rx, (*db_pool_writer).clone()).await;
        });
        
        // 2. Content snapshotting service (500ms intervals)
        let db_pool_snapshot = self.database_pool.clone();
        let snapshot_handle = tokio::spawn(async move {
            let interval = Duration::from_millis(500);
            run_snapshotting_service(db_pool_snapshot, interval).await;
        });
        
        // 3. Rate limiter cleanup service
        let rate_limiter_cleanup = self.rate_limiter.clone();
        let cleanup_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1800));
            loop {
                interval.tick().await;
                if let Err(e) = rate_limiter_cleanup.cleanup_old_data().await {
                    tracing::error!("Rate limiter cleanup failed: {}", e);
                }
            }
        });
        
        // 4. WebSocket session cleanup
        let ws_cleanup_handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300));
            loop {
                interval.tick().await;
                let threshold = chrono::Duration::minutes(10);
                if let Err(e) = ws::cleanup_inactive_sessions(threshold).await {
                    tracing::error!("WebSocket cleanup failed: {}", e);
                }
            }
        });
        
        // Store handles for graceful shutdown
        self.service_handles.extend([
            writer_handle, snapshot_handle, cleanup_handle, ws_cleanup_handle
        ]);
        
        Ok(())
    }
    
    /// Health check for all managed services
    pub async fn health_check(&self) -> ServiceHealthStatus {
        let database = self.check_database_health().await;
        let rate_limiter = self.check_rate_limiter_health().await;
        let persistence_writer = self.check_persistence_health().await;
        
        ServiceHealthStatus {
            overall_healthy: database && rate_limiter && persistence_writer,
            database,
            rate_limiter,
            persistence_writer,
            active_services: self.service_handles.len(),
        }
    }
}
```

## 🔗 API Architecture

### 🌐 REST API Design

```rust
// Main application router with proper middleware layering
let app_router = Router::new()
    .route("/health", get(health_check))
    .route("/register", post(register))
    .route("/login", post(login))
    .nest("/api", api_routes())
    .layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(cors)
            .layer(rate_limit_middleware)
            .layer(RequestBodyLimitLayer::new(20 * 1024 * 1024)),
    )
    .layer(security_headers_middleware);

// API routes with proper state management
fn api_routes() -> Router<Arc<PgPool>> {
    Router::new()
        // Script management
        .route("/scripts", get(list_scripts).post(create_script))
        .route("/scripts/:id", get(get_script).patch(update_script).delete(delete_script))
        .route("/scripts/:id/content", patch(update_content))
        .route("/scripts/:id/snapshot", post(store_content_snapshot))
        
        // Script blocks (legacy support)
        .route("/scripts/:id/blocks", post(create_block))
        .route("/blocks/:id", patch(update_block))
        .route("/blocks/:id/history", get(block_history))
        
        // Layout management
        .route("/scripts/:id/layouts", get(get_layouts).post(create_layout))
        .route("/scripts/:id/layouts/default", get(get_default_layout))
        .route("/scripts/:script_id/layouts/:layout_id", 
               patch(update_layout).delete(delete_layout))
        
        // Real-time collaboration
        .merge(ws::ws_routes())
        
        // Debug endpoints
        .route("/debug/console-logs", post(receive_console_logs))
}
```

### 🔐 Authentication System

```rust
/// JWT-based authentication with role-based access control
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String,
    pub username: String,
    pub role: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        // Extract token from Authorization header
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|header| header.to_str().ok())
            .and_then(|header| header.strip_prefix("Bearer "));

        let token = auth_header.ok_or_else(|| {
            AppError::Unauthorized("Missing or invalid Authorization header".to_string())
        })?;

        // Verify and decode JWT
        let claims = verify_token(token)?;
        
        Ok(AuthUser {
            user_id: claims.user_id,
            email: claims.email,
            username: claims.username,
            role: claims.role,
        })
    }
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    State(rate_limiter): State<Arc<RateLimiter>>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // Extract client IP
    let ip = extract_client_ip(&request)?;
    
    // Check rate limit
    rate_limiter.check(&ip).await.map_err(|_| {
        AppError::TooManyRequests("Rate limit exceeded".to_string())
    })?;
    
    Ok(next.run(request).await)
}
```

### 🔒 Security Headers

```rust
/// Security headers middleware for production security
async fn security_headers_middleware(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;
    
    let headers = response.headers_mut();
    
    // HTTPS security
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
    );
    
    // Content security
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );
    
    headers.insert(
        "X-Frame-Options",
        HeaderValue::from_static("DENY"),
    );
    
    headers.insert(
        "X-XSS-Protection",
        HeaderValue::from_static("1; mode=block"),
    );
    
    // Referrer policy
    headers.insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    
    response
}
```

## 🔄 Real-time Collaboration

### 🔗 WebSocket Architecture

```rust
/// Global broadcast system for real-time collaboration
pub static GLOBAL_BROADCAST: Lazy<(
    Sender<(String, String, Vec<u8>)>,
    std::sync::Mutex<Option<Receiver<(String, String, Vec<u8>)>>>
)> = Lazy::new(|| {
    let (tx, rx) = broadcast::channel(1000);
    (tx, std::sync::Mutex::new(Some(rx)))
});

/// Session management for WebSocket connections
pub static SESSIONS: Lazy<DashMap<String, Arc<Session>>> = Lazy::new(|| DashMap::new());

pub struct Session {
    pub clients: DashMap<String, String>, // session_id -> user_id
    pub last_activity: TokioMutex<chrono::DateTime<Utc>>,
}

/// WebSocket connection handler with authentication
pub async fn ws_handler_with_deps(
    ws: WebSocketUpgrade,
    script_id: String,
    pool: Arc<PgPool>,
    auth_user: WsAuthUser,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) -> impl IntoResponse {
    // Verify script access permissions
    let has_access = verify_script_access(&pool, &script_id, &auth_user.user_id).await?;
    
    if !has_access {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }
    
    // Upgrade WebSocket connection
    ws.on_upgrade(move |socket| {
        handle_socket(socket, script_id, auth_user.user_id.to_string(), persistence_event_tx)
    })
}

/// Individual WebSocket connection handling
async fn handle_socket(
    socket: WebSocket,
    script_id: String,
    user_id: String,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) {
    let session_id = Uuid::new_v4().to_string();
    let mut rx = GLOBAL_BROADCAST.0.subscribe();
    
    // Register client in session
    let session = SESSIONS
        .entry(script_id.clone())
        .or_insert_with(|| Arc::new(Session::new()))
        .clone();
    
    session.clients.insert(session_id.clone(), user_id.clone());
    
    let (mut socket_tx, mut socket_rx) = socket.split();
    let mut heartbeat_interval = interval(HEARTBEAT_INTERVAL);
    
    loop {
        tokio::select! {
            // Handle incoming YJS updates
            Some(msg) = socket_rx.next() => {
                if let Ok(Message::Binary(data)) = msg {
                    // Distinguish between awareness and content updates
                    if !is_awareness_update(&data) {
                        // Persist content updates
                        if let Err(e) = persistence_event_tx.send(YjsPersistenceEvent {
                            script_id: script_id.clone(),
                            update_data: data.clone(),
                            user_id: Some(Uuid::parse_str(&user_id).unwrap()),
                            received_at: Utc::now(),
                        }).await {
                            tracing::error!("Failed to send persistence event: {}", e);
                        }
                    }
                    
                    // Broadcast to all clients
                    let _ = GLOBAL_BROADCAST.0.send((script_id.clone(), user_id.clone(), data));
                }
            }
            
            // Handle broadcast messages
            Ok((broadcast_script_id, sender_user_id, data)) = rx.recv() => {
                if broadcast_script_id == script_id {
                    if let Err(_) = socket_tx.send(Message::Binary(data)).await {
                        break; // Connection closed
                    }
                }
            }
            
            // Send heartbeat
            _ = heartbeat_interval.tick() => {
                if let Err(_) = socket_tx.send(Message::Ping(vec![])).await {
                    break; // Connection closed
                }
            }
        }
    }
    
    // Cleanup on disconnect
    session.clients.remove(&session_id);
    if session.clients.is_empty() {
        SESSIONS.remove(&script_id);
    }
}
```

## 💾 Persistence Architecture

### 🔄 Dual Persistence System

Pessoa uses a dual persistence approach for reliability:

1. **YJS Updates**: Binary updates for real-time collaboration
2. **Content Snapshots**: HTML snapshots for data recovery

```rust
/// Async database writer for YJS updates
pub async fn run_async_db_writer(
    mut rx: mpsc::Receiver<YjsPersistenceEvent>,
    pool: PgPool,
) {
    while let Some(event) = rx.recv().await {
        if let Err(e) = save_yjs_update(&pool, &event).await {
            tracing::error!("Failed to save YJS update: {}", e);
        }
    }
}

async fn save_yjs_update(
    pool: &PgPool, 
    event: &YjsPersistenceEvent
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let script_id = Uuid::parse_str(&event.script_id)?;
    
    sqlx::query!(
        "INSERT INTO yjs_document_updates (script_id, user_id, update_data, created_at) 
         VALUES ($1, $2, $3, $4)",
        script_id,
        event.user_id,
        &event.update_data,
        event.received_at
    )
    .execute(pool)
    .await?;
    
    Ok(())
}
```

### 📸 Snapshotting Service

```rust
/// High-frequency snapshotting for content preservation
pub async fn run_snapshotting_service(
    pool: Arc<PgPool>,
    interval: Duration,
) {
    let mut interval_timer = tokio::time::interval(interval);
    
    loop {
        interval_timer.tick().await;
        
        // Find scripts with unprocessed updates
        let scripts = get_scripts_needing_snapshots(&pool).await
            .unwrap_or_else(|e| {
                tracing::error!("Failed to get scripts for snapshotting: {}", e);
                Vec::new()
            });
        
        for script_id in scripts {
            if let Err(e) = create_snapshot_for_script(&pool, script_id).await {
                tracing::error!("Failed to create snapshot for {}: {}", script_id, e);
            }
        }
    }
}

/// Reconstruct YJS document and create content snapshot
async fn create_snapshot_for_script(
    pool: &Arc<PgPool>,
    script_id: Uuid,
) -> Result<(), anyhow::Error> {
    // Get unprocessed YJS updates
    let updates = get_yjs_updates_since_last_snapshot(pool, script_id).await?;
    
    // Create YJS document
    let doc = Doc::new();
    
    // Bootstrap with expected fragments
    {
        let mut txn = doc.transact_mut();
        for name in ["default", "content", "prosemirror"] {
            txn.get_or_insert_xml_fragment(name);
            txn.get_or_insert_text(name);
        }
    }
    
    // Apply all updates
    {
        let mut txn = doc.transact_mut();
        for update in &updates {
            match Update::decode_v1(&update.update_data) {
                Ok(decoded_update) => {
                    txn.apply_update(decoded_update);
                }
                Err(e) => {
                    tracing::warn!("Failed to decode YJS update {}: {}", update.id, e);
                }
            }
        }
    }
    
    // Extract HTML content
    let html_content = extract_html_from_yjs_doc(&doc).await?;
    
    // Store snapshot with metadata
    sqlx::query!(
        "INSERT INTO script_snapshots_meta 
         (script_id, last_snapshot_at, last_processed_update_id, content_snapshot, snapshot_format)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (script_id) DO UPDATE SET
         last_snapshot_at = $2,
         last_processed_update_id = $3,
         content_snapshot = $4,
         snapshot_format = $5",
        script_id,
        Utc::now(),
        updates.last().map(|u| u.id),
        html_content,
        "html"
    )
    .execute(pool.as_ref())
    .await?;
    
    Ok(())
}
```

## 🤖 AI Integration

### 🔗 Gemini API Client

```rust
/// Google Gemini API integration for script analysis
pub async fn call_gemini_for_parsing(
    http_client: &Client,
    script_text: &str,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var("GEMINI_API_KEY")?;
    let api_url = env::var("GEMINI_API_URL")?;
    
    // Load analysis prompt template
    let prompt = SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", script_text);
    
    let request = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: prompt }],
        }],
        generation_config: Some(GenerationConfig {
            response_mime_type: "application/json".to_string(),
            max_output_tokens: Some(8192),
            response_schema: None, // Flexible parsing
        }),
    };
    
    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)])
        .json(&request)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await?;
        return Err(GeminiApiError::ApiError { status, body });
    }
    
    let response_body: GeminiResponse = response.json().await?;
    
    let response_text = response_body
        .candidates
        .get(0)
        .and_then(|c| c.content.parts.get(0))
        .map(|p| p.text.trim())
        .ok_or(GeminiApiError::NoCandidate)?;
    
    // Clean JSON response (remove markdown formatting)
    let clean_json = response_text
        .strip_prefix("```json")
        .unwrap_or(response_text)
        .strip_suffix("```")
        .unwrap_or(response_text)
        .trim();
    
    let parsed_script: ParsedScript = serde_json::from_str(clean_json)?;
    Ok(parsed_script)
}
```

### 📝 Script Upload Pipeline

```rust
/// Complete script upload and analysis pipeline
pub async fn upload_and_parse_script(
    mut multipart: Multipart,
) -> Result<Json<ParsedScript>, impl IntoResponse> {
    let http_client = Client::new();
    
    // Extract DOCX file from multipart upload
    let (docx_bytes, filename) = extract_file_from_multipart(&mut multipart).await?;
    
    // Convert DOCX to plain text
    let plain_text = extract_text_from_docx(&docx_bytes)
        .map_err(|e| (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error": format!("Failed to extract text: {}", e)}))
        ))?;
    
    // Analyze with Gemini API
    let mut parsed_script = call_gemini_for_parsing(&http_client, &plain_text)
        .await
        .map_err(|e| (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": format!("AI analysis failed: {}", e)}))
        ))?;
    
    // Add metadata
    parsed_script.source_filename = filename;
    
    Ok(Json(parsed_script))
}
```

## 🔍 Error Handling

### 🚨 Standardized Error Types

```rust
/// Application error types with proper HTTP status mapping
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),
    
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Forbidden: {0}")]
    Forbidden(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Conflict: {0}")]
    Conflict(String),
    
    #[error("Bad request: {0}")]
    BadRequest(String),
    
    #[error("Too many requests: {0}")]
    TooManyRequests(String),
    
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
    
    #[error("Validation error: {0}")]
    Validation(#[from] validator::ValidationErrors),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error"),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "Unauthorized"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "Forbidden"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "Not found"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "Conflict"),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "Bad request"),
            AppError::TooManyRequests(_) => (StatusCode::TOO_MANY_REQUESTS, "Too many requests"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "Validation error"),
        };
        
        let body = Json(json!({
            "error": error_message,
            "message": self.to_string(),
        }));
        
        (status, body).into_response()
    }
}
```

### 🛠️ Error Helper Utilities

```rust
/// Database operation helpers with timeout and context
pub async fn with_db_timeout<T, F, Fut>(
    operation: F,
    context: &str,
) -> Result<T, AppError>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    timeout(Duration::from_secs(5), operation())
        .await
        .map_err(|_| {
            tracing::error!("Database timeout: {}", context);
            AppError::Internal(anyhow::anyhow!("Database timeout: {}", context))
        })?
        .map_err(|e| {
            tracing::error!("Database error in {}: {}", context, e);
            AppError::from(e)
        })
}
```

## 🧪 Testing Architecture

### 🔬 Integration Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;
    use std::env;
    
    async fn setup_test_db() -> PgPool {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for tests");
        
        PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database")
    }
    
    #[tokio::test]
    async fn test_script_creation() {
        let pool = setup_test_db().await;
        
        // Clean test data
        sqlx::query!("DELETE FROM scripts WHERE title LIKE 'Test%'")
            .execute(&pool)
            .await
            .unwrap();
        
        // Test script creation
        let script = create_script(&pool, "Test Script", user_id).await.unwrap();
        assert_eq!(script.title, "Test Script");
        
        // Verify database state
        let count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM scripts WHERE id = $1",
            script.id
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        
        assert_eq!(count, Some(1));
    }
    
    #[tokio::test]
    async fn test_websocket_authentication() {
        // Test WebSocket authentication flow
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, "test@example.com", "testuser", "user").unwrap();
        
        // Verify token can be used for WebSocket auth
        let ws_auth = WsAuthUser::from_token(&token).unwrap();
        assert_eq!(ws_auth.user_id, user_id);
    }
}
```

## 🚀 Performance Optimizations

### ⚡ Database Optimizations

1. **Connection Pooling**: Configured connection pools with appropriate limits
2. **Prepared Statements**: All queries use SQLx compile-time verification
3. **Indexes**: Strategic database indexes for common queries
4. **Batch Operations**: Bulk insert/update operations where possible

### 🔄 Async Performance

1. **Tokio Runtime**: Optimized async runtime configuration
2. **Background Tasks**: Non-blocking background service processing
3. **Channel Buffering**: Appropriate buffer sizes for message channels
4. **Timeouts**: Proper timeout handling to prevent resource leaks

### 📊 Monitoring and Observability

```rust
/// Health check endpoint with detailed status
pub async fn health_check() -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(json!({
        "status": "healthy",
        "timestamp": Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION"),
        "services": {
            "database": check_database_health().await,
            "websocket": check_websocket_health().await,
            "ai_service": check_ai_service_health().await,
        }
    })))
}
```

---

## 🔗 Related Documentation

- **[System Architecture](README.md)** - High-level system overview
- **[Frontend Architecture](frontend.md)** - React frontend implementation
- **[Real-time Collaboration](collaboration.md)** - WebSocket and YJS details
- **[Database Schema](database.md)** - PostgreSQL schema documentation
- **[API Reference](../api/README.md)** - Complete API documentation 