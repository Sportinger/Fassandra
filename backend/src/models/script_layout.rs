use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a visual layout/theme for a script.
///
/// Script layouts define how different block types should be displayed,
/// allowing users to create and share different visual interpretations
/// of the same script content.
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct ScriptLayout {
    /// Unique identifier for the layout
    pub id: Uuid,
    /// Reference to the script this layout belongs to
    pub script_id: Option<Uuid>,
    /// Name of the layout (e.g., "Director's View", "Rehearsal Format")
    pub name: String,
    /// Optional description of the layout
    pub description: Option<String>,
    /// User who created this layout
    pub created_by: Option<Uuid>,
    /// Timestamp when the layout was created
    pub created_at: Option<DateTime<Utc>>,
    /// Timestamp when the layout was last updated
    pub updated_at: Option<DateTime<Utc>>,
    /// Whether this is the default layout for the script
    pub is_default: Option<bool>,
    /// JSON configuration containing all styling rules
    pub layout_config: JsonValue,
}

/// Request payload for creating a new script layout
#[derive(Debug, Deserialize)]
pub struct CreateScriptLayoutRequest {
    pub name: String,
    pub description: Option<String>,
    pub layout_config: JsonValue,
    pub is_default: Option<bool>,
}

/// Request payload for updating an existing script layout
#[derive(Debug, Deserialize)]
pub struct UpdateScriptLayoutRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub layout_config: Option<JsonValue>,
    pub is_default: Option<bool>,
} 