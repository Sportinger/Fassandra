use axum::{
    extract::{Multipart, State, Path as AxumPath},
    response::{IntoResponse, sse::{Event, Sse, KeepAlive}},
};
use uuid::Uuid;
use crate::error::AppError;
use crate::services::claude_session_service::{ClaudeSessionService, SessionUpdate};
use crate::auth::AuthUser;
use crate::handlers::script::ScriptServices;
use std::path::PathBuf;
use tokio::fs;
use anyhow::anyhow;
use futures_util::{stream::{self, TryStreamExt}};
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(serde::Serialize)]
pub struct UploadResponse {
    pub session_id: Uuid,
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
    fs::create_dir_all(&upload_dir).await.map_err(|e| {
        AppError::Internal(anyhow!("Failed to create upload directory: {}", e))
    })?;

    // Generate a unique filename
    let temp_id = Uuid::new_v4();
    let mut pdf_path = None;
    let mut original_filename = String::new();

    // Process multipart upload
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let _name = field.name().unwrap_or("").to_string();
        let file_name = field.file_name().unwrap_or("").to_string();
        
        if file_name.ends_with(".pdf") {
            original_filename = file_name.clone();
            let filepath = upload_dir.join(format!("{}_{}", temp_id, file_name));
            let filepath_str = filepath.to_string_lossy().to_string();
            
            // Create file
            let mut file = tokio::fs::File::create(&filepath).await.map_err(|e| {
                AppError::Internal(anyhow!("Failed to create file: {}", e))
            })?;
            
            // Stream the file data
            let mut field_stream = field.into_stream();
            while let Some(chunk) = field_stream.try_next().await.map_err(|e| {
                AppError::Internal(anyhow!("Failed to read chunk: {}", e))
            })? {
                tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await.map_err(|e| {
                    AppError::Internal(anyhow!("Failed to write chunk: {}", e))
                })?;
            }
            
            pdf_path = Some(filepath_str);
            break;
        }
    }

    let pdf_path = pdf_path.ok_or_else(|| {
        AppError::BadRequest("No PDF file found in upload".to_string())
    })?;

    // Get absolute path for the PDF
    let abs_pdf_path = std::fs::canonicalize(&pdf_path)
        .map_err(|e| AppError::Internal(anyhow!("Failed to get absolute path: {}", e)))?
        .to_string_lossy()
        .to_string();

    // Get database pool from services
    let pool = services.script_services.script_service.get_pool();
    
    // Get user email
    let user_email = sqlx::query_scalar::<_, String>(
        "SELECT email FROM users WHERE id = $1"
    )
    .bind(auth_user.user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(anyhow!("Failed to fetch user email: {}", e)))?;

    // Create a channel for updates (we'll use this later for WebSocket)
    let (tx, _rx) = mpsc::channel::<SessionUpdate>(100);
    
    // Start Claude session
    let session_id = services.claude_session_service
        .start_session(
            abs_pdf_path.clone(),
            user_email.clone(),
            move |_session_id, update| {
                let tx = tx.clone();
                tokio::spawn(async move {
                    let _ = tx.send(update).await;
                });
            }
        )
        .await
        .map_err(|e| AppError::Internal(anyhow!("Failed to start Claude session: {}", e)))?;

    // Note: We're NOT deleting the PDF file anymore - Claude will process it
    // The cleanup can happen after processing is complete

    let response = UploadResponse {
        session_id,
        message: format!("Claude Code session started. Processing '{}'", original_filename),
    };
    
    tracing::info!("Returning upload response: session_id={}, message={}", response.session_id, response.message);
    
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
    let _user_email = sqlx::query_scalar::<_, String>(
        "SELECT email FROM users WHERE id = $1"
    )
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
        let _ = tx.send("PDF parsing service temporarily disabled".to_string()).await;
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

    let sse = Sse::new(sse_stream)
        .keep_alive(KeepAlive::default());

    Ok(sse)
} 