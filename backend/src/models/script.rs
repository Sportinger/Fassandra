use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a script in the system.
///
/// A script is a collection of blocks that together form a complete document.
/// This struct maps directly to the `scripts` table in the database.
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Script {
    /// Unique identifier for the script
    pub id: Uuid,
    /// Title of the script
    pub title: String,
    /// UUID of the user who created the script
    pub created_by: Option<Uuid>,
    /// Timestamp when the script was created
    pub created_at: Option<DateTime<Utc>>,
    /// Whether the script is publicly accessible
    #[serde(default)]
    pub is_public: bool,
    /// Base64-encoded thumbnail image for DIN A4 preview
    pub thumbnail: Option<String>,
} 