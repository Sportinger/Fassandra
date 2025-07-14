use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a content block within a script.
///
/// Blocks are the fundamental units of content in a script. Each block has a specific type
/// and content. This struct maps directly to the `blocks` table in the database.
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Block {
    /// Unique identifier for the block
    pub id: Uuid,
    /// Reference to the script this block belongs to
    pub script_id: Uuid,
    /// Type of the block (e.g., "text", "code", "image")
    pub block_type: String,
    /// Content of the block
    pub content: String,
    /// Timestamp when the block was created
    pub created_at: Option<DateTime<Utc>>,
    /// Order of the block within the script
    pub block_order: i32,
    /// Page number where this block appears in the script (1-based)
    pub page_number: i32,
    /// Additional metadata for the block stored as JSON
    pub metadata: Option<serde_json::Value>,
} 