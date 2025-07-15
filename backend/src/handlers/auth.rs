use axum::{extract::State, Json};
use std::sync::Arc;
use sqlx::PgPool;
use serde::Deserialize;
use validator::Validate;
use crate::auth::{hash_password, verify_password, generate_token, RegisterPayload};
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

/// Registers a new user and returns a JWT token.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `Json(payload)` - Registration payload.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - JWT token as JSON on success, or an AppError on failure.
pub async fn register(State(pool): State<Arc<PgPool>>, Json(payload): Json<RegisterPayload>) -> Result<Json<String>, AppError> {
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

/// Authenticates a user and returns a JWT token.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `Json(payload)` - Login payload.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - JWT token as JSON on success, or an AppError on failure.
pub async fn login(State(pool): State<Arc<PgPool>>, Json(payload): Json<LoginPayload>) -> Result<Json<String>, AppError> {
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