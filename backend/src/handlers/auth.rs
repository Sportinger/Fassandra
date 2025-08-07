use axum::{extract::State, Json, http::StatusCode};
use std::sync::Arc;
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use validator::Validate;
use tower_cookies::Cookies;
use crate::auth::{
    hash_password, verify_password, generate_token, RegisterPayload, AuthUser,
    set_auth_cookie, remove_auth_cookie, generate_csrf_token, set_csrf_cookie,
    store_csrf_token, CsrfTokenStore, get_auth_token_from_cookie
};
use crate::error::AppError;
use crate::models::user::User;
use chrono;

/// Payload for user login requests.
#[derive(Deserialize)]
pub struct LoginPayload { 
    pub email: String, 
    pub password: String 
}

/// Health check endpoint. Returns "OK" if the server is running.
pub async fn health() -> &'static str {
    "OK"
}

/// Enhanced health check using ServiceManager
pub async fn health_with_service_manager() -> Result<Json<serde_json::Value>, AppError> {
    // For now, return simple OK - in production this would check ServiceManager health
    // TODO: Pass ServiceManager to health check for full health status
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "services": "operational"
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
    Json(payload): Json<RegisterPayload>
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
        .await?;

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
    headers: axum::http::HeaderMap,
    Json(payload): Json<LoginPayload>
) -> Result<Json<serde_json::Value>, AppError> {
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
    
    // Set the authentication cookie (for web clients)
    set_auth_cookie(&cookies, &token)?;
    
    // Check if this is a mobile client (Capacitor/Ionic app)
    // Mobile clients need the JWT token in the response body since cookies don't work cross-origin
    let is_mobile_client = headers.get("x-mobile-app")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "true")
        .unwrap_or(false)
        || headers.get("user-agent")
            .and_then(|v| v.to_str().ok())
            .map(|ua| ua.contains("Capacitor") || ua.contains("Ionic"))
            .unwrap_or(false);
    
    // Return success response with user info
    let mut response = serde_json::json!({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
    });
    
    // Include token in response for mobile clients
    if is_mobile_client {
        response["token"] = serde_json::Value::String(token.clone());
    }
    
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
        "SELECT id, email, username, role, password_hash, created_at FROM users WHERE id = $1"
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