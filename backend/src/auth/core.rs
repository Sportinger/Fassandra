use sqlx::PgPool;
// Removed unused import: use crate::models::user::User;
use crate::error::AppError;
use argon2::password_hash::{PasswordHasher, SaltString};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use chrono::{Duration as ChronoDuration, Utc};
use uuid::Uuid;
// Removed unused import: use rand::Rng;
use crate::Result;
use anyhow::Error;
use async_trait::async_trait;
use axum::{
    body::Body,
    extract::{FromRequestParts, Request, State},
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response}, // Removed unused import: Json
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_qs;
use std::collections::HashMap;
use std::env;
use std::net::{IpAddr, SocketAddr};
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tower_cookies::Cookies;
use tracing;
use validator::Validate; // Removed unused import: ValidationErrors

lazy_static! {
    static ref USERNAME_REGEX: Regex = Regex::new(r"^[a-zA-Z0-9_-]{3,20}$")
        .expect("USERNAME_REGEX compilation failed - invalid regex pattern");
    // 🔒 SECURITY: Basic password length validation - detailed validation done programmatically
    static ref PASSWORD_REGEX: Regex = Regex::new(r"^.{8,}$")
        .expect("PASSWORD_REGEX compilation failed - invalid regex pattern");
}

/// Returns the JWT secret as bytes, loaded from the JWT_SECRET environment variable.
///
/// # Returns
/// * `Result<Vec<u8>>` - The JWT secret as bytes on success, or an AppError if not set.
fn jwt_secret() -> Result<Vec<u8>> {
    env::var("JWT_SECRET")
        .map(|s| s.into_bytes())
        .map_err(|_| AppError::Internal(Error::msg("JWT_SECRET environment variable is not set")))
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
pub fn generate_token(user_id: Uuid, email: &str, username: &str, role: &str) -> Result<String> {
    let expiration = Utc::now()
        .checked_add_signed(ChronoDuration::hours(24))
        .ok_or_else(|| {
            AppError::Internal(Error::msg(
                "Timestamp overflow when calculating JWT expiration",
            ))
        })?
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
        &EncodingKey::from_secret(&jwt_secret()?),
    )
    .map_err(|_| AppError::Internal(Error::msg("Failed to generate authentication token")))
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
        &DecodingKey::from_secret(&jwt_secret()?),
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
        .map_err(|_| AppError::Internal(Error::msg("Failed to hash password")))?
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
        Some(ph) => Argon2::default()
            .verify_password(password.as_bytes(), &ph)
            .is_ok(),
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

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        // First try to get token from Authorization header
        if let Some(auth) = parts.headers.get(AUTHORIZATION) {
            let auth_str = auth
                .to_str()
                .map_err(|_| AppError::Unauthorized("Invalid authorization header".to_string()))?;

            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                let claims = verify_token(token)?;
                return Ok(AuthUser {
                    user_id: claims.sub,
                });
            }
        }

        // If no Authorization header, try to get token from cookies
        if let Ok(cookies) = Cookies::from_request_parts(parts, _state).await {
            if let Some(auth_cookie) = cookies.get("auth_token") {
                let token = auth_cookie.value();
                let claims = verify_token(token)?;
                return Ok(AuthUser {
                    user_id: claims.sub,
                });
            }
        }

        Err(AppError::Unauthorized("Missing authentication".to_string()))
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
    #[serde(rename = "botName")]
    bot_name: Option<String>,
    #[serde(rename = "botColor")]
    bot_color: Option<String>,
}

#[async_trait]
impl<S> FromRequestParts<S> for WsAuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> std::result::Result<Self, Self::Rejection> {
        tracing::debug!(
            "WS Auth: Processing WebSocket authentication for request to: {}",
            parts.uri
        );

        let query_string = parts.uri.query().ok_or_else(|| {
            tracing::error!("WS Auth: Missing query string in WebSocket request");
            AppError::Unauthorized("Missing query string".to_string())
        })?;

        tracing::debug!("WS Auth: Query string: {}", query_string);

        let params = serde_qs::from_str::<WsTokenParams>(query_string).map_err(|e| {
            tracing::error!(
                "WS Auth: Failed to parse token from query string: {}, error: {}",
                query_string,
                e
            );
            AppError::Unauthorized("Invalid token format".to_string())
        })?;

        let token = if params.token.starts_with("Bearer ") {
            &params.token[7..]
        } else {
            &params.token
        };

        // Trim any trailing whitespace or slash from the token (fixes Chrome WebSocket issue)
        let token = token.trim().trim_end_matches('/');

        tracing::debug!(
            "WS Auth: Verifying token: {}...",
            &token.chars().take(10).collect::<String>()
        );

        let claims = match verify_token(token) {
            Ok(claims) => claims,
            Err(e) => {
                tracing::error!("WS Auth: Token verification failed: {}", e);
                return Err(e);
            }
        };

        // Log bot information if present (for demo mode)
        if let (Some(bot_name), Some(bot_color)) =
            (params.bot_name.as_ref(), params.bot_color.as_ref())
        {
            tracing::info!(
                "WS Auth: Bot authentication successful - Name: {}, Color: {}, User: {} ({})",
                bot_name,
                bot_color,
                claims.username,
                claims.sub
            );
        } else {
            tracing::info!(
                "WS Auth: User authentication successful: {} ({})",
                claims.username,
                claims.sub
            );
        }

        Ok(WsAuthUser {
            user_id: claims.sub,
        })
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
        requests.entry(key.to_string()).and_modify(|timestamps| {
            timestamps.retain(|&time| now.duration_since(time) < self.window);
        });

        let timestamps = requests.entry(key.to_string()).or_insert_with(Vec::new);

        if timestamps.len() >= self.max_requests {
            return Err(AppError::TooManyRequests("Too many requests".to_string()));
        }

        timestamps.push(now);
        Ok(())
    }

    /// Cleans up old rate limit data for all keys.
    /// This should be called periodically to prevent memory accumulation.
    ///
    /// # Returns
    /// * `Result<usize>` - Number of entries removed.
    pub async fn cleanup_old_data(&self) -> Result<usize> {
        let mut requests = self.requests.lock().await;
        let now = Instant::now();
        let mut removed_count = 0;

        // Clean up old requests for all keys
        requests.retain(|_key, timestamps| {
            timestamps.retain(|&time| now.duration_since(time) < self.window);

            // Remove the entire key if no recent requests
            if timestamps.is_empty() {
                removed_count += 1;
                false
            } else {
                true
            }
        });

        tracing::debug!(
            "🧹 RateLimiter cleanup: removed {} old entries, {} active IPs remain",
            removed_count,
            requests.len()
        );

        Ok(removed_count)
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
/// Extract client IP address with security validation to prevent spoofing
fn extract_client_ip(request: &Request<Body>) -> String {
    // 🔒 SECURITY: Secure IP extraction to prevent rate limit bypass

    // First, try to get the actual connection IP from extensions
    if let Some(connect_info) = request
        .extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
    {
        let socket_addr = connect_info.0;
        let connection_ip = socket_addr.ip();

        // 🔒 SECURITY: Only trust X-Forwarded-For if we're behind a trusted proxy
        // For production, you should configure trusted proxy IP ranges
        let trust_proxy = env::var("TRUST_PROXY").unwrap_or_else(|_| "false".to_string()) == "true";

        if trust_proxy {
            // Extract and validate the first IP from X-Forwarded-For
            if let Some(forwarded_header) = request.headers().get("x-forwarded-for") {
                if let Ok(forwarded_str) = forwarded_header.to_str() {
                    // Take the first IP (client IP) from the comma-separated list
                    if let Some(first_ip) = forwarded_str.split(',').next() {
                        let cleaned_ip = first_ip.trim();
                        // Validate that it's a proper IP address
                        if let Ok(parsed_ip) = IpAddr::from_str(cleaned_ip) {
                            // Additional validation: reject private IPs if they come from public connections
                            if is_valid_client_ip(&parsed_ip, &connection_ip) {
                                return parsed_ip.to_string();
                            }
                        }
                    }
                }
            }
        }

        // Fall back to actual connection IP
        return connection_ip.to_string();
    }

    // Final fallback (should not happen in normal operation)
    tracing::warn!("Unable to extract client IP, using fallback");
    "unknown".to_string()
}

/// Validate that the client IP is reasonable given the connection IP
fn is_valid_client_ip(client_ip: &IpAddr, connection_ip: &IpAddr) -> bool {
    // 🔒 SECURITY: Prevent private IP spoofing from public connections

    // If connection comes from public internet, reject private IP claims
    if is_public_ip(connection_ip) && is_private_ip(client_ip) {
        tracing::warn!(
            "Rejecting private IP {} from public connection {}",
            client_ip,
            connection_ip
        );
        return false;
    }

    // If connection is from localhost, be more permissive (development)
    if connection_ip.is_loopback() {
        return true;
    }

    // Allow valid public IPs
    if is_public_ip(client_ip) {
        return true;
    }

    // Allow private IPs from private connections
    if is_private_ip(connection_ip) && is_private_ip(client_ip) {
        return true;
    }

    false
}

/// Check if IP is a public internet address
fn is_public_ip(ip: &IpAddr) -> bool {
    !ip.is_loopback() && !is_private_ip(ip)
}

/// Check if IP is in private address space
fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => ipv4.is_private() || ipv4.is_loopback(),
        IpAddr::V6(ipv6) => {
            ipv6.is_loopback() || 
            // Check for IPv6 private ranges (simplified)
            ipv6.segments()[0] == 0xfd00 || // Unique local addresses
            ipv6.segments()[0] == 0xfe80 // Link-local addresses
        }
    }
}

pub async fn rate_limit_middleware(
    State(rate_limiter): State<Arc<RateLimiter>>,
    request: Request<Body>,
    next: Next,
) -> std::result::Result<Response, AppError> {
    // 🔒 SECURITY: Use secure IP extraction instead of trusting headers
    let client_ip = extract_client_ip(&request);

    rate_limiter.check(&client_ip).await?;

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
    pub email: String,
    #[validate(length(
        min = 3,
        max = 30,
        message = "Username must be between 3 and 30 characters"
    ))]
    #[validate(regex(
        path = "USERNAME_REGEX",
        message = "Username can only contain letters, numbers, and underscores"
    ))]
    pub username: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters long"))]
    #[validate(regex(
        path = "PASSWORD_REGEX",
        message = "Password must be at least 8 characters long"
    ))]
    pub password: String,
}

impl RegisterPayload {
    /// Custom validation for password strength that can't be done with regex
    pub fn validate_password_strength(&self) -> Result<()> {
        let has_lower = self.password.chars().any(|c| c.is_lowercase());
        let has_upper = self.password.chars().any(|c| c.is_uppercase());
        let has_digit = self.password.chars().any(|c| c.is_digit(10));
        let has_special = self.password.chars().any(|c| "@$!%*?&".contains(c));

        if has_lower && has_upper && has_digit && has_special {
            Ok(())
        } else {
            Err(AppError::BadRequest("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)".to_string()))
        }
    }
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
        AppError::TooManyRequests(_) => {
            (StatusCode::TOO_MANY_REQUESTS, err.to_string()).into_response()
        }
        AppError::Internal(_) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
        }
        AppError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
        AppError::Conflict(_) => (StatusCode::CONFLICT, err.to_string()).into_response(),
        AppError::Validation(_) => (StatusCode::BAD_REQUEST, err.to_string()).into_response(),
    }
}
