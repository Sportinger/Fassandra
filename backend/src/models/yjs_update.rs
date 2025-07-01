use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct YjsDocumentUpdate {
    pub id: i64, // Corresponds to BIGSERIAL
    pub script_id: Uuid,
    pub user_id: Option<Uuid>, // Nullable
    pub update_data: Vec<u8>, // Corresponds to BYTEA
    pub created_at: DateTime<Utc>, // Corresponds to TIMESTAMPTZ
} 