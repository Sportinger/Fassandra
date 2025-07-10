use sqlx::PgPool;
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
use tracing::{debug, info, error};
use serde::Deserialize;

#[derive(serde::Deserialize)]
pub struct ScriptUpdate {
    pub title: String,
}

pub async fn create_script(
    State(pool): State<Arc<PgPool>>,
    Json(title): Json<String>,
    user_id: Uuid,
) -> Result<Json<Script>> {
    let script = sqlx::query_as_unchecked!(
        Script,
        "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, created_by, created_at, is_public, thumbnail",
        Uuid::new_v4(),
        title,
        Some(user_id),
        Some(Utc::now()),
        false,
        None::<String>
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(script))
}

pub async fn get_user_scripts(
    State(pool): State<Arc<PgPool>>,
    user_id: Uuid,
) -> Result<Json<Vec<Script>>> {
    let scripts = sqlx::query_as_unchecked!(
        Script,
        r#"
        SELECT DISTINCT s.id, s.title, s.created_by, s.created_at, s.is_public, s.thumbnail FROM scripts s
        WHERE s.created_by = $1
           OR s.is_public = true
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
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(scripts))
}

pub async fn update_script(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    Json(script_update): Json<ScriptUpdate>,
) -> Result<Json<Script>> {
    let ScriptUpdate { title } = script_update;

    let script = sqlx::query_as_unchecked!(
        Script,
        "UPDATE scripts SET title = $1 WHERE id = $2 RETURNING id, title, created_by, created_at, is_public, thumbnail",
        title,
        script_id
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(script))
}

pub async fn delete_script(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
) -> Result<Json<Value>> {
    sqlx::query_unchecked!(
        "DELETE FROM scripts WHERE id = $1",
        script_id
    )
    .execute(&*pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(json!({"success": true})))
} 

#[derive(Deserialize)]
pub struct ContentSnapshotRequest {
    content: String,
    format: String, // "html" or "json"
}

/// Store content snapshot for reliable persistence
/// POST /api/scripts/:script_id/snapshot
pub async fn store_content_snapshot(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    Json(request): Json<ContentSnapshotRequest>,
) -> impl IntoResponse {
    debug!("Storing content snapshot for script {}: {} chars", script_id, request.content.len());
    
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
        Err(e) => {
            error!("Failed to store content snapshot for script {}: {}", script_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to store content snapshot: {}", e)).into_response()
        }
    }
} 