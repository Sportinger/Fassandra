use anyhow::{Context, Result};
use sqlx::{migrate::Migrator, postgres::PgPoolOptions};
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use backend::core::service_manager;
use backend::core::{create_router, start_server};
use backend::infrastructure::{update_admin_user_password, Config};
use backend::telemetry;

static MIGRATOR: Migrator = sqlx::migrate!();

/// Main entry point for the Fassandra Theater Collaboration Platform backend.
///
/// This function initializes the entire application stack:
/// 1. Configures logging and tracing
/// 2. Loads configuration from environment variables
/// 3. Establishes database connection and runs migrations
/// 4. Initializes the ServiceManager for dependency injection
/// 5. Creates and configures the HTTP router
/// 6. Starts the server with graceful shutdown handling
///
/// The application uses clean architecture with proper separation of concerns:
/// - Configuration management in `config.rs`
/// - Authentication helpers in `auth_helpers.rs`
/// - Security middleware in `middleware.rs`
/// - HTTP handlers in `handlers/` modules
/// - Server setup in `server.rs`
/// - Service management via `ServiceManager`
///
/// # Architecture
/// This represents the composition root of the application, where all
/// dependencies are wired together. The main function remains focused
/// on application bootstrap and delegates all specific concerns to
/// dedicated modules.
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize structured logging with environment-based configuration
    // Reduce global noise; keep audio pipelines verbose by default.
    // Override with RUST_LOG env if needed.
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "warn,backend::networking::audio=debug,backend::audio=debug,tower_http=warn".into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("🎭 Starting Fassandra Theater Collaboration Platform backend...");

    telemetry::init_metrics().context("Failed to initialize metrics recorder")?;

    // Load application configuration from environment variables
    let config = Config::from_env().context("Failed to load application configuration")?;

    tracing::info!("✅ Configuration loaded successfully");

    // Initialize database connection pool
    let pool = create_database_pool(&config)
        .await
        .context("Failed to initialize database connection pool")?;

    // Run database migrations
    run_migrations(&pool)
        .await
        .context("Failed to run database migrations")?;

    // Update admin user password if needed
    if let Err(e) = update_admin_user_password(&pool).await {
        tracing::warn!(
            "Issue during admin user password update: {}. Continuing...",
            e
        );
    }

    // Initialize ServiceManager for centralized service management
    let service_manager = service_manager::create_production_service_manager(pool.clone())
        .await
        .context("Failed to initialize ServiceManager")?;

    tracing::info!("✅ ServiceManager initialized with all background services");

    // Create and configure the HTTP router
    let config = Arc::new(config);
    let app_router = create_router(&service_manager, config.clone());

    tracing::info!("✅ HTTP router configured with all endpoints");

    // Start the HTTP server with graceful shutdown
    let server_result = start_server(&config, app_router).await;

    // Shutdown all services managed by ServiceManager
    if let Err(e) = service_manager.shutdown().await {
        tracing::error!("❌ ServiceManager shutdown failed: {}", e);
    }

    // Handle server result
    match server_result {
        Ok(_) => {
            tracing::info!("✅ Backend server shutdown completed successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("❌ Server error: {}", e);
            Err(e)
        }
    }
}

/// Creates and configures the database connection pool.
///
/// # Arguments
/// * `config` - Application configuration containing database settings
///
/// # Returns
/// * `Result<PgPool>` - Configured PostgreSQL connection pool
async fn create_database_pool(config: &Config) -> Result<sqlx::PgPool> {
    let pool_options = PgPoolOptions::new().max_connections(config.db_max_connections);

    let pool = pool_options
        .connect(&config.database_url)
        .await
        .context("Failed to connect to PostgreSQL database")?;

    tracing::info!(
        "✅ Database connection pool created (max_connections: {})",
        config.db_max_connections
    );
    Ok(pool)
}

/// Runs database migrations to ensure schema is up to date.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// * `Result<()>` - Success or migration error
async fn run_migrations(pool: &sqlx::PgPool) -> Result<()> {
    tracing::info!("🔄 Running database migrations...");

    match MIGRATOR.run(pool).await {
        Ok(_) => {
            tracing::info!("✅ Database migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            // Log as warning for already-applied migrations, but continue
            tracing::warn!(
                "Database migration check resulted in an error (possibly already applied): {}. Continuing server startup...", 
                e
            );
            Ok(())
        }
    }
}
