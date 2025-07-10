# Snapshotting Service Documentation

## 📋 Overview

The **Snapshotting Service** is a critical component of the Pessoa teatro application that provides **reliable content persistence** for script editing. It acts as a **fallback mechanism** when the primary YJS real-time collaboration system fails to reconstruct document content properly.

## 🎯 Purpose

**Primary Goal**: Ensure that user content is **never lost**, even when:
- YJS updates fail to reconstruct the document
- WebSocket connections are unstable
- Complex collaborative editing scenarios occur
- Browser crashes or network issues happen

## 🏗️ Architecture

### Frontend Component
- **Location**: `frontend/src/components/editor/hooks/useEditorCore.ts`
- **Function**: `sendContentSnapshot()`
- **Timing**: Every **2 seconds** (configurable)
- **Initial Delay**: 5 seconds after editor loads

### Backend Component
- **Location**: `backend/src/snapshotting_service.rs`
- **Process**: Continuous background service
- **Timing**: Checks every **2 seconds**
- **Processing**: Converts HTML snapshots to structured blocks

### Database Schema
- **Table**: `script_snapshots_meta`
- **Columns**:
  - `script_id`: UUID of the script
  - `content_snapshot`: Raw HTML content
  - `snapshot_format`: Format type (default: 'html')
  - `created_at`: Timestamp of snapshot creation

## ⚡ How It Works

### 1. Frontend Capture
```typescript
// Every 2 seconds, frontend captures editor content
const sendContentSnapshot = async () => {
  const html = editor.getHTML();
  if (html && html.trim() !== '<p></p>') {
    await storeContentSnapshot(scriptId, html, token);
  }
};
```

### 2. Backend Processing
```rust
// Backend processes snapshots every 2 seconds
// Converts HTML to structured blocks
let blocks = convert_html_to_blocks(&content_snapshot);
```

### 3. Database Storage
```sql
-- Snapshots stored in script_snapshots_meta
INSERT INTO script_snapshots_meta 
(script_id, content_snapshot, snapshot_format, created_at)
VALUES ($1, $2, 'html', NOW());

-- Converted to blocks table
INSERT INTO blocks 
(script_id, block_type, content, created_at)
VALUES ($1, 'content', $2, NOW());
```

### 4. Content Recovery
```typescript
// Frontend loads content from blocks
case 'content': {
  // Handle raw HTML content from content snapshots
  console.log(`[Content Converter] Processing content block: ${contentJsonString.length} chars`);
  return contentJsonString; // Return raw HTML
}
```

## 📊 Timing Configuration

### Current Settings (Ultra-Fast Development)
- **Frontend Snapshots**: Every **2 seconds**
- **Backend Processing**: Every **2 seconds**
- **Initial Delay**: 5 seconds after editor loads

### Adjustable Parameters
```typescript
// Frontend timing (useEditorCore.ts)
const snapshotInterval = setInterval(sendContentSnapshot, 2000); // 2 seconds
const initialTimeout = setTimeout(sendContentSnapshot, 5000);    // 5 seconds initial
```

```rust
// Backend timing (snapshotting_service.rs)
let mut interval = interval(Duration::from_secs(2)); // 2 seconds
```

## 🔄 Flow Diagram

```
User Types → Frontend Editor → Content Snapshot (2s) → Backend API → Database
                                      ↓
                                 Backend Service (2s) → Process HTML → Create Blocks
                                      ↓
                                 Database → Blocks Table → Content Recovery
```

## 🛠️ API Endpoints

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

### Response
```json
{
  "success": true,
  "message": "Content snapshot stored successfully"
}
```

## 🗄️ Database Schema Details

### script_snapshots_meta Table
```sql
CREATE TABLE script_snapshots_meta (
    script_id UUID NOT NULL,
    content_snapshot TEXT,
    snapshot_format VARCHAR(10) DEFAULT 'html',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_script_snapshots_meta_script_id 
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX idx_script_snapshots_meta_created_at 
ON script_snapshots_meta(created_at);
```

### blocks Table Integration
```sql
-- Content blocks created from snapshots
INSERT INTO blocks (script_id, block_type, content, created_at)
SELECT script_id, 'content', content_snapshot, NOW()
FROM script_snapshots_meta 
WHERE processing_needed = true;
```

## 🔍 Debugging & Monitoring

### Frontend Debugging
```typescript
// Enable detailed logging
console.log('[Content Snapshot] Sending:', {
  scriptId,
  contentLength: html.length,
  preview: html.substring(0, 100)
});
```

### Backend Debugging
```rust
// Backend processing logs
debug!("✅ Created block from content snapshot: {} chars", content.len());
info!("📊 [SnapshottingService] Completed snapshot batch. Total scripts processed: {}", count);
```

### Database Monitoring
```sql
-- Check recent snapshots
SELECT script_id, 
       LEFT(content_snapshot, 100) as preview,
       created_at,
       EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
FROM script_snapshots_meta 
ORDER BY created_at DESC 
LIMIT 10;

-- Check processing frequency
SELECT script_id,
       COUNT(*) as snapshot_count,
       MAX(created_at) as latest_snapshot,
       AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_interval
FROM script_snapshots_meta
GROUP BY script_id
ORDER BY latest_snapshot DESC;
```

## 🚨 Troubleshooting Guide

### Problem: Content Not Saving
**Symptoms**: Content disappears after page reload
**Diagnosis**:
```bash
# Check if snapshots are being created
docker exec dev_pessoa_db psql -U pessoa_user -d pessoa_db -c "
SELECT COUNT(*) as recent_snapshots 
FROM script_snapshots_meta 
WHERE created_at > NOW() - INTERVAL '1 minute';"
```

**Solutions**:
1. Verify frontend timing configuration
2. Check browser console for API errors
3. Ensure authentication token is valid
4. Verify database schema includes `content_snapshot` column

### Problem: Snapshots Not Processing
**Symptoms**: Snapshots created but no blocks generated
**Diagnosis**:
```bash
# Check backend processing logs
docker logs dev_pessoa_backend | grep -i "snapshot.*service"
```

**Solutions**:
1. Restart backend service
2. Check for database connection issues
3. Verify snapshotting service is running
4. Check for HTML parsing errors

### Problem: "Error parsing content" Messages
**Symptoms**: Editor shows "(content: Error parsing content - see console)"
**Diagnosis**: Content converter missing case for `block_type: 'content'`

**Solution**:
```typescript
// Add this case to contentConverters.ts
case 'content': {
  console.log(`[Content Converter] Processing content block: ${contentJsonString.length} chars`);
  return contentJsonString; // Return raw HTML
}
```

## 📈 Performance Considerations

### Production Recommendations
- **Frontend Snapshots**: Every **10-15 seconds** (reduce server load)
- **Backend Processing**: Every **2-5 seconds** (balance responsiveness vs. CPU)
- **Cleanup**: Regular deletion of old snapshots (retention policy)

### Development Settings
- **Frontend Snapshots**: Every **2 seconds** (immediate feedback)
- **Backend Processing**: Every **2 seconds** (rapid iteration)
- **Verbose Logging**: Enabled for debugging

### Database Optimization
```sql
-- Cleanup old snapshots (keep last 24 hours)
DELETE FROM script_snapshots_meta 
WHERE created_at < NOW() - INTERVAL '24 hours';

-- Index for performance
CREATE INDEX idx_script_snapshots_meta_script_id_created_at 
ON script_snapshots_meta(script_id, created_at DESC);
```

## 🔄 Fallback Hierarchy

The system provides multiple levels of content persistence:

1. **Primary**: YJS real-time collaboration updates
2. **Secondary**: Content snapshots (every 2 seconds)
3. **Tertiary**: Manual save triggers
4. **Emergency**: Browser local storage backup

## 🔧 Configuration Options

### Environment Variables
```bash
# Backend timing
SNAPSHOT_SERVICE_INTERVAL_SECONDS=2

# Frontend timing (in code)
CONTENT_SNAPSHOT_INTERVAL_MS=2000
INITIAL_SNAPSHOT_DELAY_MS=5000
```

### Feature Flags
```typescript
// Disable snapshots for specific scripts
const enableContentSnapshots = !script.disable_snapshots;

// Adjust timing based on user preference
const snapshotInterval = user.preferences.snapshot_frequency || 2000;
```

## 📝 Best Practices

### Frontend
1. **Debounce rapid typing** to avoid excessive API calls
2. **Cache content locally** before sending snapshots
3. **Handle network failures** gracefully
4. **Provide user feedback** on save status

### Backend
1. **Process snapshots asynchronously** to avoid blocking
2. **Batch multiple snapshots** for efficiency
3. **Implement retry logic** for failed processing
4. **Monitor processing queue** length

### Database
1. **Regular cleanup** of old snapshots
2. **Proper indexing** for performance
3. **Backup strategy** for critical content
4. **Monitoring** of growth and usage patterns

## 🎯 Success Metrics

### System Health
- **Snapshot Creation Rate**: Target 95%+ success rate
- **Processing Latency**: Target <5 seconds from creation to blocks
- **Content Recovery Rate**: Target 99.9%+ successful recoveries
- **Zero Data Loss**: No content should ever be permanently lost

### Performance Metrics
- **API Response Time**: <200ms for snapshot storage
- **Database Query Time**: <100ms for content retrieval
- **Memory Usage**: Stable, no memory leaks
- **CPU Usage**: <5% average for snapshotting service

## 🔮 Future Enhancements

### Planned Features
1. **Smart Frequency Adjustment**: Reduce snapshots when content is stable
2. **Differential Snapshots**: Only save changed content
3. **Compression**: Reduce storage footprint for large documents
4. **Cross-Device Sync**: Ensure snapshots work across multiple devices
5. **Version History**: Keep multiple snapshot versions for recovery

### Technical Improvements
1. **WebSocket Fallback**: Use WebSocket for real-time snapshot sync
2. **Conflict Resolution**: Handle concurrent edits better
3. **Batch Processing**: Process multiple snapshots in single operation
4. **Monitoring Dashboard**: Real-time visibility into snapshot health

---

*Documentation created: July 10, 2025*  
*Last updated: July 10, 2025*  
*System Status: ✅ Fully Operational* 