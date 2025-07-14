//! User repository for database operations.
//!
//! Provides clean abstractions for user-related database operations.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::models::user::User;
use crate::error::AppError;

/// Repository trait for user operations
#[async_trait]
pub trait UserRepository: Send + Sync {
    /// Find a user by ID
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
    
    /// Find a user by email
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    
    /// Create a new user
    async fn create(&self, user: &User) -> Result<(), AppError>;
    
    /// Update an existing user
    async fn update(&self, user: &User) -> Result<(), AppError>;
    
    /// Delete a user
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
}

/// PostgreSQL implementation of UserRepository
pub struct PostgresUserRepository {
    pool: Arc<PgPool>,
}

impl PostgresUserRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            "SELECT id, email, password_hash, username, role, created_at FROM users WHERE id = $1",
            id
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(user)
    }
    
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            "SELECT id, email, password_hash, username, role, created_at FROM users WHERE email = $1",
            email
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(user)
    }
    
    async fn create(&self, user: &User) -> Result<(), AppError> {
        sqlx::query!(
            "INSERT INTO users (id, email, password_hash, username, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
            user.id,
            user.email,
            user.password_hash,
            user.username,
            user.role,
            user.created_at
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn update(&self, user: &User) -> Result<(), AppError> {
        sqlx::query!(
            "UPDATE users SET email = $2, password_hash = $3, username = $4, role = $5 WHERE id = $1",
            user.id,
            user.email,
            user.password_hash,
            user.username,
            user.role
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn delete(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            "DELETE FROM users WHERE id = $1",
            id
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;
    
    // Mock implementation for testing
    pub struct MockUserRepository {
        users: std::sync::Arc<std::sync::Mutex<Vec<User>>>,
    }
    
    impl MockUserRepository {
        pub fn new() -> Self {
            Self {
                users: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
        
        pub fn with_users(users: Vec<User>) -> Self {
            Self {
                users: std::sync::Arc::new(std::sync::Mutex::new(users)),
            }
        }
    }
    
    #[async_trait]
    impl UserRepository for MockUserRepository {
        async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
            let users = self.users.lock().unwrap();
            Ok(users.iter().find(|u| u.id == id).cloned())
        }
        
        async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
            let users = self.users.lock().unwrap();
            Ok(users.iter().find(|u| u.email == email).cloned())
        }
        
        async fn create(&self, user: &User) -> Result<(), AppError> {
            let mut users = self.users.lock().unwrap();
            users.push(user.clone());
            Ok(())
        }
        
        async fn update(&self, user: &User) -> Result<(), AppError> {
            let mut users = self.users.lock().unwrap();
            if let Some(existing) = users.iter_mut().find(|u| u.id == user.id) {
                *existing = user.clone();
            }
            Ok(())
        }
        
        async fn delete(&self, id: Uuid) -> Result<(), AppError> {
            let mut users = self.users.lock().unwrap();
            users.retain(|u| u.id != id);
            Ok(())
        }
    }
} 