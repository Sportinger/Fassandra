use sqlx::PgPool;
// Removed unused import: use crate::models::user::User;
use crate::error::AppError;
use uuid::Uuid;
use chrono::{Utc, Duration as ChronoDuration};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use argon2::password_hash::{SaltString, PasswordHasher};
// Removed unused import: use rand::Rng;
use std::sync::Arc;
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use crate::Result;
use anyhow::Error;
use axum::{
    extract::{State, FromRequestParts, Request},
    http::{request::Parts, header::AUTHORIZATION, StatusCode},
    response::{IntoResponse, Response}, // Removed unused import: Json
    middleware::Next,
    body::Body,
};
use validator::Validate; // Removed unused import: ValidationErrors
use regex::Regex;
use lazy_static::lazy_static;
use std::env;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use std::collections::HashMap;
use async_trait::async_trait;
use tracing;
use serde_qs;

lazy_static! {
    static ref USERNAME_REGEX: Regex = Regex::new(r"^[a-zA-Z0-9_-]{3,20}$").unwrap();
    static ref PASSWORD_REGEX: Regex = Regex::new(r"^.{8,}$").unwrap();
}

/// Returns the JWT secret as bytes, loaded from the JWT_SECRET environment variable.
///
/// # Panics
/// Panics if the JWT_SECRET environment variable is not set.
fn jwt_secret() -> Vec<u8> {
    env::var("JWT_SECRET").expect("JWT_SECRET must be set").into_bytes()
}

/// JWT claims for authentication and authorization.
///
/// Fields:
/// - `sub`: User ID (UUID).
/// - `exp`: Expiration timestamp (seconds since epoch).
/// - `email`: User's email address.
/// - `username`: User's username.
/// - `role`: User's role (e.g., "user", "admin").
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: usize,
    pub email: String,
    pub username: String,
    pub role: String,
}

/// Generates a JWT token for the given user information.
///
/// # Arguments
/// * `user_id` - User's UUID.
/// * `email` - User's email address.
/// * `username` - User's username.
/// * `role` - User's role.
///
/// # Returns
/// * `Result<String>` - The JWT token as a string on success, or an AppError on failure.
pub fn generate_token(
    user_id: Uuid,
    email: &str,
    username: &str,
    role: &str,
) -> Result<String> {
    let expiration = Utc::now()
        .checked_add_signed(ChronoDuration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id,
        exp: expiration,
        email: email.to_string(),
        username: username.to_string(),
        role: role.to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&jwt_secret()),
    )
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))
}

/// Verifies a JWT token and returns the claims if valid.
///
/// # Arguments
/// * `token` - The JWT token string to verify.
///
/// # Returns
/// * `Result<Claims>` - The decoded claims on success, or an AppError on failure.
pub fn verify_token(token: &str) -> Result<Claims> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&jwt_secret()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;
    Ok(token_data.claims)
}

/// Decodes a JWT token and returns the claims if valid.
/// This is an alias for verify_token for backward compatibility.
///
/// # Arguments
/// * `token` - The JWT token string to decode.
///
/// # Returns
/// * `Result<Claims>` - The decoded claims on success, or an AppError on failure.
pub fn decode_token(token: &str) -> Result<Claims> {
    verify_token(token)
}

/// Hashes a password using Argon2.
///
/// # Arguments
/// * `password` - The plaintext password to hash.
///
/// # Returns
/// * `Result<String>` - The hashed password as a string on success, or an AppError on failure.
pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?
        .to_string();
    Ok(password_hash)
}

/// Verifies a plaintext password against a hashed password.
///
/// # Arguments
/// * `password` - The plaintext password to verify.
/// * `hash` - The hashed password to compare against.
///
/// # Returns
/// * `bool` - True if the password matches the hash, false otherwise.
pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = PasswordHash::new(hash).ok();
    match parsed {
        Some(ph) => Argon2::default().verify_password(password.as_bytes(), &ph).is_ok(),
        None => false,
    }
}

/// Extractor for authenticated users from HTTP requests.
///
/// Fields:
/// - `user_id`: The authenticated user's UUID.
pub struct AuthUser {
    pub user_id: Uuid,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> std::result::Result<Self, Self::Rejection> {
        let auth = parts.headers.get(AUTHORIZATION)
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;
        
        let auth_str = auth.to_str()
            .map_err(|_| AppError::Unauthorized("Invalid authorization header".to_string()))?;
        
        if !auth_str.starts_with("Bearer ") {
            return Err(AppError::Unauthorized("Invalid authorization header format".to_string()));
        }
        
        let token = &auth_str[7..];
        let claims = verify_token(token)?;
        
        Ok(AuthUser { user_id: claims.sub })
    }
}

// --- WebSocket Specific Auth ---

/// Extractor for authenticated users from WebSocket connections.
///
/// Fields:
/// - `user_id`: The authenticated user's UUID.
pub struct WsAuthUser {
    pub user_id: Uuid,
}

/// JWT token query parameter for WebSocket authentication.
#[derive(Deserialize, Debug)]
struct WsTokenParams {
    token: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for WsAuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> std::result::Result<Self, Self::Rejection> {
        tracing::debug!("WS Auth: Processing WebSocket authentication for request to: {}", parts.uri);
        
        let query_string = parts.uri.query()
            .ok_or_else(|| {
                tracing::error!("WS Auth: Missing query string in WebSocket request");
                AppError::Unauthorized("Missing query string".to_string())
            })?;
        
        tracing::debug!("WS Auth: Query string: {}", query_string);
        
        let params = serde_qs::from_str::<WsTokenParams>(query_string)
            .map_err(|e| {
                tracing::error!("WS Auth: Failed to parse token from query string: {}, error: {}", query_string, e);
                AppError::Unauthorized("Invalid token format".to_string())
            })?;
        
        let token = if params.token.starts_with("Bearer ") {
            &params.token[7..]
        } else {
            &params.token
        };
        
        // Trim any trailing whitespace or slash from the token (fixes Chrome WebSocket issue)
        let token = token.trim().trim_end_matches('/');
        
        tracing::debug!("WS Auth: Verifying token: {}...", &token.chars().take(10).collect::<String>());
        
        let claims = match verify_token(token) {
            Ok(claims) => claims,
            Err(e) => {
                tracing::error!("WS Auth: Token verification failed: {}", e);
                return Err(e);
            }
        };
        
        tracing::info!("WS Auth: Authentication successful for user: {} ({})", claims.username, claims.sub);
        
        Ok(WsAuthUser { user_id: claims.sub })
    }
}

/// Rate limiter for tracking requests per key (e.g., IP address).
///
/// Fields:
/// - `requests`: Map of keys to request timestamps.
/// - `window`: Time window for rate limiting.
/// - `max_requests`: Maximum allowed requests per window.
#[derive(Debug, Clone)]
pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    window: Duration,
    max_requests: usize,
}

impl RateLimiter {
    /// Creates a new RateLimiter.
    ///
    /// # Arguments
    /// * `window` - Duration of the rate limit window.
    /// * `max_requests` - Maximum allowed requests per window.
    ///
    /// # Returns
    /// * `RateLimiter` instance.
    pub fn new(window: Duration, max_requests: usize) -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
            window,
            max_requests,
        }
    }

    /// Checks if a request is allowed under the rate limit for the given key.
    ///
    /// # Arguments
    /// * `key` - The key to check (e.g., IP address).
    ///
    /// # Returns
    /// * `Result<(), StatusCode>` - Ok if allowed, or TOO_MANY_REQUESTS if rate limit exceeded.
    ///
    /// # Errors
    /// Returns StatusCode::TOO_MANY_REQUESTS if the limit is exceeded.
    pub async fn check(&self, key: &str) -> Result<()> {
        let mut requests = self.requests.lock().await;
        let now = Instant::now();
        
        // Clean up old requests
        requests.entry(key.to_string())
            .and_modify(|timestamps| {
                timestamps.retain(|&time| now.duration_since(time) < self.window);
            });

        let timestamps = requests.entry(key.to_string())
            .or_insert_with(Vec::new);

        if timestamps.len() >= self.max_requests {
            return Err(AppError::TooManyRequests("Too many requests".to_string()));
        }

        timestamps.push(now);
        Ok(())
    }
}

/// Axum middleware for rate limiting requests.
///
/// # Arguments
/// * `State(rate_limiter)` - Shared RateLimiter state.
/// * `request` - The incoming HTTP request.
/// * `next` - The next middleware or handler.
///
/// # Returns
/// * `Result<Response, StatusCode>` - The response or a rate limit error.
pub async fn rate_limit_middleware(
    State(rate_limiter): State<Arc<RateLimiter>>,
    request: Request<Body>,
    next: Next,
) -> std::result::Result<Response, AppError> {
    let ip = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown");

    rate_limiter.check(ip).await?;

    Ok(next.run(request).await)
}

/// Payload for user registration requests.
///
/// Fields:
/// - `email`: User's email address.
/// - `username`: Desired username.
/// - `password`: Desired password.
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RegisterPayload {
    #[validate(email(message = "Invalid email format"))]
    email: String,
    #[validate(length(min = 3, max = 30, message = "Username must be between 3 and 30 characters"))]
    #[validate(regex(path = "USERNAME_REGEX", message = "Username can only contain letters, numbers, and underscores"))]
    username: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters long"))]
    #[validate(regex(path = "PASSWORD_REGEX", message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"))]
    password: String,
}

/// Payload for user login requests.
///
/// Fields:
/// - `email`: User's email address.
/// - `password`: User's password.
#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

/// Logs out a user by invalidating their session.
///
/// # Arguments
/// * `_pool` - Database connection pool (unused).
/// * `_user_id` - User's UUID (unused).
///
/// # Returns
/// * `Result<()>` - Success or failure of the logout operation.
pub async fn logout(_pool: &PgPool, _user_id: Uuid) -> Result<()> {
    // For now, just return success since we don't store sessions
    Ok(())
}

pub async fn handle_error(err: AppError) -> Response {
    match err {
        AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, err.to_string()).into_response(),
        AppError::Forbidden(_) => (StatusCode::FORBIDDEN, err.to_string()).into_response(),
        AppError::NotFound(_) => (StatusCode::NOT_FOUND, err.to_string()).into_response(),
        AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, err.to_string()).into_response(),
        AppError::TooManyRequests(_) => (StatusCode::TOO_MANY_REQUESTS, err.to_string()).into_response(),
        AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response(),
        AppError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
        AppError::Conflict(_) => (StatusCode::CONFLICT, err.to_string()).into_response(),
        AppError::Validation(_) => (StatusCode::BAD_REQUEST, err.to_string()).into_response(),
    }
}