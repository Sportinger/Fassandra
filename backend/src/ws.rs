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

use crate::auth::WsAuthUser;
use crate::persistence_event::YjsPersistenceEvent;
use tokio::sync::mpsc::Sender as TokioMpscSender;
use yrs::sync::Message as YrsSyncMessage;
use yrs::updates::decoder::{Decode as YrsDecodeTrait, DecoderV1};
use yrs::encoding::read::Cursor as YrsIoCursor;
use anyhow;

// Constants for WebSocket timeouts
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(120);
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15); // Reduced to prevent y-websocket 30s timeout

/// Global broadcast channel for all WebSocket messages  
pub static GLOBAL_BROADCAST: Lazy<(Sender<(String, String, Vec<u8>)>, std::sync::Mutex<Option<Receiver<(String, String, Vec<u8>)>>>)> = Lazy::new(|| {
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
            Ok((broadcast_script_id, sender_user_id, data)) = rx.recv() => {
                // Only handle messages for this script - allow same user for y-websocket keepalive
                if broadcast_script_id == script_id {
                    tracing::debug!("Broadcasting message from user {} to session {} for script {} (same_user: {})", sender_user_id, session_id, script_id, sender_user_id == user_id);
                    if socket_tx.send(Message::Binary(data)).await.is_err() {
                        tracing::debug!("Failed to send broadcast message to session {}, connection likely closed", session_id);
                        break;
                    }
                }
            }
            
            // Handle client timeout
            _ = hb_interval.tick() => {
                if last_client_activity.elapsed() > CLIENT_TIMEOUT {
                    tracing::info!("Client timed out: {}", session_id);
                    break;
                }
                
                // Send WebSocket ping to check connection health
                // The 15s interval prevents y-websocket's 30s timeout by ensuring frequent activity
                if socket_tx.send(Message::Ping(vec![])).await.is_err() {
                    tracing::error!("Failed to send ping to client: {}", session_id);
                    break;
                }
                tracing::debug!("Sent ping to session {}", session_id);
            }
            
            // Process incoming messages
            Some(msg) = socket_rx.next() => {
                last_client_activity = tokio::time::Instant::now();
                
                let msg = match msg {
                    Ok(msg) => msg,
                    Err(e) => {
                        tracing::error!("Error receiving message: {}", e);
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
                        
                        let is_awareness = is_awareness_update(&bin);
                        tracing::debug!(
                            "Received binary update from session {}, size: {} bytes, awareness: {}, first 10 bytes hex: {}", 
                            session_id, 
                            bin.len(),
                            is_awareness,
                            hex::encode(&bin[..bin.len().min(10)])
                        );
                        
                        // Only persist real content updates, not awareness updates (cursor movements)
                        if !is_awareness {
                            if let Err(e) = persistence_event_tx.send(YjsPersistenceEvent {
                                script_id: script_id.clone(),
                                update_data: bin.clone(),
                                user_id: Some(Uuid::parse_str(&user_id).unwrap_or_else(|_| Uuid::nil())),
                                received_at: Utc::now(),
                            }).await {
                                tracing::error!("Error sending persistence event: {}", e);
                            }
                            tracing::info!("💾 Queued content update for script {} ({}bytes) - should trigger snapshotting soon", script_id, bin.len());
                        } else {
                            tracing::debug!("👁️ Skipped persisting awareness update for script {} ({}bytes)", script_id, bin.len());
                        }
                        
                        // Always broadcast to all other clients (including awareness updates for real-time cursors)
                        // Send to global broadcast channel - other clients will filter by script_id and user_id
                        let _ = GLOBAL_BROADCAST.0.send((script_id.clone(), user_id.clone(), bin.clone()));
                        tracing::debug!("Broadcasted message from user {} for script {} to global channel", user_id, script_id);
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
    session.clients.remove(&session_id);
    
    // If no clients left in the session, remove the session
    if session.clients.is_empty() {
        SESSIONS.remove(&script_id);
    }
    
    tracing::info!("WebSocket connection closed: {}", session_id);
} 