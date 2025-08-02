//! Handlers for script-related API endpoints.
//!
//! Clean HTTP controllers that delegate business logic to application services.
//! Each handler focuses solely on HTTP concerns: request/response mapping, status codes, and error handling.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post, patch, delete},
    Router,
    middleware,
};
use serde_json::json;
use tracing::{error, info, warn};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::{AuthUser, RateLimiter, rate_limit_middleware};
use crate::error::AppError;
use crate::models::script_share::{ShareScriptRequest, ScriptShare};
use crate::application::{
    ScriptApplicationService,
    ScriptSharingApplicationService,
    ThumbnailApplicationService,
};

/// Application services container for script operations
#[derive(Clone)]
pub struct ScriptServices {
    pub script_service: Arc<ScriptApplicationService>,
    pub sharing_service: Arc<ScriptSharingApplicationService>,
    pub thumbnail_service: Arc<ThumbnailApplicationService>,
}

/// Creates a router for script-related endpoints with rate limiting protection.
///
/// Sets up the routes for script upload and processing with appropriate security middleware.
/// File upload endpoints get additional rate limiting to prevent abuse.
///
/// # Arguments
/// * `rate_limiter` - Rate limiter instance for protecting endpoints
///
/// # Returns
/// * `Router<ScriptServices>` - Configured router with script routes and security middleware
pub fn script_routes(rate_limiter: Arc<RateLimiter>) -> Router<ScriptServices> {
    Router::new()
        // Script parsing endpoints removed - use script-parser CLI tool instead
        .route("/:script_id/share", post(share_script))
        .route("/:script_id/shares", get(get_script_shares))
        .route("/:script_id/shares/:share_id", delete(remove_script_share))
        .route("/:script_id/public", patch(toggle_script_public))
        // 🔒 SECURITY: Apply rate limiting to resource-intensive thumbnail operations
        .route("/:script_id/thumbnail", post(generate_thumbnail)
            .layer(middleware::from_fn_with_state(rate_limiter.clone(), rate_limit_middleware)))
        .route("/thumbnails/generate", post(generate_all_thumbnails)
            .layer(middleware::from_fn_with_state(rate_limiter.clone(), rate_limit_middleware)))
        .route("/thumbnails/regenerate", post(regenerate_all_thumbnails_endpoint)
            .layer(middleware::from_fn_with_state(rate_limiter, rate_limit_middleware)))
}

/// Shares a script with another user.
///
/// Delegates to ScriptSharingApplicationService for business logic.
pub async fn share_script(
    State(services): State<ScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(request): Json<ShareScriptRequest>,
) -> Result<Json<ScriptShare>, AppError> {
    info!(user_id = %user_id, script_id = %script_id, "Sharing script");

    let share = services.sharing_service
        .share_script(script_id, user_id, request)
        .await?;

    info!(user_id = %user_id, script_id = %script_id, "Successfully shared script");
    Ok(Json(share))
}

/// Gets all shares for a script.
///
/// Delegates to ScriptSharingApplicationService for business logic.
pub async fn get_script_shares(
    State(services): State<ScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<Vec<(ScriptShare, String)>>, AppError> {
    info!(user_id = %user_id, script_id = %script_id, "Getting script shares");

    let shares = services.sharing_service
        .get_script_shares(script_id, user_id)
        .await?;

    info!(user_id = %user_id, script_id = %script_id, share_count = shares.len(), "Retrieved script shares");
    Ok(Json(shares))
}

/// Removes a script share.
///
/// Delegates to ScriptSharingApplicationService for business logic.
pub async fn remove_script_share(
    State(services): State<ScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path((script_id, share_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    info!(user_id = %user_id, script_id = %script_id, share_id = %share_id, "Removing script share");

    services.sharing_service
        .remove_script_share(script_id, share_id, user_id)
        .await?;

    info!(user_id = %user_id, script_id = %script_id, share_id = %share_id, "Successfully removed script share");
    Ok(StatusCode::NO_CONTENT)
}

/// Toggles a script's public status.
///
/// Delegates to ScriptSharingApplicationService for business logic.
pub async fn toggle_script_public(
    State(services): State<ScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<bool>, AppError> {
    info!(user_id = %user_id, script_id = %script_id, "Toggling script public status");

    let new_status = services.sharing_service
        .toggle_script_public(script_id, user_id)
        .await?;

    info!(user_id = %user_id, script_id = %script_id, public_status = new_status, "Successfully toggled script public status");
    Ok(Json(new_status))
}

/// Generates a thumbnail for a specific script.
///
/// Delegates to ThumbnailApplicationService for business logic.
async fn generate_thumbnail(
    State(services): State<ScriptServices>,
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<String>, AppError> {
    info!(user_id = %user_id, script_id = %script_id, "Generating thumbnail");

    let thumbnail = services.thumbnail_service
        .generate_thumbnail(script_id, user_id)
        .await?;

    info!(user_id = %user_id, script_id = %script_id, "Successfully generated thumbnail");
    Ok(Json(thumbnail))
}

/// Generates thumbnails for all scripts that don't have one.
///
/// Delegates to ThumbnailApplicationService for business logic.
async fn generate_all_thumbnails(
    State(services): State<ScriptServices>,
    AuthUser{user_id}: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!(user_id = %user_id, "Generating thumbnails for all scripts without thumbnails");

    let count = services.thumbnail_service
        .generate_missing_thumbnails(user_id)
        .await?;

    info!(user_id = %user_id, count = count, "Successfully generated missing thumbnails");
    Ok(Json(count))
}

/// Regenerates thumbnails for ALL scripts (forces refresh).
///
/// Delegates to ThumbnailApplicationService for business logic.
async fn regenerate_all_thumbnails_endpoint(
    State(services): State<ScriptServices>,
    AuthUser{user_id}: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!(user_id = %user_id, "Regenerating all thumbnails");

    let count = services.thumbnail_service
        .regenerate_all_thumbnails(user_id)
        .await?;

    info!(user_id = %user_id, count = count, "Successfully regenerated all thumbnails");
    Ok(Json(count))
}