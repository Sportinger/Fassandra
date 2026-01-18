//! Handlers for script-related API endpoints.
//!
//! Clean HTTP controllers that delegate business logic to application services.
//! Each handler focuses solely on HTTP concerns: request/response mapping, status codes, and error handling.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{delete, get, patch, post},
    Router,
};
use std::sync::Arc;
use tracing::info;
use uuid::Uuid;

use crate::application::{
    ScriptApplicationService, ScriptSharingApplicationService, ThumbnailApplicationService,
};
use crate::auth::{rate_limit_middleware, AuthUser, RateLimiter};
use crate::error::AppError;
use crate::handlers::claude_session_handler::{
    cancel_session, get_session_logs, get_session_status,
};
use crate::handlers::claude_websocket::claude_session_ws;
use crate::handlers::script_upload_handler::{
    ai_format_script, parse_existing_script, upload_and_parse_script, upload_pdf_simple,
    ExtendedScriptServices,
};
use crate::models::script_share::{ScriptShare, ShareScriptRequest};
use crate::services::claude_session_service::ClaudeSessionService;

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
/// * `Router<ExtendedScriptServices>` - Configured router with script routes and security middleware
pub fn script_routes(rate_limiter: Arc<RateLimiter>) -> Router<ExtendedScriptServices> {
    Router::new()
        // Simple PDF upload - extracts text without Claude processing
        .route(
            "/upload-pdf-simple",
            post(upload_pdf_simple).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        // AI Format - parses plain text into structured script using Claude
        .route(
            "/:script_id/ai-format",
            post(ai_format_script).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        // PDF upload and parsing endpoints using Claude Code (kept for future use)
        .route(
            "/upload-pdf",
            post(upload_and_parse_script).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        .route(
            "/parse-pdf/*path",
            post(parse_existing_script).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        // Script sharing endpoints
        .route("/:script_id/share", post(share_script_ext))
        .route("/:script_id/shares", get(get_script_shares_ext))
        .route(
            "/:script_id/shares/:share_id",
            delete(remove_script_share_ext),
        )
        .route("/:script_id/public", patch(toggle_script_public_ext))
        // 🔒 SECURITY: Apply rate limiting to resource-intensive thumbnail operations
        .route(
            "/:script_id/thumbnail",
            post(generate_thumbnail_ext).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        .route(
            "/thumbnails/generate",
            post(generate_all_thumbnails_ext).layer(middleware::from_fn_with_state(
                rate_limiter.clone(),
                rate_limit_middleware,
            )),
        )
        .route(
            "/thumbnails/regenerate",
            post(regenerate_all_thumbnails_endpoint_ext).layer(middleware::from_fn_with_state(
                rate_limiter,
                rate_limit_middleware,
            )),
        )
}

/// Creates a router for Claude session monitoring endpoints
pub fn claude_session_routes() -> Router<Arc<ClaudeSessionService>> {
    Router::new()
        .route("/:session_id", get(get_session_status))
        .route("/:session_id/logs", get(get_session_logs))
        .route("/:session_id/cancel", post(cancel_session))
        .route("/:session_id/ws", get(claude_session_ws))
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

    let share = services
        .sharing_service
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

    let shares = services
        .sharing_service
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

    services
        .sharing_service
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

    let new_status = services
        .sharing_service
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
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<String>, AppError> {
    info!(user_id = %user_id, script_id = %script_id, "Generating thumbnail");

    let thumbnail = services
        .thumbnail_service
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
    AuthUser { user_id }: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!(user_id = %user_id, "Generating thumbnails for all scripts without thumbnails");

    let count = services
        .thumbnail_service
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
    AuthUser { user_id }: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!(user_id = %user_id, "Regenerating all thumbnails");

    let count = services
        .thumbnail_service
        .regenerate_all_thumbnails(user_id)
        .await?;

    info!(user_id = %user_id, count = count, "Successfully regenerated all thumbnails");
    Ok(Json(count))
}

// Extended versions that work with ExtendedScriptServices

pub async fn share_script_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(request): Json<ShareScriptRequest>,
) -> Result<Json<ScriptShare>, AppError> {
    share_script(
        State(services.script_services),
        AuthUser { user_id },
        Path(script_id),
        Json(request),
    )
    .await
}

pub async fn get_script_shares_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<Vec<(ScriptShare, String)>>, AppError> {
    get_script_shares(
        State(services.script_services),
        AuthUser { user_id },
        Path(script_id),
    )
    .await
}

pub async fn remove_script_share_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path((script_id, share_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    remove_script_share(
        State(services.script_services),
        AuthUser { user_id },
        Path((script_id, share_id)),
    )
    .await
}

pub async fn toggle_script_public_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<bool>, AppError> {
    toggle_script_public(
        State(services.script_services),
        AuthUser { user_id },
        Path(script_id),
    )
    .await
}

pub async fn generate_thumbnail_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<String>, AppError> {
    generate_thumbnail(
        State(services.script_services),
        AuthUser { user_id },
        Path(script_id),
    )
    .await
}

pub async fn generate_all_thumbnails_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<usize>, AppError> {
    generate_all_thumbnails(State(services.script_services), AuthUser { user_id }).await
}

pub async fn regenerate_all_thumbnails_endpoint_ext(
    State(services): State<ExtendedScriptServices>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<usize>, AppError> {
    regenerate_all_thumbnails_endpoint(State(services.script_services), AuthUser { user_id }).await
}
