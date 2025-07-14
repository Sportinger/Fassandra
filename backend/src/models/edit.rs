use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents an edit to a block's content.
///
/// This struct tracks the history of changes made to blocks, including who made the change
/// and when. It maps directly to the `edits` table in the database.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Edit {
    /// Unique identifier for the edit
    pub id: Uuid,
    /// Reference to the block that was edited
    pub block_id: Option<Uuid>,
    /// Reference to the user who made the edit
    pub user_id: Option<Uuid>,
    /// The new content after the edit
    pub content: String,
    /// Timestamp when the edit was made
    pub created_at: Option<DateTime<Utc>>,
} 