//! Thumbnail Application Service
//!
//! Orchestrates thumbnail generation workflows.
//! Handles complex business logic around thumbnail creation and management.

use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use chrono::{DateTime, Utc};
use serde::Serialize;
use tracing::{info, error};
use anyhow::{Result, Context};
use crate::error::AppError;
use crate::models::script::Script;
use crate::services::thumbnail::{update_script_thumbnail, generate_missing_thumbnails, regenerate_all_thumbnails};
use crate::domain::script_service::ScriptService;
use crate::repositories::script_repository::{ScriptRepository, PostgresScriptRepository};
use crate::repositories::user_repository::{UserRepository, PostgresUserRepository};
use crate::repositories::block_repository::{BlockRepository, PostgresBlockRepository};

/// Application service for thumbnail operations
pub struct ThumbnailApplicationService {
    script_service: Arc<ScriptService>,
    pool: Arc<PgPool>,
}

impl ThumbnailApplicationService {
    /// Creates a new ThumbnailApplicationService
    pub fn new(script_service: Arc<ScriptService>, pool: Arc<PgPool>) -> Self {
        Self {
            script_service,
            pool,
        }
    }

    /// Generates a thumbnail for a specific script with proper authorization
    pub async fn generate_thumbnail(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<String, AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Generating thumbnail for script");

        // Verify ownership through domain service
        self.script_service.verify_script_ownership(script_id, user_id).await?;

        // Business validation for thumbnail generation
        self.script_service.validate_thumbnail_generation(script_id, user_id).await?;

        // Generate the thumbnail
        let thumbnail = update_script_thumbnail(self.pool.as_ref(), script_id)
            .await
            .map_err(|e| {
                error!("Failed to generate thumbnail for script {}: {}", script_id, e);
                AppError::Internal(anyhow::anyhow!("Failed to generate thumbnail"))
            })?;

        info!(user_id = %user_id, script_id = %script_id, "Successfully generated thumbnail");
        Ok(thumbnail)
    }

    /// Generates thumbnails for all scripts that don't have one
    pub async fn generate_missing_thumbnails(
        &self,
        user_id: Uuid,
    ) -> Result<usize, AppError> {
        info!(user_id = %user_id, "Generating thumbnails for all scripts without thumbnails");

        // Business validation for bulk thumbnail generation
        self.script_service.validate_bulk_thumbnail_generation(user_id).await?;

        // Generate thumbnails for missing ones
        let count = generate_missing_thumbnails(self.pool.as_ref())
            .await
            .map_err(|e| {
                error!("Failed to generate missing thumbnails: {}", e);
                AppError::Internal(anyhow::anyhow!("Failed to generate missing thumbnails"))
            })?;

        info!(user_id = %user_id, count = count, "Successfully generated missing thumbnails");
        Ok(count)
    }

    /// Regenerates thumbnails for ALL scripts (forces refresh)
    pub async fn regenerate_all_thumbnails(
        &self,
        user_id: Uuid,
    ) -> Result<usize, AppError> {
        info!(user_id = %user_id, "Regenerating all thumbnails for all scripts");

        // Business validation for bulk thumbnail regeneration
        self.script_service.validate_bulk_thumbnail_regeneration(user_id).await?;

        // Regenerate all thumbnails
        let count = regenerate_all_thumbnails(self.pool.as_ref())
            .await
            .map_err(|e| {
                error!("Failed to regenerate all thumbnails: {}", e);
                AppError::Internal(anyhow::anyhow!("Failed to regenerate all thumbnails"))
            })?;

        info!(user_id = %user_id, count = count, "Successfully regenerated all thumbnails");
        Ok(count)
    }

    /// Validates that a script exists and user has access for thumbnail operations
    pub async fn validate_script_access_for_thumbnail(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        // Check if script exists
        let script_exists = sqlx::query!(
            "SELECT id FROM scripts WHERE id = $1",
            script_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?
        .is_some();

        if !script_exists {
            return Err(AppError::NotFound("Script not found".into()));
        }

        // Check ownership or sharing access
        let has_access = self.check_script_access(script_id, user_id).await?;
        if !has_access {
            return Err(AppError::Forbidden("You don't have permission to generate thumbnails for this script".into()));
        }

        Ok(())
    }

    /// Checks if user has access to script (ownership or sharing)
    async fn check_script_access(&self, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        // Check ownership first
        if self.script_service.verify_script_ownership(script_id, user_id).await.is_ok() {
            return Ok(true);
        }

        // Check sharing
        let share_count = sqlx::query!(
            "SELECT COUNT(*) as count FROM script_shares WHERE script_id = $1 AND shared_with_user_id = $2",
            script_id,
            user_id
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .count.unwrap_or(0);

        Ok(share_count > 0)
    }

    /// Gets thumbnail statistics for monitoring
    pub async fn get_thumbnail_statistics(&self) -> Result<ThumbnailStatistics, AppError> {
        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_scripts,
                COUNT(thumbnail) as scripts_with_thumbnails,
                COUNT(*) - COUNT(thumbnail) as scripts_without_thumbnails
            FROM scripts
            "#
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(ThumbnailStatistics {
            total_scripts: stats.total_scripts.unwrap_or(0) as usize,
            scripts_with_thumbnails: stats.scripts_with_thumbnails.unwrap_or(0) as usize,
            scripts_without_thumbnails: stats.scripts_without_thumbnails.unwrap_or(0) as usize,
        })
    }
}

/// Statistics about thumbnail generation
#[derive(Debug)]
pub struct ThumbnailStatistics {
    pub total_scripts: usize,
    pub scripts_with_thumbnails: usize,
    pub scripts_without_thumbnails: usize,
} 