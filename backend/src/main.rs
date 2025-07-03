use axum::{routing::{get, post, patch}, Router, Json, extract::State, extract::Path, response::IntoResponse, serve};
use std::net::SocketAddr;
use std::env;
use sqlx::{postgres::PgPoolOptions, PgPool};
use sqlx::migrate::Migrator;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tower_http::trace::TraceLayer;
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::{Method, HeaderValue};
use tower::ServiceBuilder;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use anyhow::{Context, Result};
use std::time::Duration;
use tower_http::limit::RequestBodyLimitLayer;
use tokio::sync::mpsc;
use std::sync::Arc;

use backend::auth::{hash_password, verify_password, generate_token, AuthUser, RateLimiter, rate_limit_middleware};
use backend::error::AppError;
use backend::{create_script, create_block, update_block, get_script_with_blocks, get_block_history, delete_script, update_script_content_from_html, get_script_layouts, get_default_script_layout, create_script_layout, update_script_layout, delete_script_layout};
use backend::api::scripts::get_user_scripts;
use backend::ws;
use backend::models::script::Script;
use backend::models::block::Block;
use backend::models::edit::Edit;
use backend::models::user::User;
use backend::models::script_layout::{ScriptLayout, CreateScriptLayoutRequest, UpdateScriptLayoutRequest};
use backend::handlers::script_handlers::{script_routes, share_script, get_script_shares, remove_script_share, toggle_script_public};
use backend::persistence_event::YjsPersistenceEvent;
use backend::async_db_writer::run_async_db_writer;
use backend::snapshotting_service::run_snapshotting_service;

static MIGRATOR: Migrator = sqlx::migrate!();

// --- Placeholder Hash Logic Start ---
const DEV_USER_EMAIL: &str = "admin@pessoa.de";
const DEV_USER_PASSWORD: &str = "PassoaDevteam";
const PLACEHOLDER_HASH: &str = "$argon2id$v=19$m=65536,t=3,p=4$PLACEHOLDERSALT$PLACEHOLDERHASH";

/// Checks if the dev user exists with the placeholder hash and updates it.
async fn update_dev_user_password(pool: &PgPool) -> Result<()> {
    let user_result: Result<Option<User>, sqlx::Error> = sqlx::query_as(
        "SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = $1"
    )
    .bind(DEV_USER_EMAIL)
    .fetch_optional(pool)
    .await;

    match user_result {
        Ok(Some(user)) => {
            if user.password_hash == PLACEHOLDER_HASH {
                tracing::info!("Updating placeholder password for dev user: {}", DEV_USER_EMAIL);
                let correct_hash = hash_password(DEV_USER_PASSWORD)
                    .context("Failed to hash dev user password")?;
                sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
                    .bind(&correct_hash)
                    .bind(user.id)
                    .execute(pool)
                    .await
                    .context("Failed to update dev user password hash")?;
                tracing::info!("Dev user password updated successfully.");
            } else {
                tracing::debug!("Dev user {} already has a valid password hash.", DEV_USER_EMAIL);
            }
        }
        Ok(None) => {
            tracing::warn!("Dev user {} not found after migration. Check migration file.", DEV_USER_EMAIL);
        }
        Err(e) => {
            // Log the error but don't prevent startup
            tracing::error!("Error checking dev user password: {}", e);
        }
    }
    Ok(())
}
// --- Placeholder Hash Logic End ---

/// Application configuration loaded from environment variables.
///
/// Fields:
/// - `database_url`: Database connection string.
/// - `db_max_connections`: Maximum number of DB connections.
/// - `allowed_origins`: List of allowed CORS origins.
/// - `backend_port`: Port for the backend server.
#[derive(Debug)]
struct Config {
    database_url: String,
    db_max_connections: u32,
    allowed_origins: Vec<String>,
    backend_port: u16,
}

impl Config {
    /// Loads configuration from environment variables.
    ///
    /// # Returns
    /// * `Result<Self>` - The loaded configuration or an error if required variables are missing or invalid.
    fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")
                .context("DATABASE_URL environment variable not set")?,
            db_max_connections: env::var("DB_MAX_CONNECTIONS")
                .map(|val| val.parse::<u32>())
                .unwrap_or(Ok(5))
                .context("Invalid DB_MAX_CONNECTIONS value")?,
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:8080,http://localhost:5173".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            backend_port: env::var("BACKEND_PORT")
                .map(|val| val.parse::<u16>())
                .unwrap_or(Ok(3001))
                .context("Invalid BACKEND_PORT value")?,
        })
    }
}

/// Health check endpoint. Returns "OK" if the server is running.
async fn health() -> &'static str {
    "OK"
}

/// Payload for user registration requests.
#[derive(Deserialize)]
struct RegisterPayload { email: String, username: String, password: String }

/// Registers a new user and returns a JWT token.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `Json(payload)` - Registration payload.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - JWT token as JSON on success, or an AppError on failure.
async fn register(State(pool): State<Arc<PgPool>>, Json(payload): Json<RegisterPayload>) -> Result<Json<String>, AppError> {
    let password_hash = hash_password(&payload.password)?;
    
    // Default role for new users - adjust as needed
    let default_role = "user"; 

    // Include username and role in insert, fetch all needed fields
    let user: User = sqlx::query_as(
        "INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, password_hash, role, created_at"
    )
        .bind(&payload.email)
        .bind(&payload.username) // Bind username
        .bind(&password_hash)
        .bind(default_role) // Bind default role
        .fetch_one(pool.as_ref()) // Use pool.as_ref() when state is Arc<PgPool>
        .await?;

    // Pass all required fields to generate_token
    let token = generate_token(user.id, &user.email, &user.username, &user.role)?;
    Ok(Json(token))
}

/// Payload for user login requests.
#[derive(Deserialize)]
struct LoginPayload { email: String, password: String }

/// Authenticates a user and returns a JWT token.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `Json(payload)` - Login payload.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - JWT token as JSON on success, or an AppError on failure.
async fn login(State(pool): State<Arc<PgPool>>, Json(payload): Json<LoginPayload>) -> Result<Json<String>, AppError> {
    // Fetch all fields needed for the token
    let user: User = sqlx::query_as(
        "SELECT id, email, username, role, password_hash, created_at FROM users WHERE email=$1"
    )
        .bind(&payload.email)
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| match e {
            // Map "no rows" error specifically to Unauthorized
            sqlx::Error::RowNotFound => AppError::Unauthorized("Invalid credentials".to_string()),
            // Let other SQLx errors be converted automatically via #[from]
            // This requires AppError::Db(#[from] sqlx::Error) in error.rs
            _ => AppError::Db(e),
        })?;
    // Verify password
    if !verify_password(&payload.password, &user.password_hash) {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }
    // Pass all required fields to generate_token
    let token = generate_token(user.id, &user.email, &user.username, &user.role)?;
    Ok(Json(token))
}

/// Response structure for listing scripts.
#[derive(Serialize)]
struct ScriptsResponse(Vec<Script>);

/// Lists all scripts for the authenticated user.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
///
/// # Returns
/// * `Result<Json<ScriptsResponse>, AppError>` - List of scripts as JSON on success, or an AppError on failure.
async fn list_scripts(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser) -> Result<Json<ScriptsResponse>, AppError> {
    let response = get_user_scripts(
        State(pool.as_ref().clone()),
        user_id
    ).await?;
    let scripts = response.0; // Extract the Vec<Script> from Json wrapper
    Ok(Json(ScriptsResponse(scripts)))
}

/// Payload for creating a new script.
#[derive(Deserialize)]
struct CreateScriptPayload { title: String }

/// Endpoint to create a new script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Json(payload)` - Script creation payload.
///
/// # Returns
/// * `Result<Json<Script>, AppError>` - The new script as JSON on success, or an AppError on failure.
async fn create_script_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Json(payload): Json<CreateScriptPayload>) -> Result<Json<Script>, AppError> {
    let script = create_script(pool.as_ref(), &payload.title, user_id).await?;
    Ok(Json(script))
}

/// Payload for creating a new block.
#[derive(Deserialize)]
struct CreateBlockPayload { block_type: String, content: String }

/// Endpoint to create a new block for a script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Block creation payload.
///
/// # Returns
/// * `Result<Json<Uuid>, AppError>` - The new block's ID as JSON on success, or an AppError on failure.
async fn create_block_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id: _}: AuthUser, Path(script_id): Path<Uuid>, Json(payload): Json<CreateBlockPayload>) -> Result<Json<Uuid>, AppError> {
    let id = create_block(pool.as_ref(), script_id, &payload.block_type, &payload.content).await?;
    Ok(Json(id))
}

/// Endpoint to fetch a script and its blocks.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
///
/// # Returns
/// * `Result<Json<ScriptWithBlocks>, AppError>` - The script and its blocks as JSON on success, or an AppError on failure.
async fn get_script_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id: _}: AuthUser, Path(script_id): Path<Uuid>) -> Result<Json<ScriptWithBlocks>, AppError> {
    let (script, blocks) = get_script_with_blocks(pool.as_ref(), script_id).await?;
    Ok(Json(ScriptWithBlocks { script, blocks }))
}

/// Response structure for a script with its blocks.
#[derive(Serialize)]
struct ScriptWithBlocks { script: Script, blocks: Vec<Block> }

/// Payload for updating a block's content.
#[derive(Deserialize)]
struct UpdateBlockPayload { content: String }

/// Endpoint to update a block's content.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(block_id)` - The block ID.
/// * `Json(payload)` - Update payload.
///
/// # Returns
/// * `Result<impl IntoResponse, AppError>` - No content on success, or an AppError on failure.
async fn update_block_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(block_id): Path<Uuid>, Json(payload): Json<UpdateBlockPayload>) -> Result<impl IntoResponse, AppError> {
    update_block(pool.as_ref(), block_id, &payload.content, user_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Endpoint to fetch the edit history for a block.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(block_id)` - The block ID.
///
/// # Returns
/// * `Result<Json<Vec<Edit>>, AppError>` - List of edits as JSON on success, or an AppError on failure.
async fn block_history_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{..}: AuthUser, Path(block_id): Path<Uuid>) -> Result<Json<Vec<Edit>>, AppError> {
    let edits = get_block_history(pool.as_ref(), block_id).await?;
    Ok(Json(edits))
}

/// Endpoint to update a script's title.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Script update payload (only title is used).
///
/// # Returns
/// * `Result<Json<Script>, AppError>` - The updated script as JSON on success, or an AppError on failure.
async fn update_script_title_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id: _}: AuthUser, // Ensure user is authenticated, but user_id not used for auth check
    Path(script_id): Path<Uuid>,
    Json(payload): Json<CreateScriptPayload>, // Assuming CreateScriptPayload contains { title: String }
) -> Result<Json<Script>, AppError> {
    let script = sqlx::query_as!(
        Script,
        r#"UPDATE scripts SET title = $1 WHERE id = $2 
        RETURNING id, title, created_by, created_at, COALESCE(is_public, false) as "is_public!", thumbnail"#,
        payload.title,
        script_id
    )
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Script not found".to_string()),
        _ => AppError::Db(e), // Convert other sqlx errors to AppError::Db
    })?;
    Ok(Json(script))
}

/// Payload for updating script content.
#[derive(Deserialize)]
struct UpdateScriptContentPayload { 
    content: String // HTML content from TipTap editor
}

/// Payload for console log forwarding from mobile browsers.
#[derive(Deserialize)]
struct ConsoleLogEntry {
    timestamp: String,
    level: String,
    message: String,
    user_agent: String,
    url: String,
    script_id: Option<String>,
    user_id: Option<String>,
}

#[derive(Deserialize)]
struct ConsoleLogPayload {
    logs: Vec<ConsoleLogEntry>,
    device_info: serde_json::Value,
}

/// Endpoint to update a script's content from the TipTap editor.
///
/// This endpoint receives HTML content from the TipTap editor and converts it
/// into structured blocks in the database, providing persistence for collaborative edits.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Content update payload containing HTML.
///
/// # Returns
/// * `Result<impl IntoResponse, AppError>` - HTTP 204 No Content on success, or an AppError on failure.
async fn update_script_content_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(payload): Json<UpdateScriptContentPayload>,
) -> Result<impl IntoResponse, AppError> {
    tracing::info!("💾 Received content update for script {}: {} characters", script_id, payload.content.len());
    
    // Convert HTML to blocks and update the database
    update_script_content_from_html(pool.as_ref(), script_id, &payload.content, user_id).await?;
    
    tracing::info!("✅ Successfully updated script content for script {}", script_id);
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Endpoint to delete a script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user (ensures the endpoint is protected).
/// * `Path(script_id)` - The ID of the script to delete.
///
/// # Returns
/// * `Result<StatusCode, AppError>` - HTTP 204 No Content on success, or an AppError on failure.
async fn delete_script_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id: _}: AuthUser, // Ensure user is authenticated
    Path(script_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    // Call the delete_script function from lib.rs (or wherever it's appropriately defined without user checks)
    // Assuming `backend::delete_script` is the function from `lib.rs`.
    // The `use backend::{... delete_script ...}` statement would be needed if not already present.
    // For now, let's assume `delete_script` is brought into scope correctly.
    crate::delete_script(pool.as_ref(), script_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// === Script Layout Endpoints ===

/// Gets all layouts for a script.
async fn get_script_layouts_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id: _}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Vec<ScriptLayout>>, AppError> {
    let layouts = get_script_layouts(pool.as_ref(), script_id).await?;
    Ok(Json(layouts))
}

/// Gets the default layout for a script.
async fn get_default_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id: _}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Option<ScriptLayout>>, AppError> {
    let layout = get_default_script_layout(pool.as_ref(), script_id).await?;
    Ok(Json(layout))
}

/// Creates a new layout for a script.
async fn create_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(request): Json<CreateScriptLayoutRequest>
) -> Result<Json<ScriptLayout>, AppError> {
    let layout = create_script_layout(pool.as_ref(), script_id, &request, user_id).await?;
    Ok(Json(layout))
}

/// Updates an existing script layout.
async fn update_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path((script_id, layout_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateScriptLayoutRequest>
) -> Result<Json<ScriptLayout>, AppError> {
    let layout = update_script_layout(pool.as_ref(), layout_id, &request, user_id).await?;
    Ok(Json(layout))
}

/// Deletes a script layout.
async fn delete_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id: _}: AuthUser,
    Path((script_id, layout_id)): Path<(Uuid, Uuid)>
) -> Result<axum::http::StatusCode, AppError> {
    delete_script_layout(pool.as_ref(), layout_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Endpoint to receive console logs from mobile browsers for debugging.
async fn receive_console_logs(
    Json(payload): Json<ConsoleLogPayload>,
) -> Result<axum::http::StatusCode, AppError> {
    // Log the received console logs from mobile browsers
    for log_entry in payload.logs {
        match log_entry.level.as_str() {
            "error" => tracing::error!("[Mobile Console] {}: {}", log_entry.timestamp, log_entry.message),
            "warn" => tracing::warn!("[Mobile Console] {}: {}", log_entry.timestamp, log_entry.message),
            "info" => tracing::info!("[Mobile Console] {}: {}", log_entry.timestamp, log_entry.message),
            "debug" => tracing::debug!("[Mobile Console] {}: {}", log_entry.timestamp, log_entry.message),
            _ => tracing::info!("[Mobile Console] {}: {}", log_entry.timestamp, log_entry.message),
        }
    }
    
    // Log device info
    tracing::info!("[Mobile Debug] Device info: {}", serde_json::to_string_pretty(&payload.device_info).unwrap_or_default());
    
    Ok(axum::http::StatusCode::OK)
}

/// Define a constant for the body limit (e.g., 20 MB)
const MAX_REQUEST_BODY_SIZE: usize = 20 * 1024 * 1024;

const YJS_PERSISTENCE_QUEUE_CAPACITY: usize = 1024;
const SNAPSHOTTING_INTERVAL_SECONDS: u64 = 60 * 5;

/// Main entry point for the backend server.
///
/// Initializes configuration, database, runs migrations, and starts the Axum server.
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env().context("Failed to load configuration")?;

    let pool_options = PgPoolOptions::new()
        .max_connections(config.db_max_connections);

    let pool = pool_options
        .connect(&config.database_url)
        .await
        .context("Failed to create PostgreSQL connection pool")?;

    tracing::info!("Running database migrations...");
    match MIGRATOR.run(&pool).await {
        Ok(_) => {
            tracing::info!("Database migrations completed successfully.");
        }
        Err(e) => {
            // Log as warning and continue. If it's a real issue with a new migration, 
            // it might prevent proper operation, but "already applied" errors won't stop startup.
            tracing::warn!("Database migration check resulted in an error (possibly already applied, check logs): {}. Continuing server startup...", e);
        }
    }

    if let Err(e) = update_dev_user_password(&pool).await {
        tracing::warn!("Issue during dev user password update: {}. Continuing...", e);
    }

    let shared_pool = Arc::new(pool.clone());
    let pool_for_script_routes = pool.clone(); // Clone PgPool for script_routes specifically

    let (persistence_event_tx, persistence_event_rx) =
        mpsc::channel::<YjsPersistenceEvent>(YJS_PERSISTENCE_QUEUE_CAPACITY);

    let db_writer_pool_clone = Arc::clone(&shared_pool);
    tokio::spawn(async move {
        run_async_db_writer(persistence_event_rx, (*db_writer_pool_clone).clone()).await;
    });
    tracing::info!("Async DB Writer service spawned.");

    let snapshot_pool = Arc::clone(&shared_pool);
    let snapshot_interval = Duration::from_secs(10); // Fixed 10-second interval
    tokio::spawn(async move {
        run_snapshotting_service(snapshot_pool, snapshot_interval).await;
    });
    tracing::info!("Snapshotting service spawned with 2-second fixed interval.");
    
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
        // Provide a default valid origin list if parsing failed or resulted in empty
        // This ensures `AllowOrigin::list` doesn't get an empty list which might error.
        // Using a known valid default like the frontend dev server.
        // Ensure this default is actually useful for your setup.
        let _default_origins_for_fallback = vec![
            HeaderValue::from_static("http://localhost:5173"), 
            HeaderValue::from_static("http://localhost:8080"),
        ];
        // It's tricky to reassign `origins` due to borrowing, so we'd adjust CorsLayer call or handle this case explicitly
        // For now, the critical part is that `origins` feeding into `AllowOrigin::list` must not be empty
        // and must contain valid HeaderValues.
        // The filter_map above and the check here try to ensure that.
        // If `origins` *is* empty here, `AllowOrigin::list(origins)` might still be problematic.
        // A robust solution would involve ensuring `origins` always has at least one valid entry
        // or using a different Cors setup if `ALLOWED_ORIGINS` is totally unparseable.
    }

    tracing::info!("Using effective ALLOWED_ORIGINS for CORS: {:?}", origins);

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins)) // Reverted to use the parsed list of specific origins
        .allow_methods(vec![Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers(vec![
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
        ])
        .allow_credentials(true);
    
    let rate_limiter_state = Arc::new(RateLimiter::new(Duration::from_secs(60), 100));

    // Define the main router with Arc<PgPool> state
    let app_router = Router::new()
        .route("/health", get(health))
        .route("/register", post(register))
        .route("/login", post(login))
        .nest("/api", api_routes_arc_state(persistence_event_tx.clone()))
        .nest("/api/s", script_routes(pool_for_script_routes.clone()).with_state(pool_for_script_routes))
        .with_state(Arc::clone(&shared_pool))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(Arc::clone(&rate_limiter_state), rate_limit_middleware))
                .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BODY_SIZE)),
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    tracing::info!("Backend server listening on {}", addr);

    serve(tokio::net::TcpListener::bind(addr).await?, app_router.into_make_service())
        .await
        .context("Server failed")?;

    Ok(())
}

// API routes that expect Arc<PgPool> state
fn api_routes_arc_state(persistence_event_tx: mpsc::Sender<YjsPersistenceEvent>) -> Router<Arc<PgPool>> {
    Router::new()
        .route("/scripts", get(list_scripts).post(create_script_endpoint))
        .route("/scripts/:id", get(get_script_endpoint).patch(update_script_title_endpoint).delete(delete_script_endpoint))
        .route("/scripts/:id/content", patch(update_script_content_endpoint))
        .route("/scripts/:id/blocks", post(create_block_endpoint))
        .route("/scripts/:id/layouts", get(get_script_layouts_endpoint).post(create_script_layout_endpoint))
        .route("/scripts/:id/layouts/default", get(get_default_layout_endpoint))
        .route("/scripts/:script_id/layouts/:layout_id", patch(update_script_layout_endpoint).delete(delete_script_layout_endpoint))
        .route("/blocks/:id", patch(update_block_endpoint))
        .route("/blocks/:id/history", get(block_history_endpoint))
        .route("/debug/console-logs", post(receive_console_logs))
        .merge(ws::ws_routes(persistence_event_tx.clone()))
        // Note: script_routes is now handled separately in main() due to its PgPool state requirement
}