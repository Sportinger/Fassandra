//! Handlers for page break management API endpoints.

use axum::{
    extract::{State, Path, Json},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, put},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, error};
use uuid::Uuid;
use sqlx::PgPool;
use std::sync::Arc;

use crate::auth::AuthUser;

/// Request payload for updating page breaks
#[derive(Debug, Deserialize)]
pub struct UpdatePageBreaksRequest {
    /// List of blocks with their updated page numbers
    pub blocks: Vec<BlockPageUpdate>,
}

/// Individual block page number update
#[derive(Debug, Deserialize)]
pub struct BlockPageUpdate {
    /// Block ID
    pub block_id: Uuid,
    /// New page number for the block
    pub page_number: i32,
}

/// Response for getting page breaks
#[derive(Debug, Serialize)]
pub struct PageBreaksResponse {
    /// Script ID
    pub script_id: Uuid,
    /// List of blocks with their page numbers
    pub blocks: Vec<BlockPageInfo>,
}

/// Block page information
#[derive(Debug, Serialize)]
pub struct BlockPageInfo {
    /// Block ID
    pub block_id: Uuid,
    /// Block type
    pub block_type: String,
    /// Block content preview (first 100 chars)
    pub content_preview: String,
    /// Current page number
    pub page_number: i32,
    /// Block order within the script
    pub block_order: i32,
}

/// Creates a router for page break management endpoints.
pub fn create_page_break_router() -> Router<Arc<PgPool>> {
    Router::new()
        .route("/scripts/:script_id/page-breaks", get(get_page_breaks))
        .route("/scripts/:script_id/page-breaks", put(update_page_breaks))
}

/// Gets page break information for a script.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `Path(script_id)` - Script ID from URL path
/// * `AuthUser{user_id}` - Authenticated user
///
/// # Returns
/// * `Result<Json<PageBreaksResponse>, impl IntoResponse>` - Page break information or error
async fn get_page_breaks(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<PageBreaksResponse>, impl IntoResponse> {
    info!(%user_id, %script_id, "Getting page breaks for script");

    // Verify user has access to this script
    let script_access = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        error!("Database error checking script access: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let script = match script_access {
        Some(script) => script,
        None => {
            return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Script not found"}))));
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
            error!("Database error checking script sharing: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?
        .count.unwrap_or(0) > 0;

    if !has_access {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))));
    }

    // Get blocks with page information
    let blocks = sqlx::query!(
        "SELECT id, block_type, content, page_number, block_order 
         FROM blocks 
         WHERE script_id = $1 
         ORDER BY page_number ASC, block_order ASC",
        script_id
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| {
        error!("Database error fetching blocks: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let block_info: Vec<BlockPageInfo> = blocks
        .into_iter()
        .map(|block| {
            let content_preview = if block.content.len() > 100 {
                format!("{}...", &block.content[..100])
            } else {
                block.content
            };

            BlockPageInfo {
                block_id: block.id,
                block_type: block.block_type,
                content_preview,
                page_number: block.page_number,
                block_order: block.block_order,
            }
        })
        .collect();

    let response = PageBreaksResponse {
        script_id,
        blocks: block_info,
    };

    Ok(Json(response))
}

/// Updates page breaks for a script.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `Path(script_id)` - Script ID from URL path
/// * `AuthUser{user_id}` - Authenticated user
/// * `Json(payload)` - Update request payload
///
/// # Returns
/// * `Result<Json<serde_json::Value>, impl IntoResponse>` - Success response or error
async fn update_page_breaks(
    State(pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<UpdatePageBreaksRequest>,
) -> Result<Json<serde_json::Value>, impl IntoResponse> {
    info!(%user_id, %script_id, "Updating page breaks for script");

    // Verify user has write access to this script
    let script_access = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(pool.as_ref())
    .await
    .map_err(|e| {
        error!("Database error checking script access: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    let script = match script_access {
        Some(script) => script,
        None => {
            return Err((StatusCode::NOT_FOUND, Json(json!({"error": "Script not found"}))));
        }
    };

    // Check if user owns the script or has write access via sharing
    let has_write_access = script.created_by == Some(user_id) || 
        sqlx::query!(
            "SELECT COUNT(*) as count FROM script_shares 
             WHERE script_id = $1 AND shared_with_user_id = $2 AND permission = 'write'",
            script_id,
            user_id
        )
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| {
            error!("Database error checking script sharing: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?
        .count.unwrap_or(0) > 0;

    if !has_write_access {
        return Err((StatusCode::FORBIDDEN, Json(json!({"error": "Write access denied"}))));
    }

    // Start transaction for atomic updates
    let mut tx = pool.as_ref().begin().await.map_err(|e| {
        error!("Failed to begin transaction: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    // Update page numbers for each block
    for block_update in payload.blocks {
        sqlx::query!(
            "UPDATE blocks SET page_number = $1 WHERE id = $2 AND script_id = $3",
            block_update.page_number,
            block_update.block_id,
            script_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to update block page number: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
        })?;
    }

    // Commit transaction
    tx.commit().await.map_err(|e| {
        error!("Failed to commit transaction: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error"})))
    })?;

    info!(%user_id, %script_id, "Successfully updated page breaks");

    Ok(Json(json!({
        "success": true,
        "message": "Page breaks updated successfully"
    })))
} 