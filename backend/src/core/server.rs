use anyhow::{Context, Result};
use axum::http::{header, HeaderValue, Method};
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    routing::{get, post},
    serve, Json, Router,
};
use sqlx::PgPool;
use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::mpsc;
use tower::ServiceBuilder;
use tower_cookies::CookieManagerLayer;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::auth::{create_csrf_store, rate_limit_middleware, AuthUser};
use crate::handlers::account::{delete_account, export_account_data};
use crate::handlers::auth::{
    get_csrf_token, get_current_user, get_ws_token, health_with_service_manager, login,
    login_with_google, logout, receive_console_logs, register,
};
use crate::handlers::script::{claude_session_routes, script_routes};
use crate::infrastructure::middleware::create_security_headers_middleware;
use crate::infrastructure::Config;
use crate::models::script::Script;
use crate::networking::audio;
use crate::networking::websocket;
use crate::services::persistence_event::YjsPersistenceEvent;
use crate::telemetry;
use yrs::updates::encoder::Encode;
use yrs::GetString;
use yrs::{ReadTxn, Transact};
use yrs::{Text, XmlFragment as _};

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
        .unwrap_or_else(|_| "https://192.168.2.141:8080,https://192.168.2.141:8443,http://192.168.2.141:8080,http://localhost:8080,https://localhost:8080,https://localhost:8443,capacitor://localhost,ionic://localhost,http://localhost,https://fassandra.de,https://www.fassandra.de".to_string());

    // Parse all allowed origins into a vector
    let origins: Vec<String> = allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    // Use a closure to dynamically check and return the matching origin
    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::ACCEPT,
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-csrf-token"),
            header::HeaderName::from_static("x-requested-with"),
        ])
        .allow_credentials(true)
        .expose_headers([header::HeaderName::from_static("set-cookie")])
        .allow_origin(tower_http::cors::AllowOrigin::predicate(
            move |origin: &HeaderValue, _request_parts: &axum::http::request::Parts| {
                // Convert the origin header to string
                if let Ok(origin_str) = origin.to_str() {
                    // Check if this origin is in our allowed list
                    // This will properly match the exact origin including protocol
                    origins.iter().any(|allowed| allowed == origin_str)
                } else {
                    false
                }
            },
        ));

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

    let base = Router::new()
        .route("/health", get(health_with_service_manager))
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/login/google", post(login_with_google))
        .route("/logout", post(logout))
        .route("/metrics", get(telemetry::metrics_endpoint))
        // Account management (GDPR/DSGVO)
        .route("/api/account/export", get(export_account_data))
        .route("/api/account", axum::routing::delete(delete_account))
        .nest(
            "/api",
            api_routes_with_services(
                service_manager.get_persistence_sender(),
                script_services.clone(),
                csrf_store.clone(),
            ),
        )
        .nest(
            "/api/s",
            script_routes(service_manager.get_rate_limiter()).with_state(extended_script_services),
        )
        .nest(
            "/api/s/session",
            claude_session_routes().with_state(claude_session_service),
        )
        .with_state(Arc::new(database_pool))
        .layer(
            ServiceBuilder::new()
                .layer(CookieManagerLayer::new()) // Add cookie support
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(
                    service_manager.get_rate_limiter(),
                    rate_limit_middleware,
                ))
                .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BODY_SIZE)),
        )
        .layer(axum::middleware::from_fn(telemetry::track_http_metrics))
        .layer(axum::middleware::from_fn(
            create_security_headers_middleware(config.clone()),
        ));

    // Add audio WebSocket routes
    let audio_router = audio::audio_routes(config.clone());
    base.merge(audio_router)
}

/// Wrapper functions for API endpoints that need AuthUser extraction

/// Wrapper for get_user_scripts to use ScriptServices
async fn get_user_scripts_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    auth_user: AuthUser,
) -> Result<Json<Vec<Script>>, crate::error::AppError> {
    let scripts = services
        .script_service
        .list_user_scripts(auth_user.user_id)
        .await?;
    Ok(Json(scripts))
}

/// Wrapper for create_script to use ScriptServices
async fn create_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    auth_user: AuthUser,
    Json(request): Json<ScriptCreateRequest>,
) -> Result<Json<Script>, crate::error::AppError> {
    let script = services
        .script_service
        .create_script(request.title, auth_user.user_id)
        .await?;
    Ok(Json(script))
}

/// Wrapper for update_script to use ScriptServices
async fn update_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(script_update): Json<ScriptUpdate>,
) -> Result<Json<Script>, crate::error::AppError> {
    let script = services
        .script_service
        .update_script(script_id, script_update.title, auth_user.user_id)
        .await?;
    Ok(Json(script))
}

/// Wrapper for delete_script to use ScriptServices
async fn delete_script_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    services
        .script_service
        .delete_script(script_id, auth_user.user_id)
        .await?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// Wrapper for getting a script with YJS state
async fn get_script_with_yjs_wrapper(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    match services
        .script_service
        .get_script_with_yjs(script_id, auth_user.user_id)
        .await
    {
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
                "format": "yjs"
            })))
        }
        Ok(None) => Err(crate::error::AppError::NotFound(
            "Script not found".to_string(),
        )),
        Err(e) => {
            tracing::error!("Failed to load YJS state: {}", e);
            Err(crate::error::AppError::Internal(anyhow::anyhow!(
                "Failed to load script"
            )))
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
        .route(
            "/scripts",
            get(get_user_scripts_wrapper).post(create_script_wrapper),
        )
        .route(
            "/scripts/:id",
            get(get_script_with_yjs_wrapper)
                .patch(update_script_wrapper)
                .delete(delete_script_wrapper),
        )
        // New YJS endpoints
        .route("/scripts/:id/yjs", get(get_script_yjs_state))
        .route("/scripts/:id/updates", get(get_script_recent_updates))
        .route("/scripts/:id/compact", post(trigger_script_compaction))
        .route(
            "/scripts/:id/migrate_legacy",
            post(trigger_script_migration),
        )
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
        .merge(websocket::ws_routes(persistence_event_tx.clone()));

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

    // Server-side fallback migration: if 'default' is empty but legacy
    // 'prosemirror' text contains content, materialize simple paragraphs
    // so the editor can render immediately.
    {
        use yrs::{ReadTxn, Transact, WriteTxn, XmlElementPrelim, XmlTextPrelim};
        let mut needs = false;
        let legacy_len = {
            let t = doc.transact();
            let txt = t.get_text("prosemirror");
            let len = txt.as_ref().map(|x| x.len(&t)).unwrap_or(0);
            let def_len = t
                .get_xml_fragment("default")
                .map(|f| f.len(&t))
                .unwrap_or(0);
            needs = def_len == 0 && len > 0;
            len
        };
        if needs && legacy_len > 0 {
            let legacy = {
                let t = doc.transact();
                t.get_text("prosemirror")
                    .map(|x| x.get_string(&t))
                    .unwrap_or_default()
            };
            let blocks: Vec<&str> = legacy
                .split("\n\n")
                .map(|b| b.trim())
                .filter(|b| !b.is_empty())
                .collect();
            let mut w = doc.transact_mut();
            let frag = w.get_or_insert_xml_fragment("default");
            for b in blocks {
                let p = frag.push_back(&mut w, XmlElementPrelim::empty("paragraph"));
                p.push_back(&mut w, XmlTextPrelim::new(b.to_string()));
            }
        }
    }

    // Get the YJS state as update
    let update = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());

    // Return as binary response
    Ok((
        [(axum::http::header::CONTENT_TYPE, "application/octet-stream")],
        update,
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
    let since_id = params
        .get("since")
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
    let updates_json: Vec<serde_json::Value> = updates
        .iter()
        .map(|u| {
            serde_json::json!({
                "id": u.id,
                "data": base64::engine::general_purpose::STANDARD.encode(&u.update_data),
                "created_at": u.created_at
            })
        })
        .collect();

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
    // Manual compaction: fold recent updates into base state now
    crate::services::yjs_compaction_service::compact_now(&pool, script_id)
        .await
        .map_err(|e| crate::error::AppError::Internal(e.into()))?;

    Ok(Json(serde_json::json!({
        "message": "Compaction completed",
        "script_id": script_id
    })))
}

/// Trigger server-side migration to normalize legacy content into visible TipTap nodes
async fn trigger_script_migration(
    State(services): State<crate::handlers::script::ScriptServices>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let pool = services.script_service.get_pool();
    let (new_size, updates_marked) =
        crate::services::yjs_compaction_service::migrate_legacy_to_structured(&pool, script_id)
            .await
            .map_err(|e| crate::error::AppError::Internal(e.into()))?;

    Ok(Json(serde_json::json!({
        "message": "Migration completed",
        "script_id": script_id,
        "new_base_size": new_size,
        "updates_marked_compacted": updates_marked
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
    let addr: SocketAddr = bind_addr.parse().context("Invalid server address")?;

    tracing::info!("🚀 Server starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .context("Failed to bind to address")?;

    serve(listener, app)
        .await
        .context("Server failed to start")?;

    Ok(())
}
