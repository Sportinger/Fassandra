use std::env;
use anyhow::{Context, Result};
use sqlx::PgPool;
use crate::auth::hash_password;
use crate::models::user::User;

/// Application configuration loaded from environment variables.
///
/// Fields:
/// - `database_url`: Database connection string.
/// - `db_max_connections`: Maximum number of DB connections.
/// - `backend_port`: Port for the backend server.
#[derive(Debug)]
pub struct Config {
    pub database_url: String,
    pub db_max_connections: u32,
    pub backend_port: u16,
    // 🔒 SECURITY: Configurable security headers
    pub csp_policy: String,
    pub hsts_max_age: String,
    pub hsts_include_subdomains: bool,
    pub x_frame_options: String,
    pub referrer_policy: String,
    pub permissions_policy: String,
}

impl Config {
    /// Loads configuration from environment variables.
    ///
    /// # Returns
    /// * `Result<Self>` - The loaded configuration or an error if required variables are missing or invalid.
    pub fn from_env() -> Result<Self> {
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

/// Checks if the admin user exists with the placeholder hash and updates it.
/// Uses environment variables for secure configuration.
pub async fn update_admin_user_password(pool: &PgPool) -> Result<()> {
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