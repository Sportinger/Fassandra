use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents a user in the system.
///
/// This struct is used for database operations and authentication.
/// It maps directly to the `users` table in the database.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    /// Unique identifier for the user
    pub id: Uuid,
    /// User's email address (unique)
    pub email: String,
    /// User's chosen username
    pub username: String,
    /// Argon2 hashed password
    pub password_hash: String,
    /// User's role (e.g., "user", "admin")
    pub role: String,
    /// Timestamp when the user was created
    pub created_at: Option<DateTime<Utc>>,
} 