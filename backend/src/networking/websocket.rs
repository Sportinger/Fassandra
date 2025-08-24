use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path,
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{
    sink::SinkExt,
    stream::StreamExt
};
use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tokio::sync::broadcast::{self, Sender, Receiver};
use uuid::Uuid;
use tokio::time::{interval, Duration};
use chrono::Utc;
use dashmap::DashMap;
use hex;
use std::process::Command;

/// Get current process memory usage in MB
fn get_process_memory() -> f64 {
    if let Ok(output) = Command::new("ps")
        .args(&["--no-headers", "-o", "rss", "-p", &std::process::id().to_string()])
        .output()
    {
        if let Ok(rss_str) = String::from_utf8(output.stdout) {
            if let Ok(rss_kb) = rss_str.trim().parse::<f64>() {
                return rss_kb / 1024.0; // Convert KB to MB
            }
        }
    }
    0.0
}

use crate::auth::WsAuthUser;
use crate::services::persistence_event::YjsPersistenceEvent;
use tokio::sync::mpsc::Sender as TokioMpscSender;
use yrs::sync::Message as YrsSyncMessage;
use yrs::updates::decoder::{Decode as YrsDecodeTrait, DecoderV1};
use yrs::encoding::read::Cursor as YrsIoCursor;
use anyhow;

// Constants for WebSocket timeouts
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(120);
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15); // Reduced to prevent y-websocket 30s timeout

/// Global broadcast channel for all WebSocket messages  
/// Format: (script_id, sender_user_id, sender_session_id, data)
pub static GLOBAL_BROADCAST: Lazy<(Sender<(String, String, String, Vec<u8>)>, std::sync::Mutex<Option<Receiver<(String, String, String, Vec<u8>)>>>)> = Lazy::new(|| {
    let (tx, rx) = broadcast::channel(1000);
    (tx, std::sync::Mutex::new(Some(rx))) // Keep the first receiver alive but unused
});

/// Check if a binary message is an awareness update that should not be persisted
fn is_awareness_update(data: &[u8]) -> bool {
    if data.is_empty() {
        return false;
    }
    
    // Fast-path: according to y-protocol, message type 0x04 == Awareness
    // This catches the typical tiny 4-10 byte awareness pings and avoids an
    // expensive full decode on every single one.
    if data[0] == 4 {
        tracing::trace!("Detected awareness update via msg-type byte 0x04 (len={})", data.len());
                    return true;
    }
    
    // Slow-path fallback – fully decode to be safe for unknown variants.
    if let Ok(sync_message) = YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(data))) {
        if matches!(sync_message, YrsSyncMessage::Awareness(_)) {
            tracing::trace!("Detected awareness update via full decode (len={})", data.len());
                return true;
        }
        // Any other valid SyncMessage is considered content.
        return false;
    }
    
    // Couldn’t decode → assume it’s content to avoid data loss.
    false
}

/// WebSocket session state keyed by script_id
pub static SESSIONS: Lazy<DashMap<String, Arc<Session>>> = Lazy::new(|| DashMap::new());

/// Session structure - stores clients connected to a specific script
pub struct Session {
    /// Tracks active client session IDs (not user_id)
    pub clients: DashMap<String, String>, // session_id -> user_id
    /// Last activity timestamp to track script activity
    pub last_activity: TokioMutex<chrono::DateTime<Utc>>,
}

impl Session {
    /// Create a new empty session
    pub fn new() -> Self {
        Self {
            clients: DashMap::new(),
            last_activity: TokioMutex::new(Utc::now()),
        }
    }

    /// Update the last activity timestamp
    pub async fn update_activity(&self) {
        let mut last_activity = self.last_activity.lock().await;
        *last_activity = Utc::now();
    }
    
    /// Check if the session is inactive (no activity for more than the threshold)
    pub async fn is_inactive(&self, threshold: chrono::Duration) -> bool {
        let last_activity = self.last_activity.lock().await;
        Utc::now().signed_duration_since(*last_activity) > threshold
    }
}

/// Cleans up inactive WebSocket sessions to prevent memory leaks.
/// This function should be called periodically to remove sessions that haven't been active.
///
/// # Arguments
/// * `inactive_threshold` - Duration after which a session is considered inactive
///
/// # Returns
/// * `Result<usize>` - Number of sessions removed
pub async fn cleanup_inactive_sessions(inactive_threshold: chrono::Duration) -> Result<usize, anyhow::Error> {
    let mut removed_count = 0;
    let mut sessions_to_remove = Vec::new();
    
    // First pass: identify sessions to remove
    for entry in SESSIONS.iter() {
        let script_id = entry.key();
        let session = entry.value();
        
        // Check if session is inactive and has no clients
        if session.clients.is_empty() || session.is_inactive(inactive_threshold).await {
            sessions_to_remove.push(script_id.clone());
        }
    }
    
    // Second pass: remove identified sessions
    for script_id in sessions_to_remove {
        if let Some((_, session)) = SESSIONS.remove(&script_id) {
            // Double-check if session is still empty/inactive before removing
            if session.clients.is_empty() || session.is_inactive(inactive_threshold).await {
                removed_count += 1;
                tracing::debug!("🧹 Removed inactive WebSocket session for script: {}", script_id);
            } else {
                // If session became active again, put it back
                SESSIONS.insert(script_id.clone(), session);
                tracing::debug!("🔄 WebSocket session for script {} became active again, keeping it", script_id);
            }
        }
    }
    
    let total_sessions = SESSIONS.len();
    tracing::info!("🧹 WebSocket cleanup: removed {} inactive sessions, {} active sessions remain", 
                   removed_count, total_sessions);
    
    Ok(removed_count)
}

/// Entrypoint to create WebSocket routes
pub fn ws_routes(persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>) -> Router<Arc<sqlx::PgPool>> {
    // Create a router with the WebSocket upgrade handler
    // We need to capture the persistence_event_tx in the handler closure since we can't use multiple states
    let handler = move |ws: WebSocketUpgrade, 
                        Path(script_id): Path<String>,
                        State(pool): State<Arc<sqlx::PgPool>>,
                        auth_user: WsAuthUser| {
        ws_handler_with_deps(ws, script_id, pool, auth_user, persistence_event_tx.clone())
    };
    
    Router::new()
        .route("/collab/:script_id", get(handler))
}

/// Handle WebSocket connections
pub async fn ws_handler_with_deps(
    ws: WebSocketUpgrade,
    script_id: String,
    pool: Arc<sqlx::PgPool>,
    auth_user: WsAuthUser,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    
    tracing::info!("WebSocket connection requested for script: {}, user: {}", script_id, user_id);
    
    // 🔒 CRITICAL SECURITY: Verify user has access to this script before WebSocket upgrade
    let script_uuid = match Uuid::parse_str(&script_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            tracing::warn!("Invalid script ID format: {}", script_id);
            return (StatusCode::BAD_REQUEST, "Invalid script ID").into_response();
        }
    };
    
    // Check if user has access to this script (owns it, it's public, or it's shared with them)
    let has_access = match sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM scripts s
            WHERE s.id = $1 
            AND (
                s.created_by = $2           -- User owns the script
                OR s.is_public = true       -- Script is public
                OR EXISTS (                 -- Script is shared with user
                    SELECT 1 FROM script_shares ss 
                    WHERE ss.script_id = s.id 
                    AND ss.shared_with_user_id = $2
                )
            )
        )
        "#
    )
    .bind(script_uuid)
    .bind(user_id)
    .fetch_one(pool.as_ref())
    .await
    {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Database error checking script access: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response();
        }
    };
    
    if !has_access {
        tracing::warn!("User {} attempted to access script {} without permission", user_id, script_id);
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }
    
    tracing::info!("User {} authorized for script {} - proceeding with WebSocket upgrade", user_id, script_id);
    
    // Upgrade the connection to a WebSocket
    // Remove protocol requirement for better Chrome compatibility
    // Chrome sometimes has issues with explicit protocol negotiation
    ws.on_upgrade(move |socket| {
          tracing::info!("WebSocket connection upgraded successfully for script: {}, user: {}", script_id, user_id);
          handle_socket(socket, script_id, user_id.to_string(), persistence_event_tx)
      })
}

/// Handle an individual WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    script_id: String,
    user_id: String,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) {
    // Generate a unique session ID
    let session_id = Uuid::new_v4().to_string();
    
    tracing::info!("Successfully established WebSocket connection for script: {}, user: {}, session: {}", 
                 script_id, user_id, session_id);
    
    // Subscribe to the global broadcast channel
    let mut rx = GLOBAL_BROADCAST.0.subscribe();
    
    // Get or create a session for this script
    let session = SESSIONS
        .entry(script_id.clone())
        .or_insert_with(|| Arc::new(Session::new()))
        .clone();
    
    // Add this client to the session
    session.clients.insert(session_id.clone(), user_id.clone());
    
    // Split the socket
    let (mut socket_tx, mut socket_rx) = socket.split();
    
    // Set up heartbeat for this connection
    let mut hb_interval = interval(HEARTBEAT_INTERVAL);
    let mut last_client_activity = tokio::time::Instant::now();
    
    // Update session activity
    session.update_activity().await;
    
    // Process incoming messages and broadcast messages
    loop {
        tokio::select! {
            // Handle broadcast messages from other clients  
            Ok((broadcast_script_id, sender_user_id, sender_session_id, data)) = rx.recv() => {
                // Only handle messages for this script AND not from the same session
                // This prevents echoing back the sender's own messages which causes flickering
                if broadcast_script_id == script_id && sender_session_id != session_id {
                    tracing::debug!("Relaying message from session {} (user {}) to session {} (user {}) for script {}", 
                                   sender_session_id, sender_user_id, session_id, user_id, script_id);
                    if socket_tx.send(Message::Binary(data)).await.is_err() {
                        tracing::debug!("Failed to send broadcast message to session {}, connection likely closed", session_id);
                        break;
                    }
                } else if sender_session_id == session_id {
                    tracing::trace!("Skipping echo-back to sender session {} for script {}", session_id, script_id);
                }
            }
            
            // Handle client timeout
            _ = hb_interval.tick() => {
                if last_client_activity.elapsed() > CLIENT_TIMEOUT {
                    tracing::info!("Client timed out: {}", session_id);
                    break;
                }
                
                // Send both ping frame AND a heartbeat message
                // The ping frame checks connection at protocol level
                // The heartbeat message updates y-websocket's wsLastMessageReceived to prevent 30s timeout
                
                // Send ping frame for protocol-level keepalive
                if socket_tx.send(Message::Ping(vec![])).await.is_err() {
                    tracing::error!("Failed to send ping to client: {}", session_id);
                    break;
                }
                
                // Send empty binary message as heartbeat for y-websocket
                // This will update wsLastMessageReceived and prevent the 30-second disconnect
                // Using an empty Yjs update (sync step 2 message) which is harmless
                let heartbeat = vec![0x00, 0x00]; // Yjs sync step 2 with empty content
                if socket_tx.send(Message::Binary(heartbeat)).await.is_err() {
                    tracing::error!("Failed to send heartbeat to client: {}", session_id);
                    break;
                }
                tracing::debug!("Sent ping and heartbeat to session {}", session_id);
            }
            
            // Process incoming messages
            Some(msg) = socket_rx.next() => {
                last_client_activity = tokio::time::Instant::now();
                
                let msg = match msg {
                    Ok(msg) => msg,
                    Err(e) => {
                        // Connection reset happens during reconnection cycles
                        if e.to_string().contains("Connection reset") {
                            tracing::info!("WebSocket disconnected (likely reconnecting): {}", e);
                        } else {
                            tracing::error!("Error receiving WebSocket message: {}", e);
                        }
                        break;
                    }
                };
                
                match msg {
                    Message::Text(text) => {
                        // Handle text message - typically chat or control messages
                        tracing::debug!("Received text message from session {}: {}", session_id, text);
                    }
                    
                    Message::Binary(bin) => {
                        // This is a Yjs update message
                        session.update_activity().await;
                        
                        // Get memory before processing
                        let before_mem = get_process_memory();
                        tracing::info!("[WS_MSG_RECEIVED] session: {}, script: {}, size: {}, memory_before: {} MB",
                                       session_id, script_id, bin.len(), before_mem);
                        
                        // Add size validation
                        const MAX_WEBSOCKET_MESSAGE_SIZE: usize = 5_000_000; // 5MB max
                        if bin.len() > MAX_WEBSOCKET_MESSAGE_SIZE {
                            tracing::error!(
                                "[WS_MSG_TOO_LARGE] session: {}, size: {} bytes (max: {}), first_100_hex: {}", 
                                session_id,
                                bin.len(), 
                                MAX_WEBSOCKET_MESSAGE_SIZE,
                                hex::encode(&bin[..bin.len().min(100)])
                            );
                            // Send error back to client
                            let _ = socket_tx.send(Message::Text("Error: Message too large".to_string())).await;
                            continue; // Skip processing this message
                        }
                        
                        let is_awareness = is_awareness_update(&bin);
                        tracing::debug!(
                            "[WS_MSG_TYPE] session: {}, awareness: {}, first_50_hex: {}", 
                            session_id, 
                            is_awareness,
                            hex::encode(&bin[..bin.len().min(50)])
                        );
                        
                        // Only persist real content updates, not awareness updates (cursor movements)
                        if !is_awareness {
                            // Log full content for small updates that might be problematic
                            if bin.len() <= 100 {
                                tracing::debug!("[WS_CONTENT_FULL] script: {}, size: {}, full_hex: {}", 
                                              script_id, bin.len(), hex::encode(&bin));
                            }
                            
                            // Analyze the binary structure
                            let should_persist = if bin.len() >= 1 {
                                let msg_type = bin[0];
                                let msg_subtype = if bin.len() > 1 { Some(bin[1]) } else { None };
                                tracing::info!("[WS_CONTENT_TYPE] script: {}, msg_type: {:#04x}, subtype: {:?}", 
                                              script_id, msg_type, msg_subtype.map(|b| format!("{:#04x}", b)));
                                
                                // FIX: Persist all YJS updates except awareness
                                // The previous logic was too restrictive and filtered out legitimate updates
                                // YJS updates can have various binary formats, not just type 0x00 subtype 0x02
                                // Solution: Simply persist everything that isn't an awareness update
                                tracing::info!(
                                    "[WS_UPDATE] Persisting YJS update - script: {}, size: {}, type: {:#04x}",
                                    script_id, bin.len(), msg_type
                                );
                                true
                            } else {
                                // Empty message - don't persist
                                tracing::debug!("[WS_EMPTY_MESSAGE] Skipping empty message");
                                false
                            };
                            
                            if should_persist {
                                tracing::error!("[WS_PERSIST_START] script: {}, size: {} bytes, session: {}, user: {}", 
                                              script_id, bin.len(), session_id, user_id);
                                
                                if let Err(e) = persistence_event_tx.send(YjsPersistenceEvent {
                                    script_id: script_id.clone(),
                                    update_data: bin.clone(),
                                    user_id: Some(Uuid::parse_str(&user_id).unwrap_or_else(|_| Uuid::nil())),
                                    received_at: Utc::now(),
                                }).await {
                                    tracing::error!("[WS_PERSIST_ERROR] Failed to send persistence event: {}", e);
                                } else {
                                    let after_mem = get_process_memory();
                                    tracing::error!("[WS_PERSIST_QUEUED] script: {}, size: {}, memory_delta: {} MB", 
                                                  script_id, bin.len(), after_mem - before_mem);
                                }
                            }
                        } else {
                            tracing::debug!("[WS_AWARENESS_SKIP] script: {}, size: {} bytes", script_id, bin.len());
                        }
                        
                        // Always broadcast to all other clients (including awareness updates for real-time cursors)
                        // Send to global broadcast channel - other clients will filter by script_id and session_id
                        // Including session_id prevents echo-back to sender which causes flickering
                        let _ = GLOBAL_BROADCAST.0.send((script_id.clone(), user_id.clone(), session_id.clone(), bin.clone()));
                        tracing::debug!("Broadcasted message from session {} (user {}) for script {} to global channel", session_id, user_id, script_id);
                    }
                    
                    Message::Ping(data) => {
                        tracing::debug!("Received ping from session {}", session_id);
                        // Respond to ping with pong
                        if socket_tx.send(Message::Pong(data)).await.is_err() {
                            tracing::error!("Failed to send pong to client: {}", session_id);
                            break;
                        }
                    }
                    
                    Message::Pong(_) => {
                        // Client responded to our ping
                        tracing::debug!("Received pong from session {}", session_id);
                    }
                    
                    Message::Close(_) => {
                        tracing::info!("Received close message from session {}", session_id);
                        break;
                    }
                }
            }
            
            // If no message for too long, break the loop
            else => break,
        }
    }
    
    // Clean up when done
    tracing::info!("WebSocket cleanup starting for session: {}, script: {}, user: {}", 
                  session_id, script_id, user_id);
    
    // Remove this client from the session
    if let Some((removed_session_id, removed_user_id)) = session.clients.remove(&session_id) {
        tracing::info!("Removed client session {} (user: {}) from script {}", 
                      removed_session_id, removed_user_id, script_id);
    } else {
        tracing::warn!("Session {} was already removed from script {}", session_id, script_id);
    }
    
    // Log remaining clients
    let remaining_clients = session.clients.len();
    tracing::info!("Script {} has {} remaining clients after removing session {}", 
                  script_id, remaining_clients, session_id);
    
    // If no clients left in the session, remove the session from global map
    if remaining_clients == 0 {
        tracing::info!("No clients remaining for script {}, removing session from global map", script_id);
        if let Some((removed_script_id, removed_session)) = SESSIONS.remove(&script_id) {
            let final_client_count = removed_session.clients.len();
            tracing::info!("Successfully removed session for script {} (final client count: {})", 
                          removed_script_id, final_client_count);
        } else {
            tracing::warn!("Session for script {} was already removed from global map", script_id);
        }
    } else {
        // Log who's still connected
        let connected_users: Vec<String> = session.clients.iter()
            .map(|entry| format!("session={}, user={}", entry.key(), entry.value()))
            .collect();
        tracing::info!("Script {} still has active connections: [{}]", 
                      script_id, connected_users.join(", "));
    }
    
    tracing::info!("WebSocket connection closed: session={}, script={}, user={}", 
                  session_id, script_id, user_id);
} 