use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a user in the system.
///
/// This struct maps directly to the `users` table in the database.
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct User {
    /// Unique identifier for the user
    pub id: Uuid,
    /// Email address (used for login)
    pub email: String,
    /// Username for display
    pub username: String,
    /// Hashed password
    pub password_hash: String,
    /// User role (e.g., "user", "admin")
    pub role: String,
    /// Timestamp when the user was created
    pub created_at: Option<DateTime<Utc>>,
}
