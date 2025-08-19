//! Core library for the Pessoa Theater Collaboration Platform backend.
//!
//! This module serves as the composition root, providing clean module exports
//! and essential utilities for the backend service. The heavy lifting is now
//! done by the service-oriented architecture with proper separation of concerns.

use sqlx::PgPool;
use uuid::Uuid;
use tracing::info;

// Re-export commonly used types for convenience
pub use crate::error::AppError;
pub use crate::error::*;

/// Type alias for Result with our custom error type
pub type Result<T> = std::result::Result<T, AppError>;

/// Utility function to get a script with its blocks - used by thumbnail.rs
/// This is kept here for backward compatibility during the transition
pub async fn get_script_with_blocks(
    pool: &PgPool,
    script_id: Uuid,
) -> Result<Option<(crate::models::script::Script, Vec<crate::models::block::Block>)>> {
    info!("🔍 Fetching script with blocks: {}", script_id);
    
    // First get the script
    let script = sqlx::query_as!(
        crate::models::script::Script,
        "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(pool)
    .await?;
    
    if let Some(script) = script {
        // Blocks table deprecated - return empty
        let blocks = vec![];
        
        Ok(Some((script, blocks)))
    } else {
        Ok(None)
    }
}

/// Health check function
pub async fn health_check(pool: &PgPool) -> Result<()> {
    sqlx::query("SELECT 1")
        .fetch_one(pool)
        .await?;
    Ok(())
}