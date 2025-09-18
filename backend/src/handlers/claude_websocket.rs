use crate::auth::WebSocketAuth;
use crate::services::claude_session_service::{ClaudeSessionService, SessionUpdate};
use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

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
            let _ = sender
                .send(axum::extract::ws::Message::Text(
                    serde_json::json!({
                        "type": "error",
                        "message": format!("Session {} not found", session_id)
                    })
                    .to_string(),
                ))
                .await;
            return;
        }
    };

    // Send initial status
    let _ = sender
        .send(axum::extract::ws::Message::Text(
            serde_json::json!({
                "type": "initial",
                "session": {
                    "id": session_info.id,
                    "status": format!("{:?}", session_info.status),
                    "progress": session_info.progress,
                    "pdf_filename": session_info.pdf_filename,
                    "started_at": session_info.started_at.to_rfc3339(),
                }
            })
            .to_string(),
        ))
        .await;

    // Create channel for updates
    let (tx, mut rx) = mpsc::channel::<SessionUpdate>(100);

    // Spawn task to monitor session and send updates
    let claude_service_clone = claude_service.clone();
    let monitor_task = tokio::spawn(async move {
        let mut last_line_count = 0usize;
        let mut last_progress: Option<u8> = None;
        let mut last_status: Option<String> = None;
        // Track last-seen parsed signals to avoid duplicate emissions
        let mut last_page_seen: Option<(u32, u32)> = None; // (current, total)
        let mut last_chunk_seen: Option<(u32, u32)> = None; // (current, total)
        let mut chunk_info_sent: Option<(u32, u32)> = None; // (total_pages, total_chunks)

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            if let Some(session) = claude_service_clone.get_session(session_id).await {
                // Emit status/progress changes
                let status_str = format!("{:?}", session.status);
                if last_progress.map(|p| p != session.progress).unwrap_or(true)
                    || last_status.as_deref() != Some(&status_str)
                {
                    last_progress = Some(session.progress);
                    last_status = Some(status_str.clone());
                    let _ = tx
                        .send(SessionUpdate::Status {
                            status: session.status.clone(),
                            progress: session.progress,
                        })
                        .await;
                }

                // Check for new log lines
                if let Some(logs) = claude_service_clone
                    .get_session_logs(session_id, last_line_count)
                    .await
                {
                    for line in logs {
                        // Forward raw output
                        let _ = tx.send(SessionUpdate::Output { line: line.clone() }).await;

                        // Parse known progress markers from the line and forward structured updates
                        if let Some((tp, tc)) = parse_chunk_info(&line) {
                            if chunk_info_sent != Some((tp, tc)) {
                                chunk_info_sent = Some((tp, tc));
                                let _ = tx
                                    .send(SessionUpdate::ChunkInfo {
                                        total_pages: tp,
                                        total_chunks: tc,
                                    })
                                    .await;
                            }
                        } else if let Some((cur, total)) = parse_page_progress(&line) {
                            if last_page_seen != Some((cur, total)) {
                                last_page_seen = Some((cur, total));
                                let _ = tx
                                    .send(SessionUpdate::PageProgress {
                                        current_page: cur,
                                        total_pages: total,
                                    })
                                    .await;
                            }
                        } else if let Some((cur, total, ps, pe)) = parse_chunk_complete(&line) {
                            if last_chunk_seen != Some((cur, total)) {
                                last_chunk_seen = Some((cur, total));
                                let _ = tx
                                    .send(SessionUpdate::ChunkProgress {
                                        current_chunk: cur,
                                        total_chunks: total,
                                        pages_start: ps,
                                        pages_end: pe,
                                    })
                                    .await;
                            }
                        }
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
                SessionUpdate::PageProgress {
                    current_page,
                    total_pages,
                } => {
                    serde_json::json!({
                        "type": "page_progress",
                        "current_page": current_page,
                        "total_pages": total_pages,
                        "message": format!("Processing page {} of {}", current_page, total_pages)
                    })
                }
                SessionUpdate::ChunkInfo {
                    total_pages,
                    total_chunks,
                } => {
                    serde_json::json!({
                        "type": "chunk_info",
                        "total_pages": total_pages,
                        "total_chunks": total_chunks,
                        "message": format!("Script will be processed in {} chunks", total_chunks)
                    })
                }
                SessionUpdate::ChunkProgress {
                    current_chunk,
                    total_chunks,
                    pages_start,
                    pages_end,
                } => {
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

            if sender
                .send(axum::extract::ws::Message::Text(message.to_string()))
                .await
                .is_err()
            {
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

// Lightweight parsers for Claude output markers
fn parse_chunk_info(line: &str) -> Option<(u32, u32)> {
    // "[PROGRESS] Starting chunked parsing - Total pages: Y, Chunks: Z"
    if line.contains("Starting chunked parsing") {
        let tp = line.split("Total pages:").nth(1)?.trim();
        let tp_num = tp.split(',').next()?.trim().parse::<u32>().ok()?;
        let tc = line.split("Chunks:").nth(1)?.trim();
        let tc_num = tc.split_whitespace().next()?.trim().parse::<u32>().ok()?;
        return Some((tp_num, tc_num));
    }
    None
}

fn parse_page_progress(line: &str) -> Option<(u32, u32)> {
    // "[PROGRESS] Page X of Y processed"
    if let Some(start) = line.find("Page ") {
        let rest = &line[start + 5..];
        let parts: Vec<&str> = rest.split(" of ").collect();
        if parts.len() >= 2 {
            let cur = parts[0].trim().parse::<u32>().ok()?;
            let total_str = parts[1].split_whitespace().next()?;
            let total = total_str.trim().parse::<u32>().ok()?;
            return Some((cur, total));
        }
    }
    None
}

fn parse_chunk_complete(line: &str) -> Option<(u32, u32, u32, u32)> {
    // "[CHUNK_COMPLETE] Chunk X of Z processed (pages A-B)"
    if line.contains("[CHUNK_COMPLETE]") && line.contains("Chunk") {
        let cur = line
            .split("Chunk ")
            .nth(1)?
            .split_whitespace()
            .next()?
            .parse::<u32>()
            .ok()?;
        let total = line
            .split(" of ")
            .nth(1)?
            .split_whitespace()
            .next()?
            .parse::<u32>()
            .ok()?;
        let pages = line.split("(pages ").nth(1)?.split(')').next()?;
        let mut it = pages.split('-');
        let ps = it.next()?.trim().parse::<u32>().ok()?;
        let pe = it.next()?.trim().parse::<u32>().ok()?;
        return Some((cur, total, ps, pe));
    }
    None
}
