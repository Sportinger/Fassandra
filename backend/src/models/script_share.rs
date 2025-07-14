use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a script share entry in the system.
///
/// This struct tracks which scripts are shared with which users and what permissions they have.
/// It maps directly to the `script_shares` table in the database.
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct ScriptShare {
    /// Unique identifier for the share entry
    pub id: Uuid,
    /// The script being shared
    pub script_id: Uuid,
    /// The user the script is shared with
    pub shared_with_user_id: Uuid,
    /// Permission level (read or write)
    pub permission: String,
    /// Timestamp when the share was created
    pub created_at: Option<DateTime<Utc>>,
    /// UUID of the user who created the share
    pub created_by: Option<Uuid>,
}

/// Request payload for sharing a script
#[derive(Debug, Deserialize)]
pub struct ShareScriptRequest {
    /// Username of the user to share with
    pub username: String,
    /// Permission level to grant
    pub permission: SharePermission,
}

/// Permission levels for script sharing
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum SharePermission {
    Read,
    Write,
}

impl SharePermission {
    pub fn as_str(&self) -> &'static str {
        match self {
            SharePermission::Read => "read",
            SharePermission::Write => "write",
        }
    }
}

impl std::fmt::Display for SharePermission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
} 