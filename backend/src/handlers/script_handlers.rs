//! Handlers for script-related API endpoints.

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post, patch, delete},
    Router,
    middleware,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{error, info, warn};
use reqwest::Client;
use sqlx::PgPool;
use std::io::{Cursor, Read};
use std::sync::Arc;

use crate::analysis::structs::Script as ParsedScript;
use crate::analysis::parser::{extract_text_with_pages_from_docx, text_with_pages_to_string_with_page_markers};
use crate::auth::{AuthUser, RateLimiter, rate_limit_middleware};
use crate::error::AppError; // Import AppError
use crate::gemini_api::{call_gemini_for_parsing, GeminiApiError};
use crate::create_script_from_parsed; // Import the function from lib.rs
use crate::models::script_share::{ShareScriptRequest, ScriptShare};
use crate::models::user::User;
use crate::thumbnail::{update_script_thumbnail, generate_missing_thumbnails, regenerate_all_thumbnails};
use uuid::Uuid; // Import Uuid

/// Creates a router for script-related endpoints with rate limiting protection.
///
/// Sets up the routes for script upload and processing with appropriate security middleware.
/// File upload endpoints get additional rate limiting to prevent abuse.
///
/// # Arguments
/// * `rate_limiter` - Rate limiter instance for protecting endpoints
///
/// # Returns
/// * `Router<PgPool>` - Configured router with script routes and security middleware
pub fn script_routes(rate_limiter: Arc<RateLimiter>) -> Router<PgPool> {
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

/// Handles script file upload and parsing via Gemini API with enhanced text extraction.
///
/// Processes a multipart form to extract a DOCX file, extracts text with page information,
/// and sends it to Gemini for parsing with proper JSON schema for accurate page numbers.
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
        .timeout(std::time::Duration::from_secs(60)) // 60 second timeout
        .build()
        .map_err(|e| {
            // 🔒 SECURITY: Log detailed error server-side but return generic message
            error!("Failed to create HTTP client: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Service temporarily unavailable")
        })?;

    // Extract the file from the multipart form
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        // 🔒 SECURITY: Log detailed error server-side but return generic message
        error!("Failed to read multipart field: {}", e);
        (StatusCode::BAD_REQUEST, "Invalid upload format")
    })? {
        if field.name() == Some("file") {
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field.content_type().unwrap_or("").to_string();
            info!("Processing uploaded file: {}", filename);

            // Read the file data
            let data = field.bytes().await.map_err(|e| {
                // 🔒 SECURITY: Log detailed error server-side but return generic message
                error!("Failed to read file data: {}", e);
                (StatusCode::BAD_REQUEST, "Unable to process uploaded file")
            })?;

            // 🔒 SECURITY: Comprehensive file validation
            
            // 1. File size validation (10MB limit)
            const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
            if data.len() > MAX_FILE_SIZE {
                warn!("File too large: {} bytes (max: {} bytes)", data.len(), MAX_FILE_SIZE);
                return Err((StatusCode::BAD_REQUEST, "File size exceeds 10MB limit"));
            }
            
            // 2. Minimum file size validation (empty file check)
            if data.len() < 100 {
                warn!("File too small: {} bytes", data.len());
                return Err((StatusCode::BAD_REQUEST, "File appears to be empty or corrupted"));
            }

            // 3. Filename extension validation
            if !filename.to_lowercase().ends_with(".docx") {
                warn!("Unsupported file type: {}", filename);
                return Err((StatusCode::BAD_REQUEST, "Only DOCX files are supported"));
            }

            // 4. Enhanced DOCX file signature and structure validation
            if data.len() < 4 || &data[0..2] != b"PK" {
                warn!("Invalid DOCX file: missing ZIP signature");
                return Err((StatusCode::BAD_REQUEST, "Invalid DOCX file format"));
            }

            // 5. Content-based MIME type validation (more robust than header checking)
            // DOCX files are ZIP archives with specific internal structure
            if !validate_docx_structure(&data) {
                warn!("Invalid DOCX structure detected for file: {}", filename);
                return Err((StatusCode::BAD_REQUEST, "Invalid DOCX file format - corrupted or not a valid DOCX file"));
            }

            // 6. Enhanced MIME type validation (allow from content-type header but verify)
            if !content_type.is_empty() { 
                let allowed_mime_types = [
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/zip", // DOCX files appear as ZIP
                    "application/octet-stream" // Some browsers send this for DOCX
                ];
                
                let is_valid_mime = allowed_mime_types.iter().any(|&mime| content_type.contains(mime));
                if !is_valid_mime {
                    warn!("Invalid MIME type: {} for file: {}", content_type, filename);
                    return Err((StatusCode::BAD_REQUEST, "Invalid file type. Expected DOCX format."));
                }
            }

            // 7. Additional security: File content analysis before processing
            // Check for suspicious content patterns that could indicate malicious files
            if contains_suspicious_patterns(&data) {
                warn!("Suspicious content patterns detected in file: {}", filename);
                return Err((StatusCode::BAD_REQUEST, "File content validation failed"));
            }

            // Extract text with page information from DOCX
            let text_with_pages = extract_text_with_pages_from_docx(&data)
                .map_err(|e| {
                    // 🔒 SECURITY: Log detailed error server-side but return generic message
                    error!("Failed to extract text from DOCX: {}", e);
                    (StatusCode::BAD_REQUEST, "Invalid or corrupted DOCX file")
                })?;

            info!("Extracted {} text elements with page information", text_with_pages.len());

            // Convert to string with page markers for better Gemini processing
            let enhanced_text = text_with_pages_to_string_with_page_markers(&text_with_pages);

            // Call Gemini API for parsing with enhanced JSON schema
            let parsed_script = call_gemini_for_parsing(&enhanced_text, &http_client)
                .await
                .map_err(|e| {
                    // 🔒 SECURITY: Log detailed error server-side but return generic message
                    error!("Gemini API call failed: {}", e);
                    // Never expose internal system architecture details to users
                    (StatusCode::INTERNAL_SERVER_ERROR, "Script parsing failed. Please try again.")
                })?;

            info!("Successfully parsed script with {} sections", parsed_script.sections.len());
            return Ok(Json(parsed_script));
        }
    }

    // If we get here, no file was found in the multipart data
    warn!("No file found in multipart data");
    Err((StatusCode::BAD_REQUEST, "No file provided"))
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
    AuthUser{user_id}: AuthUser,
    Path(script_id): Path<Uuid>,
) -> Result<Json<String>, AppError> {
    info!("User {} generating thumbnail for script: {}", user_id, script_id);
    
    // 🔒 SECURITY: Check if user has access to this script before allowing thumbnail generation
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
        Some(_) => return Err(AppError::Forbidden("You don't have permission to generate thumbnails for this script".into())),
        None => return Err(AppError::NotFound("Script not found".into())),
    }
    
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
    info!("Regenerating all thumbnails for all scripts");
    
    let count = regenerate_all_thumbnails(&pool).await?;
    info!("Regenerated {} thumbnails", count);
    
    Ok(Json(count))
}

/// 🔒 SECURITY: Validates DOCX file structure by checking for required internal components
/// DOCX files are ZIP archives with specific internal files that must be present
fn validate_docx_structure(data: &[u8]) -> bool {
    use std::io::Cursor;
    
    // Try to read as ZIP archive
    let reader = Cursor::new(data);
    let zip_result = zip::ZipArchive::new(reader);
    
    match zip_result {
        Ok(mut archive) => {
            // Check for required DOCX components
            let required_files = [
                "[Content_Types].xml",
                "word/document.xml",
                "_rels/.rels"
            ];
            
            for required_file in &required_files {
                if archive.by_name(required_file).is_err() {
                    warn!("Missing required DOCX component: {}", required_file);
                    return false;
                }
            }
            
            // Additional check: ensure word/document.xml contains Word document structure
            if let Ok(mut document_file) = archive.by_name("word/document.xml") {
                let mut content = String::new();
                if document_file.read_to_string(&mut content).is_ok() {
                    // Check for basic Word document XML structure
                    if !content.contains("<w:document") || !content.contains("http://schemas.openxmlformats.org/wordprocessingml/") {
                        warn!("word/document.xml does not contain valid Word document structure");
                        return false;
                    }
                } else {
                    warn!("Could not read word/document.xml content");
                    return false;
                }
            }
            
            true
        },
        Err(e) => {
            warn!("ZIP archive parsing failed");
            false
        }
    }
}

/// 🔒 SECURITY: Scans file content for suspicious patterns that could indicate malicious files
/// This helps detect files that might contain embedded scripts, executables, or other threats
fn contains_suspicious_patterns(data: &[u8]) -> bool {
    // Convert to string for pattern matching (only check first part to avoid performance issues)
    let sample_size = std::cmp::min(data.len(), 8192); // Check first 8KB
    let content_sample = String::from_utf8_lossy(&data[..sample_size]).to_lowercase();
    
    // Suspicious patterns that could indicate malicious content
    let suspicious_patterns = [
        // Script execution patterns
        "<script",
        "javascript:",
        "vbscript:",
        "eval(",
        "document.write",
        
        // Executable patterns
        "mz", // DOS/Windows executable header
        "#!/", // Unix shebang
        
        // Macro/embedded code patterns
        "auto_open",
        "document_open", 
        "workbook_open",
        "shell.application",
        "wscript.shell",
        
        // URL/network patterns (suspicious in document context)
        "http://",
        "https://",
        "ftp://",
        
        // Encoding patterns that could hide malicious content
        "base64,",
        "data:application",
        "<!--[if",
        
        // ActiveX/OLE patterns
        "activex",
        "clsid:",
        "progid:",
    ];
    
    for pattern in &suspicious_patterns {
        if content_sample.contains(pattern) {
            warn!("Detected suspicious pattern in file content: {}", pattern);
            return true;
        }
    }
    
    // Check for excessive binary content (could indicate embedded executables)
    let binary_threshold = sample_size / 10; // Allow up to 10% binary content
    let binary_bytes = data[..sample_size].iter()
        .filter(|&&b| b < 32 && b != b'\n' && b != b'\r' && b != b'\t')
        .count();
    
    if binary_bytes > binary_threshold {
        warn!("Excessive binary content detected: {} binary bytes in {} sample", binary_bytes, sample_size);
        return true;
    }
    
    false
}