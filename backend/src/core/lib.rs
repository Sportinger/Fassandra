//! Core library for the Fassandra Theater Collaboration Platform backend.
//!
//! This module serves as the composition root, providing clean module exports
//! and essential utilities for the backend service. The heavy lifting is now
//! done by the service-oriented architecture with proper separation of concerns.

use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

// Re-export commonly used types for convenience
pub use crate::error::AppError;
pub use crate::error::*;

/// Type alias for Result with our custom error type
pub type Result<T> = std::result::Result<T, AppError>;

/// Utility function to get a script - simplified version without blocks
/// Blocks have been deprecated in favor of YJS documents
pub async fn get_script(
    pool: &PgPool,
    script_id: Uuid,
) -> Result<Option<crate::models::script::Script>> {
    info!("🔍 Fetching script: {}", script_id);

    let script = sqlx::query_as!(
        crate::models::script::Script,
        "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(script)
}

/// Health check function
pub async fn health_check(pool: &PgPool) -> Result<()> {
    sqlx::query("SELECT 1").fetch_one(pool).await?;
    Ok(())
}
