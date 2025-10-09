use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use chrono::Utc;
use dashmap::DashMap;
use futures_util::{sink::SinkExt, stream::StreamExt};
use hex;
use once_cell::sync::Lazy;
use sqlx::PgPool;
use std::process::Command;
use std::sync::Arc;
use tokio::sync::broadcast::{self, Receiver, Sender};
use tokio::sync::Mutex as TokioMutex;
use tokio::time::{interval, Duration};
use uuid::Uuid;

/// Get current process memory usage in MB
fn get_process_memory() -> f64 {
    if let Ok(output) = Command::new("ps")
        .args(&[
            "--no-headers",
            "-o",
            "rss",
            "-p",
            &std::process::id().to_string(),
        ])
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
use anyhow;
use tokio::sync::mpsc::Sender as TokioMpscSender;
use yrs::encoding::read::Cursor as YrsIoCursor;
use yrs::sync::Message as YrsSyncMessage;
use yrs::sync::Message as SyncEnvelope;
use yrs::sync::SyncMessage as SyncInnerMessage;
use yrs::sync::SyncMessage as YrsInnerSyncMessage;
use yrs::updates::decoder::{Decode as YrsDecodeTrait, DecoderV1};
use yrs::updates::encoder::Encode as YrsEncodeTrait;
use yrs::StateVector;

// Constants for WebSocket timeouts
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(300);
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15); // Reduced to prevent y-websocket 30s timeout

/// Global broadcast channel for all WebSocket messages  
/// Format: (script_id, sender_user_id, sender_session_id, data)
pub static GLOBAL_BROADCAST: Lazy<(
    Sender<(String, String, String, Vec<u8>)>,
    std::sync::Mutex<Option<Receiver<(String, String, String, Vec<u8>)>>>,
)> = Lazy::new(|| {
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
        tracing::trace!(
            "Detected awareness update via msg-type byte 0x04 (len={})",
            data.len()
        );
        return true;
    }

    // Slow-path fallback – fully decode to be safe for unknown variants.
    if let Ok(sync_message) = YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(data))) {
        if matches!(sync_message, YrsSyncMessage::Awareness(_)) {
            tracing::trace!(
                "Detected awareness update via full decode (len={})",
                data.len()
            );
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
pub async fn cleanup_inactive_sessions(
    inactive_threshold: chrono::Duration,
) -> Result<usize, anyhow::Error> {
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
                tracing::debug!(
                    "🧹 Removed inactive WebSocket session for script: {}",
                    script_id
                );
            } else {
                // If session became active again, put it back
                SESSIONS.insert(script_id.clone(), session);
                tracing::debug!(
                    "🔄 WebSocket session for script {} became active again, keeping it",
                    script_id
                );
            }
        }
    }

    let total_sessions = SESSIONS.len();
    tracing::info!(
        "🧹 WebSocket cleanup: removed {} inactive sessions, {} active sessions remain",
        removed_count,
        total_sessions
    );

    Ok(removed_count)
}

/// Entrypoint to create WebSocket routes
pub fn ws_routes(
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) -> Router<Arc<sqlx::PgPool>> {
    // Create a router with the WebSocket upgrade handler
    // We need to capture the persistence_event_tx in the handler closure since we can't use multiple states
    let handler = move |ws: WebSocketUpgrade,
                        Path(script_id): Path<String>,
                        State(pool): State<Arc<sqlx::PgPool>>,
                        auth_user: WsAuthUser| {
        ws_handler_with_deps(ws, script_id, pool, auth_user, persistence_event_tx.clone())
    };

    Router::new().route("/collab/:script_id", get(handler))
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

    tracing::info!(
        "WebSocket connection requested for script: {}, user: {}",
        script_id,
        user_id
    );

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
        "#,
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
        tracing::warn!(
            "User {} attempted to access script {} without permission",
            user_id,
            script_id
        );
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    tracing::info!(
        "User {} authorized for script {} - proceeding with WebSocket upgrade",
        user_id,
        script_id
    );

    // Upgrade the connection to a WebSocket
    // Remove protocol requirement for better Chrome compatibility
    // Chrome sometimes has issues with explicit protocol negotiation
    let pool_for_ws = pool.clone();
    ws.on_upgrade(move |socket| {
        tracing::info!(
            "WebSocket connection upgraded successfully for script: {}, user: {}",
            script_id,
            user_id
        );
        handle_socket(
            socket,
            script_id,
            user_id.to_string(),
            persistence_event_tx,
            pool_for_ws,
        )
    })
}

/// Handle an individual WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    script_id: String,
    user_id: String,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
    pool: Arc<PgPool>,
) {
    // Generate a unique session ID
    let session_id = Uuid::new_v4().to_string();

    tracing::info!(
        "Successfully established WebSocket connection for script: {}, user: {}, session: {}",
        script_id,
        user_id,
        session_id
    );

    // Subscribe to the global broadcast channel
    let mut rx = GLOBAL_BROADCAST.0.subscribe();

    // Get or create a session for this script
    let session = SESSIONS
        .entry(script_id.clone())
        .or_insert_with(|| Arc::new(Session::new()))
        .clone();

    // Add this client to the session
    session.clients.insert(session_id.clone(), user_id.clone());

    metrics::gauge!("collab_active_connections", "script_id" => script_id.clone()).increment(1.0);
    metrics::counter!("collab_ws_connections_total", "script_id" => script_id.clone()).increment(1);

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

                // Send ping frame for protocol-level keepalive
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
                        tracing::debug!("Received text message from session {}: {}", session_id, text);
                        metrics::counter!(
                            "collab_ws_messages_total",
                            "script_id" => script_id.clone(),
                            "kind" => "text"
                        )
                        .increment(1);
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
                        let kind_label = if is_awareness { "awareness" } else { "update" };
                        metrics::counter!(
                            "collab_ws_messages_total",
                            "script_id" => script_id.clone(),
                            "kind" => kind_label
                        )
                        .increment(1);
                        metrics::histogram!(
                            "collab_ws_message_bytes",
                            "script_id" => script_id.clone(),
                            "kind" => kind_label
                        )
                        .record(bin.len() as f64);

                        let mut broadcast_allowed = true;
                        if std::env::var("YJS_WS_SYNC").unwrap_or_default() == "on" {
                            if let Ok(sync_msg) = YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(&bin))) {
                                if let YrsSyncMessage::Sync(inner) = sync_msg {
                                    match inner {
                                        // Handshake messages should not be broadcast to other clients
                                        yrs::sync::SyncMessage::SyncStep1(client_sv) => {
                                            broadcast_allowed = false;
                                            // Reply with SyncStep2 (diff) to this client only
                                            use yrs::updates::encoder::Encode as _;
                                            let client_sv_bytes = client_sv.encode_v1();
                                            match crate::services::yjs_compaction_service::compute_diff_update(pool.as_ref(), uuid::Uuid::parse_str(&script_id).unwrap_or(uuid::Uuid::nil()), client_sv_bytes.as_slice()).await {
                                                Ok(diff) => {
                                                    let msg = yrs::sync::Message::Sync(yrs::sync::SyncMessage::SyncStep2(diff));
                                                    let payload = msg.encode_v1();
                                                    let _ = socket_tx.send(Message::Binary(payload)).await;
                                                    // handled this frame fully
                                                    continue;
                                                }
                                                Err(e) => {
                                                    tracing::error!("[WS_SYNC] Failed to compute diff: {}", e);
                                                }
                                            }
                                        }
                                        yrs::sync::SyncMessage::SyncStep2(_) => {
                                            broadcast_allowed = false; // also do not broadcast step2
                                        }
                                        // Updates are fine to broadcast
                                        yrs::sync::SyncMessage::Update(_) => {
                                            broadcast_allowed = true;
                                        }
                                        _ => { /* leave default */ }
                                    }
                                }
                            }
                        }
                        tracing::debug!(
                            "[WS_MSG_TYPE] session: {}, awareness: {}, first_50_hex: {}",
                            session_id,
                            is_awareness,
                            hex::encode(&bin[..bin.len().min(50)])
                        );

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
                                // Decode sync message and persist only raw Yjs Update payloads
                                let mut to_persist: Option<Vec<u8>> = None;
                                let mut decode_succeeded = false;
                                if let Ok(sync_msg) = YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(&bin))) {
                                    decode_succeeded = true;
                                    if let YrsSyncMessage::Sync(inner) = sync_msg {
                                        match inner {
                                            YrsInnerSyncMessage::Update(update) => {
                                                let bytes = update; // Already bytes in this yrs version
                                                tracing::info!("[WS_PERSIST_EXTRACT] Extracted Yjs Update payload ({} bytes) for script {}", bytes.len(), script_id);
                                                to_persist = Some(bytes);
                                            }
                                            YrsInnerSyncMessage::SyncStep2(update) => {
                                                // Client could send step2 in edge cases; persist update as well
                                                let bytes = update; // Already bytes in this yrs version
                                                tracing::info!("[WS_PERSIST_EXTRACT] Extracted SyncStep2 payload ({} bytes) for script {}", bytes.len(), script_id);
                                                to_persist = Some(bytes);
                                            }
                                            _ => {
                                                tracing::debug!("[WS_PERSIST_SKIP] Non-update sync message, skipping persistence");
                                            }
                                        }
                                    }
                                }

                                // Fallback: if decoding failed or yielded no payload but this isn't awareness,
                                // persist the raw binary frame to avoid data loss for variant frames.
                                // Only fallback if the frame could not be decoded at all (likely a raw Update),
                                // and it's not an awareness ping.
                                if to_persist.is_none() && !decode_succeeded && !is_awareness {
                                    tracing::debug!("[WS_PERSIST_FALLBACK] Persisting raw binary frame ({} bytes) for script {}", bin.len(), script_id);
                                    to_persist = Some(bin.clone());
                                }

                                if let Some(update_bytes) = to_persist {
                                    tracing::info!("[WS_PERSIST_START] script: {}, update_size: {} bytes, session: {}, user: {}",
                                                   script_id, update_bytes.len(), session_id, user_id);
                                    if let Err(e) = persistence_event_tx.send(YjsPersistenceEvent {
                                        script_id: script_id.clone(),
                                        update_data: update_bytes,
                                        user_id: Some(Uuid::parse_str(&user_id).unwrap_or_else(|_| Uuid::nil())),
                                        received_at: Utc::now(),
                                    }).await {
                                        tracing::error!("[WS_PERSIST_ERROR] Failed to send persistence event: {}", e);
                                    } else {
                                        let after_mem = get_process_memory();
                                        tracing::info!("[WS_PERSIST_QUEUED] script: {}, memory_delta: {} MB",
                                                       script_id, after_mem - before_mem);
                                        metrics::counter!(
                                            "collab_ws_persist_events_total",
                                            "script_id" => script_id.clone()
                                        )
                                        .increment(1);
                                    }
                                } else {
                                    tracing::debug!("[WS_PERSIST_NONE] No update payload extracted; not persisting this frame");
                                }
                            }
                        else {
                            tracing::debug!("[WS_AWARENESS_SKIP] script: {}, size: {} bytes", script_id, bin.len());
                        }

                        // Always broadcast to all other clients (including awareness updates for real-time cursors)
                        // Send to global broadcast channel - other clients will filter by script_id and session_id
                        // Including session_id prevents echo-back to sender which causes flickering
                        if broadcast_allowed { let _ = GLOBAL_BROADCAST.0.send((script_id.clone(), user_id.clone(), session_id.clone(), bin.clone())); }
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
    tracing::info!(
        "WebSocket cleanup starting for session: {}, script: {}, user: {}",
        session_id,
        script_id,
        user_id
    );

    // Remove this client from the session
    if let Some((removed_session_id, removed_user_id)) = session.clients.remove(&session_id) {
        tracing::info!(
            "Removed client session {} (user: {}) from script {}",
            removed_session_id,
            removed_user_id,
            script_id
        );
        metrics::gauge!("collab_active_connections", "script_id" => script_id.clone())
            .decrement(1.0);
    } else {
        tracing::warn!(
            "Session {} was already removed from script {}",
            session_id,
            script_id
        );
    }

    // Log remaining clients
    let remaining_clients = session.clients.len();
    tracing::info!(
        "Script {} has {} remaining clients after removing session {}",
        script_id,
        remaining_clients,
        session_id
    );

    // If no clients left in the session, remove the session from global map
    if remaining_clients == 0 {
        tracing::info!(
            "No clients remaining for script {}, removing session from global map",
            script_id
        );
        if let Some((removed_script_id, removed_session)) = SESSIONS.remove(&script_id) {
            let final_client_count = removed_session.clients.len();
            tracing::info!(
                "Successfully removed session for script {} (final client count: {})",
                removed_script_id,
                final_client_count
            );
        } else {
            tracing::warn!(
                "Session for script {} was already removed from global map",
                script_id
            );
        }
    } else {
        // Log who's still connected
        let connected_users: Vec<String> = session
            .clients
            .iter()
            .map(|entry| format!("session={}, user={}", entry.key(), entry.value()))
            .collect();
        tracing::info!(
            "Script {} still has active connections: [{}]",
            script_id,
            connected_users.join(", ")
        );
    }

    tracing::info!(
        "WebSocket connection closed: session={}, script={}, user={}",
        session_id,
        script_id,
        user_id
    );
}
