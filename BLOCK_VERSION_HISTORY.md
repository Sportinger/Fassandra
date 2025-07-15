# Block Version History Design
## Simple & Practical "Go Back" / "Show Last Version" Functionality

### 🎯 **Core Concept: Snapshot-Based Versioning**

Instead of complex operational transforms, we use simple **before/after snapshots** every time a block changes.

---

## 1. Database Schema (Already in Enhanced Design)

```sql
-- Main blocks table (current version)
CREATE TABLE blocks (
    id UUID PRIMARY KEY,
    script_id UUID NOT NULL,
    block_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    layer VARCHAR(50) DEFAULT 'active',
    position DECIMAL(10,6) NOT NULL,
    page_number INTEGER,
    scene_number VARCHAR(100),
    scene_title VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    deleted_by UUID NULL
);

-- Version history (snapshots)
CREATE TABLE block_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES blocks(id),
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,           -- Snapshot of content at this version
    metadata JSONB DEFAULT '{}',      -- Snapshot of metadata at this version  
    position DECIMAL(10,6),           -- Position at time of change
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,               -- Optional: "fixed typo", "director note", etc.
    change_type VARCHAR(50),          -- "content_edit", "position_move", "metadata_update"
    UNIQUE(block_id, version_number)
);

-- Index for fast version lookups
CREATE INDEX idx_block_versions_block_id ON block_versions(block_id, version_number DESC);
```

---

## 2. Backend Models & Logic

### Version Management Service
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlockVersion {
    pub id: Uuid,
    pub block_id: Uuid,
    pub version_number: i32,
    pub content: serde_json::Value,
    pub metadata: BlockMetadata,
    pub position: f64,
    pub created_at: DateTime<Utc>,
    pub created_by: Uuid,
    pub change_reason: Option<String>,
    pub change_type: ChangeType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ChangeType {
    ContentEdit,      // User edited the text
    PositionMove,     // Block was moved/reordered
    MetadataUpdate,   // Cue number, references, etc. changed
    LayerChange,      // Block moved between layers
    Restore,          // Block restored from deletion
}

impl BlockVersion {
    // Convert version back to current block format
    pub fn to_block(&self, script_id: Uuid) -> Block {
        Block {
            id: self.block_id,
            script_id,
            content: self.content.clone(),
            metadata: self.metadata.clone(),
            position: self.position,
            // ... other fields from current state
        }
    }
}
```

### Automatic Version Creation
```rust
impl BlockRepository {
    // Called before every block update
    pub async fn create_version_snapshot(
        &self,
        block: &Block,
        user_id: Uuid,
        change_reason: Option<String>,
        change_type: ChangeType,
    ) -> Result<BlockVersion, AppError> {
        // Get next version number
        let next_version = self.get_next_version_number(block.id).await?;
        
        let version = BlockVersion {
            id: Uuid::new_v4(),
            block_id: block.id,
            version_number: next_version,
            content: block.content.clone(),
            metadata: block.metadata.clone(),
            position: block.position,
            created_at: Utc::now(),
            created_by: user_id,
            change_reason,
            change_type,
        };
        
        sqlx::query!(
            "INSERT INTO block_versions 
             (id, block_id, version_number, content, metadata, position, created_by, change_reason, change_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            version.id,
            version.block_id,
            version.version_number,
            version.content,
            serde_json::to_value(&version.metadata)?,
            version.position,
            version.created_by,
            version.change_reason,
            serde_json::to_value(&version.change_type)?
        ).execute(&self.pool).await?;
        
        Ok(version)
    }
    
    // Update block with automatic versioning
    pub async fn update_block_with_versioning(
        &self,
        block_id: Uuid,
        updates: BlockUpdateRequest,
        user_id: Uuid,
        change_reason: Option<String>,
    ) -> Result<Block, AppError> {
        // 1. Get current block state
        let current_block = self.get_block_by_id(block_id).await?;
        
        // 2. Create version snapshot of current state
        self.create_version_snapshot(
            &current_block,
            user_id,
            change_reason.clone(),
            updates.determine_change_type(),
        ).await?;
        
        // 3. Apply updates to create new current state
        let updated_block = self.apply_updates(current_block, updates).await?;
        
        // 4. Save new current state
        self.save_block(&updated_block).await?;
        
        Ok(updated_block)
    }
}
```

---

## 3. API Endpoints for Version History

### Get Block Version History
```rust
// GET /api/blocks/{block_id}/versions
pub async fn get_block_versions(
    Path(block_id): Path<Uuid>,
    Query(params): Query<VersionQueryParams>,
) -> Result<Json<Vec<BlockVersion>>, AppError> {
    let versions = block_repository
        .get_block_versions(block_id, params.limit.unwrap_or(10))
        .await?;
    
    Ok(Json(versions))
}

#[derive(Deserialize)]
pub struct VersionQueryParams {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}
```

### Get Specific Version
```rust
// GET /api/blocks/{block_id}/versions/{version_number}
pub async fn get_block_version(
    Path((block_id, version_number)): Path<(Uuid, i32)>,
) -> Result<Json<BlockVersion>, AppError> {
    let version = block_repository
        .get_block_version(block_id, version_number)
        .await?;
    
    Ok(Json(version))
}
```

### Restore to Previous Version
```rust
// POST /api/blocks/{block_id}/restore/{version_number}
pub async fn restore_block_version(
    Path((block_id, version_number)): Path<(Uuid, i32)>,
    Extension(user_id): Extension<Uuid>,
    Json(restore_request): Json<RestoreRequest>,
) -> Result<Json<Block>, AppError> {
    // 1. Get the target version
    let target_version = block_repository
        .get_block_version(block_id, version_number)
        .await?;
    
    // 2. Create version snapshot of current state (before restore)
    let current_block = block_repository.get_block_by_id(block_id).await?;
    block_repository.create_version_snapshot(
        &current_block,
        user_id,
        Some(format!("Restored to version {}", version_number)),
        ChangeType::Restore,
    ).await?;
    
    // 3. Apply the target version as new current state
    let restored_block = target_version.to_block(current_block.script_id);
    block_repository.save_block(&restored_block).await?;
    
    Ok(Json(restored_block))
}

#[derive(Deserialize)]
pub struct RestoreRequest {
    pub reason: Option<String>,
}
```

### Compare Versions
```rust
// GET /api/blocks/{block_id}/versions/{v1}/compare/{v2}
pub async fn compare_block_versions(
    Path((block_id, v1, v2)): Path<(Uuid, i32, i32)>,
) -> Result<Json<VersionComparison>, AppError> {
    let version1 = block_repository.get_block_version(block_id, v1).await?;
    let version2 = block_repository.get_block_version(block_id, v2).await?;
    
    let comparison = VersionComparison::create(&version1, &version2);
    Ok(Json(comparison))
}

#[derive(Serialize)]
pub struct VersionComparison {
    pub content_changes: Vec<TextDiff>,
    pub metadata_changes: Vec<MetadataChange>,
    pub position_change: Option<PositionChange>,
}
```

---

## 4. Frontend Components

### Version History Panel
```typescript
interface VersionHistoryProps {
  blockId: string;
  onVersionSelect: (version: BlockVersion) => void;
  onRestore: (version: BlockVersion) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  blockId,
  onVersionSelect,
  onRestore
}) => {
  const [versions, setVersions] = useState<BlockVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BlockVersion | null>(null);
  
  useEffect(() => {
    loadVersionHistory();
  }, [blockId]);
  
  const loadVersionHistory = async () => {
    const response = await api.get(`/blocks/${blockId}/versions`);
    setVersions(response.data);
  };
  
  const handleRestore = async (version: BlockVersion) => {
    if (confirm(`Restore to version ${version.version_number}?`)) {
      await api.post(`/blocks/${blockId}/restore/${version.version_number}`, {
        reason: `Restored to version from ${version.created_at}`
      });
      onRestore(version);
    }
  };
  
  return (
    <div className="version-history-panel">
      <h3>Version History</h3>
      
      <div className="version-list">
        {versions.map((version, index) => (
          <div
            key={version.id}
            className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedVersion(version);
              onVersionSelect(version);
            }}
          >
            <div className="version-header">
              <span className="version-number">
                {index === 0 ? 'Current' : `Version ${version.version_number}`}
              </span>
              <span className="version-date">
                {formatDate(version.created_at)}
              </span>
            </div>
            
            <div className="version-meta">
              <span className="author">{version.created_by}</span>
              <span className="change-type">{version.change_type}</span>
              {version.change_reason && (
                <span className="reason">"{version.change_reason}"</span>
              )}
            </div>
            
            {index > 0 && (
              <button
                className="restore-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestore(version);
                }}
              >
                Restore
              </button>
            )}
          </div>
        ))}
      </div>
      
      {selectedVersion && (
        <VersionPreview
          version={selectedVersion}
          onCompare={(otherVersion) => showComparison(selectedVersion, otherVersion)}
        />
      )}
    </div>
  );
};
```

### Quick "Undo" Button
```typescript
interface QuickUndoProps {
  blockId: string;
  onUndo: () => void;
}

export const QuickUndoButton: React.FC<QuickUndoProps> = ({ blockId, onUndo }) => {
  const [lastVersion, setLastVersion] = useState<BlockVersion | null>(null);
  
  useEffect(() => {
    loadLastVersion();
  }, [blockId]);
  
  const loadLastVersion = async () => {
    const response = await api.get(`/blocks/${blockId}/versions?limit=1`);
    if (response.data.length > 0) {
      setLastVersion(response.data[0]);
    }
  };
  
  const handleQuickUndo = async () => {
    if (lastVersion) {
      await api.post(`/blocks/${blockId}/restore/${lastVersion.version_number}`, {
        reason: "Quick undo"
      });
      onUndo();
    }
  };
  
  if (!lastVersion) return null;
  
  return (
    <button className="quick-undo-btn" onClick={handleQuickUndo} title="Undo last change">
      ↶ Undo
      <span className="undo-preview">
        {formatRelativeTime(lastVersion.created_at)}
      </span>
    </button>
  );
};
```

### Version Comparison View
```typescript
interface VersionComparisonProps {
  version1: BlockVersion;
  version2: BlockVersion;
}

export const VersionComparison: React.FC<VersionComparisonProps> = ({
  version1,
  version2
}) => {
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  
  useEffect(() => {
    loadComparison();
  }, [version1, version2]);
  
  const loadComparison = async () => {
    const response = await api.get(
      `/blocks/${version1.block_id}/versions/${version1.version_number}/compare/${version2.version_number}`
    );
    setComparison(response.data);
  };
  
  return (
    <div className="version-comparison">
      <div className="comparison-header">
        <div className="version-info">
          <h4>Version {version1.version_number}</h4>
          <span>{formatDate(version1.created_at)}</span>
        </div>
        <div className="vs">vs</div>
        <div className="version-info">
          <h4>Version {version2.version_number}</h4>
          <span>{formatDate(version2.created_at)}</span>
        </div>
      </div>
      
      {comparison && (
        <div className="comparison-content">
          <div className="content-diff">
            <h5>Content Changes</h5>
            <DiffViewer
              oldValue={JSON.stringify(version1.content, null, 2)}
              newValue={JSON.stringify(version2.content, null, 2)}
              splitView={true}
            />
          </div>
          
          {comparison.metadata_changes.length > 0 && (
            <div className="metadata-diff">
              <h5>Metadata Changes</h5>
              {comparison.metadata_changes.map((change, index) => (
                <div key={index} className="metadata-change">
                  <span className="field">{change.field}:</span>
                  <span className="old-value">{change.old_value}</span>
                  <span className="arrow">→</span>
                  <span className="new-value">{change.new_value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## 5. User Experience Examples

### Typical Workflow
```
1. User edits dialogue line: "Hello there" → "Hello darkness"
   → Automatic version snapshot created

2. Director adds comment: "Too dramatic"
   → Another version snapshot (metadata change)

3. User wants to undo dialogue change:
   → Click "Undo" or select previous version
   → Restore to version with original "Hello there"

4. User wants to see what changed:
   → Open version history panel
   → Compare any two versions
   → See exact differences highlighted
```

### Version History UI
```
Version History for Block #12345

┌─ Current (just now)                               [Restore] ✗
│  by: john@theater.com | Content Edit
│  "Fixed spelling mistake"
│
├─ Version 3 (2 hours ago)                         [Restore] ✓  
│  by: director@theater.com | Metadata Update
│  "Added lighting cue reference"
│
├─ Version 2 (yesterday)                           [Restore] ✓
│  by: john@theater.com | Content Edit  
│  "Updated dialogue per director notes"
│
└─ Version 1 (3 days ago)                          [Restore] ✓
   by: john@theater.com | Content Edit
   "Initial version from script upload"
```

---

## 🎯 **Key Benefits of This Approach**

1. **Simple & Fast** - Just snapshot before each change
2. **Stable References** - Cues/comments keep working during version restoration
3. **Complete History** - Never lose any edit, ever
4. **User-Friendly** - Familiar "undo" concept, not Git complexity  
5. **Performance** - Simple queries, indexed by block_id
6. **Debugging** - Easy to see who changed what when
7. **Audit Trail** - Perfect for theater production accountability

### Comparison with Content-Hash Versioning
| Feature | Enhanced Block Versions | Content-Hash Versions |
|---------|------------------------|----------------------|
| **Restore Time** | Instant (1 query) | Complex (rebuild references) |
| **Cue Stability** | ✅ Stable | ❌ Break on restore |
| **Query Complexity** | Simple | Complex hash resolution |
| **Storage Overhead** | Minimal snapshots | Deduplicated but complex |
| **Implementation** | 1-2 weeks | 2-3 months |

The enhanced block versioning gives you **perfect "go back" functionality** without the complexity! 🎭 