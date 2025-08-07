# 🔄 Real-time Collaboration

Comprehensive documentation for Pessoa's real-time collaborative editing system using WebSockets and YJS.

## 🎯 Overview

Pessoa's real-time collaboration is built on YJS (Yjs) - a mature CRDT (Conflict-free Replicated Data Type) that enables seamless collaborative editing. The system handles multiple users editing the same script simultaneously with automatic conflict resolution and real-time synchronization.

## 🏗️ Architecture Components

### 🔗 Core Technologies

| Technology | Purpose | Role |
|------------|---------|------|
| **YJS (Y.js)** | CRDT implementation | Conflict-free collaborative editing |
| **WebSocket** | Real-time communication | Low-latency message transport |
| **TipTap** | Rich text editor | User interface for editing |
| **Tokio** | Async runtime | Backend WebSocket handling |
| **PostgreSQL** | Persistence layer | Store YJS updates and snapshots |

### 📊 System Flow

```
User A Editor  ←→  YJS Provider  ←→  WebSocket  ←→  Backend  ←→  Database
                                        ↕
User B Editor  ←→  YJS Provider  ←→  WebSocket  ←→  Backend  ←→  Database
                                        ↕
User C Editor  ←→  YJS Provider  ←→  WebSocket  ←→  Backend  ←→  Database
```

## 🔧 Frontend Implementation

### 🎭 YJS Document Setup

```typescript
// Document initialization with proper fragment structure
const ydoc = new Y.Doc();

// Bootstrap document with expected fragments
const initializeYjsFragments = () => {
  const fragmentNames = ['default', 'content', 'prosemirror'];
  
  fragmentNames.forEach(name => {
    // Create both XML fragments and text nodes
    ydoc.getXmlFragment(name);
    ydoc.getText(name);
  });
};

// WebSocket provider configuration
const provider = new WebsocketProvider(
  `wss://pessoa.theater/api/collab/${scriptId}`,
  scriptId,
  ydoc,
  {
    params: { token }, // JWT authentication
    awareness: new awarenessProtocol.Awareness(ydoc),
    maxBackoffTime: 5000,
    disableBc: true, // Disable broadcast channel
  }
);
```

### 🔄 TipTap Editor Integration

```typescript
// TipTap editor with YJS collaboration extensions
const editor = useEditor({
  extensions: [
    StarterKit,
    
    // Core collaboration extensions
    Collaboration.configure({
      document: ydoc,
    }),
    
    CollaborationCursor.configure({
      provider: provider,
      user: {
        name: user?.username || 'Anonymous',
        color: generateUserColor(user?.id),
      },
    }),
    
    // Custom Pessoa extensions
    DialogueBlock,
    Speaker,
    
    // History for undo/redo
    History.configure({
      depth: 100,
      newGroupDelay: 500,
    }),
  ],
  
  // Content loading
  content: '<p>Loading...</p>',
  
  // Event handlers
  onCreate: ({ editor }) => {
    // Editor ready, start collaboration
    setEditorReady(true);
  },
  
  onUpdate: ({ editor }) => {
    // Content changed, update will be automatically synced
    debouncedContentSnapshot(editor.getHTML());
  },
}, [ydoc, provider]); // Re-create when YJS setup changes
```

### 👁️ Awareness System

```typescript
// Track user cursors and selections
const useCollaborationAwareness = (provider: WebsocketProvider | null) => {
  const [activeUsers, setActiveUsers] = useState<Map<number, any>>(new Map());
  
  useEffect(() => {
    if (!provider?.awareness) return;
    
    const awareness = provider.awareness;
    
    const updateAwareness = () => {
      const states = awareness.getStates();
      setActiveUsers(new Map(states));
    };
    
    // Listen for awareness changes
    awareness.on('change', updateAwareness);
    updateAwareness(); // Initial state
    
    return () => {
      awareness.off('change', updateAwareness);
    };
  }, [provider]);
  
  // Count active users (excluding self)
  const activeUserCount = Math.max(0, activeUsers.size - 1);
  
  return { activeUsers, activeUserCount };
};
```

## 🛠️ Backend Implementation

### 🔗 WebSocket Handler

```rust
/// WebSocket connection handler with comprehensive error handling
pub async fn ws_handler_with_deps(
    ws: WebSocketUpgrade,
    Path(script_id): Path<String>,
    State(pool): State<Arc<PgPool>>,
    auth_user: WsAuthUser,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) -> impl IntoResponse {
    let user_id = auth_user.user_id;
    
    // 🔒 CRITICAL SECURITY: Verify script access before WebSocket upgrade
    let script_uuid = match Uuid::parse_str(&script_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid script ID").into_response();
        }
    };
    
    // Check user permissions (owns, public, or shared)
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
        tracing::warn!("User {} denied access to script {}", user_id, script_id);
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }
    
    // Upgrade to WebSocket
    ws.on_upgrade(move |socket| {
        handle_socket(socket, script_id, user_id.to_string(), persistence_event_tx)
    })
}
```

### 📡 Message Broadcasting System

```rust
/// Global broadcast channel for real-time collaboration
/// Format: (script_id, user_id, message_data)
pub static GLOBAL_BROADCAST: Lazy<(
    Sender<(String, String, Vec<u8>)>,
    std::sync::Mutex<Option<Receiver<(String, String, Vec<u8>)>>>
)> = Lazy::new(|| {
    let (tx, rx) = broadcast::channel(1000);
    (tx, std::sync::Mutex::new(Some(rx)))
});

/// Session management for tracking active connections
pub static SESSIONS: Lazy<DashMap<String, Arc<Session>>> = Lazy::new(|| DashMap::new());

#[derive(Debug)]
pub struct Session {
    /// Active client connections (session_id -> user_id)
    pub clients: DashMap<String, String>,
    /// Last activity timestamp for cleanup
    pub last_activity: TokioMutex<chrono::DateTime<Utc>>,
}

impl Session {
    pub fn new() -> Self {
        Self {
            clients: DashMap::new(),
            last_activity: TokioMutex::new(Utc::now()),
        }
    }
    
    pub async fn update_activity(&self) {
        *self.last_activity.lock().await = Utc::now();
    }
}
```

### 🔄 Message Processing

```rust
/// Handle individual WebSocket connection with proper cleanup
async fn handle_socket(
    socket: WebSocket,
    script_id: String,
    user_id: String,
    persistence_event_tx: TokioMpscSender<YjsPersistenceEvent>,
) {
    let session_id = Uuid::new_v4().to_string();
    
    // Subscribe to global broadcast
    let mut rx = GLOBAL_BROADCAST.0.subscribe();
    
    // Register in session
    let session = SESSIONS
        .entry(script_id.clone())
        .or_insert_with(|| Arc::new(Session::new()))
        .clone();
    
    session.clients.insert(session_id.clone(), user_id.clone());
    session.update_activity().await;
    
    // Split socket for concurrent read/write
    let (mut socket_tx, mut socket_rx) = socket.split();
    
    // Heartbeat timer
    let mut heartbeat_interval = interval(HEARTBEAT_INTERVAL);
    let mut last_client_activity = tokio::time::Instant::now();
    
    loop {
        tokio::select! {
            // Handle broadcast messages from other clients
            Ok((broadcast_script_id, sender_user_id, data)) = rx.recv() => {
                // Only forward messages for this script
                if broadcast_script_id == script_id {
                    if socket_tx.send(Message::Binary(data)).await.is_err() {
                        tracing::debug!("Client {} disconnected during broadcast", session_id);
                        break;
                    }
                }
            }
            
            // Handle client timeout
            _ = heartbeat_interval.tick() => {
                if last_client_activity.elapsed() > CLIENT_TIMEOUT {
                    tracing::info!("Client {} timed out", session_id);
                    break;
                }
                
                // Send ping to keep connection alive
                if socket_tx.send(Message::Ping(vec![])).await.is_err() {
                    tracing::debug!("Failed to ping client {}", session_id);
                    break;
                }
            }
            
            // Process incoming messages
            Some(msg) = socket_rx.next() => {
                last_client_activity = tokio::time::Instant::now();
                
                match msg {
                    Ok(Message::Binary(data)) => {
                        session.update_activity().await;
                        
                        // Distinguish between awareness and content updates
                        let is_awareness = is_awareness_update(&data);
                        
                        // Only persist content updates (not cursor movements)
                        if !is_awareness {
                            if let Err(e) = persistence_event_tx.send(YjsPersistenceEvent {
                                script_id: script_id.clone(),
                                update_data: data.clone(),
                                user_id: Some(Uuid::parse_str(&user_id).unwrap_or_else(|_| Uuid::nil())),
                                received_at: Utc::now(),
                            }).await {
                                tracing::error!("Failed to queue persistence event: {}", e);
                            }
                        }
                        
                        // Always broadcast to other clients
                        let _ = GLOBAL_BROADCAST.0.send((script_id.clone(), user_id.clone(), data));
                    }
                    
                    Ok(Message::Ping(data)) => {
                        // Respond to ping
                        if socket_tx.send(Message::Pong(data)).await.is_err() {
                            break;
                        }
                    }
                    
                    Ok(Message::Pong(_)) => {
                        // Client responded to our ping
                        tracing::trace!("Received pong from {}", session_id);
                    }
                    
                    Ok(Message::Close(_)) => {
                        tracing::info!("Client {} requested close", session_id);
                        break;
                    }
                    
                    Ok(Message::Text(text)) => {
                        tracing::debug!("Received text message: {}", text);
                        // Handle text messages if needed
                    }
                    
                    Err(e) => {
                        tracing::error!("WebSocket error for {}: {}", session_id, e);
                        break;
                    }
                }
            }
            
            // Exit if no more messages
            else => break,
        }
    }
    
    // Cleanup on disconnect
    session.clients.remove(&session_id);
    if session.clients.is_empty() {
        SESSIONS.remove(&script_id);
        tracing::debug!("Removed empty session for script {}", script_id);
    }
    
    tracing::info!("WebSocket connection closed: {}", session_id);
}
```

### 🎯 Awareness vs Content Detection

```rust
/// Detect if binary message is awareness update (cursor/selection)
/// Awareness updates should not be persisted, only broadcast
fn is_awareness_update(data: &[u8]) -> bool {
    if data.is_empty() {
        return false;
    }
    
    // Fast-path: YJS awareness messages have type byte 0x04
    if data[0] == 4 {
        return true;
    }
    
    // Slow-path: decode and check message type
    if let Ok(sync_message) = YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(data))) {
        matches!(sync_message, YrsSyncMessage::Awareness(_))
    } else {
        false // Assume content if can't decode
    }
}
```

## 💾 Persistence Strategy

### 🔄 Dual Persistence System

Pessoa uses two complementary persistence mechanisms:

1. **YJS Updates**: Binary operation log for precise reconstruction
2. **Content Snapshots**: HTML content for reliability and recovery

```rust
/// Async database writer for YJS updates
pub async fn run_async_db_writer(
    mut rx: mpsc::Receiver<YjsPersistenceEvent>,
    pool: PgPool,
) {
    tracing::info!("Async DB Writer service started");
    
    while let Some(event) = rx.recv().await {
        match save_yjs_update(&pool, &event).await {
            Ok(_) => {
                tracing::debug!("Saved YJS update for script {} ({}B)", 
                    event.script_id, event.update_data.len());
            }
            Err(e) => {
                tracing::error!("CRITICAL: Failed to save YJS update for {}: {}", 
                    event.script_id, e);
            }
        }
    }
    
    tracing::info!("Async DB Writer service stopped");
}

async fn save_yjs_update(
    pool: &PgPool,
    event: &YjsPersistenceEvent,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let script_id = Uuid::parse_str(&event.script_id)?;
    
    sqlx::query!(
        "INSERT INTO yjs_document_updates (script_id, user_id, update_data, created_at) 
         VALUES ($1, $2, $3, $4)",
        script_id,
        event.user_id,
        &event.update_data,
        event.received_at
    )
    .execute(pool)
    .await?;
    
    Ok(())
}
```

### 📸 High-Frequency Snapshotting

```rust
/// Snapshotting service that runs every 500ms for real-time content preservation
pub async fn run_snapshotting_service(
    pool: Arc<PgPool>,
    interval: Duration,
) {
    let mut interval_timer = tokio::time::interval(interval);
    
    loop {
        interval_timer.tick().await;
        
        // Find scripts with unprocessed YJS updates
        match get_scripts_needing_snapshots(&pool).await {
            Ok(scripts) => {
                for script_id in scripts {
                    if let Err(e) = create_snapshot_for_script(&pool, script_id).await {
                        tracing::error!("Snapshot failed for {}: {}", script_id, e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to get scripts for snapshotting: {}", e);
            }
        }
    }
}

/// Reconstruct YJS document from updates and create HTML snapshot
async fn create_snapshot_for_script(
    pool: &Arc<PgPool>,
    script_id: Uuid,
) -> Result<(), anyhow::Error> {
    // Get all unprocessed updates
    let updates = get_yjs_updates_since_last_snapshot(pool, script_id).await?;
    
    if updates.is_empty() {
        return Ok(()); // No new updates
    }
    
    // Create fresh YJS document
    let doc = Doc::new();
    
    // Bootstrap with expected fragments (critical for proper reconstruction)
    {
        let mut txn = doc.transact_mut();
        for name in ["default", "content", "prosemirror"] {
            txn.get_or_insert_xml_fragment(name);
            txn.get_or_insert_text(name);
        }
    }
    
    // Apply all updates in order
    {
        let mut txn = doc.transact_mut();
        for update in &updates {
            match Update::decode_v1(&update.update_data) {
                Ok(decoded_update) => {
                    txn.apply_update(decoded_update);
                }
                Err(e) => {
                    tracing::warn!("Skipping corrupt update {}: {}", update.id, e);
                }
            }
        }
    }
    
    // Extract HTML content
    let html_content = extract_html_from_yjs_doc(&doc).await?;
    
    // Store snapshot with metadata
    sqlx::query!(
        "INSERT INTO script_snapshots_meta 
         (script_id, last_snapshot_at, last_processed_update_id, content_snapshot, snapshot_format)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (script_id) DO UPDATE SET
         last_snapshot_at = $2,
         last_processed_update_id = $3,
         content_snapshot = $4,
         snapshot_format = $5",
        script_id,
        Utc::now(),
        updates.last().map(|u| u.id),
        html_content,
        "html"
    )
    .execute(pool.as_ref())
    .await?;
    
    tracing::info!("Created snapshot for script {} ({} updates processed)", 
        script_id, updates.len());
    
    Ok(())
}
```

## 🔧 Connection Management

### 🔄 Reconnection Strategy

```typescript
// Frontend reconnection handling
const useWebSocketReconnection = (provider: WebsocketProvider | null) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  useEffect(() => {
    if (!provider) return;
    
    const handleStatusChange = (event: { status: string }) => {
      setConnectionStatus(event.status as any);
      
      if (event.status === 'connected') {
        setReconnectAttempts(0);
      } else if (event.status === 'disconnected') {
        setReconnectAttempts(prev => prev + 1);
      }
    };
    
    provider.on('status', handleStatusChange);
    provider.on('connection-close', () => setConnectionStatus('disconnected'));
    provider.on('connection-error', () => setConnectionStatus('error'));
    
    return () => {
      provider.off('status', handleStatusChange);
    };
  }, [provider]);
  
  return { connectionStatus, reconnectAttempts };
};
```

### 🧹 Session Cleanup

```rust
/// Cleanup inactive WebSocket sessions
pub async fn cleanup_inactive_sessions(
    threshold: chrono::Duration
) -> Result<usize, anyhow::Error> {
    let now = Utc::now();
    let mut removed_count = 0;
    
    // Collect inactive sessions
    let inactive_scripts: Vec<String> = SESSIONS
        .iter()
        .filter_map(|entry| {
            let script_id = entry.key();
            let session = entry.value();
            
            // Check if session has been inactive
            if let Ok(last_activity) = session.last_activity.try_lock() {
                if now.signed_duration_since(*last_activity) > threshold {
                    Some(script_id.clone())
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();
    
    // Remove inactive sessions
    for script_id in inactive_scripts {
        if let Some((_, session)) = SESSIONS.remove(&script_id) {
            tracing::debug!("Removed inactive session for script {}", script_id);
            removed_count += 1;
        }
    }
    
    Ok(removed_count)
}
```

## ⚡ Performance Optimizations

### 🚀 Frontend Optimizations

1. **Debounced Updates**: Batch multiple YJS operations
2. **Awareness Throttling**: Limit cursor update frequency
3. **Smart Reconnection**: Exponential backoff with jitter
4. **Memory Management**: Proper cleanup of YJS documents

```typescript
// Debounced content snapshot for better performance
const debouncedContentSnapshot = useMemo(
  () => debounce((content: string) => {
    if (content && content !== '<p></p>') {
      api.storeContentSnapshot(scriptId, content);
    }
  }, 2000), // 2-second delay
  [scriptId]
);

// Cleanup on unmount
useEffect(() => {
  return () => {
    debouncedContentSnapshot.cancel();
    provider?.destroy();
    ydoc?.destroy();
  };
}, [debouncedContentSnapshot, provider, ydoc]);
```

### 🔧 Backend Optimizations

1. **Channel Buffering**: 1024-message buffer for persistence events
2. **Broadcast Efficiency**: Direct memory sharing for binary data
3. **Session Indexing**: DashMap for O(1) session lookups
4. **Heartbeat Tuning**: 15-second intervals to prevent timeouts

```rust
// Optimized constants for production
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(120);
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);
const YJS_PERSISTENCE_QUEUE_CAPACITY: usize = 1024;
const SNAPSHOT_INTERVAL_MILLIS: u64 = 500;
```

## 🧪 Testing Collaboration

### 🔬 Multi-Client Testing

```typescript
// Test suite for collaboration features
describe('Real-time Collaboration', () => {
  it('should sync changes between multiple clients', async () => {
    const client1 = new TestClient('user1');
    const client2 = new TestClient('user2');
    
    await Promise.all([
      client1.connect(scriptId),
      client2.connect(scriptId),
    ]);
    
    // Client 1 makes a change
    await client1.type('Hello from user 1');
    
    // Client 2 should receive the change
    await waitFor(() => {
      expect(client2.getContent()).toContain('Hello from user 1');
    });
    
    // Client 2 makes a change
    await client2.type(' and user 2');
    
    // Both clients should have merged content
    await waitFor(() => {
      const expectedContent = 'Hello from user 1 and user 2';
      expect(client1.getContent()).toContain(expectedContent);
      expect(client2.getContent()).toContain(expectedContent);
    });
  });
  
  it('should handle cursor positions correctly', async () => {
    const client1 = new TestClient('user1');
    const client2 = new TestClient('user2');
    
    await Promise.all([
      client1.connect(scriptId),
      client2.connect(scriptId),
    ]);
    
    // Test cursor visibility
    expect(client1.getVisibleCursors()).toHaveLength(1); // user2's cursor
    expect(client2.getVisibleCursors()).toHaveLength(1); // user1's cursor
  });
});
```

## 🚨 Error Handling

### 🔄 Conflict Resolution

YJS automatically handles conflicts using CRDTs, but we add additional safeguards:

```typescript
// Monitor for YJS conflicts and errors
const useCollaborationErrorHandling = (ydoc: Y.Doc | null) => {
  useEffect(() => {
    if (!ydoc) return;
    
    const handleUpdateError = (error: Error) => {
      console.error('YJS update error:', error);
      // Optionally notify user or attempt recovery
    };
    
    const handleSyncError = (error: Error) => {
      console.error('YJS sync error:', error);
      // Attempt to reconnect or reload document
    };
    
    ydoc.on('updateV2', (update, origin) => {
      try {
        // Validate update if needed
        if (update.byteLength > MAX_UPDATE_SIZE) {
          throw new Error('Update too large');
        }
      } catch (error) {
        handleUpdateError(error as Error);
      }
    });
    
    return () => {
      // Cleanup listeners
    };
  }, [ydoc]);
};
```

---

## 🔗 Related Documentation

- **[System Architecture](README.md)** - High-level system overview
- **[Frontend Architecture](frontend.md)** - React frontend implementation  
- **[Backend Architecture](backend.md)** - Rust backend implementation
- **[Database Schema](database.md)** - PostgreSQL schema documentation
- **[API Reference](../api/README.md)** - Complete API documentation 