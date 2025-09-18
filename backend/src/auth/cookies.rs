use crate::Result;
use chrono::{Duration, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_cookies::{cookie::SameSite, Cookie, Cookies};
use uuid::Uuid;

/// Cookie configuration constants
const AUTH_COOKIE_NAME: &str = "auth_token";
const CSRF_COOKIE_NAME: &str = "csrf_token";
const COOKIE_MAX_AGE_DAYS: i64 = 7;

/// Check if we're in production mode or using HTTPS
/// Cookies should be secure when using HTTPS (even in dev)
fn should_use_secure_cookies() -> bool {
    // Check if we're in production
    if std::env::var("PRODUCTION").is_ok()
        || std::env::var("RUST_ENV").unwrap_or_default() == "production"
    {
        return true;
    }

    // Check if HTTPS is enabled in dev (for proper cookie handling)
    std::env::var("USE_HTTPS").unwrap_or_default() == "true"
}

/// Get appropriate SameSite setting based on environment
fn get_same_site_setting() -> SameSite {
    // In production, use Lax for better security
    if std::env::var("PRODUCTION").is_ok()
        || std::env::var("RUST_ENV").unwrap_or_default() == "production"
    {
        return SameSite::Lax;
    }

    // In development with HTTP, use Lax
    if !should_use_secure_cookies() {
        return SameSite::Lax;
    }

    // In development with HTTPS, use None for cross-origin
    SameSite::None
}

/// Optional cookie domain for sharing across subdomains in production
/// If `COOKIE_DOMAIN` is set (e.g., ".fassandra.de"), cookies will include this domain
fn get_cookie_domain() -> Option<String> {
    // Only apply a custom domain in production contexts
    let is_prod = std::env::var("PRODUCTION").is_ok()
        || std::env::var("RUST_ENV").unwrap_or_default() == "production";

    if !is_prod {
        return None;
    }

    // Expect a value like ".fassandra.de" to cover apex + subdomains
    match std::env::var("COOKIE_DOMAIN") {
        Ok(v) if !v.trim().is_empty() => Some(v.trim().to_string()),
        _ => None,
    }
}

/// CSRF token store - in production, this should be in Redis or database
pub type CsrfTokenStore = Arc<RwLock<HashMap<String, (Uuid, chrono::DateTime<Utc>)>>>;

/// Creates a new CSRF token store
pub fn create_csrf_store() -> CsrfTokenStore {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Sets an authentication cookie with the JWT token
pub fn set_auth_cookie(cookies: &Cookies, token: &str) -> Result<()> {
    let mut builder = Cookie::build((AUTH_COOKIE_NAME, token.to_string()))
        .path("/")
        .max_age(time::Duration::days(COOKIE_MAX_AGE_DAYS))
        .same_site(get_same_site_setting())
        .http_only(true)
        .secure(should_use_secure_cookies()); // Secure when using HTTPS

    if let Some(domain) = get_cookie_domain() {
        builder = builder.domain(domain);
    }

    let cookie = builder.build();

    cookies.add(cookie);
    Ok(())
}

/// Removes the authentication cookie
pub fn remove_auth_cookie(cookies: &Cookies) {
    let mut builder = Cookie::build((AUTH_COOKIE_NAME, ""))
        .path("/")
        .max_age(time::Duration::seconds(0))
        .same_site(get_same_site_setting())
        .http_only(true)
        .secure(should_use_secure_cookies()); // Match the setting used when creating the cookie

    if let Some(domain) = get_cookie_domain() {
        builder = builder.domain(domain);
    }

    let cookie = builder.build();

    cookies.add(cookie);
}

/// Gets the authentication token from cookies
pub fn get_auth_token_from_cookie(cookies: &Cookies) -> Option<String> {
    cookies
        .get(AUTH_COOKIE_NAME)
        .map(|cookie| cookie.value().to_string())
}

/// Generates a new CSRF token
pub fn generate_csrf_token() -> String {
    Uuid::new_v4().to_string()
}

/// Sets a CSRF token cookie
pub fn set_csrf_cookie(cookies: &Cookies, token: &str) {
    let mut builder = Cookie::build((CSRF_COOKIE_NAME, token.to_string()))
        .path("/")
        .max_age(time::Duration::days(COOKIE_MAX_AGE_DAYS))
        .same_site(get_same_site_setting())
        .http_only(false) // CSRF token needs to be readable by JavaScript
        .secure(should_use_secure_cookies()); // Secure when using HTTPS

    if let Some(domain) = get_cookie_domain() {
        builder = builder.domain(domain);
    }

    let cookie = builder.build();

    cookies.add(cookie);
}

/// Gets the CSRF token from cookies
pub fn get_csrf_token_from_cookie(cookies: &Cookies) -> Option<String> {
    cookies
        .get(CSRF_COOKIE_NAME)
        .map(|cookie| cookie.value().to_string())
}

/// Stores a CSRF token in the store with user association
pub async fn store_csrf_token(store: &CsrfTokenStore, token: &str, user_id: Uuid) -> Result<()> {
    let expiry = Utc::now() + Duration::hours(24);
    let mut tokens = store.write().await;
    tokens.insert(token.to_string(), (user_id, expiry));

    // Clean up expired tokens
    let now = Utc::now();
    tokens.retain(|_, (_, exp)| *exp > now);

    Ok(())
}

/// Validates a CSRF token
pub async fn validate_csrf_token(
    store: &CsrfTokenStore,
    token: &str,
    user_id: Uuid,
) -> Result<bool> {
    let tokens = store.read().await;

    if let Some((stored_user_id, expiry)) = tokens.get(token) {
        if *stored_user_id == user_id && *expiry > Utc::now() {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Cleans up expired CSRF tokens
pub async fn cleanup_expired_csrf_tokens(store: &CsrfTokenStore) {
    let now = Utc::now();
    let mut tokens = store.write().await;
    tokens.retain(|_, (_, expiry)| *expiry > now);
}
