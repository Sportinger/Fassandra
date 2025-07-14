use axum::{routing::{get, post, patch}, Router, extract::State, serve};
use axum::http::{Method, HeaderValue, header};
use std::net::SocketAddr;
use std::env;
use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tower_http::trace::TraceLayer;
use tower_http::cors::{CorsLayer, AllowOrigin};
use tower_http::limit::RequestBodyLimitLayer;
use tower::ServiceBuilder;
use anyhow::{Context, Result};

use crate::api::scripts::{store_content_snapshot, get_content_snapshot};
use crate::ws;
use crate::handlers::page_break_handlers::create_page_break_router;
use crate::handlers::script_handlers::script_routes;
use crate::handlers::auth::{health_with_service_manager, register, login, receive_console_logs};
use crate::handlers::script::{
    list_scripts, create_script_endpoint, get_script_endpoint, update_script_title_endpoint, 
    delete_script_endpoint, update_script_content_endpoint, create_block_endpoint, 
    update_block_endpoint, block_history_endpoint, get_script_layouts_endpoint, 
    get_default_layout_endpoint, create_script_layout_endpoint, update_script_layout_endpoint, 
    delete_script_layout_endpoint
};
use crate::auth::rate_limit_middleware;
use crate::persistence_event::YjsPersistenceEvent;
use crate::config::Config;
use crate::middleware::create_security_headers_middleware;

/// Define a constant for the body limit (e.g., 20 MB)
const MAX_REQUEST_BODY_SIZE: usize = 20 * 1024 * 1024;

/// Creates and configures the CORS layer with environment-specific origins.
pub fn create_cors_layer() -> Result<CorsLayer> {
    let allowed_origins_env = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:8080,http://localhost:5173".to_string());

    let origins: Vec<HeaderValue> = allowed_origins_env
        .split(',') // Split the string into individual origins
        .filter_map(|origin_str| {
            let trimmed = origin_str.trim();
            if trimmed.is_empty() {
                None // Skip empty strings that might result from trailing commas
            } else {
                match HeaderValue::from_str(trimmed) {
                    Ok(header_val) => Some(header_val),
                    Err(e) => {
                        // Log an error if an origin is invalid, but don't panic
                        tracing::error!("Invalid origin string '{}': {}. Skipping.", trimmed, e);
                        None
                    }
                }
            }
        })
        .collect();

    if origins.is_empty() {
        // Fallback if all origins were invalid or string was empty/only commas
        tracing::warn!("ALLOWED_ORIGINS resulted in an empty list. Falling back to default for CORS.");
        // Using a known valid default like the frontend dev server.
        let default_origins = vec![
            HeaderValue::from_static("http://localhost:5173"), 
            HeaderValue::from_static("http://localhost:8080"),
        ];
        return Ok(create_cors_with_origins(default_origins));
    }

    tracing::info!("Using effective ALLOWED_ORIGINS for CORS: {:?}", origins);
    Ok(create_cors_with_origins(origins))
}

/// Creates a CORS layer with the given origins.
fn create_cors_with_origins(origins: Vec<HeaderValue>) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(vec![Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers(vec![
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
        ])
        .allow_credentials(true)
}

/// Creates the main API router with all routes configured.
pub fn create_router(
    service_manager: &crate::service_manager::ServiceManager,
    config: Arc<Config>,
) -> Router {
    let database_pool = service_manager.get_database_pool();
    let cors = create_cors_layer().expect("Failed to create CORS layer");
    
    Router::new()
        .route("/health", get(health_with_service_manager))
        .route("/register", post(register))
        .route("/login", post(login))
        .nest("/api", api_routes_arc_state(service_manager.get_persistence_sender()))
        .nest("/api/s", script_routes(service_manager.get_rate_limiter()).with_state(service_manager.get_script_services()))
        .with_state(Arc::new(database_pool))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(service_manager.get_rate_limiter(), rate_limit_middleware))
                .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BODY_SIZE)),
        )
        .layer(axum::middleware::from_fn(create_security_headers_middleware(config)))
}

/// API routes that expect Arc<PgPool> state
fn api_routes_arc_state(persistence_event_tx: mpsc::Sender<YjsPersistenceEvent>) -> Router<Arc<PgPool>> {
    Router::new()
        .route("/scripts", get(list_scripts).post(create_script_endpoint))
        .route("/scripts/:id", get(get_script_endpoint).patch(update_script_title_endpoint).delete(delete_script_endpoint))
        .route("/scripts/:id/content", patch(update_script_content_endpoint))
        .route("/scripts/:id/snapshot", post(store_content_snapshot).get(get_content_snapshot))
        .route("/scripts/:id/blocks", post(create_block_endpoint))
        // Script Layout Routes
        .route("/scripts/:id/layouts", get(get_script_layouts_endpoint).post(create_script_layout_endpoint))
        .route("/scripts/:id/layouts/default", get(get_default_layout_endpoint))
        .route("/scripts/:script_id/layouts/:layout_id", patch(update_script_layout_endpoint).delete(delete_script_layout_endpoint))
        .route("/blocks/:id", patch(update_block_endpoint))
        .route("/blocks/:id/history", get(block_history_endpoint))
        .route("/debug/console-logs", post(receive_console_logs))
        .merge(ws::ws_routes(persistence_event_tx.clone()))
        .merge(create_page_break_router())
        // Note: script_routes is now handled separately in main() due to its PgPool state requirement
}

/// Starts the HTTP server with the given configuration and router.
pub async fn start_server(config: &Config, app_router: Router) -> Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    tracing::info!("🚀 Backend server listening on {} with ServiceManager", addr);

    // 🚀 GRACEFUL SHUTDOWN: Set up signal handling for clean service shutdown
    let shutdown_signal = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C signal handler");
        tracing::info!("🛑 Shutdown signal received, starting graceful shutdown...");
    };

    // Run server with graceful shutdown
    let server = serve(tokio::net::TcpListener::bind(addr).await?, app_router.into_make_service())
        .with_graceful_shutdown(shutdown_signal);

    // Wait for either server error or shutdown signal
    server.await.context("Server failed to start or encountered an error")
} 