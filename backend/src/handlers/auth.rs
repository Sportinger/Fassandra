use crate::auth::{
    generate_csrf_token, generate_token, get_auth_token_from_cookie, hash_password,
    remove_auth_cookie, set_auth_cookie, set_csrf_cookie, store_csrf_token, verify_password,
    AuthUser, CsrfTokenStore, RegisterPayload,
};
use crate::error::AppError;
use crate::models::user::User;
use axum::{extract::State, http::StatusCode, Json};
use chrono;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::env;
use std::sync::Arc;
use tower_cookies::Cookies;
use validator::Validate;

/// Payload for user login requests.
#[derive(Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: String,
}

/// Health check endpoint. Returns "OK" if the server is running.
pub async fn health() -> &'static str {
    "OK"
}

/// Enhanced health check with database connectivity verification
pub async fn health_with_service_manager(
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check database connectivity
    let database_healthy = match sqlx::query("SELECT 1").fetch_one(pool.as_ref()).await {
        Ok(_) => true,
        Err(_) => false,
    };

    Ok(Json(serde_json::json!({
        "status": if database_healthy { "healthy" } else { "unhealthy" },
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "database": database_healthy,
        "services": "operational" // Basic status since we can't access full ServiceManager here
    })))
}

/// Registers a new user and sets authentication cookies.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `cookies` - Cookie jar for setting HTTP cookies.
/// * `Json(payload)` - Registration payload.
///
/// # Returns
/// * `Result<Json<serde_json::Value>, AppError>` - JSON response on success, or an AppError on failure.
pub async fn register(
    State(pool): State<Arc<PgPool>>,
    cookies: Cookies,
    Json(payload): Json<RegisterPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
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
        .await
        .map_err(|e| {
            // Map unique constraint violations to user-friendly conflicts
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.code().as_deref() == Some("23505") {
                    let msg = db_err.message().to_lowercase();
                    if msg.contains("email") {
                        return AppError::Conflict("Email already exists".to_string());
                    }
                    if msg.contains("username") {
                        return AppError::Conflict("Username already exists".to_string());
                    }
                    return AppError::Conflict("User already exists".to_string());
                }
            }
            AppError::Db(e)
        })?;

    // Pass all required fields to generate_token
    let token = generate_token(user.id, &user.email, &user.username, &user.role)?;

    // Set the authentication cookie
    set_auth_cookie(&cookies, &token)?;

    // Return success response with user info
    Ok(Json(serde_json::json!({
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
    })))
}

/// Authenticates a user and sets authentication cookies.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `cookies` - Cookie jar for setting HTTP cookies.
/// * `Json(payload)` - Login payload.
///
/// # Returns
/// * `Result<Json<serde_json::Value>, AppError>` - JSON response on success, or an AppError on failure.
pub async fn login(
    State(pool): State<Arc<PgPool>>,
    cookies: Cookies,
    _headers: axum::http::HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Fetch all fields needed for the token
    let user: User = sqlx::query_as(
        "SELECT id, email, username, role, password_hash, created_at FROM users WHERE email=$1",
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

    // Set the authentication cookie (for backward compatibility)
    set_auth_cookie(&cookies, &token)?;

    // Always include token in response for sessionStorage-based auth
    // This enables multi-tab support with different users
    let response = serde_json::json!({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        },
        "token": token.clone()  // Always return token for sessionStorage
    });

    Ok(Json(response))
}

/// Payload for Google login
#[derive(Deserialize)]
pub struct GoogleLoginPayload {
    pub id_token: String,
}

/// Minimal shape of Google's tokeninfo response
#[derive(Deserialize)]
struct GoogleTokenInfo {
    aud: String,
    email: String,
    #[serde(default)]
    email_verified: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    sub: Option<String>,
}

/// Login or register via Google ID token.
/// Accepts an ID token from Google Identity Services, verifies it against
/// Google's tokeninfo endpoint, then issues our own JWT and sets cookies.
pub async fn login_with_google(
    State(pool): State<Arc<PgPool>>,
    cookies: Cookies,
    Json(payload): Json<GoogleLoginPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Support one or multiple client IDs via env. Prefer GOOGLE_CLIENT_IDS if set, fallback to GOOGLE_CLIENT_ID.
    // Comma-separated list allows staging/production/mobile variants without code changes.
    let client_ids_raw = env::var("GOOGLE_CLIENT_IDS")
        .or_else(|_| env::var("GOOGLE_CLIENT_ID"))
        .map_err(|_| AppError::Internal(anyhow::anyhow!("GOOGLE_CLIENT_ID(S) not configured")))?;
    let client_ids: Vec<String> = client_ids_raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Verify ID token with Google
    let http = Client::new();
    let url = format!(
        "https://oauth2.googleapis.com/tokeninfo?id_token={}",
        payload.id_token
    );
    let resp = http.get(&url).send().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to call Google tokeninfo: {}", e))
    })?;

    if !resp.status().is_success() {
        return Err(AppError::Unauthorized("Invalid Google token".to_string()));
    }

    let info: GoogleTokenInfo = resp.json().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to parse Google tokeninfo: {}", e))
    })?;

    // Validate audience against allowed client IDs
    if !client_ids.iter().any(|cid| *cid == info.aud) {
        tracing::warn!(
            "Google login rejected: audience mismatch (aud={}, allowed={})",
            info.aud,
            client_ids.join(",")
        );
        return Err(AppError::Unauthorized("Google client mismatch".to_string()));
    }

    // Ensure email is present and verified if provided
    if info.email.is_empty() {
        return Err(AppError::Unauthorized(
            "Google account has no email".to_string(),
        ));
    }
    if let Some(verified) = info.email_verified.as_deref() {
        if verified != "true" {
            return Err(AppError::Unauthorized(
                "Google email not verified".to_string(),
            ));
        }
    }

    // Find or create the user by email
    let existing: Option<User> = sqlx::query_as(
        "SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = $1",
    )
    .bind(&info.email)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(AppError::Db)?;

    let user = match existing {
        Some(u) => u,
        None => {
            let username_base = info
                .name
                .as_deref()
                .unwrap_or_else(|| info.email.split('@').next().unwrap_or("user"));
            let username = username_base
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                .collect::<String>()
                .to_lowercase();
            let password_hash = "oauth:google".to_string();
            let default_role = "user";

            sqlx::query_as::<_, User>(
                "INSERT INTO users (email, username, password_hash, role) VALUES ($1, $2, $3, $4)
                 RETURNING id, email, username, password_hash, role, created_at",
            )
            .bind(&info.email)
            .bind(&username)
            .bind(&password_hash)
            .bind(default_role)
            .fetch_one(pool.as_ref())
            .await
            .map_err(|e| {
                if let sqlx::Error::Database(db_err) = &e {
                    if db_err.code().as_deref() == Some("23505") {
                        return AppError::Conflict("Email already exists".to_string());
                    }
                }
                AppError::Db(e)
            })?
        }
    };

    // Issue our JWT
    let token = generate_token(user.id, &user.email, &user.username, &user.role)?;
    set_auth_cookie(&cookies, &token)?;

    let response = serde_json::json!({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        },
        "token": token
    });

    Ok(Json(response))
}

/// Payload for console log forwarding from mobile browsers.
#[derive(Deserialize)]
pub struct ConsoleLogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[derive(Deserialize)]
pub struct ConsoleLogPayload {
    pub logs: Vec<ConsoleLogEntry>,
    pub device_info: serde_json::Value,
}

/// Endpoint to receive console logs from mobile browsers for debugging.
pub async fn receive_console_logs(
    Json(payload): Json<ConsoleLogPayload>,
) -> Result<axum::http::StatusCode, AppError> {
    // Log the received console logs from mobile browsers
    for log_entry in payload.logs {
        match log_entry.level.as_str() {
            "error" => tracing::error!(
                "[Mobile Console] {}: {}",
                log_entry.timestamp,
                log_entry.message
            ),
            "warn" => tracing::warn!(
                "[Mobile Console] {}: {}",
                log_entry.timestamp,
                log_entry.message
            ),
            "info" => tracing::info!(
                "[Mobile Console] {}: {}",
                log_entry.timestamp,
                log_entry.message
            ),
            "debug" => tracing::debug!(
                "[Mobile Console] {}: {}",
                log_entry.timestamp,
                log_entry.message
            ),
            _ => tracing::info!(
                "[Mobile Console] {}: {}",
                log_entry.timestamp,
                log_entry.message
            ),
        }
    }

    // Log device info
    tracing::info!(
        "[Mobile Debug] Device info: {}",
        serde_json::to_string_pretty(&payload.device_info).unwrap_or_default()
    );

    Ok(axum::http::StatusCode::OK)
}

/// Response structure for user information
#[derive(Serialize)]
pub struct UserInfoResponse {
    pub id: uuid::Uuid,
    pub email: String,
    pub username: String,
    pub role: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Get current user information endpoint
/// Returns the authenticated user's information based on their JWT token
pub async fn get_current_user(
    State(pool): State<Arc<PgPool>>,
    auth: AuthUser,
) -> Result<Json<UserInfoResponse>, AppError> {
    // Fetch user details from database using the authenticated user ID
    let user: User = sqlx::query_as(
        "SELECT id, email, username, role, password_hash, created_at FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::Unauthorized("User not found".to_string()),
        _ => AppError::Db(e),
    })?;

    // Return user info without sensitive data
    Ok(Json(UserInfoResponse {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
    }))
}

/// Logout endpoint - removes authentication cookies
pub async fn logout(cookies: Cookies) -> StatusCode {
    remove_auth_cookie(&cookies);
    StatusCode::OK
}

/// CSRF token response
#[derive(Serialize)]
pub struct CsrfTokenResponse {
    pub token: String,
}

/// Get a new CSRF token
pub async fn get_csrf_token(
    State(csrf_store): State<CsrfTokenStore>,
    cookies: Cookies,
    auth: AuthUser,
) -> Result<Json<CsrfTokenResponse>, AppError> {
    let token = generate_csrf_token();

    // Store the token associated with the user
    store_csrf_token(&csrf_store, &token, auth.user_id).await?;

    // Set the CSRF cookie
    set_csrf_cookie(&cookies, &token);

    Ok(Json(CsrfTokenResponse { token }))
}

/// Get WebSocket token endpoint
/// Returns the JWT token from the httpOnly cookie for WebSocket authentication
pub async fn get_ws_token(
    cookies: Cookies,
    _auth: AuthUser, // Validates user is authenticated
) -> Result<Json<serde_json::Value>, AppError> {
    // Get the JWT token from the cookie
    let token = get_auth_token_from_cookie(&cookies)
        .ok_or_else(|| AppError::Unauthorized("No authentication token found".to_string()))?;

    Ok(Json(serde_json::json!({
        "token": token
    })))
}
