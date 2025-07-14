use axum::{extract::{State, Path}, Json, response::IntoResponse};
use std::sync::Arc;
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::auth::AuthUser;
use crate::error::AppError;
use crate::models::{script::Script, block::Block, edit::Edit, script_layout::{ScriptLayout, CreateScriptLayoutRequest, UpdateScriptLayoutRequest}};
use crate::api::scripts::{get_user_scripts, store_content_snapshot, get_content_snapshot};
use crate::{create_script, create_block, update_block, get_script_with_blocks, get_block_history, delete_script, update_script_content_from_html, get_script_layouts, get_default_script_layout, create_script_layout, update_script_layout, delete_script_layout};
use crate::auth_helpers::{check_script_access, check_script_ownership};

/// Response structure for listing scripts.
#[derive(Serialize)]
pub struct ScriptsResponse(pub Vec<Script>);

/// Response structure for a script with its blocks.
#[derive(Serialize)]
pub struct ScriptWithBlocks { 
    pub script: Script, 
    pub blocks: Vec<Block> 
}

/// Payload for creating a new script.
#[derive(Deserialize)]
pub struct CreateScriptPayload { 
    pub title: String 
}

/// Payload for creating a new block.
#[derive(Deserialize)]
pub struct CreateBlockPayload { 
    pub block_type: String, 
    pub content: String 
}

/// Payload for updating a block's content.
#[derive(Deserialize)]
pub struct UpdateBlockPayload { 
    pub content: String 
}

/// Payload for updating script content.
#[derive(Deserialize)]
pub struct UpdateScriptContentPayload { 
    pub content: String // HTML content from TipTap editor
}

/// Lists all scripts for the authenticated user.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
///
/// # Returns
/// * `Result<Json<ScriptsResponse>, AppError>` - List of scripts as JSON on success, or an AppError on failure.
pub async fn list_scripts(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser) -> Result<Json<ScriptsResponse>, AppError> {
    let response = get_user_scripts(
        State(Arc::new(pool.as_ref().clone())),
        user_id
    ).await?;
    let scripts = response.0; // Extract the Vec<Script> from Json wrapper
    Ok(Json(ScriptsResponse(scripts)))
}

/// Endpoint to create a new script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Json(payload)` - Script creation payload.
///
/// # Returns
/// * `Result<Json<Script>, AppError>` - The new script as JSON on success, or an AppError on failure.
pub async fn create_script_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Json(payload): Json<CreateScriptPayload>) -> Result<Json<Script>, AppError> {
    let script = create_script(pool.as_ref(), &payload.title, user_id).await?;
    Ok(Json(script))
}

/// Endpoint to create a new block for a script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Block creation payload.
///
/// # Returns
/// * `Result<Json<Uuid>, AppError>` - The new block's ID as JSON on success, or an AppError on failure.
pub async fn create_block_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(script_id): Path<Uuid>, Json(payload): Json<CreateBlockPayload>) -> Result<Json<Uuid>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before allowing block creation
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let id = create_block(pool.as_ref(), script_id, &payload.block_type, &payload.content, None).await?;
    Ok(Json(id))
}

/// Endpoint to fetch a script and its blocks.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
///
/// # Returns
/// * `Result<Json<ScriptWithBlocks>, AppError>` - The script and its blocks as JSON on success, or an AppError on failure.
pub async fn get_script_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(script_id): Path<Uuid>) -> Result<Json<ScriptWithBlocks>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let (script, blocks) = get_script_with_blocks(pool.as_ref(), script_id).await?;
    Ok(Json(ScriptWithBlocks { script, blocks }))
}

/// Endpoint to update a block's content.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(block_id)` - The block ID.
/// * `Json(payload)` - Update payload.
///
/// # Returns
/// * `Result<impl IntoResponse, AppError>` - No content on success, or an AppError on failure.
pub async fn update_block_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{user_id}: AuthUser, Path(block_id): Path<Uuid>, Json(payload): Json<UpdateBlockPayload>) -> Result<impl IntoResponse, AppError> {
    update_block(pool.as_ref(), block_id, &payload.content, user_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Endpoint to fetch the edit history for a block.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(block_id)` - The block ID.
///
/// # Returns
/// * `Result<Json<Vec<Edit>>, AppError>` - List of edits as JSON on success, or an AppError on failure.
pub async fn block_history_endpoint(State(pool): State<Arc<PgPool>>, AuthUser{..}: AuthUser, Path(block_id): Path<Uuid>) -> Result<Json<Vec<Edit>>, AppError> {
    let edits = get_block_history(pool.as_ref(), block_id).await?;
    Ok(Json(edits))
}

/// Endpoint to update a script's title.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Script update payload (only title is used).
///
/// # Returns
/// * `Result<Json<Script>, AppError>` - The updated script as JSON on success, or an AppError on failure.
pub async fn update_script_title_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser, // 🔒 SECURITY: Use user_id for authorization check
    Path(script_id): Path<Uuid>,
    Json(payload): Json<CreateScriptPayload>, // Assuming CreateScriptPayload contains { title: String }
) -> Result<Json<Script>, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing update
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only update scripts you own".to_string()));
    }
    
    let script = sqlx::query_as!(
        Script,
        r#"UPDATE scripts SET title = $1 WHERE id = $2 
        RETURNING id, title, created_by, created_at, COALESCE(is_public, false) as "is_public!", thumbnail"#,
        payload.title,
        script_id
    )
    .fetch_one(pool.as_ref())
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Script not found".to_string()),
        _ => AppError::Db(e), // Convert other sqlx errors to AppError::Db
    })?;
    Ok(Json(script))
}

/// Endpoint to update a script's content from the TipTap editor.
///
/// This endpoint receives HTML content from the TipTap editor and converts it
/// into structured blocks in the database, providing persistence for collaborative edits.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user.
/// * `Path(script_id)` - The script ID.
/// * `Json(payload)` - Content update payload containing HTML.
///
/// # Returns
/// * `Result<impl IntoResponse, AppError>` - HTTP 204 No Content on success, or an AppError on failure.
pub async fn update_script_content_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(payload): Json<UpdateScriptContentPayload>,
) -> Result<impl IntoResponse, AppError> {
    tracing::info!("💾 Received content update for script {}: {} characters", script_id, payload.content.len());
    
    // Convert HTML to blocks and update the database
    update_script_content_from_html(pool.as_ref(), script_id, &payload.content, user_id).await?;
    
    tracing::info!("✅ Successfully updated script content for script {}", script_id);
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Endpoint to delete a script.
///
/// # Arguments
/// * `State(pool)` - Shared PostgreSQL connection pool.
/// * `AuthUser` - The authenticated user (ensures the endpoint is protected).
/// * `Path(script_id)` - The ID of the script to delete.
///
/// # Returns
/// * `Result<StatusCode, AppError>` - HTTP 204 No Content on success, or an AppError on failure.
pub async fn delete_script_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser, // 🔒 SECURITY: Use user_id for authorization check
    Path(script_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing deletion
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only delete scripts you own".to_string()));
    }
    
    // Call the delete_script function from lib.rs (or wherever it's appropriately defined without user checks)
    // Assuming `backend::delete_script` is the function from `lib.rs`.
    // The `use backend::{... delete_script ...}` statement would be needed if not already present.
    // For now, let's assume `delete_script` is brought into scope correctly.
    crate::delete_script(pool.as_ref(), script_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// === Script Layout Endpoints ===

/// Gets all layouts for a script.
pub async fn get_script_layouts_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Vec<ScriptLayout>>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before returning layouts
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let layouts = get_script_layouts(pool.as_ref(), script_id).await?;
    Ok(Json(layouts))
}

/// Gets the default layout for a script.
pub async fn get_default_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>
) -> Result<Json<Option<ScriptLayout>>, AppError> {
    // 🔒 SECURITY: Check if user has access to this script before returning default layout
    if !check_script_access(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("Access denied to this script".to_string()));
    }
    
    let layout = get_default_script_layout(pool.as_ref(), script_id).await?;
    Ok(Json(layout))
}

/// Creates a new layout for a script.
pub async fn create_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(request): Json<CreateScriptLayoutRequest>
) -> Result<Json<ScriptLayout>, AppError> {
    let layout = create_script_layout(pool.as_ref(), script_id, &request, user_id).await?;
    Ok(Json(layout))
}

/// Updates an existing script layout.
pub async fn update_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path((_script_id, layout_id)): Path<(Uuid, Uuid)>,
    Json(request): Json<UpdateScriptLayoutRequest>
) -> Result<Json<ScriptLayout>, AppError> {
    let layout = update_script_layout(pool.as_ref(), layout_id, &request, user_id).await?;
    Ok(Json(layout))
}

/// Deletes a script layout.
pub async fn delete_script_layout_endpoint(
    State(pool): State<Arc<PgPool>>,
    AuthUser{user_id}: AuthUser,
    Path((script_id, layout_id)): Path<(Uuid, Uuid)>
) -> Result<axum::http::StatusCode, AppError> {
    // 🔒 SECURITY: Check if user owns this script before allowing layout deletion
    if !check_script_ownership(pool.as_ref(), script_id, user_id).await? {
        return Err(AppError::Forbidden("You can only delete layouts for scripts you own".to_string()));
    }
    
    delete_script_layout(pool.as_ref(), layout_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
} 