//! Script repository for database operations.
//!
//! Provides clean abstractions for script-related database operations.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::models::script::Script;
use crate::error::AppError;

/// Repository trait for script operations
#[async_trait]
pub trait ScriptRepository: Send + Sync {
    /// Find a script by ID
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Script>, AppError>;
    
    /// Find all scripts for a user
    async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Script>, AppError>;
    
    /// Create a new script
    async fn create(&self, script: &Script) -> Result<(), AppError>;
    
    /// Update an existing script
    async fn update(&self, script: &Script) -> Result<(), AppError>;
    
    /// Delete a script
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
    
    /// Check if a script exists
    async fn exists(&self, id: Uuid) -> Result<bool, AppError>;
    
    /// Find scripts by title pattern
    async fn find_by_title_pattern(&self, pattern: &str) -> Result<Vec<Script>, AppError>;
}

/// PostgreSQL implementation of ScriptRepository
pub struct PostgresScriptRepository {
    pool: Arc<PgPool>,
}

impl PostgresScriptRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ScriptRepository for PostgresScriptRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Script>, AppError> {
        let script = sqlx::query_as!(
            Script,
            "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1",
            id
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(script)
    }
    
    async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Script>, AppError> {
        let scripts = sqlx::query_as!(
            Script,
            r#"
            SELECT DISTINCT s.id, s.title, s.created_by, s.created_at, s.is_public, s.thumbnail 
            FROM scripts s
            LEFT JOIN script_shares ss ON s.id = ss.script_id
            WHERE s.created_by = $1                    -- User's own scripts
               OR s.is_public = true                   -- Public scripts from anyone
               OR ss.shared_with_user_id = $1          -- Scripts shared with user
            ORDER BY s.created_at DESC
            "#,
            user_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(scripts)
    }
    
    async fn create(&self, script: &Script) -> Result<(), AppError> {
        sqlx::query!(
            "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) VALUES ($1, $2, $3, $4, $5, $6)",
            script.id,
            script.title,
            script.created_by,
            script.created_at,
            script.is_public,
            script.thumbnail
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn update(&self, script: &Script) -> Result<(), AppError> {
        sqlx::query!(
            "UPDATE scripts SET title = $2, is_public = $3, thumbnail = $4 WHERE id = $1",
            script.id,
            script.title,
            script.is_public,
            script.thumbnail
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn delete(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            "DELETE FROM scripts WHERE id = $1",
            id
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn exists(&self, id: Uuid) -> Result<bool, AppError> {
        let exists = sqlx::query!(
            "SELECT EXISTS(SELECT 1 FROM scripts WHERE id = $1)",
            id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(exists.exists.unwrap_or(false))
    }
    
    async fn find_by_title_pattern(&self, pattern: &str) -> Result<Vec<Script>, AppError> {
        let scripts = sqlx::query_as!(
            Script,
            "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE title ILIKE $1 ORDER BY created_at DESC",
            format!("%{}%", pattern)
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(scripts)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::models::script::Script;
    use chrono::Utc;
    use uuid::Uuid;
    
    // Mock implementation for testing
    pub struct MockScriptRepository {
        scripts: std::sync::Arc<std::sync::Mutex<Vec<Script>>>,
    }
    
    impl MockScriptRepository {
        pub fn new() -> Self {
            Self {
                scripts: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
            }
        }
        
        pub fn with_scripts(scripts: Vec<Script>) -> Self {
            Self {
                scripts: std::sync::Arc::new(std::sync::Mutex::new(scripts)),
            }
        }
    }
    
    #[async_trait]
    impl ScriptRepository for MockScriptRepository {
        async fn find_by_id(&self, id: Uuid) -> Result<Option<Script>, AppError> {
            let scripts = self.scripts.lock().unwrap();
            Ok(scripts.iter().find(|s| s.id == id).cloned())
        }
        
        async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Script>, AppError> {
            let scripts = self.scripts.lock().unwrap();
            Ok(scripts.iter()
                .filter(|s| {
                    s.created_by == Some(user_id) || // User's own scripts
                    s.is_public                      // Public scripts from anyone
                })
                .cloned()
                .collect())
        }
        
        async fn create(&self, script: &Script) -> Result<(), AppError> {
            let mut scripts = self.scripts.lock().unwrap();
            scripts.push(script.clone());
            Ok(())
        }
        
        async fn update(&self, script: &Script) -> Result<(), AppError> {
            let mut scripts = self.scripts.lock().unwrap();
            if let Some(existing) = scripts.iter_mut().find(|s| s.id == script.id) {
                *existing = script.clone();
            }
            Ok(())
        }
        
        async fn delete(&self, id: Uuid) -> Result<(), AppError> {
            let mut scripts = self.scripts.lock().unwrap();
            scripts.retain(|s| s.id != id);
            Ok(())
        }
        
        async fn exists(&self, id: Uuid) -> Result<bool, AppError> {
            let scripts = self.scripts.lock().unwrap();
            Ok(scripts.iter().any(|s| s.id == id))
        }
        
        async fn find_by_title_pattern(&self, pattern: &str) -> Result<Vec<Script>, AppError> {
            let scripts = self.scripts.lock().unwrap();
            Ok(scripts.iter()
                .filter(|s| s.title.to_lowercase().contains(&pattern.to_lowercase()))
                .cloned()
                .collect())
        }
    }
} 