use crate::auth::AuthUser;
use crate::error::AppError;
use crate::handlers::script::ScriptServices;
use crate::services::claude_session_service::{ClaudeSessionService, SessionUpdate};
use anyhow::anyhow;
use axum::{
    extract::{Multipart, Path as AxumPath, State},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use futures_util::stream::{self, TryStreamExt};
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::mpsc;
use uuid::Uuid;

// Yrs imports for simple PDF upload
use yrs::Map;
use yrs::updates::encoder::Encode;
use yrs::{Doc, GetString, Options, ReadTxn, Transact, WriteTxn, Xml, XmlElementPrelim, XmlFragment as _, XmlTextPrelim};

#[derive(serde::Serialize)]
pub struct UploadResponse {
    pub session_id: Uuid,
    pub message: String,
}

/// Response for simple PDF upload (no Claude processing)
#[derive(serde::Serialize)]
pub struct SimpleUploadResponse {
    pub script_id: Uuid,
    pub title: String,
    pub message: String,
}

#[derive(Clone)]
pub struct ExtendedScriptServices {
    pub script_services: ScriptServices,
    pub claude_session_service: Arc<ClaudeSessionService>,
}

pub async fn upload_and_parse_script(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<axum::Json<UploadResponse>, AppError> {
    // Create upload directory if it doesn't exist
    let upload_dir = PathBuf::from("uploads/scripts");
    fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to create upload directory: {}", e)))?;

    // Generate a unique filename
    let temp_id = Uuid::new_v4();
    let mut pdf_path = None;
    let mut original_filename = String::new();

    // Process multipart upload
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read multipart field: {}", e)))?
    {
        let _name = field.name().unwrap_or("").to_string();
        let file_name = field.file_name().unwrap_or("").to_string();

        if file_name.ends_with(".pdf") {
            original_filename = file_name.clone();
            let filepath = upload_dir.join(format!("{}_{}", temp_id, file_name));
            let filepath_str = filepath.to_string_lossy().to_string();

            // Create file
            let mut file = tokio::fs::File::create(&filepath)
                .await
                .map_err(|e| AppError::Internal(anyhow!("Failed to create file: {}", e)))?;

            // Stream the file data
            let mut field_stream = field.into_stream();
            while let Some(chunk) = field_stream
                .try_next()
                .await
                .map_err(|e| AppError::Internal(anyhow!("Failed to read chunk: {}", e)))?
            {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                    .await
                    .map_err(|e| AppError::Internal(anyhow!("Failed to write chunk: {}", e)))?;
            }

            pdf_path = Some(filepath_str);
            break;
        }
    }

    let pdf_path =
        pdf_path.ok_or_else(|| AppError::BadRequest("No PDF file found in upload".to_string()))?;

    // Get absolute path for the PDF
    let abs_pdf_path = std::fs::canonicalize(&pdf_path)
        .map_err(|e| AppError::Internal(anyhow!("Failed to get absolute path: {}", e)))?
        .to_string_lossy()
        .to_string();

    // Prepare chunk directory and split PDF into 5-page chunks
    let stem = std::path::Path::new(&original_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("script");
    let chunk_dir_host = upload_dir.join(format!("{}_{}_chunks", temp_id, stem));
    fs::create_dir_all(&chunk_dir_host)
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to create chunk directory: {}", e)))?;

    let chunk_dir_abs = std::fs::canonicalize(&chunk_dir_host)
        .map_err(|e| AppError::Internal(anyhow!("Failed to get absolute chunk dir: {}", e)))?
        .to_string_lossy()
        .to_string();

    // Convert host paths to container paths for splitting by replacing the host backend root with /app
    // This works regardless of the specific absolute path prefix on the host.
    let to_container_path = |host_path: &str| -> String {
        if let Some(idx) = host_path.find("/backend") {
            let suffix = &host_path[idx + "/backend".len()..];
            format!("/app{}", suffix)
        } else {
            // Fallback: if no '/backend' in path, return as-is (may still work if already container path)
            host_path.to_string()
        }
    };
    let container_pdf_path = to_container_path(&abs_pdf_path);
    let container_chunk_dir = to_container_path(&chunk_dir_abs);

    // Run splitter inside container context
    let split_status = tokio::process::Command::new("/app/split_pdf.sh")
        .arg(&container_pdf_path)
        .arg(&container_chunk_dir)
        .arg("5")
        .output()
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to start split script: {}", e)))?;

    if !split_status.status.success() {
        let stderr = String::from_utf8_lossy(&split_status.stderr).to_string();
        let stdout = String::from_utf8_lossy(&split_status.stdout).to_string();
        return Err(AppError::Internal(anyhow!(
            "PDF split failed. Status: {:?}\nSTDOUT:\n{}\nSTDERR:\n{}",
            split_status.status.code(),
            stdout,
            stderr
        )));
    }

    // Get database pool from services
    let pool = services.script_services.script_service.get_pool();

    // Get user email
    let user_email = sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
        .bind(auth_user.user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to fetch user email: {}", e)))?;

    // Create a channel for updates (we'll use this later for WebSocket)
    let (tx, _rx) = mpsc::channel::<SessionUpdate>(100);

    // Start Claude session
    // Start Claude session pointing to the chunk directory (host path; service will map to /app)
    let session_id = services.claude_session_service
        .start_session(
            chunk_dir_abs.clone(),
            user_email.clone(),
            move |_session_id, update| {
                let tx = tx.clone();
                tokio::spawn(async move {
                    let _ = tx.send(update).await;
                });
            }
        )
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("Another Claude Code session is already running") {
                AppError::TooManyRequests("Another parsing session is already running. Please wait for it to finish or cancel it.".to_string())
            } else {
                AppError::Internal(anyhow!("Failed to start Claude session: {}", msg))
            }
        })?;

    // Note: We're NOT deleting the PDF file anymore - Claude will process it
    // The cleanup can happen after processing is complete

    let response = UploadResponse {
        session_id,
        message: format!(
            "Claude Code session started. Processing '{}'",
            original_filename
        ),
    };

    tracing::info!(
        "Returning upload response: session_id={}, message={}",
        response.session_id,
        response.message
    );

    Ok(axum::Json(response))
}

pub async fn parse_existing_script(
    AxumPath(path): AxumPath<String>,
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    // Check if file exists
    let pdf_path = PathBuf::from(&path);
    if !pdf_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", path)));
    }

    // Get database pool from services
    let pool = services.script_services.script_service.get_pool();

    // Get user email
    let _user_email = sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = $1")
        .bind(auth_user.user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to fetch user email: {}", e)))?;

    // Get API key
    let _api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| AppError::Internal(anyhow!("ANTHROPIC_API_KEY not set")))?;

    // Create a channel for progress updates
    let (tx, rx) = tokio::sync::mpsc::channel::<String>(100);

    // Clone pool for the spawn task
    let _pool_clone = Arc::new(pool.clone());
    let _path_clone = path.clone();

    // Spawn task to handle parsing
    tokio::spawn(async move {
        // let parser = ClaudeCodeParserService::new(api_key, pool_clone);

        // let _ = parser.parse_pdf_with_streaming(&path_clone, &user_email, move |update| {
        //     let _ = tx.blocking_send(update);
        // }).await;

        // Temporary placeholder
        let _ = tx
            .send("PDF parsing service temporarily disabled".to_string())
            .await;
    });

    // Create SSE stream
    let sse_stream = stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Some(data) => {
                let event = Event::default().data(data);
                Some((Ok::<_, Infallible>(event), rx))
            }
            None => None,
        }
    });

    let sse = Sse::new(sse_stream).keep_alive(KeepAlive::default());

    Ok(sse)
}

/// Simple PDF upload handler - extracts text and creates script without Claude processing
///
/// This is a simplified import flow:
/// 1. Upload PDF
/// 2. Extract raw text using pdftotext
/// 3. Create script with plain text paragraphs
/// 4. Delete PDF
/// 5. Return script ID
pub async fn upload_pdf_simple(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<axum::Json<SimpleUploadResponse>, AppError> {
    // Create upload directory if it doesn't exist
    let upload_dir = PathBuf::from("uploads/scripts");
    fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to create upload directory: {}", e)))?;

    // Generate a unique filename
    let temp_id = Uuid::new_v4();
    let mut pdf_path: Option<PathBuf> = None;
    let mut original_filename = String::new();

    // Process multipart upload
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read multipart field: {}", e)))?
    {
        let file_name = field.file_name().unwrap_or("").to_string();

        if file_name.to_lowercase().ends_with(".pdf") {
            original_filename = file_name.clone();
            let filepath = upload_dir.join(format!("{}_{}", temp_id, file_name));

            // Create file
            let mut file = tokio::fs::File::create(&filepath)
                .await
                .map_err(|e| AppError::Internal(anyhow!("Failed to create file: {}", e)))?;

            // Stream the file data
            let mut field_stream = field.into_stream();
            while let Some(chunk) = field_stream
                .try_next()
                .await
                .map_err(|e| AppError::Internal(anyhow!("Failed to read chunk: {}", e)))?
            {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                    .await
                    .map_err(|e| AppError::Internal(anyhow!("Failed to write chunk: {}", e)))?;
            }

            pdf_path = Some(filepath);
            break;
        }
    }

    let pdf_path =
        pdf_path.ok_or_else(|| AppError::BadRequest("No PDF file found in upload".to_string()))?;

    // Extract text using pdftotext
    let output = tokio::process::Command::new("pdftotext")
        .arg("-layout")  // Preserve layout
        .arg(&pdf_path)
        .arg("-")  // Output to stdout
        .output()
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to run pdftotext: {}", e)))?;

    if !output.status.success() {
        // Clean up PDF file
        let _ = fs::remove_file(&pdf_path).await;
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Internal(anyhow!("pdftotext failed: {}", stderr)));
    }

    let extracted_text = String::from_utf8_lossy(&output.stdout).to_string();

    // Clean up PDF file - we don't need it anymore
    let _ = fs::remove_file(&pdf_path).await;

    // Get title from filename (without .pdf extension)
    let title = std::path::Path::new(&original_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled Script")
        .to_string();

    // Get database pool
    let pool = services.script_services.script_service.get_pool();

    // Get user ID
    let user_id = auth_user.user_id;

    // Create script record
    let script_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO scripts (id, created_by, title, created_at, is_public)
        VALUES ($1, $2, $3, NOW(), false)
        "#
    )
    .bind(script_id)
    .bind(user_id)
    .bind(&title)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Failed to create script record: {}", e)))?;

    // Create Yjs document with plain text paragraphs
    create_simple_yjs_document(pool, script_id, user_id, &extracted_text).await?;

    tracing::info!(
        "Simple PDF upload completed: script_id={}, title={}, text_length={}",
        script_id,
        title,
        extracted_text.len()
    );

    Ok(axum::Json(SimpleUploadResponse {
        script_id,
        title: title.clone(),
        message: format!("Script '{}' created successfully", title),
    }))
}

/// Creates a simple Yjs document with the extracted text as paragraphs
async fn create_simple_yjs_document(
    pool: &sqlx::PgPool,
    script_id: Uuid,
    _user_id: Uuid,
    text: &str,
) -> Result<(), AppError> {
    let doc = Doc::with_options(Options::default());

    {
        let mut txn = doc.transact_mut();

        // Create the standard Yjs structures used by the editor
        let fragment = txn.get_or_insert_xml_fragment("default");
        txn.get_or_insert_text("prosemirror");
        let metadata = txn.get_or_insert_map("metadata");

        // Set metadata using fully qualified syntax
        Map::insert(&metadata, &mut txn, "initialized", true);
        Map::insert(&metadata, &mut txn, "source", "simple_pdf_upload".to_string());
        Map::insert(&metadata, &mut txn, "migrated", true);

        // Split text into paragraphs and add them
        for line in text.lines() {
            let trimmed = line.trim();
            // Skip empty lines but create paragraph nodes for non-empty content
            if !trimmed.is_empty() {
                let p = fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                p.push_back(&mut txn, XmlTextPrelim::new(trimmed.to_string()));
            }
        }

        // If no content, add an empty paragraph so editor has a cursor anchor
        if text.trim().is_empty() {
            fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
        }
    }

    // Encode the document state
    let base_state = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());
    let state_vector = doc.transact().state_vector().encode_v1();

    // Store in database
    sqlx::query(
        r#"
        INSERT INTO yjs_base_states
            (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
        VALUES ($1, $2, $3, NOW(), 0, 0, $4)
        ON CONFLICT (script_id) DO UPDATE SET
            base_state = EXCLUDED.base_state,
            state_vector = EXCLUDED.state_vector,
            compacted_at = NOW(),
            document_size = EXCLUDED.document_size
        "#
    )
    .bind(script_id)
    .bind(base_state.as_slice())
    .bind(state_vector.as_slice())
    .bind(base_state.len() as i32)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Failed to store Yjs document: {}", e)))?;

    tracing::info!(
        "Created simple Yjs document for script {}: {} bytes",
        script_id,
        base_state.len()
    );

    Ok(())
}

// ============================================================================
// AI FORMAT ENDPOINT
// ============================================================================

/// Embed the text parser prompt for AI formatting
const TEXT_PARSER_PROMPT: &str = include_str!("../services/prompt_text_parser.md");

/// Response for AI format endpoint
#[derive(serde::Serialize)]
pub struct AIFormatResponse {
    pub success: bool,
    pub message: String,
    pub script_id: Uuid,
}

/// AI Format endpoint - parses plain text into structured script using Anthropic API
///
/// Flow:
/// 1. Load existing Yjs document
/// 2. Extract plain text from it
/// 3. Send to Anthropic API with parsing prompt
/// 4. Parse JSON response
/// 5. Rebuild Yjs document with structured content
pub async fn ai_format_script(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    AxumPath(script_id): AxumPath<Uuid>,
) -> Result<axum::Json<AIFormatResponse>, AppError> {
    let pool = services.script_services.script_service.get_pool();

    // Verify user has access to this script
    let script: (Uuid, Uuid, String) = sqlx::query_as(
        "SELECT id, created_by, title FROM scripts WHERE id = $1",
    )
    .bind(script_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;

    let (_, created_by, title) = script;
    if created_by != auth_user.user_id {
        return Err(AppError::Forbidden("You don't have access to this script".to_string()));
    }

    tracing::info!("Starting AI format for script {}: '{}'", script_id, title);

    // Step 1: Load existing Yjs document and extract text
    let document_text = extract_text_from_yjs(pool, script_id).await?;

    if document_text.trim().is_empty() {
        return Err(AppError::BadRequest("Document is empty, nothing to format".to_string()));
    }

    tracing::info!("Extracted {} characters from script {}", document_text.len(), script_id);

    // Step 2: Call Anthropic API to parse the text
    let parsed_json = call_anthropic_for_parsing(&document_text).await?;

    tracing::info!("Received parsed JSON from Anthropic API for script {}", script_id);

    // Step 3: Parse the JSON and rebuild the Yjs document
    rebuild_yjs_from_parsed_json(pool, script_id, auth_user.user_id, &parsed_json).await?;

    tracing::info!("AI format completed for script {}", script_id);

    Ok(axum::Json(AIFormatResponse {
        success: true,
        message: "Script formatted successfully".to_string(),
        script_id,
    }))
}

/// Extract plain text from a Yjs document
async fn extract_text_from_yjs(
    pool: &sqlx::PgPool,
    script_id: Uuid,
) -> Result<String, AppError> {
    use yrs::updates::decoder::Decode;

    tracing::debug!("[extract_text_from_yjs] Starting for script_id={}", script_id);

    // Load base state
    tracing::debug!("[extract_text_from_yjs] Loading base state from database...");
    let base_state: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT base_state FROM yjs_base_states WHERE script_id = $1",
    )
    .bind(script_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!("[extract_text_from_yjs] Database error loading base state: {}", e);
        AppError::Internal(anyhow!("Database error: {}", e))
    })?;

    let doc = Doc::with_options(Options::default());

    // Apply base state
    if let Some((base_data,)) = base_state {
        tracing::debug!("[extract_text_from_yjs] Found base state: {} bytes", base_data.len());
        if !base_data.is_empty() {
            match yrs::Update::decode_v1(&base_data) {
                Ok(update) => {
                    let mut txn = doc.transact_mut();
                    let _ = txn.apply_update(update);
                    tracing::debug!("[extract_text_from_yjs] Applied base state successfully");
                }
                Err(e) => {
                    tracing::warn!("[extract_text_from_yjs] Failed to decode base state: {}", e);
                }
            }
        }
    } else {
        tracing::debug!("[extract_text_from_yjs] No base state found for script");
    }

    // Apply recent updates
    tracing::debug!("[extract_text_from_yjs] Loading recent updates from database...");
    let updates: Vec<(Vec<u8>,)> = sqlx::query_as(
        "SELECT update_data FROM yjs_recent_updates WHERE script_id = $1 AND NOT is_compacted ORDER BY id ASC",
    )
    .bind(script_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!("[extract_text_from_yjs] Database error loading updates: {}", e);
        AppError::Internal(anyhow!("Database error: {}", e))
    })?;
    tracing::debug!("[extract_text_from_yjs] Found {} recent updates to apply", updates.len());

    let mut applied_updates = 0;
    for (update_data,) in updates {
        match yrs::Update::decode_v1(&update_data) {
            Ok(update) => {
                let mut txn = doc.transact_mut();
                let _ = txn.apply_update(update);
                applied_updates += 1;
            }
            Err(e) => {
                tracing::warn!("[extract_text_from_yjs] Failed to decode update: {}", e);
            }
        }
    }
    tracing::debug!("[extract_text_from_yjs] Applied {} updates successfully", applied_updates);

    // Extract text from the document
    // The text is stored in the 'default' XML fragment as paragraph elements
    tracing::debug!("[extract_text_from_yjs] Extracting text from Yjs document...");
    let text = {
        let txn = doc.transact();
        let mut result = String::new();

        if let Some(fragment) = txn.get_xml_fragment("default") {
            let fragment_len = fragment.len(&txn);
            tracing::debug!("[extract_text_from_yjs] Found 'default' fragment with {} children", fragment_len);
            // Iterate through children and extract text
            for i in 0..fragment_len {
                if let Some(child) = fragment.get(&txn, i) {
                    let child_text = extract_text_from_xml_node(&txn, &child);
                    if !child_text.is_empty() {
                        result.push_str(&child_text);
                        result.push('\n');
                    }
                }
            }
        } else {
            tracing::debug!("[extract_text_from_yjs] No 'default' XML fragment found");
        }

        // Also try the prosemirror text field as fallback
        if result.trim().is_empty() {
            tracing::debug!("[extract_text_from_yjs] No text from fragment, trying 'prosemirror' text field...");
            if let Some(text) = txn.get_text("prosemirror") {
                result = text.get_string(&txn);
                tracing::debug!("[extract_text_from_yjs] Got {} chars from 'prosemirror' field", result.len());
            } else {
                tracing::debug!("[extract_text_from_yjs] No 'prosemirror' text field found");
            }
        }

        result
    };

    tracing::debug!("[extract_text_from_yjs] Extraction complete: {} chars, {} lines",
        text.len(),
        text.lines().count()
    );
    Ok(text)
}

/// Recursively extract text from an XML node
fn extract_text_from_xml_node<T: ReadTxn>(txn: &T, node: &yrs::XmlOut) -> String {
    match node {
        yrs::XmlOut::Element(el) => {
            let mut text = String::new();
            let tag = el.tag().to_string();

            // For dialogue blocks, format specially
            if tag == "dialogueBlock" {
                let mut speaker = String::new();
                let mut dialogue_text = String::new();

                for i in 0..el.len(txn) {
                    if let Some(child) = el.get(txn, i) {
                        if let yrs::XmlOut::Element(child_el) = &child {
                            let child_tag = child_el.tag().to_string();
                            if child_tag == "speaker" {
                                speaker = extract_text_from_xml_node(txn, &child);
                            } else if child_tag == "dialogueText" {
                                dialogue_text = extract_text_from_xml_node(txn, &child);
                            }
                        }
                    }
                }

                if !speaker.is_empty() {
                    text.push_str(&speaker);
                    text.push('\n');
                }
                text.push_str(&dialogue_text);
            } else if tag == "sceneBlock" {
                // For scene blocks, extract text content
                // (attribute access is complex due to yrs trait requirements)
                for i in 0..el.len(txn) {
                    if let Some(child) = el.get(txn, i) {
                        text.push_str(&extract_text_from_xml_node(txn, &child));
                    }
                }
            } else {
                // For other elements, just extract all text content
                for i in 0..el.len(txn) {
                    if let Some(child) = el.get(txn, i) {
                        let child_text = extract_text_from_xml_node(txn, &child);
                        text.push_str(&child_text);
                        // Add newline after paragraphs
                        if tag == "paragraph" && !child_text.is_empty() {
                            text.push('\n');
                        }
                    }
                }
            }

            text.trim().to_string()
        }
        yrs::XmlOut::Text(txt) => {
            txt.get_string(txn)
        }
        yrs::XmlOut::Fragment(frag) => {
            let mut text = String::new();
            for i in 0..frag.len(txn) {
                if let Some(child) = frag.get(txn, i) {
                    text.push_str(&extract_text_from_xml_node(txn, &child));
                    text.push('\n');
                }
            }
            text
        }
    }
}

/// Call Anthropic API to parse the document text
async fn call_anthropic_for_parsing(text: &str) -> Result<String, AppError> {
    use crate::external::anthropic::{AnthropicClient, AnthropicConfig};

    tracing::debug!("[call_anthropic_for_parsing] Starting with {} chars of input text", text.len());

    // Load API configuration
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| AppError::Internal(anyhow!("ANTHROPIC_API_KEY not set")))?;

    let config = AnthropicConfig {
        api_key,
        model: std::env::var("ANTHROPIC_MODEL")
            .unwrap_or_else(|_| "claude-haiku-4-5-20251001".to_string()),
        max_tokens: std::env::var("ANTHROPIC_MAX_TOKENS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4096),
        rate_limit_delay_ms: 0, // No rate limiting for single-pass parsing
    };

    // Create client
    let client = AnthropicClient::new(config)
        .map_err(|e| AppError::from(e))?;

    tracing::info!("[call_anthropic_for_parsing] Calling Anthropic API...");

    // Parse with API
    let response = client.parse_text(TEXT_PARSER_PROMPT, text).await
        .map_err(|e| {
            tracing::error!("[call_anthropic_for_parsing] Anthropic API error: {}", e);
            AppError::from(e)
        })?;

    tracing::info!(
        "[call_anthropic_for_parsing] Tokens used: input={}, output={}",
        response.usage.input_tokens,
        response.usage.output_tokens
    );

    // Convert to JSON string for compatibility with existing code
    let json_str = response.json_content.to_string();
    tracing::debug!("[call_anthropic_for_parsing] Response JSON: {} chars", json_str.len());

    Ok(json_str)
}

/// Rebuild Yjs document from parsed JSON
async fn rebuild_yjs_from_parsed_json(
    pool: &sqlx::PgPool,
    script_id: Uuid,
    user_id: Uuid,
    json_str: &str,
) -> Result<(), AppError> {
    tracing::debug!("[rebuild_yjs_from_parsed_json] Starting for script_id={}, json_length={}",
        script_id, json_str.len());

    // Parse the JSON
    tracing::debug!("[rebuild_yjs_from_parsed_json] Parsing JSON...");
    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| {
            tracing::error!("[rebuild_yjs_from_parsed_json] Invalid JSON: {}", e);
            tracing::error!("[rebuild_yjs_from_parsed_json] JSON content (first 1000 chars): {}",
                &json_str[..json_str.len().min(1000)]);
            AppError::Internal(anyhow!("Invalid JSON from API: {}", e))
        })?;
    tracing::debug!("[rebuild_yjs_from_parsed_json] JSON parsed successfully");

    // Check for error response
    if let Some(error) = parsed.get("error") {
        tracing::error!("[rebuild_yjs_from_parsed_json] API returned error: {}", error);
        return Err(AppError::Internal(anyhow!("API parsing error: {}", error)));
    }

    // Extract content array
    tracing::debug!("[rebuild_yjs_from_parsed_json] Extracting content array...");
    let content = parsed.get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| {
            tracing::error!("[rebuild_yjs_from_parsed_json] Missing 'content' array in JSON");
            tracing::error!("[rebuild_yjs_from_parsed_json] JSON keys: {:?}",
                parsed.as_object().map(|o| o.keys().collect::<Vec<_>>()));
            AppError::Internal(anyhow!("Missing content array in parsed JSON"))
        })?;
    tracing::debug!("[rebuild_yjs_from_parsed_json] Found {} content items", content.len());

    // Create new Yjs document with structured content
    tracing::debug!("[rebuild_yjs_from_parsed_json] Creating new Yjs document...");
    let doc = Doc::with_options(Options::default());

    // Count content types for logging
    let mut type_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    {
        let mut txn = doc.transact_mut();

        // Create standard structures
        let fragment = txn.get_or_insert_xml_fragment("default");
        txn.get_or_insert_text("prosemirror");
        let metadata = txn.get_or_insert_map("metadata");

        // Set metadata
        Map::insert(&metadata, &mut txn, "initialized", true);
        Map::insert(&metadata, &mut txn, "source", "ai_format".to_string());
        Map::insert(&metadata, &mut txn, "migrated", true);
        Map::insert(&metadata, &mut txn, "ai_formatted", true);
        Map::insert(&metadata, &mut txn, "ai_formatted_at", chrono::Utc::now().to_rfc3339());
        tracing::debug!("[rebuild_yjs_from_parsed_json] Metadata set");

        // Process content items
        tracing::debug!("[rebuild_yjs_from_parsed_json] Processing content items...");
        for (idx, item) in content.iter().enumerate() {
            let content_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
            let content_text = item.get("content").and_then(|c| c.as_str()).unwrap_or("");

            // Track counts
            *type_counts.entry(content_type.to_string()).or_insert(0) += 1;

            tracing::trace!("[rebuild_yjs_from_parsed_json] Item {}: type='{}', content_len={}",
                idx, content_type, content_text.len());

            match content_type {
                "scene" => {
                    let scene_el = fragment.push_back(&mut txn, XmlElementPrelim::empty("sceneBlock"));
                    let scene_num = item.get("scene_number")
                        .and_then(|n| n.as_str())
                        .unwrap_or("1");
                    scene_el.insert_attribute(&mut txn, "sceneNumber", scene_num.to_string());
                    scene_el.insert_attribute(&mut txn, "sceneName", content_text.to_string());
                    scene_el.push_back(&mut txn, XmlTextPrelim::new(content_text.to_string()));
                }
                "dialogue" | "monologue" => {
                    let dlg_el = fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                    let speaker_el = dlg_el.push_back(&mut txn, XmlElementPrelim::empty("speaker"));

                    if let Some(speaker) = item.get("speaker").and_then(|s| s.as_str()) {
                        speaker_el.push_back(&mut txn, XmlTextPrelim::new(speaker.to_string()));
                    }

                    let text_el = dlg_el.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));

                    // Split dialogue into paragraphs
                    for line in content_text.split('\n') {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            let p = text_el.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut txn, XmlTextPrelim::new(trimmed.to_string()));
                        }
                    }
                }
                "stage_direction" => {
                    let p = fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                    // Wrap in parentheses if not already
                    let formatted = if content_text.starts_with('(') && content_text.ends_with(')') {
                        content_text.to_string()
                    } else {
                        format!("({})", content_text)
                    };
                    p.push_back(&mut txn, XmlTextPrelim::new(formatted));
                }
                "joint_dialogue" => {
                    let dlg_el = fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                    let speaker_el = dlg_el.push_back(&mut txn, XmlElementPrelim::empty("speaker"));

                    // Join speakers with comma
                    if let Some(speakers) = item.get("speakers").and_then(|s| s.as_array()) {
                        let speaker_names: Vec<&str> = speakers.iter()
                            .filter_map(|s| s.as_str())
                            .collect();
                        speaker_el.push_back(&mut txn, XmlTextPrelim::new(speaker_names.join(", ")));
                    }

                    let text_el = dlg_el.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                    for line in content_text.split('\n') {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            let p = text_el.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut txn, XmlTextPrelim::new(trimmed.to_string()));
                        }
                    }
                }
                _ => {
                    // Unknown type - add as paragraph
                    tracing::debug!("[rebuild_yjs_from_parsed_json] Unknown type '{}', adding as paragraph", content_type);
                    if !content_text.trim().is_empty() {
                        let p = fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                        p.push_back(&mut txn, XmlTextPrelim::new(content_text.trim().to_string()));
                    }
                }
            }
        }

        // Log content type summary
        tracing::debug!("[rebuild_yjs_from_parsed_json] Content type summary: {:?}", type_counts);

        // Ensure at least one paragraph exists
        let final_len = fragment.len(&txn);
        if final_len == 0 {
            tracing::debug!("[rebuild_yjs_from_parsed_json] No content, adding empty paragraph");
            fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
        }
        tracing::debug!("[rebuild_yjs_from_parsed_json] Document has {} top-level elements", fragment.len(&txn));
    }

    // Encode and store
    tracing::debug!("[rebuild_yjs_from_parsed_json] Encoding Yjs document...");
    let base_state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
    let state_vector = doc.transact().state_vector().encode_v1();
    tracing::debug!("[rebuild_yjs_from_parsed_json] Encoded: base_state={} bytes, state_vector={} bytes",
        base_state.len(), state_vector.len());

    // Update the base state (this replaces the existing content)
    tracing::debug!("[rebuild_yjs_from_parsed_json] Storing to yjs_base_states...");
    sqlx::query(
        r#"
        INSERT INTO yjs_base_states
            (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
        VALUES ($1, $2, $3, NOW(), 0, 0, $4)
        ON CONFLICT (script_id) DO UPDATE SET
            base_state = EXCLUDED.base_state,
            state_vector = EXCLUDED.state_vector,
            compacted_at = NOW(),
            document_size = EXCLUDED.document_size
        "#
    )
    .bind(script_id)
    .bind(base_state.as_slice())
    .bind(state_vector.as_slice())
    .bind(base_state.len() as i32)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!("[rebuild_yjs_from_parsed_json] Failed to store document: {}", e);
        AppError::Internal(anyhow!("Failed to store formatted document: {}", e))
    })?;
    tracing::debug!("[rebuild_yjs_from_parsed_json] Base state stored successfully");

    // Clear any recent updates (they're now obsolete)
    tracing::debug!("[rebuild_yjs_from_parsed_json] Marking recent updates as compacted...");
    sqlx::query("UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1")
        .bind(script_id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!("[rebuild_yjs_from_parsed_json] Failed to clear recent updates: {}", e);
            AppError::Internal(anyhow!("Failed to clear recent updates: {}", e))
        })?;
    tracing::debug!("[rebuild_yjs_from_parsed_json] Recent updates cleared");

    tracing::info!("[rebuild_yjs_from_parsed_json] Complete for script {}: {} bytes, types={:?}",
        script_id, base_state.len(), type_counts);

    Ok(())
}

// ============================================================================
// CHUNKED AI FORMAT WITH SSE STREAMING
// ============================================================================

/// Chunk with context from previous chunk for continuity
#[derive(Debug, Clone)]
pub struct ChunkWithContext {
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub context: Option<String>,  // Previous chunk's ending for context
    pub text: String,             // Text to parse
    pub is_first: bool,
    pub is_last: bool,
}

/// SSE event types for streaming progress
#[derive(serde::Serialize, Clone)]
#[serde(tag = "type")]
pub enum AIFormatEvent {
    #[serde(rename = "started")]
    Started {
        total_chunks: usize,
        backup_id: String,
        total_chars: usize,
    },
    #[serde(rename = "chunk_started")]
    ChunkStarted {
        chunk: usize,
        total: usize,
    },
    #[serde(rename = "chunk_complete")]
    ChunkComplete {
        chunk: usize,
        total: usize,
        items_parsed: usize,
    },
    #[serde(rename = "complete")]
    Complete {
        total_items: usize,
        backup_id: String,
    },
    #[serde(rename = "error")]
    Error {
        message: String,
        chunk: Option<usize>,
    },
    #[serde(rename = "cancelled")]
    Cancelled,
}

/// Request body for cancel/undo operations
#[derive(serde::Deserialize)]
pub struct FormatControlRequest {
    pub backup_id: String,
}

/// In-memory storage for backups and cancel flags
/// In production, consider using Redis or database
use std::sync::RwLock;
use std::collections::HashMap;
use once_cell::sync::Lazy;

#[derive(Clone)]
struct FormatSession {
    backup_state: Vec<u8>,
    script_id: Uuid,
    cancelled: bool,
    created_at: std::time::Instant,
}

static FORMAT_SESSIONS: Lazy<RwLock<HashMap<String, FormatSession>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// Split text into chunks with overlap for context continuity
fn split_into_chunks(text: &str, chunk_size: usize, overlap_size: usize) -> Vec<ChunkWithContext> {
    let text_len = text.len();

    if text_len <= chunk_size {
        // Small document, single chunk
        return vec![ChunkWithContext {
            chunk_index: 0,
            total_chunks: 1,
            context: None,
            text: text.to_string(),
            is_first: true,
            is_last: true,
        }];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    let mut chunk_index = 0;

    // First, calculate total chunks for progress reporting
    let mut temp_start = 0;
    let mut total_chunks = 0;
    while temp_start < text_len {
        total_chunks += 1;
        temp_start += chunk_size;
    }

    while start < text_len {
        let end = (start + chunk_size).min(text_len);

        // Try to find a good break point (paragraph break, empty line)
        let actual_end = if end < text_len {
            find_break_point(text, end, chunk_size / 4)
        } else {
            end
        };

        let chunk_text = &text[start..actual_end];

        // Get context from previous chunk
        let context = if start > 0 {
            let context_start = if start > overlap_size { start - overlap_size } else { 0 };
            Some(text[context_start..start].to_string())
        } else {
            None
        };

        chunks.push(ChunkWithContext {
            chunk_index,
            total_chunks,
            context,
            text: chunk_text.to_string(),
            is_first: chunk_index == 0,
            is_last: actual_end >= text_len,
        });

        start = actual_end;
        chunk_index += 1;
    }

    // Update total_chunks to actual count
    let actual_total = chunks.len();
    for chunk in &mut chunks {
        chunk.total_chunks = actual_total;
        chunk.is_last = chunk.chunk_index == actual_total - 1;
    }

    tracing::debug!("[split_into_chunks] Split {} chars into {} chunks", text_len, actual_total);
    chunks
}

/// Find a good break point near the target position
fn find_break_point(text: &str, target: usize, search_range: usize) -> usize {
    let search_start = target.saturating_sub(search_range);
    let search_end = (target + search_range).min(text.len());
    let search_text = &text[search_start..search_end];

    // Priority: double newline (paragraph break) > single newline > space
    if let Some(pos) = search_text.rfind("\n\n") {
        return search_start + pos + 2;
    }
    if let Some(pos) = search_text.rfind('\n') {
        return search_start + pos + 1;
    }
    if let Some(pos) = search_text.rfind(' ') {
        return search_start + pos + 1;
    }

    target
}

/// Save backup of current document state
async fn save_format_backup(
    pool: &sqlx::PgPool,
    script_id: Uuid,
) -> Result<String, AppError> {
    use yrs::updates::decoder::Decode;

    tracing::debug!("[save_format_backup] Saving backup for script {}", script_id);

    // Load current document state
    let base_state: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT base_state FROM yjs_base_states WHERE script_id = $1",
    )
    .bind(script_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Database error: {}", e)))?;

    let backup_state = base_state
        .map(|(data,)| data)
        .unwrap_or_default();

    let backup_id = Uuid::new_v4().to_string();

    // Store in memory
    let session = FormatSession {
        backup_state,
        script_id,
        cancelled: false,
        created_at: std::time::Instant::now(),
    };

    FORMAT_SESSIONS.write().unwrap().insert(backup_id.clone(), session);

    tracing::debug!("[save_format_backup] Backup saved with id {}", backup_id);
    Ok(backup_id)
}

/// Restore document from backup
async fn restore_format_backup(
    pool: &sqlx::PgPool,
    backup_id: &str,
) -> Result<(), AppError> {
    let session = FORMAT_SESSIONS.read().unwrap()
        .get(backup_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound("Backup not found".to_string()))?;

    tracing::debug!("[restore_format_backup] Restoring backup {} for script {}",
        backup_id, session.script_id);

    // Restore the backup state
    let doc = Doc::with_options(Options::default());
    if !session.backup_state.is_empty() {
        use yrs::updates::decoder::Decode;
        if let Ok(update) = yrs::Update::decode_v1(&session.backup_state) {
            let mut txn = doc.transact_mut();
            let _ = txn.apply_update(update);
        }
    }

    let base_state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
    let state_vector = doc.transact().state_vector().encode_v1();

    sqlx::query(
        r#"
        INSERT INTO yjs_base_states
            (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
        VALUES ($1, $2, $3, NOW(), 0, 0, $4)
        ON CONFLICT (script_id) DO UPDATE SET
            base_state = EXCLUDED.base_state,
            state_vector = EXCLUDED.state_vector,
            compacted_at = NOW(),
            document_size = EXCLUDED.document_size
        "#
    )
    .bind(session.script_id)
    .bind(base_state.as_slice())
    .bind(state_vector.as_slice())
    .bind(base_state.len() as i32)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Failed to restore backup: {}", e)))?;

    tracing::info!("[restore_format_backup] Backup {} restored successfully", backup_id);
    Ok(())
}

/// Check if a format session has been cancelled
fn is_session_cancelled(backup_id: &str) -> bool {
    FORMAT_SESSIONS.read().unwrap()
        .get(backup_id)
        .map(|s| s.cancelled)
        .unwrap_or(false)
}

/// Mark a session as cancelled
fn mark_session_cancelled(backup_id: &str) -> bool {
    if let Some(session) = FORMAT_SESSIONS.write().unwrap().get_mut(backup_id) {
        session.cancelled = true;
        true
    } else {
        false
    }
}

/// Clean up old sessions (call periodically)
pub fn cleanup_old_format_sessions(max_age_secs: u64) {
    let mut sessions = FORMAT_SESSIONS.write().unwrap();
    let now = std::time::Instant::now();
    sessions.retain(|_, session| {
        now.duration_since(session.created_at).as_secs() < max_age_secs
    });
}

/// Embed the chunk parser prompt
const TEXT_PARSER_CHUNK_PROMPT: &str = include_str!("../services/prompt_text_parser_chunk.md");

/// SSE streaming endpoint for AI formatting with chunked processing
pub async fn ai_format_stream(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    AxumPath(script_id): AxumPath<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let pool = services.script_services.script_service.get_pool().clone();

    // Verify user has access to this script
    let script: (Uuid, Uuid, String) = sqlx::query_as(
        "SELECT id, created_by, title FROM scripts WHERE id = $1",
    )
    .bind(script_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;

    let (_, created_by, title) = script;
    if created_by != auth_user.user_id {
        return Err(AppError::Forbidden("You don't have access to this script".to_string()));
    }

    tracing::info!("[ai_format_stream] Starting for script {}: '{}'", script_id, title);

    // Create channel for SSE events
    let (tx, rx) = tokio::sync::mpsc::channel::<AIFormatEvent>(100);

    // Clone pool for the spawned task
    let pool_clone = pool.clone();
    let user_id = auth_user.user_id;

    // Spawn the processing task
    tokio::spawn(async move {
        if let Err(e) = process_format_stream(pool_clone, script_id, user_id, tx.clone()).await {
            tracing::error!("[ai_format_stream] Processing error: {}", e);
            let _ = tx.send(AIFormatEvent::Error {
                message: e.to_string(),
                chunk: None,
            }).await;
        }
    });

    // Create SSE stream
    let sse_stream = stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Some(event) => {
                let json = serde_json::to_string(&event).unwrap_or_default();
                let sse_event = Event::default().data(json);
                Some((Ok::<_, Infallible>(sse_event), rx))
            }
            None => None,
        }
    });

    let sse = Sse::new(sse_stream).keep_alive(KeepAlive::default());
    Ok(sse)
}

/// Process format stream - the actual chunked processing logic
async fn process_format_stream(
    pool: sqlx::PgPool,
    script_id: Uuid,
    user_id: Uuid,
    tx: tokio::sync::mpsc::Sender<AIFormatEvent>,
) -> Result<(), AppError> {
    // Step 1: Extract text from document
    let document_text = extract_text_from_yjs(&pool, script_id).await?;

    if document_text.trim().is_empty() {
        return Err(AppError::BadRequest("Document is empty, nothing to format".to_string()));
    }

    let total_chars = document_text.len();
    tracing::info!("[process_format_stream] Extracted {} chars from script {}", total_chars, script_id);

    // Step 2: Save backup before processing
    let backup_id = save_format_backup(&pool, script_id).await?;
    tracing::info!("[process_format_stream] Backup saved: {}", backup_id);

    // Step 3: Split into chunks
    let chunk_size = 8000;  // ~8k chars per chunk
    let overlap_size = 1000; // ~1k overlap for context
    let chunks = split_into_chunks(&document_text, chunk_size, overlap_size);

    // Send started event
    let _ = tx.send(AIFormatEvent::Started {
        total_chunks: chunks.len(),
        backup_id: backup_id.clone(),
        total_chars,
    }).await;

    tracing::info!("[process_format_stream] Split into {} chunks", chunks.len());

    // Step 4: Create Anthropic client for chunk processing
    use crate::external::anthropic::{AnthropicClient, AnthropicConfig};

    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| AppError::Internal(anyhow!("ANTHROPIC_API_KEY not set")))?;

    let config = AnthropicConfig {
        api_key,
        model: std::env::var("ANTHROPIC_MODEL")
            .unwrap_or_else(|_| "claude-haiku-4-5-20251001".to_string()),
        max_tokens: std::env::var("ANTHROPIC_MAX_TOKENS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(4096),
        rate_limit_delay_ms: std::env::var("ANTHROPIC_RATE_LIMIT_MS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(2000),
    };

    let client = AnthropicClient::new(config)
        .map_err(|e| AppError::from(e))?;

    // Step 5: Process chunks sequentially
    let mut all_content: Vec<serde_json::Value> = Vec::new();
    let mut last_scene_number = 0;
    let mut last_speaker: Option<String> = None;

    for chunk in &chunks {
        // Check for cancellation
        if is_session_cancelled(&backup_id) {
            tracing::info!("[process_format_stream] Cancelled at chunk {}", chunk.chunk_index);
            // Restore backup
            restore_format_backup(&pool, &backup_id).await?;
            let _ = tx.send(AIFormatEvent::Cancelled).await;
            return Ok(());
        }

        // Send chunk started event
        let _ = tx.send(AIFormatEvent::ChunkStarted {
            chunk: chunk.chunk_index + 1,
            total: chunk.total_chunks,
        }).await;

        tracing::info!("[process_format_stream] Processing chunk {}/{}", chunk.chunk_index + 1, chunk.total_chunks);

        // Call Anthropic API for this chunk
        let chunk_result = call_anthropic_for_chunk(
            &client,
            chunk,
            last_scene_number,
            last_speaker.as_deref(),
        ).await;

        match chunk_result {
            Ok((parsed_content, new_scene_number, new_speaker)) => {
                let items_count = parsed_content.len();
                all_content.extend(parsed_content);
                last_scene_number = new_scene_number;
                last_speaker = new_speaker;

                // Send chunk complete event
                let _ = tx.send(AIFormatEvent::ChunkComplete {
                    chunk: chunk.chunk_index + 1,
                    total: chunk.total_chunks,
                    items_parsed: items_count,
                }).await;

                tracing::info!("[process_format_stream] Chunk {} complete: {} items", chunk.chunk_index + 1, items_count);

                // Apply rate limiting between chunks
                client.apply_rate_limit().await;
            }
            Err(e) => {
                tracing::error!("[process_format_stream] Chunk {} failed: {}", chunk.chunk_index + 1, e);
                // Restore backup on error
                let _ = restore_format_backup(&pool, &backup_id).await;
                let _ = tx.send(AIFormatEvent::Error {
                    message: e.to_string(),
                    chunk: Some(chunk.chunk_index + 1),
                }).await;
                return Err(e);
            }
        }
    }

    // Step 6: Rebuild document with all parsed content
    tracing::info!("[process_format_stream] Rebuilding document with {} total items", all_content.len());

    let full_json = serde_json::json!({
        "metadata": {},
        "content": all_content
    });

    rebuild_yjs_from_parsed_json(&pool, script_id, user_id, &full_json.to_string()).await?;

    // Send complete event
    let _ = tx.send(AIFormatEvent::Complete {
        total_items: all_content.len(),
        backup_id: backup_id.clone(),
    }).await;

    tracing::info!("[process_format_stream] Format complete for script {}", script_id);
    Ok(())
}

/// Call Anthropic API to parse a single chunk with context
async fn call_anthropic_for_chunk(
    client: &crate::external::anthropic::AnthropicClient,
    chunk: &ChunkWithContext,
    previous_scene_number: usize,
    previous_speaker: Option<&str>,
) -> Result<(Vec<serde_json::Value>, usize, Option<String>), AppError> {
    tracing::debug!("[call_anthropic_for_chunk] Processing chunk {}/{}, {} chars",
        chunk.chunk_index + 1, chunk.total_chunks, chunk.text.len());

    // Parse chunk via API
    let response = client.parse_chunk(
        &chunk.text,
        TEXT_PARSER_CHUNK_PROMPT,
        chunk.context.as_deref(),
        previous_scene_number,
        previous_speaker,
    ).await.map_err(|e| {
        tracing::error!("[call_anthropic_for_chunk] Anthropic API error: {}", e);
        AppError::from(e)
    })?;

    tracing::info!(
        "[call_anthropic_for_chunk] Chunk {}/{} - Tokens: input={}, output={}",
        chunk.chunk_index + 1,
        chunk.total_chunks,
        response.usage.input_tokens,
        response.usage.output_tokens
    );

    tracing::debug!("[call_anthropic_for_chunk] Chunk {} parsed: {} items, last_scene={}, last_speaker={:?}",
        chunk.chunk_index + 1, response.content.len(), response.last_scene_number, response.last_speaker);

    Ok((response.content, response.last_scene_number, response.last_speaker))
}

/// Cancel endpoint - stops processing and restores backup
pub async fn ai_format_cancel(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    AxumPath(script_id): AxumPath<Uuid>,
    axum::Json(req): axum::Json<FormatControlRequest>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    let pool = services.script_services.script_service.get_pool();

    // Verify ownership
    let script: (Uuid,) = sqlx::query_as(
        "SELECT created_by FROM scripts WHERE id = $1",
    )
    .bind(script_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;

    if script.0 != auth_user.user_id {
        return Err(AppError::Forbidden("You don't have access to this script".to_string()));
    }

    // Mark session as cancelled
    if mark_session_cancelled(&req.backup_id) {
        tracing::info!("[ai_format_cancel] Session {} marked as cancelled", req.backup_id);

        // Restore backup
        restore_format_backup(pool, &req.backup_id).await?;

        Ok(axum::Json(serde_json::json!({
            "success": true,
            "message": "Format cancelled and document restored"
        })))
    } else {
        Err(AppError::NotFound("Session not found".to_string()))
    }
}

/// Undo endpoint - restores document to pre-format state
pub async fn ai_format_undo(
    State(services): State<ExtendedScriptServices>,
    auth_user: AuthUser,
    AxumPath(script_id): AxumPath<Uuid>,
    axum::Json(req): axum::Json<FormatControlRequest>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    let pool = services.script_services.script_service.get_pool();

    // Verify ownership
    let script: (Uuid,) = sqlx::query_as(
        "SELECT created_by FROM scripts WHERE id = $1",
    )
    .bind(script_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;

    if script.0 != auth_user.user_id {
        return Err(AppError::Forbidden("You don't have access to this script".to_string()));
    }

    // Restore backup
    tracing::info!("[ai_format_undo] Undoing format for script {} with backup {}", script_id, req.backup_id);
    restore_format_backup(pool, &req.backup_id).await?;

    // Remove session after undo
    FORMAT_SESSIONS.write().unwrap().remove(&req.backup_id);

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "message": "Document restored to pre-format state"
    })))
}
