# Enhanced Block System Design
## Pragmatic Approach for Theater Collaboration Layers

### 🎯 **Goal: Extend Current System, Don't Replace It**

Build on the working foundation to add:
- **Technical Cues** (Licht, Ton, Video, Requisite)
- **Comments** (Director, Dramaturgical, General)
- **Layer Visibility** (Show/hide different content types)
- **Version History** (Restore "deleted" content)

---

## 1. Database Schema Changes

### Extend Existing Blocks Table
```sql
-- Add new columns to existing blocks table
ALTER TABLE blocks ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE blocks ADD COLUMN layer VARCHAR(50) DEFAULT 'active';
ALTER TABLE blocks ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE blocks ADD COLUMN deleted_by UUID NULL;

-- Update block_type enum to include new types
ALTER TYPE block_type ADD VALUE 'lighting_cue';
ALTER TYPE block_type ADD VALUE 'sound_cue';
ALTER TYPE block_type ADD VALUE 'video_cue';
ALTER TYPE block_type ADD VALUE 'props_cue';
ALTER TYPE block_type ADD VALUE 'director_note';
ALTER TYPE block_type ADD VALUE 'general_comment';
ALTER TYPE block_type ADD VALUE 'dramaturgical_comment';
```

### New User Layer Settings Table
```sql
CREATE TABLE user_layer_settings (
    user_id UUID NOT NULL,
    script_id UUID NOT NULL,
    layer_name VARCHAR(50) NOT NULL,
    visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, script_id, layer_name)
);

-- Default layers for new users
INSERT INTO user_layer_settings (user_id, script_id, layer_name, visible) VALUES
(?, ?, 'active', true),
(?, ?, 'cues', false),
(?, ?, 'comments', true),
(?, ?, 'deleted', false);
```

### Simple Block Versioning Table
```sql
CREATE TABLE block_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES blocks(id),
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT
);
```

---

## 2. Backend Model Updates

### Enhanced Block Model
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Block {
    pub id: Uuid,
    pub script_id: Uuid,
    pub block_type: BlockType,
    pub content: serde_json::Value,
    pub position: f64,
    pub page_number: Option<i32>,
    pub scene_number: Option<String>,
    pub scene_title: Option<String>,
    pub metadata: BlockMetadata,       // NEW
    pub layer: String,                 // NEW
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,  // NEW
    pub deleted_by: Option<Uuid>,           // NEW
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum BlockType {
    // Existing
    Dialogue,
    StageDirection,
    Paragraph,
    
    // New Cue Types
    LightingCue,
    SoundCue, 
    VideoCue,
    PropsCue,
    
    // New Comment Types
    DirectorNote,
    GeneralComment,
    DramaturgicalComment,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct BlockMetadata {
    // For cues
    pub cue_number: Option<String>,          // "LX 12", "SFX 3"
    pub reference_block_id: Option<Uuid>,   // What dialogue line this cue references
    pub timing_offset: Option<CueOffset>,   // Before/during/after referenced block
    pub department: Option<String>,         // "lighting", "sound", "video", "props"
    
    // For comments
    pub comment_anchor: Option<CommentAnchor>,
    pub thread_parent: Option<Uuid>,        // For threaded discussions
    
    // Common
    pub author: Option<Uuid>,
    pub tags: Vec<String>,
    pub priority: Option<String>,           // "high", "medium", "low"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum CueOffset {
    Before,    // Cue happens before referenced block
    During,    // Cue happens during referenced block
    After,     // Cue happens after referenced block
    Standalone // Cue is position-based, not dialogue-referenced
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum CommentAnchor {
    Block(Uuid),           // Comment on specific block
    Scene(String),         // Comment on entire scene
    PageRange(i32, i32),   // Comment on page range
    Character(String),     // Comment on character throughout script
    Floating,             // General comment
}
```

### User Layer Settings Model
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserLayerSettings {
    pub user_id: Uuid,
    pub script_id: Uuid,
    pub visible_layers: HashMap<String, bool>,
}

impl UserLayerSettings {
    pub fn default_for_user(user_id: Uuid, script_id: Uuid) -> Self {
        let mut visible_layers = HashMap::new();
        visible_layers.insert("active".to_string(), true);
        visible_layers.insert("cues".to_string(), false);
        visible_layers.insert("comments".to_string(), true);
        visible_layers.insert("deleted".to_string(), false);
        
        Self { user_id, script_id, visible_layers }
    }
}
```

---

## 3. API Endpoints

### Block Filtering with Layers
```rust
// GET /api/scripts/{script_id}/blocks?layers=active,comments&types=dialogue,director_note
pub async fn get_blocks_filtered(
    Path(script_id): Path<Uuid>,
    Query(params): Query<BlockFilterParams>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<Block>>, AppError> {
    let layers = params.layers.unwrap_or_else(|| vec!["active".to_string()]);
    let types = params.types.unwrap_or_else(|| vec![]);
    
    let blocks = block_repository
        .get_blocks_by_layers_and_types(script_id, &layers, &types)
        .await?;
    
    Ok(Json(blocks))
}

#[derive(Deserialize)]
pub struct BlockFilterParams {
    pub layers: Option<Vec<String>>,
    pub types: Option<Vec<BlockType>>,
    pub include_deleted: Option<bool>,
}
```

### Cue Management
```rust
// POST /api/blocks/{block_id}/cues
pub async fn create_cue(
    Path(block_id): Path<Uuid>,
    Json(cue_data): Json<CreateCueRequest>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Block>, AppError> {
    let cue_block = Block {
        id: Uuid::new_v4(),
        script_id: cue_data.script_id,
        block_type: cue_data.cue_type,
        content: json!({
            "cue_text": cue_data.text,
            "instructions": cue_data.instructions
        }),
        position: cue_data.position,
        layer: "cues".to_string(),
        metadata: BlockMetadata {
            cue_number: cue_data.cue_number,
            reference_block_id: Some(block_id),
            timing_offset: cue_data.timing_offset,
            department: cue_data.department,
            author: Some(user_id),
            ..Default::default()
        },
        ..Default::default()
    };
    
    let created = block_repository.create_block(cue_block).await?;
    Ok(Json(created))
}
```

### Layer Visibility Settings
```rust
// PUT /api/scripts/{script_id}/layer-settings
pub async fn update_layer_settings(
    Path(script_id): Path<Uuid>,
    Json(settings): Json<HashMap<String, bool>>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<UserLayerSettings>, AppError> {
    for (layer, visible) in settings {
        user_layer_repository
            .set_layer_visibility(user_id, script_id, &layer, visible)
            .await?;
    }
    
    let updated_settings = user_layer_repository
        .get_settings(user_id, script_id)
        .await?;
    
    Ok(Json(updated_settings))
}
```

---

## 4. Frontend Updates

### Layer Toggle Component
```typescript
interface LayerToggleProps {
  scriptId: string;
  currentLayers: Record<string, boolean>;
  onLayerToggle: (layer: string, visible: boolean) => void;
}

export const LayerToggle: React.FC<LayerToggleProps> = ({
  scriptId,
  currentLayers,
  onLayerToggle
}) => {
  const layerDefinitions = [
    { key: 'active', label: 'Script Content', icon: '📝', alwaysOn: true },
    { key: 'cues', label: 'Technical Cues', icon: '💡' },
    { key: 'comments', label: 'Comments & Notes', icon: '💬' },
    { key: 'deleted', label: 'Deleted Content', icon: '🗑️' },
  ];

  return (
    <div className="layer-toggle-panel">
      <h3>Content Layers</h3>
      {layerDefinitions.map(layer => (
        <label key={layer.key} className="layer-toggle">
          <input
            type="checkbox"
            checked={currentLayers[layer.key] || false}
            onChange={(e) => onLayerToggle(layer.key, e.target.checked)}
            disabled={layer.alwaysOn}
          />
          <span className="layer-icon">{layer.icon}</span>
          <span className="layer-label">{layer.label}</span>
        </label>
      ))}
    </div>
  );
};
```

### Cue Block Component
```typescript
interface CueBlockProps {
  block: Block;
  referencedBlock?: Block;
  onEdit: (block: Block) => void;
  onDelete: (blockId: string) => void;
}

export const CueBlock: React.FC<CueBlockProps> = ({
  block,
  referencedBlock,
  onEdit,
  onDelete
}) => {
  const cueTypeIcons = {
    lighting_cue: '💡',
    sound_cue: '🔊',
    video_cue: '📹',
    props_cue: '🎭'
  };

  return (
    <div className={`cue-block ${block.block_type}`}>
      <div className="cue-header">
        <span className="cue-icon">{cueTypeIcons[block.block_type]}</span>
        <span className="cue-number">{block.metadata.cue_number}</span>
        <span className="cue-department">{block.metadata.department}</span>
      </div>
      
      <div className="cue-content">
        {block.content.cue_text}
      </div>
      
      {referencedBlock && (
        <div className="cue-reference">
          Referenced: "{referencedBlock.content.line || referencedBlock.content.text}"
          <span className="timing-offset">
            ({block.metadata.timing_offset || 'during'})
          </span>
        </div>
      )}
      
      <div className="cue-actions">
        <button onClick={() => onEdit(block)}>Edit</button>
        <button onClick={() => onDelete(block.id)}>Delete</button>
      </div>
    </div>
  );
};
```

---

## 5. Implementation Timeline

### Week 1-2: Database & Backend
- [ ] Add metadata, layer, deleted_* columns to blocks table
- [ ] Create user_layer_settings table
- [ ] Update BlockType enum with new cue/comment types
- [ ] Add BlockMetadata struct and related models
- [ ] Update block repository with filtering methods

### Week 3-4: API Layer
- [ ] Add layer filtering to GET /blocks endpoint
- [ ] Create cue management endpoints
- [ ] Add layer settings endpoints
- [ ] Update block CRUD to handle metadata
- [ ] Add soft delete functionality

### Week 5-6: Frontend Components
- [ ] Create LayerToggle component
- [ ] Create CueBlock component
- [ ] Create CommentBlock component
- [ ] Update Editor to render new block types
- [ ] Add cue creation UI

### Week 7: Integration & Testing
- [ ] End-to-end testing of layer visibility
- [ ] Test cue referencing between blocks
- [ ] Test comment threading
- [ ] Performance testing with large scripts
- [ ] User acceptance testing

---

## 6. Migration Strategy

### Zero-Downtime Migration
```sql
-- Step 1: Add new columns with defaults
ALTER TABLE blocks ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE blocks ADD COLUMN layer VARCHAR(50) DEFAULT 'active';

-- Step 2: Create new tables
CREATE TABLE user_layer_settings (...);
CREATE TABLE block_versions (...);

-- Step 3: Populate defaults for existing users
INSERT INTO user_layer_settings 
SELECT u.id, s.id, 'active', true, NOW()
FROM users u CROSS JOIN scripts s;

-- Step 4: Deploy new backend code
-- Step 5: Deploy new frontend code
-- Step 6: Cleanup old unused columns (later)
```

---

## 🎯 **Key Benefits of This Approach**

1. **Low Risk** - Evolutionary change, not revolutionary
2. **Fast Implementation** - ~7 weeks vs 6+ months
3. **Stable References** - Cues reference blocks by ID, not content hash
4. **Simple Queries** - Standard SQL, easy to optimize
5. **Keep YJS** - Real-time collaboration continues working
6. **Extensible** - Easy to add new block types and layers
7. **Debuggable** - Standard database patterns, familiar tools

This design gives you everything you need for theater production workflows while building on your solid foundation! 🎭 