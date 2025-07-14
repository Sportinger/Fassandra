use sqlx::{PgPool, Row};
use crate::models::script::Script;
use crate::error::AppError;
use uuid::Uuid;
use crate::Result;
use serde_json::{json, Value};
use chrono::Utc;
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use axum::http::StatusCode;
use tracing::{debug, info, error, warn};
use serde::Deserialize;
use crate::auth::AuthUser;

#[derive(serde::Deserialize)]
pub struct ScriptUpdate {
    pub title: String,
}

/// Check if user has access to a script (owns it, it's public, or shared with them)
async fn check_script_access(pool: &PgPool, script_id: Uuid, user_id: Uuid) -> Result<bool> {
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
        "#
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let has_access: bool = row.get("has_access");
    Ok(has_access)
}

/// Check if user owns a script (required for modification operations)
async fn check_script_ownership(pool: &PgPool, script_id: Uuid, user_id: Uuid) -> Result<bool> {
    let row = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM scripts WHERE id = $1 AND created_by = $2) as owns_script"
    )
    .bind(script_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Database access error")))?;

    let owns_script: bool = row.get("owns_script");
    Ok(owns_script)
}

pub async fn create_script(
    State(pool): State<Arc<PgPool>>,
    Json(title): Json<String>,
    user_id: Uuid,
) -> Result<Json<Script>> {
    // Input validation
    if title.trim().is_empty() {
        return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
    }
    if title.len() > 500 {
        return Err(AppError::BadRequest("Script title too long".to_string()));
    }

    let script = sqlx::query_as!(
        Script,
        "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, created_by, created_at, is_public, thumbnail",
        Uuid::new_v4(),
        title.trim(),
        Some(user_id),
        Some(Utc::now()),
        Some(false),
        None::<String>
    )
    .fetch_one(&*pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to create script")))?;

    Ok(Json(script))
}

pub async fn get_user_scripts(
    State(pool): State<Arc<PgPool>>,
    user_id: Uuid,
) -> Result<Json<Vec<Script>>> {
    let scripts = sqlx::query_as!(
        Script,
        r#"
        SELECT DISTINCT s.id, s.title, s.created_by, s.created_at, s.is_public, s.thumbnail FROM scripts s
        WHERE s.created_by = $1
           OR s.is_public = TRUE
           OR EXISTS (
               SELECT 1 FROM script_shares ss 
               WHERE ss.script_id = s.id 
               AND ss.shared_with_user_id = $1
           )
        ORDER BY s.created_at DESC
        "#,
        Some(user_id)
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to fetch scripts")))?;

    Ok(Json(scripts))
}

pub async fn update_script(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    Json(script_update): Json<ScriptUpdate>,
    auth_user: AuthUser,
) -> Result<Json<Script>> {
    let ScriptUpdate { title } = script_update;

    // Input validation
    if title.trim().is_empty() {
        return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
    }
    if title.len() > 500 {
        return Err(AppError::BadRequest("Script title too long".to_string()));
    }

    // 🔒 SECURITY: Check ownership before allowing update
    if !check_script_ownership(&pool, script_id, auth_user.user_id).await? {
        warn!("User {} attempted to update script {} without ownership", auth_user.user_id, script_id);
        return Err(AppError::Forbidden("You can only update scripts you own".to_string()));
    }

    let script = sqlx::query_as!(
        Script,
        "UPDATE scripts SET title = $1 WHERE id = $2 RETURNING id, title, created_by, created_at, is_public, thumbnail",
        title.trim(),
        script_id
    )
    .fetch_one(&*pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to update script")))?;

    Ok(Json(script))
}

pub async fn delete_script(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
) -> Result<Json<Value>> {
    // 🔒 SECURITY: Check ownership before allowing deletion
    if !check_script_ownership(&pool, script_id, auth_user.user_id).await? {
        warn!("User {} attempted to delete script {} without ownership", auth_user.user_id, script_id);
        return Err(AppError::Forbidden("You can only delete scripts you own".to_string()));
    }

    sqlx::query!(
        "DELETE FROM scripts WHERE id = $1",
        script_id
    )
    .execute(&*pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to delete script")))?;

    Ok(Json(json!({"success": true})))
} 

#[derive(Deserialize)]
pub struct ContentSnapshotRequest {
    content: String,
    format: String, // "html" or "json"
}

/// Store content snapshot for reliable persistence
/// POST /api/scripts/:script_id/snapshot
#[axum::debug_handler]
pub async fn store_content_snapshot(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(request): Json<ContentSnapshotRequest>,
) -> impl IntoResponse {
    tracing::debug!("Storing content snapshot for script {}: {} chars", script_id, request.content.len());
    
    // Input validation
    if request.content.len() > 10_000_000 {  // 10MB limit
        return (StatusCode::BAD_REQUEST, "Content too large".to_string()).into_response();
    }
    
    if !["html", "json"].contains(&request.format.as_str()) {
        return (StatusCode::BAD_REQUEST, "Invalid format, must be 'html' or 'json'".to_string()).into_response();
    }

    // 🔒 SECURITY: Check access before allowing content storage
    match check_script_access(&pool, script_id, auth_user.user_id).await {
        Ok(has_access) => {
            if !has_access {
                warn!("User {} attempted to store content for script {} without access", auth_user.user_id, script_id);
                return (StatusCode::FORBIDDEN, "Access denied".to_string()).into_response();
            }
        }
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database access error".to_string()).into_response();
        }
    }
    
    // Store the content snapshot in the database
    let result = sqlx::query!(
        r#"
        INSERT INTO script_snapshots_meta (script_id, content_snapshot, snapshot_format, created_at, last_snapshot_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (script_id) 
        DO UPDATE SET 
            content_snapshot = $2,
            snapshot_format = $3,
            created_at = NOW(),
            last_snapshot_at = NOW()
        "#,
        script_id,
        request.content,
        request.format
    )
    .execute(pool.as_ref())
    .await;

    match result {
        Ok(_) => {
            info!("Successfully stored content snapshot for script {}", script_id);
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "message": "Content snapshot stored successfully"
            }))).into_response()
        }
        Err(_) => {
            error!("Failed to store content snapshot for script {}", script_id);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to store content snapshot".to_string()).into_response()
        }
    }
} 

/// GET /api/scripts/:id/snapshot - Get the latest content snapshot
pub async fn get_content_snapshot(
    State(pool): State<Arc<PgPool>>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // 🔒 SECURITY: Check if user has access to this script
    let script_access = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        tracing::error!("Database error checking script access: {}", e);
        AppError::Internal(anyhow::Error::msg("Database error"))
    })?;

    let script = match script_access {
        Some(script) => script,
        None => {
            return Err(AppError::NotFound("Script not found".to_string()));
        }
    };

    // Check if user owns the script or has access via sharing
    let has_access = script.created_by == Some(user_id) ||
        sqlx::query!(
            "SELECT COUNT(*) as count FROM script_shares WHERE script_id = $1 AND shared_with_user_id = $2",
            script_id,
            user_id
        )
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| {
            tracing::error!("Database error checking script sharing: {}", e);
            AppError::Internal(anyhow::Error::msg("Database error"))
        })?.count.unwrap_or(0) > 0;

    if !has_access {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    // Get the latest content snapshot using dynamic query to avoid cache issues
    let snapshot_result = sqlx::query_as::<_, (Option<String>, Option<String>, chrono::DateTime<chrono::Utc>)>(
        "SELECT content_snapshot, snapshot_format, created_at FROM script_snapshots_meta WHERE script_id = $1 AND content_snapshot IS NOT NULL ORDER BY created_at DESC LIMIT 1"
    )
    .bind(script_id)
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        tracing::error!("Database error fetching content snapshot: {}", e);
        AppError::Internal(anyhow::Error::msg("Database error"))
    })?;

    match snapshot_result {
        Some((content_snapshot, snapshot_format, created_at)) => {
            if let Some(content) = content_snapshot {
                tracing::info!("🎯 Retrieved content snapshot for script {}: {} chars", script_id, content.len());
                Ok(Json(serde_json::json!({
                    "script_id": script_id,
                    "content": content,
                    "format": snapshot_format.unwrap_or_else(|| "html".to_string()),
                    "created_at": created_at
                })))
            } else {
                // No content in snapshot
                Ok(Json(serde_json::json!({
                    "script_id": script_id,
                    "content": "",
                    "format": "html",
                    "created_at": null
                })))
            }
        }
        None => {
            // No snapshot found - return empty content
            tracing::info!("⚠️ No content snapshot found for script {}, returning empty content", script_id);
            Ok(Json(serde_json::json!({
                "script_id": script_id,
                "content": "",
                "format": "html",
                "created_at": null
            })))
        }
    }
} 