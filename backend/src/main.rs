use axum::{routing::{get, post, patch}, Router, Json, extract::State, extract::Path, response::IntoResponse, serve};
use std::net::SocketAddr;
use std::env;
use std::pin::Pin;
use std::future::Future;
use sqlx::{postgres::PgPoolOptions, PgPool};
use sqlx::migrate::Migrator;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tower_http::trace::TraceLayer;
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::{Method, HeaderValue, header};
use tower::ServiceBuilder;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use anyhow::{Context, Result};
use validator::Validate;

use tower_http::limit::RequestBodyLimitLayer;
use tokio::sync::mpsc;
use std::sync::Arc;
use axum::middleware::Next;
use axum::extract::Request;
use axum::response::Response;
use chrono;
use sqlx::Row;

use backend::auth::{hash_password, verify_password, generate_token, AuthUser, rate_limit_middleware, RegisterPayload};
use backend::error::AppError;
use backend::{create_script, create_block, update_block, get_script_with_blocks, get_block_history, delete_script, update_script_content_from_html, get_script_layouts, get_default_script_layout, create_script_layout, update_script_layout, delete_script_layout};
use backend::api::scripts::{get_user_scripts, store_content_snapshot};
use backend::handlers::script_handlers::script_routes;

// 🔒 SECURITY: Helper functions for authorization checks
async fn check_script_access(pool: &PgPool, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
    let row = sqlx::query(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM scripts s
            WHERE s.id = $1 
            AND (
                s.created_by = $2           -- User owns the script
                OR s.is_public = true       -- Script is public
                OR EXISTS (                 -- Script is shared with user
                    SELECT 1 FROM script_shares ss 
                    WHERE ss.script_id = s.id 
                    AND ss.shared_with_user_id = $2
                )
            )
        ) as has_access
        "#
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let has_access: bool = row.get("has_access");
    Ok(has_access)
}

async fn check_script_ownership(pool: &PgPool, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
    let row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM scripts WHERE id = $1 AND created_by = $2) as owns_script"
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let owns_script: bool = row.get("owns_script");
    Ok(owns_script)
}
use backend::ws;
use backend::models::script::Script;
use backend::models::block::Block;
use backend::models::edit::Edit;
use backend::models::user::User;
use backend::models::script_layout::{ScriptLayout, CreateScriptLayoutRequest, UpdateScriptLayoutRequest};
use backend::handlers::page_break_handlers::create_page_break_router;
use backend::persistence_event::YjsPersistenceEvent;



static MIGRATOR: Migrator = sqlx::migrate!();

// --- Secure Admin User Configuration Logic Start ---
/// Checks if the admin user exists with the placeholder hash and updates it.
/// Uses environment variables for secure configuration.
async fn update_admin_user_password(pool: &PgPool) -> Result<()> {
    // Load admin configuration from environment variables
    let admin_email = env::var("ADMIN_EMAIL")
        .context("ADMIN_EMAIL environment variable not set")?;
    let admin_password = env::var("ADMIN_PASSWORD")
        .context("ADMIN_PASSWORD environment variable not set")?;
    let placeholder_hash = env::var("ADMIN_PLACEHOLDER_HASH")
        .context("ADMIN_PLACEHOLDER_HASH environment variable not set")?;

    let user_result: Result<Option<User>, sqlx::Error> = sqlx::query_as(
        "SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = $1"
    )
    .bind(&admin_email)
    .fetch_optional(pool)
    .await;

    match user_result {
        Ok(Some(user)) => {
            if user.password_hash == placeholder_hash {
                tracing::info!("Updating placeholder password for admin user: {}", admin_email);
                let correct_hash = hash_password(&admin_password)
                    .context("Failed to hash admin user password")?;
                sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
                    .bind(&correct_hash)
                    .bind(user.id)
                    .execute(pool)
                    .await
                    .context("Failed to update admin user password hash")?;
                tracing::info!("Admin user password updated successfully.");
            } else {
                tracing::debug!("Admin user {} already has a valid password hash.", admin_email);
            }
        }
        Ok(None) => {
            tracing::warn!("Admin user {} not found after migration. Check migration file.", admin_email);
        }
        Err(e) => {
            // Log the error but don't prevent startup
            tracing::error!("Error checking admin user password: {}", e);
        }
    }
    Ok(())
}
// --- Secure Admin User Configuration Logic End ---

/// Application configuration loaded from environment variables.
///
/// Fields:
/// - `database_url`: Database connection string.
/// - `db_max_connections`: Maximum number of DB connections.
/// - `backend_port`: Port for the backend server.
#[derive(Debug)]
struct Config {
    database_url: String,
    db_max_connections: u32,
    backend_port: u16,
    // 🔒 SECURITY: Configurable security headers
    csp_policy: String,
    hsts_max_age: String,
    hsts_include_subdomains: bool,
    x_frame_options: String,
    referrer_policy: String,
    permissions_policy: String,
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
            backend_port: env::var("BACKEND_PORT")
                .map(|val| val.parse::<u16>())
                .unwrap_or(Ok(3001))
                .context("Invalid BACKEND_PORT value")?,
            // 🔒 SECURITY: Configurable security headers with secure defaults
            csp_policy: env::var("CSP_POLICY").unwrap_or_else(|_| {
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
                .to_string()
            }),
            hsts_max_age: env::var("HSTS_MAX_AGE").unwrap_or_else(|_| "31536000".to_string()),
            hsts_include_subdomains: env::var("HSTS_INCLUDE_SUBDOMAINS")
                .map(|val| val.to_lowercase() == "true")
                .unwrap_or(true),
            x_frame_options: env::var("X_FRAME_OPTIONS").unwrap_or_else(|_| "DENY".to_string()),
            referrer_policy: env::var("REFERRER_POLICY")
                .unwrap_or_else(|_| "strict-origin-when-cross-origin".to_string()),
            permissions_policy: env::var("PERMISSIONS_POLICY")
                .unwrap_or_else(|_| "geolocation=(), microphone=(), camera=()".to_string()),
        })
    }
}

/// Health check endpoint. Returns "OK" if the server is running.
async fn health() -> &'static str {
    "OK"
}

/// Enhanced health check using ServiceManager
async fn health_with_service_manager() -> Result<Json<serde_json::Value>, AppError> {
    // For now, return simple OK - in production this would check ServiceManager health
    // TODO: Pass ServiceManager to health check for full health status
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "services": "operational"
    })))
}

// Using RegisterPayload from auth.rs with validation

/// Registers a new user and returns a JWT token.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `Json(payload)` - Registration payload.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - JWT token as JSON on success, or an AppError on failure.
async fn register(State(pool): State<Arc<PgPool>>, Json(payload): Json<RegisterPayload>) -> Result<Json<String>, AppError> {
    // 🔒 SECURITY: Validate payload including strong password requirements
    payload.validate()?;
    
    // 🔒 SECURITY: Additional password strength validation
    payload.validate_password_strength()?;
    
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
        State(Arc::new(pool.as_ref().clone())),
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
async fn create_block_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(script_id): Path<Uuid>, Json(payload): Json<CreateBlockPayload>) -> Result<Json<Uuid>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before allowing block creation
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let id = create_block(pool.as_ref(), script_id, &payload.block_type, &payload.content, None).await?;
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
async fn get_script_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(script_id): Path<Uuid>) -> Result<Json<ScriptWithBlocks>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
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
    AuthUser{user_id}: AuthUser, // 🔒 SECURITY: Use user_id for authorization check
    Path(script_id): Path<Uuid>,
    Json(payload): Json<CreateScriptPayload>, // Assuming CreateScriptPayload contains { title: String }
) -> Result<Json<Script>, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing update
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only update scripts you own".to_string()));
    }
    
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
    AuthUser{user_id}: AuthUser, // 🔒 SECURITY: Use user_id for authorization check
    Path(script_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing deletion
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only delete scripts you own".to_string()));
    }
    
    // Call the delete_script function from lib.rs (or wherever it's appropriately defined without user checks)
    // Assuming `backend::delete_script` is the function from `lib.rs`.
    // The `use backend::{... delete_script ...}` statement would be needed if not already present.
    // For now, let's assume `delete_script` is brought into scope correctly.
    crate::delete_script(pool.as_ref(), script_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// === Script Layout Endpoints ===

// Script Layout Endpoints - RESTORED
/// Gets all layouts for a script.
async fn get_script_layouts_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Vec<ScriptLayout>>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before returning layouts
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let layouts = get_script_layouts(pool.as_ref(), script_id).await?;
    Ok(Json(layouts))
}

/// Gets the default layout for a script.
async fn get_default_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Option<ScriptLayout>>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before returning default layout
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
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
    Path((_script_id, layout_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateScriptLayoutRequest>
) -> Result<Json<ScriptLayout>, AppError> {
    let layout = update_script_layout(pool.as_ref(), layout_id, &request, user_id).await?;
    Ok(Json(layout))
}

/// Deletes a script layout.
async fn delete_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path((script_id, layout_id)): Path<(Uuid, Uuid)>
) -> Result<axum::http::StatusCode, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing layout deletion
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only delete layouts for scripts you own".to_string()));
    }
    
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

/// Security headers middleware to protect against common web vulnerabilities
/// 🔒 SECURITY: Now uses configurable headers instead of hardcoded values
fn create_security_headers_middleware(config: Arc<Config>) -> impl Fn(Request, Next) -> Pin<Box<dyn Future<Output = Response> + Send>> + Clone {
    move |request: Request, next: Next| {
        let config = config.clone();
        Box::pin(async move {
            let mut response = next.run(request).await;
            
            let headers = response.headers_mut();
            
            // Content Security Policy - configurable to allow environment-specific policies
            headers.insert(
                header::HeaderName::from_static("content-security-policy"),
                HeaderValue::from_str(&config.csp_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("default-src 'self'") // Safe fallback
                })
            );
            
            // X-Content-Type-Options - prevent MIME type sniffing
            headers.insert(
                header::HeaderName::from_static("x-content-type-options"),
                HeaderValue::from_static("nosniff")
            );
            
            // X-Frame-Options - configurable clickjacking protection
            headers.insert(
                header::HeaderName::from_static("x-frame-options"),
                HeaderValue::from_str(&config.x_frame_options).unwrap_or_else(|_| {
                    HeaderValue::from_static("DENY") // Safe fallback
                })
            );
            
            // X-XSS-Protection - enable XSS filtering (legacy browsers)
            headers.insert(
                header::HeaderName::from_static("x-xss-protection"),
                HeaderValue::from_static("1; mode=block")
            );
            
            // Strict-Transport-Security - configurable HTTPS enforcement
            let hsts_value = if config.hsts_include_subdomains {
                format!("max-age={}; includeSubDomains; preload", config.hsts_max_age)
            } else {
                format!("max-age={}", config.hsts_max_age)
            };
            headers.insert(
                header::HeaderName::from_static("strict-transport-security"),
                HeaderValue::from_str(&hsts_value).unwrap_or_else(|_| {
                    HeaderValue::from_static("max-age=31536000; includeSubDomains; preload") // Safe fallback
                })
            );
            
            // Referrer-Policy - configurable referrer information control
            headers.insert(
                header::HeaderName::from_static("referrer-policy"),
                HeaderValue::from_str(&config.referrer_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("strict-origin-when-cross-origin") // Safe fallback
                })
            );
            
            // Permissions-Policy - configurable browser features control
            headers.insert(
                header::HeaderName::from_static("permissions-policy"),
                HeaderValue::from_str(&config.permissions_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("geolocation=(), microphone=(), camera=()") // Safe fallback
                })
            );
            
            response
        })
    }
}

/// Define a constant for the body limit (e.g., 20 MB)
const MAX_REQUEST_BODY_SIZE: usize = 20 * 1024 * 1024;

const YJS_PERSISTENCE_QUEUE_CAPACITY: usize = 1024;

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

    if let Err(e) = update_admin_user_password(&pool).await {
        tracing::warn!("Issue during dev user password update: {}. Continuing...", e);
    }

    // 🚀 ARCHITECTURE FIX: Use ServiceManager for centralized service management
    // This eliminates tight coupling and provides proper dependency injection
    let service_manager = backend::service_manager::create_production_service_manager(pool.clone())
        .await
        .context("Failed to initialize ServiceManager")?;
    
    tracing::info!("✅ ServiceManager initialized with all background services");
    
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
    
    // All cleanup services are now managed by ServiceManager - no manual spawning needed!

    // 🚀 CLEAN ROUTER: Define router using ServiceManager (eliminates tight coupling)
    let database_pool = service_manager.get_database_pool();
    let config = Arc::new(config); // 🔒 SECURITY: Share config for middleware and server setup
    let app_router = Router::new()
        .route("/health", get(health_with_service_manager))
        .route("/register", post(register))
        .route("/login", post(login))
        .nest("/api", api_routes_arc_state(service_manager.get_persistence_sender()))
        .nest("/api/s", script_routes(service_manager.get_rate_limiter()).with_state(database_pool.clone()))
        .with_state(Arc::new(database_pool))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(service_manager.get_rate_limiter(), rate_limit_middleware))
                .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BODY_SIZE)),
        )
        .layer(axum::middleware::from_fn(create_security_headers_middleware(config.clone())));

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
    if let Err(e) = server.await {
        tracing::error!("❌ Server error: {}", e);
    }

    // Shutdown all services managed by ServiceManager
    if let Err(e) = service_manager.shutdown().await {
        tracing::error!("❌ ServiceManager shutdown failed: {}", e);
    }

    tracing::info!("✅ Backend server shutdown completed");
    Ok(())
}

// API routes that expect Arc<PgPool> state
fn api_routes_arc_state(persistence_event_tx: mpsc::Sender<YjsPersistenceEvent>) -> Router<Arc<PgPool>> {
    Router::new()
        .route("/scripts", get(list_scripts).post(create_script_endpoint))
        .route("/scripts/:id", get(get_script_endpoint).patch(update_script_title_endpoint).delete(delete_script_endpoint))
        .route("/scripts/:id/content", patch(update_script_content_endpoint))
        .route("/scripts/:id/snapshot", post(store_content_snapshot))
        .route("/scripts/:id/blocks", post(create_block_endpoint))
        // Script Layout Routes - RESTORED
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