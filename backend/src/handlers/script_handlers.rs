//! Handlers for script-related API endpoints.
//!
//! Clean HTTP controllers that delegate business logic to application services.
//! Each handler focuses solely on HTTP concerns: request/response mapping, status codes, and error handling.

use axum::{
    extract::{Multipart, Path, State},
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

use crate::analysis::structs::Script as ParsedScript;
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
        // 🔒 SECURITY: Apply stricter rate limiting to file upload endpoint
        .route("/upload", post(upload_and_parse_script)
            .layer(middleware::from_fn_with_state(rate_limiter.clone(), rate_limit_middleware)))
        .route("/create_script_from_parsed", post(create_script_from_parsed_handler))
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

/// Request payload for creating a script from parsed data.
#[derive(serde::Deserialize, Debug)]
pub struct CreateScriptFromParsedPayload {
    parsed_script: ParsedScript,
}

/// Handles creating a script entry and associated blocks from parsed data.
///
/// Delegates to ScriptApplicationService for business logic.
#[axum::debug_handler]
async fn create_script_from_parsed_handler(
    State(services): State<ScriptServices>,
    AuthUser{user_id}: AuthUser,
    Json(payload): Json<CreateScriptFromParsedPayload>,
) -> Result<Json<Uuid>, AppError> {
    info!(user_id = %user_id, "Creating script from parsed data");

    let script_id = services.script_service
        .create_script_from_parsed(&payload.parsed_script, user_id)
        .await?;

    info!(script_id = %script_id, user_id = %user_id, "Successfully created script");
    Ok(Json(script_id))
}

/// Handles script file upload and parsing via Gemini API.
///
/// Processes multipart form data and delegates to ScriptApplicationService.
#[axum::debug_handler]
async fn upload_and_parse_script(
    State(services): State<ScriptServices>,
    mut multipart: Multipart,
) -> Result<Json<ParsedScript>, impl IntoResponse> {
    // Extract file from multipart form
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        error!("Failed to read multipart field: {}", e);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid upload format"})))
    })? {
        if field.name() == Some("file") {
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field.content_type().unwrap_or("").to_string();
            
            info!("Processing uploaded file: {}", filename);

            // Read file data
            let data = field.bytes().await.map_err(|e| {
                error!("Failed to read file data: {}", e);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Unable to process uploaded file"})))
            })?;

            // Delegate to application service
            let parsed_script = services.script_service
                .upload_and_parse_script(data.to_vec(), &filename, &content_type)
                .await
                .map_err(|e| {
                    error!("Script upload failed: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Script parsing failed"})))
                })?;

            info!("Successfully parsed script with {} sections", parsed_script.sections.len());
            return Ok(Json(parsed_script));
        }
    }

    // No file found in multipart data
    warn!("No file found in multipart data");
    Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No file provided"}))))
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