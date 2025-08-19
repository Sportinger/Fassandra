use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade}, State, Path},
    response::IntoResponse,
};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;
use futures_util::{SinkExt, StreamExt};
use crate::auth::WebSocketAuth;
use crate::services::claude_session_service::{ClaudeSessionService, SessionUpdate};

/// WebSocket handler for real-time Claude session updates
pub async fn claude_session_ws(
    ws: WebSocketUpgrade,
    State(claude_service): State<Arc<ClaudeSessionService>>,
    Path(session_id): Path<Uuid>,
    WebSocketAuth(_auth_user): WebSocketAuth, // Use WebSocket auth that accepts token from query
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_claude_session_socket(socket, claude_service, session_id))
}

async fn handle_claude_session_socket(
    socket: WebSocket,
    claude_service: Arc<ClaudeSessionService>,
    session_id: Uuid,
) {
    let (mut sender, mut receiver) = socket.split();
    
    // Check if session exists
    let session_info = match claude_service.get_session(session_id).await {
        Some(info) => info,
        None => {
            let _ = sender.send(axum::extract::ws::Message::Text(
                serde_json::json!({
                    "type": "error",
                    "message": format!("Session {} not found", session_id)
                }).to_string()
            )).await;
            return;
        }
    };
    
    // Send initial status
    let _ = sender.send(axum::extract::ws::Message::Text(
        serde_json::json!({
            "type": "initial",
            "session": {
                "id": session_info.id,
                "status": format!("{:?}", session_info.status),
                "progress": session_info.progress,
                "pdf_filename": session_info.pdf_filename,
                "started_at": session_info.started_at.to_rfc3339(),
            }
        }).to_string()
    )).await;
    
    // Create channel for updates
    let (tx, mut rx) = mpsc::channel::<SessionUpdate>(100);
    
    // Spawn task to monitor session and send updates
    let claude_service_clone = claude_service.clone();
    let monitor_task = tokio::spawn(async move {
        let mut last_line_count = 0;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            
            if let Some(session) = claude_service_clone.get_session(session_id).await {
                // Check for new log lines
                if let Some(logs) = claude_service_clone.get_session_logs(session_id, last_line_count).await {
                    for line in logs {
                        let _ = tx.send(SessionUpdate::Output { line }).await;
                    }
                    last_line_count = session.output.len();
                }
                
                // Check if session is complete or failed
                match session.status {
                    crate::services::claude_session_service::SessionStatus::Complete => {
                        if let Some(script_id) = session.script_id {
                            let _ = tx.send(SessionUpdate::Complete { script_id }).await;
                        }
                        break;
                    }
                    crate::services::claude_session_service::SessionStatus::Failed => {
                        let error = session.error.unwrap_or_else(|| "Unknown error".to_string());
                        let _ = tx.send(SessionUpdate::Failed { error }).await;
                        break;
                    }
                    _ => {}
                }
            } else {
                // Session was removed
                break;
            }
        }
    });
    
    // Forward updates to WebSocket
    let forward_task = tokio::spawn(async move {
        while let Some(update) = rx.recv().await {
            let message = match update {
                SessionUpdate::Status { status, progress } => {
                    serde_json::json!({
                        "type": "status",
                        "status": format!("{:?}", status),
                        "progress": progress
                    })
                }
                SessionUpdate::Output { line } => {
                    serde_json::json!({
                        "type": "output",
                        "line": line
                    })
                }
                SessionUpdate::PageProgress { current_page, total_pages } => {
                    serde_json::json!({
                        "type": "page_progress",
                        "current_page": current_page,
                        "total_pages": total_pages,
                        "message": format!("Processing page {} of {}", current_page, total_pages)
                    })
                }
                SessionUpdate::ChunkInfo { total_pages, total_chunks } => {
                    serde_json::json!({
                        "type": "chunk_info",
                        "total_pages": total_pages,
                        "total_chunks": total_chunks,
                        "message": format!("Script will be processed in {} chunks", total_chunks)
                    })
                }
                SessionUpdate::ChunkProgress { current_chunk, total_chunks, pages_start, pages_end } => {
                    serde_json::json!({
                        "type": "chunk_progress",
                        "current_chunk": current_chunk,
                        "total_chunks": total_chunks,
                        "pages_start": pages_start,
                        "pages_end": pages_end,
                        "message": format!("Processing chunk {} of {} (pages {}-{})", 
                                          current_chunk, total_chunks, pages_start, pages_end)
                    })
                }
                SessionUpdate::Complete { script_id } => {
                    serde_json::json!({
                        "type": "complete",
                        "script_id": script_id
                    })
                }
                SessionUpdate::Failed { error } => {
                    serde_json::json!({
                        "type": "failed",
                        "error": error
                    })
                }
            };
            
            if sender.send(axum::extract::ws::Message::Text(message.to_string())).await.is_err() {
                break;
            }
        }
    });
    
    // Handle incoming messages (for potential future use)
    let receive_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(axum::extract::ws::Message::Text(text)) => {
                    // Handle text messages if needed
                    tracing::debug!("Received WebSocket message: {}", text);
                }
                Ok(axum::extract::ws::Message::Close(_)) => {
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Wait for any task to complete
    tokio::select! {
        _ = monitor_task => {},
        _ = forward_task => {},
        _ = receive_task => {},
    }
}