use sqlx::PgPool;
use crate::models::script::Script;
use crate::error::AppError;
use uuid::Uuid;
use crate::Result;
use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;

pub async fn create_script(
    State(pool): State<PgPool>,
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
    .fetch_one(&pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(script))
}

pub async fn get_user_scripts(
    State(pool): State<PgPool>,
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
    .fetch_all(&pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(scripts))
}

pub async fn update_script_title(
    State(pool): State<PgPool>,
    Path(script_id): Path<Uuid>,
    Json(title): Json<String>,
) -> Result<Json<Script>> {
    let script = sqlx::query_as_unchecked!(
        Script,
        "UPDATE scripts SET title = $1 WHERE id = $2 RETURNING id, title, created_by, created_at, is_public, thumbnail",
        title,
        script_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(Json(script))
}

pub async fn delete_script(
    State(pool): State<PgPool>,
    Path(script_id): Path<Uuid>,
) -> Result<()> {
    sqlx::query_unchecked!(
        "DELETE FROM scripts WHERE id = $1",
        script_id
    )
    .execute(&pool)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(())
} 