use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScriptSnapshotMeta {
    pub script_id: Uuid,
    pub last_snapshot_at: DateTime<Utc>,
    pub last_processed_update_id: Option<i64>,
} 