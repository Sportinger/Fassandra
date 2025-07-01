use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Event to be sent to the persistence queue for Yjs updates.
#[derive(Debug, Clone)]
pub struct YjsPersistenceEvent {
    pub script_id: String,
    pub update_data: Vec<u8>,
    pub user_id: Option<Uuid>,
    pub received_at: DateTime<Utc>,
} 