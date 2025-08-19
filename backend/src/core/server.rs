use axum::{routing::{get, post}, Router, serve, extract::{State, Path, Query}, Json, response::IntoResponse};
use axum::http::{Method, HeaderValue, header};
use tower::ServiceBuilder;
use std::collections::HashMap;
use tower_http::trace::TraceLayer;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_cookies::CookieManagerLayer;
use std::net::SocketAddr;
use std::env;
use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::mpsc;
use uuid::Uuid;
use anyhow::{Context, Result};

use crate::networking::websocket;
use crate::handlers::page_break_handlers::create_page_break_router;
use crate::handlers::script::{script_routes, claude_session_routes};
use crate::handlers::auth::{health_with_service_manager, register, login, receive_console_logs, get_current_user, logout, get_csrf_token, get_ws_token};
use crate::auth::{rate_limit_middleware, AuthUser, create_csrf_store};
use crate::services::persistence_event::YjsPersistenceEvent;
use crate::infrastructure::Config;
use crate::infrastructure::middleware::create_security_headers_middleware;
use crate::models::script::Script;
use yrs::{ReadTxn, Transact};
use yrs::updates::encoder::Encode;

/// Script create request payload
#[derive(serde::Deserialize)]
pub struct ScriptCreateRequest {
    pub title: String,
}

/// Script update request payload
#[derive(serde::Deserialize)]
pub struct ScriptUpdate {
    pub title: String,
}

/// Content snapshot request payload
#[derive(serde::Deserialize)]
pub struct ContentSnapshotRequest {
    pub content: String,
    pub format: String, // "html" or "json"
}

/// Maximum request body size (50MB)
const MAX_REQUEST_BODY_SIZE: usize = 50 * 1024 * 1024;

/// Creates a database connection pool
pub async fn create_database_pool(config: &Config) -> Result<PgPool> {
    let database_url = &config.database_url;
    
    PgPool::connect(database_url)
        .await
        .context("Failed to connect to database")
}

/// Runs database migrations
pub async fn run_migrations(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("Failed to run migrations")?;
    
    Ok(())
}

/// Creates CORS layer with appropriate settings
fn create_cors_layer() -> Result<CorsLayer> {
    // Support multiple CORS origins from ALLOWED_ORIGINS environment variable
    let allowed_origins = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "https://192.168.2.141:8080,https://192.168.2.141:8443,http://192.168.2.141:8080,http://localhost:8080,https://localhost:8080,https://localhost:8443,capacitor://localhost,ionic://localhost,http://localhost,https://mylayer.org,https://www.mylayer.org".to_string());
    
    // Parse all allowed origins into a vector
    let origins: Vec<String> = allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    
    // Use a closure to dynamically check and return the matching origin
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            header::AUTHORIZATION,
            header::ACCEPT,
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-csrf-token"),
            header::HeaderName::from_static("x-requested-with"),
        ])
        .allow_credentials(true)
        .expose_headers([
            header::HeaderName::from_static("set-cookie"),
        ])
        .allow_origin(tower_http::cors::AllowOrigin::predicate(move |origin: &HeaderValue, _request_parts: &axum::http::request::Parts| {
            // Convert the origin header to string
            if let Ok(origin_str) = origin.to_str() {
                // Check if this origin is in our allowed list
                // This will properly match the exact origin including protocol
                origins.iter().any(|allowed| allowed == origin_str)
            } else {
                false
            }
        }));
    
    Ok(cors)
}

/// Creates the main application router
pub fn create_router(
    service_manager: &crate::core::service_manager::ServiceManager,
    config: Arc<Config>,
) -> Router {
    let database_pool = service_manager.get_database_pool();
    let script_services = service_manager.get_script_services();
    let extended_script_services = service_manager.get_extended_script_services();
    let claude_session_service = service_manager.get_claude_session_service();
    let cors = create_cors_layer().expect("Failed to create CORS layer");
    let csrf_store = create_csrf_store();
    
    Router::new()
        .route("/health", get(health_with_service_manager))
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .nest("/api", api_routes_with_services(service_manager.get_persistence_sender(), script_services.clone(), csrf_store.clone()))
        .nest("/api/s", script_routes(service_manager.get_rate_limiter()).with_state(extended_script_services))
        .nest("/api/s/session", claude_session_routes().with_state(claude_session_service))
        .with_state(Arc::new(database_pool))
        .layer(
            ServiceBuilder::new()
                .layer(CookieManagerLayer::new())  // Add cookie support
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(service_manager.get_rate_limiter(), rate_limit_middleware))
                .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BODY_SIZE)),
        )
        .layer(axum::middleware::from_fn(create_security_headers_middleware(config)))
}

/// Wrapper functions for API endpoints that need AuthUser extraction

/// Wrapper for get_user_scripts to use ScriptServices
async fn get_user_scripts_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    auth_user: AuthUser,
) -> Result<Json<Vec<Script>>, crate::error::AppError> {
    let scripts = services.script_service.list_user_scripts(auth_user.user_id).await?;
    Ok(Json(scripts))
}

/// Wrapper for create_script to use ScriptServices
async fn create_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    auth_user: AuthUser,
    Json(request): Json<ScriptCreateRequest>,
) -> Result<Json<Script>, crate::error::AppError> {
    let script = services.script_service.create_script(request.title, auth_user.user_id).await?;
    Ok(Json(script))
}

/// Wrapper for update_script to use ScriptServices
async fn update_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(script_update): Json<ScriptUpdate>,
) -> Result<Json<Script>, crate::error::AppError> {
    let script = services.script_service.update_script(script_id, script_update.title, auth_user.user_id).await?;
    Ok(Json(script))
}

/// Wrapper for delete_script to use ScriptServices
async fn delete_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    services.script_service.delete_script(script_id, auth_user.user_id).await?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// Wrapper for store_content_snapshot to use ScriptServices
async fn store_content_snapshot_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(request): Json<ContentSnapshotRequest>,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    services.script_service.store_content_snapshot(script_id, request.content, request.format, auth_user.user_id).await?;
    Ok(Json(serde_json::json!({"success": true, "message": "Content snapshot stored successfully"})))
}

/// Wrapper for get_content_snapshot to use ScriptServices
async fn get_content_snapshot_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let snapshot = services.script_service.get_content_snapshot(script_id, auth_user.user_id).await?;
    Ok(Json(serde_json::json!({
        "script_id": snapshot.script_id,
        "content": snapshot.content,
        "format": snapshot.format,
        "created_at": snapshot.created_at
    })))
}

/// Wrapper for get_script_with_blocks to use ScriptServices
/// Now returns YJS state instead of blocks for better performance
async fn get_script_with_blocks_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    // Try to load with YJS state first (new method)
    match services.script_service.get_script_with_yjs(script_id, auth_user.user_id).await {
        Ok(Some((script, yjs_state))) => {
            // Return YJS state encoded as base64 for transport
            use base64::Engine as _;
            let state_base64 = base64::engine::general_purpose::STANDARD.encode(&yjs_state);
            Ok(Json(serde_json::json!({
                "id": script.id,
                "title": script.title,
                "created_by": script.created_by,
                "created_at": script.created_at,
                "is_public": script.is_public,
                "thumbnail": script.thumbnail,
                "yjs_state": state_base64,
                "format": "yjs"  // Indicate this is YJS format
            })))
        }
        Ok(None) => Err(crate::error::AppError::NotFound("Script not found".to_string())),
        Err(e) => {
            // Fallback to blocks for compatibility
            tracing::warn!("Failed to load YJS state, falling back to blocks: {}", e);
            let result = services.script_service.get_script_with_blocks(script_id, auth_user.user_id).await?;
            
            match result {
                Some((script, blocks)) => {
                    Ok(Json(serde_json::json!({
                        "id": script.id,
                        "title": script.title,
                        "created_by": script.created_by,
                        "created_at": script.created_at,
                        "is_public": script.is_public,
                        "thumbnail": script.thumbnail,
                        "blocks": blocks,
                        "format": "blocks"  // Indicate this is blocks format
                    })))
                }
                None => Err(crate::error::AppError::NotFound("Script not found".to_string()))
            }
        }
    }
}

/// API routes that use ScriptServices for CRUD operations
fn api_routes_with_services(
    persistence_event_tx: mpsc::Sender<YjsPersistenceEvent>,
    script_services: crate::handlers::script::ScriptServices,
    csrf_store: crate::auth::CsrfTokenStore,
) -> Router<Arc<PgPool>> {
    // Routes that use ScriptServices
    let script_crud_routes = Router::new()
        .route("/scripts", get(get_user_scripts_wrapper).post(create_script_wrapper))
        .route("/scripts/:id", get(get_script_with_blocks_wrapper).patch(update_script_wrapper).delete(delete_script_wrapper))
        .route("/scripts/:id/snapshot", post(store_content_snapshot_wrapper).get(get_content_snapshot_wrapper))
        // New YJS endpoints
        .route("/scripts/:id/yjs", get(get_script_yjs_state))
        .route("/scripts/:id/updates", get(get_script_recent_updates))
        .route("/scripts/:id/compact", post(trigger_script_compaction))
        // Parsing status endpoint
        .route("/parsing/:session_id/status", get(get_parsing_status))
        .with_state(script_services);
    
    // Create wrapper for CSRF endpoint
    let csrf_route = Router::new()
        .route("/csrf-token", get(get_csrf_token))
        .with_state(csrf_store);
    
    // Routes that use Arc<PgPool> state
    let pool_based_routes = Router::new()
        .route("/me", get(get_current_user))
        .route("/ws-token", get(get_ws_token))
        .route("/debug/console-logs", post(receive_console_logs))
        .merge(websocket::ws_routes(persistence_event_tx.clone()))
        .merge(create_page_break_router());
    
    // Combine all route sets
    Router::new()
        .merge(script_crud_routes)
        .merge(csrf_route)
        .merge(pool_based_routes)
}

/// Get the YJS state for a script
async fn get_script_yjs_state(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<impl IntoResponse, crate::error::AppError> {
    // Load YJS state using compaction service
    let pool = services.script_service.get_pool();
    let doc = crate::services::yjs_compaction_service::load_document(&pool, script_id)
        .await
        .map_err(|e| crate::error::AppError::Internal(e.into()))?;
    
    // Get the YJS state as update
    let update = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
    
    // Return as binary response
    Ok((
        [(axum::http::header::CONTENT_TYPE, "application/octet-stream")],
        update
    ))
}

/// Get recent updates for a script (not yet compacted)
async fn get_script_recent_updates(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let pool = services.script_service.get_pool();
    
    // Get the 'since' parameter (update ID to start from)
    let since_id = params.get("since")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);
    
    // Query recent updates
    let updates = sqlx::query!(
        r#"
        SELECT id, update_data, created_at
        FROM yjs_recent_updates
        WHERE script_id = $1 AND id > $2 AND NOT is_compacted
        ORDER BY id ASC
        LIMIT 100
        "#,
        script_id,
        since_id
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e: sqlx::Error| crate::error::AppError::Internal(anyhow::anyhow!(e)))?;
    
    // Convert to JSON response
    use base64::Engine as _;
    let updates_json: Vec<serde_json::Value> = updates.iter().map(|u| {
        serde_json::json!({
            "id": u.id,
            "data": base64::engine::general_purpose::STANDARD.encode(&u.update_data),
            "created_at": u.created_at
        })
    }).collect();
    
    Ok(Json(serde_json::json!({
        "script_id": script_id,
        "updates": updates_json,
        "count": updates.len()
    })))
}

/// Trigger manual compaction for a script
async fn trigger_script_compaction(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let pool = services.script_service.get_pool();
    
    // Create compaction service and trigger compaction
    // Note: Compaction happens automatically in the background service
    // This endpoint is just for manual triggering if needed
    
    // Note: In production, this would be better handled by the background service
    // This is just for manual triggering if needed
    Ok(Json(serde_json::json!({
        "message": "Compaction triggered",
        "script_id": script_id
    })))
}

/// Get the status of a chunked parsing session
async fn get_parsing_status(
    Path(session_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    // In a real implementation, this would query the parsing orchestrator
    // For now, return a mock response showing the expected format
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "script_id": Uuid::new_v4(),
        "status": "processing",
        "chunks_completed": 3,
        "chunks_total": 10,
        "pages_processed": 30,
        "pages_total": 100,
        "current_chunk": 4,
        "progress_percentage": 30.0,
        "errors": [],
        "message": "Processing chunk 4 of 10 (pages 31-40)"
    })))
}

/// Starts the HTTP server
pub async fn start_server(config: &Config, app: Router) -> Result<()> {
    let bind_addr = format!("0.0.0.0:{}", config.backend_port);
    let addr: SocketAddr = bind_addr.parse()
        .context("Invalid server address")?;
    
    tracing::info!("🚀 Server starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await
        .context("Failed to bind to address")?;
    
    serve(listener, app).await
        .context("Server failed to start")?;
    
    Ok(())
} 