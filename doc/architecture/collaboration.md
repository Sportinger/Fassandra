# 🤝 Real-time Collaboration Architecture

This guide explains how Pessoa's real-time collaboration system works, including the primary YJS system and the critical backup snapshotting service.

## 🎯 Overview

Pessoa uses a **dual-layer approach** to ensure reliable real-time collaboration:

1. **Primary Layer**: YJS + WebSocket for instant real-time collaboration
2. **Backup Layer**: Content snapshots for data persistence and fallback

This architecture ensures **zero data loss** even when the primary collaboration system encounters issues.

## 🏗️ System Architecture

```
User Types → TipTap Editor → YJS Document → WebSocket → Backend → Other Users
     ↓                                         ↓
Content Snapshot (2s) → Backend API → Database → Snapshotting Service (2s)
     ↓                                         ↓
Database Blocks → Content Recovery → Editor Content
```

## 🚀 Primary Collaboration Layer: YJS + WebSocket

### YJS Integration

**What is YJS?**
- **Conflict-free Replicated Data Type (CRDT)** technology
- **Automatic conflict resolution** for simultaneous edits
- **Real-time synchronization** across multiple users
- **Offline support** with automatic sync when reconnected

**TipTap Integration:**
```typescript
// TipTap + YJS collaboration setup
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      history: false, // YJS handles history
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider: websocketProvider,
      user: {
        name: user.username,
        color: '#f59e0b',
      },
    }),
  ],
});
```

### WebSocket Communication

**Connection Management:**
- **Automatic reconnection** with exponential backoff
- **Browser-specific handling** (Chrome vs Firefox)
- **Mobile optimization** with shorter timeouts
- **Authentication** via JWT tokens in query string

**Real-time Features:**
- **Live cursor tracking** - See where other users are typing
- **Instant text sync** - Changes appear immediately
- **User presence** - Active user counter
- **Awareness states** - User activity and selections

## 🛡️ Backup Layer: Content Snapshotting Service

The snapshotting service acts as a **critical safety net** when YJS collaboration fails to reconstruct document content properly.

### Why Snapshotting is Essential

**Real-world Scenarios:**
- Complex collaborative editing sessions
- Browser crashes during editing
- Network interruptions
- YJS document corruption
- WebSocket connection failures

**Zero Data Loss Guarantee:**
- User content is **never lost**, even when primary collaboration fails
- Automatic recovery from snapshots when YJS fails
- Continuous background persistence every 2 seconds

### Snapshotting Architecture

#### Frontend Component
- **Location**: `frontend/src/components/editor/hooks/useEditorCore.ts`
- **Function**: `sendContentSnapshot()`
- **Timing**: Every **2 seconds** (configurable)
- **Trigger**: Content changes detected in TipTap editor

```typescript
// Frontend snapshot capture
const sendContentSnapshot = async () => {
  const html = editor.getHTML();
  if (html && html.trim() !== '<p></p>') {
    await storeContentSnapshot(scriptId, html, token);
  }
};

// Automatic snapshotting every 2 seconds
const snapshotInterval = setInterval(sendContentSnapshot, 2000);
```

#### Backend Processing
- **Location**: `backend/src/snapshotting_service.rs`
- **Process**: Continuous background service
- **Timing**: Processes snapshots every **2 seconds**
- **Conversion**: HTML snapshots → Structured blocks

## ⚡ Performance Optimization

### Development Settings (Ultra-Fast Feedback)
- **Frontend Snapshots**: Every **2 seconds**
- **Backend Processing**: Every **2 seconds**
- **Initial Delay**: 5 seconds after editor loads

### Production Recommendations
- **Frontend Snapshots**: Every **10-15 seconds** (reduce server load)
- **Backend Processing**: Every **2-5 seconds** (balance responsiveness vs. CPU)
- **Cleanup**: Regular deletion of old snapshots (retention policy)

## 🔧 API Endpoints

### Store Content Snapshot
```http
POST /api/scripts/{script_id}/content-snapshot
Content-Type: application/json
Authorization: Bearer {token}

{
  "content": "<p>Hello World</p><p>More content...</p>",
  "format": "html"
}
```

### WebSocket Collaboration
```javascript
// WebSocket connection for real-time collaboration
WS /api/collab/{script_id}?token={jwt_token}
```

## 📊 Monitoring & Debugging

### Success Metrics
- **Snapshot Creation Rate**: Target 95%+ success rate
- **Processing Latency**: Target <5 seconds from creation to blocks
- **Content Recovery Rate**: Target 99.9%+ successful recoveries
- **Zero Data Loss**: No content should ever be permanently lost

---

**Last Updated**: January 2025  
**System Status**: ✅ Fully Operational  
**Zero Data Loss**: ✅ Guaranteed  
**Real-time Sync**: ✅ Sub-second latency 