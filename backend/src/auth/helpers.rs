use crate::error::AppError;
use anyhow::Result;
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// 🔒 SECURITY: Helper functions for authorization checks

/// Checks if a user has access to a script (ownership, public, or shared).
pub async fn check_script_access(
    pool: &PgPool,
    script_id: Uuid,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let row = sqlx::query(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM scripts s
            WHERE s.id = $1 
            AND (
                s.created_by = $2           -- User owns the script
                OR s.is_public = true       -- Script is public
                OR EXISTS (                 -- Script is shared with user
                    SELECT 1 FROM script_shares ss 
                    WHERE ss.script_id = s.id 
                    AND ss.shared_with_user_id = $2
                )
            )
        ) as has_access
        "#,
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let has_access: bool = row.get("has_access");
    Ok(has_access)
}

/// Checks if a user owns a script.
pub async fn check_script_ownership(
    pool: &PgPool,
    script_id: Uuid,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM scripts WHERE id = $1 AND created_by = $2) as owns_script",
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let owns_script: bool = row.get("owns_script");
    Ok(owns_script)
}
