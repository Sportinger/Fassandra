//! Handlers for script-related API endpoints.

use axum::{
    extract::{Multipart, State, Path},
    http::StatusCode, 
    response::{IntoResponse, Json},
    routing::{post, patch, get, delete},
    Router, // Import Bytes
};
use serde_json::json;
use tracing::{error, info}; // Add warn
use reqwest::Client; // For making the Gemini API call
use sqlx::PgPool; // Import PgPool

use crate::analysis::parser::extract_text_from_docx;
use crate::gemini_api::{call_gemini_for_parsing, GeminiApiError}; 
use crate::analysis::structs::Script as ParsedScript;
use crate::auth::AuthUser;
use crate::error::AppError; // Import AppError
use crate::create_script_from_parsed; // Import the function from lib.rs
use crate::models::script_share::{ShareScriptRequest, ScriptShare};
use crate::models::user::User;
use crate::thumbnail::{update_script_thumbnail, generate_missing_thumbnails, regenerate_all_thumbnails};
use uuid::Uuid; // Import Uuid

/// Creates a router for script-related endpoints.
///
/// Sets up the routes for script upload and processing.
/// Needs PgPool state to be compatible with the main router.
///
/// # Returns
/// * `Router<PgPool>` - Configured router with script routes and middleware
pub fn script_routes(_pool: PgPool) -> Router<PgPool> {
    Router::new()
        .route("/upload", post(upload_and_parse_script))
        .route("/create_script_from_parsed", post(create_script_from_parsed_handler))
        .route("/:script_id/share", post(share_script))
        .route("/:script_id/shares", get(get_script_shares))
        .route("/:script_id/shares/:share_id", delete(remove_script_share))
        .route("/:script_id/public", patch(toggle_script_public))
        .route("/:script_id/thumbnail", post(generate_thumbnail))
        .route("/thumbnails/generate", post(generate_all_thumbnails))
        .route("/thumbnails/regenerate", post(regenerate_all_thumbnails_endpoint))
        // Add other script routes here (GET /api/scripts, POST /api/scripts/:id/...) later
        // .layer(DefaultBodyLimit::max(MAX_UPLOAD_SIZE)) // Temporarily remove body limit
}

/// Request payload for creating a script from parsed data.
#[derive(serde::Deserialize, Debug)] // Add Debug derive
pub struct CreateScriptFromParsedPayload {
    parsed_script: ParsedScript, // Expect the full ParsedScript structure
}

/// Handles creating a script entry and associated blocks from parsed data.
///
/// # Arguments
/// * `State(pool)` - Database connection pool.
/// * `AuthUser{user_id}` - The authenticated user.
/// * `Json(payload)` - The parsed JSON payload.
///
/// # Returns
/// * `Result<Json<Uuid>, AppError>` - The ID of the newly created script or an error.
// Restore original function signature and logic
// #[instrument(skip(payload))] // Optional: add instrument back if desired
// #[axum::debug_handler] // Optional: add debug_handler back if desired
#[axum::debug_handler] // Added debug_handler
async fn create_script_from_parsed_handler(
    State(pool): State<PgPool>,
    AuthUser{user_id}: AuthUser, // Restore AuthUser extractor
    Json(payload): Json<CreateScriptFromParsedPayload>, // Use Json extractor
) -> Result<Json<Uuid>, AppError> {
    info!(user_id = %user_id, "Attempting to create script from parsed data.");

    // Use the real user_id and payload from extractors
    let new_script_id = create_script_from_parsed(&pool, &payload.parsed_script, user_id).await?;

    info!(%new_script_id, user_id = %user_id, "Successfully created script with ID.");
    Ok(Json(new_script_id))
}

/// Handles script file upload, text extraction, and parsing via Gemini API.
///
/// Processes a multipart form to extract a DOCX file, converts it to text,
/// and then sends the text to the Gemini API for structural parsing.
///
/// # Arguments
/// * `multipart` - Multipart form data containing the script file
///
/// # Returns
/// * `Result<Json<ParsedScript>, impl IntoResponse>` - Parsed script or error response
#[axum::debug_handler]
async fn upload_and_parse_script(
    mut multipart: Multipart,
) -> Result<Json<ParsedScript>, impl IntoResponse> {
    // Create HTTP client with timeout to prevent hanging uploads
    let http_client = Client::builder()
        .timeout(std::time::Duration::from_secs(60)) // 60 second timeout for Gemini API
        .build()
        .map_err(|err| {
            error!("Failed to create HTTP client: {}", err);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Internal server error"})))
        })?;
    let mut extracted_text: Option<String> = None;
    let mut original_filename: Option<String> = None;

    // Process the multipart form data
    while let Some(field) = multipart.next_field().await.map_err(|err| {
        error!("Error reading multipart field: {}", err);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read upload data"})))
    })? {
        let name = field.name().unwrap_or("").to_string();
        let filename = field.file_name().map(String::from);
        
        if name == "scriptFile" { // Expecting the file under the name "scriptFile"
            original_filename = filename.clone(); // Store filename for context
            info!("Processing uploaded file: {:?}", original_filename.as_deref().unwrap_or("unknown"));
            
            let bytes = field.bytes().await.map_err(|err| {
                error!("Failed to read file bytes: {}", err);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read file content"})))
            })?;

            info!("Read {} bytes from upload.", bytes.len());

            // 1. Extract text from DOCX
            let text = extract_text_from_docx(&bytes).map_err(|err| {
                error!("DOCX text extraction failed: {}", err);
                (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": format!("Failed to extract text from DOCX: {}", err)})))
            })?;
            
            // --- FOR TESTING: Use only the first 1/10 of the text ---
            let text_len = text.len();
            let end_index = text_len / 10;
            let partial_text = match text.get(..end_index) {
                Some(slice) => slice.to_string(),
                None => text.clone(), // Should not happen if text is not empty
            };
            info!("Using partial text for Gemini ({} bytes)", partial_text.len());
            // extracted_text = Some(text); // Use full text if not testing
            extracted_text = Some(partial_text);
            // --- END TESTING SECTION ---

            // Stop processing fields once we have the scriptFile
            break; 
        }
    }

    // Ensure we got the text
    let script_text = match extracted_text {
        Some(text) => text,
        None => {
            error!("Multipart request did not contain 'scriptFile' field or text extraction failed.");
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Missing 'scriptFile' in upload"}))));
        }
    };

    // 2. Call Gemini API for parsing
    info!("Calling Gemini API for parsing...");
    let parsed_script_result = call_gemini_for_parsing(&http_client, &script_text).await;

    match parsed_script_result {
        Ok(mut script) => {
            info!("Successfully parsed script using Gemini.");
            // Add original filename to the parsed script object if available
            script.source_filename = original_filename; 
            Ok(Json(script))
        }
        Err(e) => {
            error!("Gemini API call failed: {}", e);
            // Map GeminiApiError to appropriate HTTP status codes
            let status_code = match e {
                GeminiApiError::MissingEnvVar(_) => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiApiError::Reqwest(_) => StatusCode::BAD_GATEWAY, // Error communicating with Gemini
                GeminiApiError::ApiError { status, .. } => status, // Use status code from Gemini if available
                GeminiApiError::Deserialization(_) => StatusCode::INTERNAL_SERVER_ERROR, // Gemini returned unexpected format
                GeminiApiError::NoCandidate => StatusCode::INTERNAL_SERVER_ERROR, // Gemini didn't provide a response part
                GeminiApiError::StructureParsing(_) => StatusCode::INTERNAL_SERVER_ERROR, // Failed to parse Gemini's valid JSON
            };
             Err((status_code, Json(json!({"error": format!("Script parsing failed: {}", e)}))))
        }
    }
}

/// Shares a script with another user.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `AuthUser{user_id}` - The authenticated user (script owner)
/// * `Path(script_id)` - The script to share
/// * `Json(request)` - Share request containing username and permission
///
/// # Returns
/// * `Result<Json<ScriptShare>, AppError>` - The created share entry or error
pub async fn share_script(
    State(pool): State<PgPool>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
    Json(request): Json<ShareScriptRequest>,
) -> Result<Json<ScriptShare>, AppError> {
    // Verify the user owns the script
    let owner_check = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(&pool)
    .await?;

    match owner_check {
        Some(record) if record.created_by == Some(user_id) => {
            // User owns the script, proceed
        }
        Some(_) => return Err(AppError::Forbidden("You don't have permission to share this script".into())),
        None => return Err(AppError::NotFound("Script not found".into())),
    }

    // Find the user to share with
    let target_user = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE username = $1",
        request.username
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Create the share entry
    let share = sqlx::query_as!(
        ScriptShare,
        r#"
        INSERT INTO script_shares (script_id, shared_with_user_id, permission, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (script_id, shared_with_user_id) 
        DO UPDATE SET permission = $3
        RETURNING *
        "#,
        script_id,
        target_user.id,
        request.permission.as_str(),
        user_id
    )
    .fetch_one(&pool)
    .await?;

    info!("User {} shared script {} with user {}", user_id, script_id, target_user.id);
    Ok(Json(share))
}

/// Gets all shares for a script.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `AuthUser{user_id}` - The authenticated user
/// * `Path(script_id)` - The script ID
///
/// # Returns
/// * `Result<Json<Vec<ScriptShare>>, AppError>` - List of shares or error
pub async fn get_script_shares(
    State(pool): State<PgPool>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<Vec<(ScriptShare, String)>>, AppError> {
    // Verify the user owns the script
    let owner_check = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(&pool)
    .await?;

    match owner_check {
        Some(record) if record.created_by == Some(user_id) => {
            // User owns the script, proceed
        }
        Some(_) => return Err(AppError::Forbidden("You don't have permission to view shares for this script".into())),
        None => return Err(AppError::NotFound("Script not found".into())),
    }

    // Get all shares with user information
    let shares = sqlx::query!(
        r#"
        SELECT ss.*, u.username
        FROM script_shares ss
        JOIN users u ON ss.shared_with_user_id = u.id
        WHERE ss.script_id = $1
        ORDER BY ss.created_at DESC
        "#,
        script_id
    )
    .fetch_all(&pool)
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

    Ok(Json(shares))
}

/// Removes a script share.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `AuthUser{user_id}` - The authenticated user
/// * `Path((script_id, share_id))` - The script and share IDs
///
/// # Returns
/// * `Result<StatusCode, AppError>` - Success status or error
pub async fn remove_script_share(
    State(pool): State<PgPool>,
    AuthUser { user_id }: AuthUser,
    Path((script_id, share_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    // Verify the user owns the script
    let owner_check = sqlx::query!(
        "SELECT created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(&pool)
    .await?;

    match owner_check {
        Some(record) if record.created_by == Some(user_id) => {
            // User owns the script, proceed
        }
        Some(_) => return Err(AppError::Forbidden("You don't have permission to remove shares for this script".into())),
        None => return Err(AppError::NotFound("Script not found".into())),
    }

    // Delete the share
    let result = sqlx::query!(
        "DELETE FROM script_shares WHERE id = $1 AND script_id = $2",
        share_id,
        script_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Share not found".into()));
    }

    info!("User {} removed share {} from script {}", user_id, share_id, script_id);
    Ok(StatusCode::NO_CONTENT)
}

/// Toggles a script's public status.
///
/// # Arguments
/// * `State(pool)` - Database connection pool
/// * `AuthUser{user_id}` - The authenticated user
/// * `Path(script_id)` - The script ID
///
/// # Returns
/// * `Result<Json<bool>, AppError>` - The new public status or error
pub async fn toggle_script_public(
    State(pool): State<PgPool>,
    AuthUser { user_id }: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<bool>, AppError> {
    // Update the script's public status, ensuring the user owns it
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
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Script not found or you don't have permission".into()))?;

    info!("User {} toggled script {} public status to {}", user_id, script_id, result.is_public.unwrap_or(false));
    Ok(Json(result.is_public.unwrap_or(false)))
}

/// Generates a thumbnail for a specific script.
///
/// # Arguments
/// * `State(pool)` - Database connection pool.
/// * `AuthUser{user_id}` - The authenticated user.
/// * `Path(script_id)` - The script ID to generate thumbnail for.
///
/// # Returns
/// * `Result<Json<String>, AppError>` - The base64-encoded thumbnail or an error.
async fn generate_thumbnail(
    State(pool): State<PgPool>,
    AuthUser{user_id: _}: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<String>, AppError> {
    info!("Generating thumbnail for script: {}", script_id);
    
    let thumbnail = update_script_thumbnail(&pool, script_id).await?;
    
    Ok(Json(thumbnail))
}

/// Generates thumbnails for all scripts that don't have one.
///
/// # Arguments
/// * `State(pool)` - Database connection pool.
/// * `AuthUser{user_id}` - The authenticated user.
///
/// # Returns
/// * `Result<Json<usize>, AppError>` - The number of thumbnails generated or an error.
async fn generate_all_thumbnails(
    State(pool): State<PgPool>,
    AuthUser{user_id: _}: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!("Generating thumbnails for all scripts without thumbnails");
    
    let count = generate_missing_thumbnails(&pool).await?;
    
    Ok(Json(count))
}

/// Regenerates thumbnails for ALL scripts (forces refresh).
///
/// # Arguments
/// * `State(pool)` - Database connection pool.
/// * `AuthUser{user_id}` - The authenticated user.
///
/// # Returns
/// * `Result<Json<usize>, AppError>` - The number of thumbnails regenerated or an error.
async fn regenerate_all_thumbnails_endpoint(
    State(pool): State<PgPool>,
    AuthUser{user_id: _}: AuthUser,
) -> Result<Json<usize>, AppError> {
    info!("Regenerating thumbnails for ALL scripts");
    
    let count = regenerate_all_thumbnails(&pool).await?;
    
    Ok(Json(count))
} 