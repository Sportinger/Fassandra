//! Script Sharing Application Service
//!
//! Orchestrates script sharing workflows and permissions management.
//! Handles complex business logic around script access control and sharing.

use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::domain::script_service::ScriptService;
use crate::error::AppError;
use crate::models::script_share::{ScriptShare, ShareScriptRequest};
use crate::models::user::User;

/// Application service for script sharing operations
pub struct ScriptSharingApplicationService {
    script_service: Arc<ScriptService>,
    pool: Arc<PgPool>,
}

impl ScriptSharingApplicationService {
    /// Creates a new ScriptSharingApplicationService
    pub fn new(script_service: Arc<ScriptService>, pool: Arc<PgPool>) -> Self {
        Self {
            script_service,
            pool,
        }
    }

    /// Shares a script with another user with full validation and business logic
    pub async fn share_script(
        &self,
        script_id: Uuid,
        user_id: Uuid,
        request: ShareScriptRequest,
    ) -> Result<ScriptShare, AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Sharing script with user");

        // Verify ownership through domain service
        self.script_service
            .verify_script_ownership(script_id, user_id)
            .await?;

        // Business validation for sharing
        self.script_service
            .validate_script_sharing(script_id, user_id, &request.username)
            .await?;

        // Find target user
        let target_user = self.find_user_by_username(&request.username).await?;

        // Prevent self-sharing
        if target_user.id == user_id {
            warn!("User {} attempted to share script with themselves", user_id);
            return Err(AppError::BadRequest(
                "Cannot share script with yourself".into(),
            ));
        }

        // Create or update the share
        let share = self
            .create_or_update_share(
                script_id,
                user_id,
                target_user.id,
                &request.permission.to_string(),
            )
            .await?;

        info!(user_id = %user_id, script_id = %script_id, target_user_id = %target_user.id, "Successfully shared script");
        Ok(share)
    }

    /// Gets all shares for a script with proper authorization
    pub async fn get_script_shares(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<(ScriptShare, String)>, AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Getting script shares");

        // Verify ownership
        self.script_service
            .verify_script_ownership(script_id, user_id)
            .await?;

        // Get shares with user information
        let shares: Vec<_> = sqlx::query!(
            r#"
            SELECT ss.*, u.username
            FROM script_shares ss
            JOIN users u ON ss.shared_with_user_id = u.id
            WHERE ss.script_id = $1
            ORDER BY ss.created_at DESC
            "#,
            script_id
        )
        .fetch_all(self.pool.as_ref())
        .await?
        .into_iter()
        .map(|record| {
            (
                ScriptShare {
                    id: record.id,
                    script_id: record.script_id,
                    shared_with_user_id: record.shared_with_user_id,
                    permission: record.permission,
                    created_at: record.created_at,
                    created_by: record.created_by,
                },
                record.username,
            )
        })
        .collect();

        info!(user_id = %user_id, script_id = %script_id, share_count = shares.len(), "Retrieved script shares");
        Ok(shares)
    }

    /// Removes a script share with proper authorization
    pub async fn remove_script_share(
        &self,
        script_id: Uuid,
        share_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        info!(user_id = %user_id, script_id = %script_id, share_id = %share_id, "Removing script share");

        // Verify ownership
        self.script_service
            .verify_script_ownership(script_id, user_id)
            .await?;

        // Remove the share
        let result = sqlx::query!(
            "DELETE FROM script_shares WHERE id = $1 AND script_id = $2",
            share_id,
            script_id
        )
        .execute(self.pool.as_ref())
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Share not found".into()));
        }

        info!(user_id = %user_id, script_id = %script_id, share_id = %share_id, "Successfully removed script share");
        Ok(())
    }

    /// Toggles a script's public status with proper authorization
    pub async fn toggle_script_public(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Toggling script public status");

        // Business validation through domain service
        self.script_service
            .validate_public_toggle(script_id, user_id)
            .await?;

        // Update the script's public status
        let result = sqlx::query!(
            r#"
            UPDATE scripts 
            SET is_public = NOT is_public 
            WHERE id = $1 AND created_by = $2
            RETURNING is_public
            "#,
            script_id,
            user_id
        )
        .fetch_optional(self.pool.as_ref())
        .await?
        .ok_or_else(|| {
            AppError::NotFound("Script not found or you don't have permission".into())
        })?;

        let new_status = result.is_public.unwrap_or(false);
        info!(user_id = %user_id, script_id = %script_id, public_status = new_status, "Successfully toggled script public status");
        Ok(new_status)
    }

    /// Checks if a user has access to a script (ownership, sharing, or public)
    pub async fn check_script_access(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, AppError> {
        // Check ownership first
        if self
            .script_service
            .verify_script_ownership(script_id, user_id)
            .await
            .is_ok()
        {
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

        if share_count > 0 {
            return Ok(true);
        }

        // Check if public
        let is_public = sqlx::query!("SELECT is_public FROM scripts WHERE id = $1", script_id)
            .fetch_optional(self.pool.as_ref())
            .await?
            .map(|record| record.is_public.unwrap_or(false))
            .unwrap_or(false);

        Ok(is_public)
    }

    /// Checks if a user has write access to a script
    pub async fn check_script_write_access(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, AppError> {
        // Check ownership first
        if self
            .script_service
            .verify_script_ownership(script_id, user_id)
            .await
            .is_ok()
        {
            return Ok(true);
        }

        // Check for write sharing
        let write_share_count = sqlx::query!(
            "SELECT COUNT(*) as count FROM script_shares 
             WHERE script_id = $1 AND shared_with_user_id = $2 AND permission = 'write'",
            script_id,
            user_id
        )
        .fetch_one(self.pool.as_ref())
        .await?
        .count
        .unwrap_or(0);

        Ok(write_share_count > 0)
    }

    /// Finds a user by username
    async fn find_user_by_username(&self, username: &str) -> Result<User, AppError> {
        // Note: Using exact match for now due to SQLX offline mode constraints
        // TODO: Update to case-insensitive after preparing queries
        sqlx::query_as!(User, "SELECT * FROM users WHERE username = $1", username)
            .fetch_optional(self.pool.as_ref())
            .await?
            .ok_or_else(|| AppError::NotFound(format!("User '{}' not found", username)))
    }

    /// Creates or updates a script share
    async fn create_or_update_share(
        &self,
        script_id: Uuid,
        created_by: Uuid,
        shared_with_user_id: Uuid,
        permission: &str,
    ) -> Result<ScriptShare, AppError> {
        sqlx::query_as!(
            ScriptShare,
            r#"
            INSERT INTO script_shares (script_id, shared_with_user_id, permission, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (script_id, shared_with_user_id) 
            DO UPDATE SET permission = $3
            RETURNING *
            "#,
            script_id,
            shared_with_user_id,
            permission,
            created_by
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to create or update script share: {}", e);
            AppError::Db(e)
        })
    }
}
