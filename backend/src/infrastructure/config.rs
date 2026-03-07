use crate::auth::hash_password;
use crate::models::user::User;
use anyhow::{Context, Result};
use sqlx::PgPool;
use std::env;

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
    // ASR/Auto-follow config
    pub asr_provider: String, // local|deepgram
    pub asr_language: String, // e.g., de-DE
    pub asr_sample_rate: u32, // e.g., 16000 or 48000
    pub deepgram_api_key: Option<String>,
    // Anthropic API config
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: String,
    pub anthropic_max_tokens: u32,
    pub anthropic_rate_limit_ms: u64,
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
                .unwrap_or(Ok(3000))
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
            // Auto-follow defaults
            asr_provider: env::var("ASR_PROVIDER").unwrap_or_else(|_| "deepgram".to_string()),
            asr_language: env::var("ASR_LANGUAGE").unwrap_or_else(|_| "de".to_string()),
            asr_sample_rate: env::var("ASR_SAMPLE_RATE")
                .map(|v| v.parse::<u32>())
                .unwrap_or(Ok(48000))
                .context("Invalid ASR_SAMPLE_RATE value")?,
            deepgram_api_key: env::var("DEEPGRAM_API_KEY").ok(),
            // Anthropic API defaults
            anthropic_api_key: env::var("ANTHROPIC_API_KEY").ok(),
            anthropic_model: env::var("ANTHROPIC_MODEL")
                .unwrap_or_else(|_| "claude-haiku-4-5-20251001".to_string()),
            anthropic_max_tokens: env::var("ANTHROPIC_MAX_TOKENS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(4096),
            anthropic_rate_limit_ms: env::var("ANTHROPIC_RATE_LIMIT_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(2000),
        })
    }
}

/// Checks if the admin user exists with the placeholder hash and updates it.
/// Uses environment variables for secure configuration.
pub async fn update_admin_user_password(pool: &PgPool) -> Result<()> {
    // Load admin configuration from environment variables
    let admin_email =
        env::var("ADMIN_EMAIL").context("ADMIN_EMAIL environment variable not set")?;
    let admin_password =
        env::var("ADMIN_PASSWORD").context("ADMIN_PASSWORD environment variable not set")?;
    let placeholder_hash = env::var("ADMIN_PLACEHOLDER_HASH")
        .context("ADMIN_PLACEHOLDER_HASH environment variable not set")?;

    let user_result: Result<Option<User>, sqlx::Error> = sqlx::query_as(
        "SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = $1",
    )
    .bind(&admin_email)
    .fetch_optional(pool)
    .await;

    match user_result {
        Ok(Some(user)) => {
            if user.password_hash == placeholder_hash {
                tracing::info!(
                    "Updating placeholder password for admin user: {}",
                    admin_email
                );
                let correct_hash =
                    hash_password(&admin_password).context("Failed to hash admin user password")?;
                sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
                    .bind(&correct_hash)
                    .bind(user.id)
                    .execute(pool)
                    .await
                    .context("Failed to update admin user password hash")?;
                tracing::info!("Admin user password updated successfully.");
            } else {
                tracing::debug!(
                    "Admin user {} already has a valid password hash.",
                    admin_email
                );
            }
        }
        Ok(None) => {
            tracing::warn!(
                "Admin user {} not found after migration. Check migration file.",
                admin_email
            );
        }
        Err(e) => {
            // Log the error but don't prevent startup
            tracing::error!("Error checking admin user password: {}", e);
        }
    }
    Ok(())
}
