//! YJS Update repository for managing YJS document updates.
//!
//! Provides clean abstractions for YJS update-related database operations.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::error::AppError;

/// Represents a YJS update from the database
#[derive(Debug, Clone)]
pub struct YjsUpdate {
    pub id: i64,
    pub script_id: Uuid,
    pub update_data: Vec<u8>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub user_id: Option<Uuid>,
}

/// Repository trait for YJS update operations
#[async_trait]
pub trait YjsUpdateRepository: Send + Sync {
    /// Get updates for a script since a specific update ID
    async fn get_updates_since(&self, script_id: Uuid, since_id: i64) -> Result<Vec<YjsUpdate>, AppError>;
    
    /// Get all updates for a script
    async fn get_all_updates(&self, script_id: Uuid) -> Result<Vec<YjsUpdate>, AppError>;
    
    /// Store a new YJS update
    async fn store_update(&self, script_id: Uuid, update_data: Vec<u8>, user_id: Option<Uuid>) -> Result<i64, AppError>;
    
    /// Get the latest update ID for a script
    async fn get_latest_update_id(&self, script_id: Uuid) -> Result<Option<i64>, AppError>;
    
    /// Clean up old updates (keep only recent ones)
    async fn cleanup_old_updates(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError>;
    
    /// Get update count for a script
    async fn get_update_count(&self, script_id: Uuid) -> Result<i64, AppError>;
}

/// PostgreSQL implementation of YjsUpdateRepository
pub struct PostgresYjsUpdateRepository {
    pool: Arc<PgPool>,
}

impl PostgresYjsUpdateRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl YjsUpdateRepository for PostgresYjsUpdateRepository {
    async fn get_updates_since(&self, script_id: Uuid, since_id: i64) -> Result<Vec<YjsUpdate>, AppError> {
        let updates = sqlx::query_as!(
            YjsUpdate,
            r#"
            SELECT id, script_id, update_data, created_at, user_id
            FROM yjs_recent_updates
            WHERE script_id = $1 AND id > $2 AND is_compacted = false
            ORDER BY created_at ASC, id ASC
            "#,
            script_id,
            since_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(updates)
    }
    
    async fn get_all_updates(&self, script_id: Uuid) -> Result<Vec<YjsUpdate>, AppError> {
        let updates = sqlx::query_as!(
            YjsUpdate,
            r#"
            SELECT id, script_id, update_data, created_at, user_id
            FROM yjs_recent_updates
            WHERE script_id = $1
            ORDER BY created_at ASC, id ASC
            "#,
            script_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(updates)
    }
    
    async fn store_update(&self, script_id: Uuid, update_data: Vec<u8>, user_id: Option<Uuid>) -> Result<i64, AppError> {
        let record = sqlx::query!(
            r#"
            INSERT INTO yjs_recent_updates (script_id, update_data, user_id, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
            "#,
            script_id,
            update_data,
            user_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(record.id)
    }
    
    async fn get_latest_update_id(&self, script_id: Uuid) -> Result<Option<i64>, AppError> {
        let record = sqlx::query!(
            r#"
            SELECT id
            FROM yjs_recent_updates
            WHERE script_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            "#,
            script_id
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(record.map(|r| r.id))
    }
    
    async fn cleanup_old_updates(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            DELETE FROM yjs_recent_updates
            WHERE script_id = $1 AND id NOT IN (
                SELECT id FROM yjs_recent_updates
                WHERE script_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2
            )
            "#,
            script_id,
            keep_count
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn get_update_count(&self, script_id: Uuid) -> Result<i64, AppError> {
        let record = sqlx::query!(
            r#"
            SELECT COUNT(*) as count
            FROM yjs_recent_updates
            WHERE script_id = $1
            "#,
            script_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(record.count.unwrap_or(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;
    
    // Mock implementation for testing
    pub struct MockYjsUpdateRepository {
        updates: std::sync::Arc<std::sync::Mutex<Vec<YjsUpdate>>>,
        next_id: std::sync::Arc<std::sync::Mutex<i64>>,
    }
    
    impl MockYjsUpdateRepository {
        pub fn new() -> Self {
            Self {
                updates: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
                next_id: std::sync::Arc::new(std::sync::Mutex::new(1)),
            }
        }
        
        pub fn with_updates(updates: Vec<YjsUpdate>) -> Self {
            let next_id = updates.iter().map(|u| u.id).max().unwrap_or(0) + 1;
            Self {
                updates: std::sync::Arc::new(std::sync::Mutex::new(updates)),
                next_id: std::sync::Arc::new(std::sync::Mutex::new(next_id)),
            }
        }
    }
    
    #[async_trait]
    impl YjsUpdateRepository for MockYjsUpdateRepository {
        async fn get_updates_since(&self, script_id: Uuid, since_id: i64) -> Result<Vec<YjsUpdate>, AppError> {
            let updates = self.updates.lock().unwrap();
            Ok(updates.iter()
                .filter(|u| u.script_id == script_id && u.id > since_id)
                .cloned()
                .collect())
        }
        
        async fn get_all_updates(&self, script_id: Uuid) -> Result<Vec<YjsUpdate>, AppError> {
            let updates = self.updates.lock().unwrap();
            Ok(updates.iter()
                .filter(|u| u.script_id == script_id)
                .cloned()
                .collect())
        }
        
        async fn store_update(&self, script_id: Uuid, update_data: Vec<u8>, user_id: Option<Uuid>) -> Result<i64, AppError> {
            let mut updates = self.updates.lock().unwrap();
            let mut next_id = self.next_id.lock().unwrap();
            
            let id = *next_id;
            *next_id += 1;
            
            updates.push(YjsUpdate {
                id,
                script_id,
                update_data,
                created_at: Utc::now(),
                user_id,
            });
            
            Ok(id)
        }
        
        async fn get_latest_update_id(&self, script_id: Uuid) -> Result<Option<i64>, AppError> {
            let updates = self.updates.lock().unwrap();
            Ok(updates.iter()
                .filter(|u| u.script_id == script_id)
                .map(|u| u.id)
                .max())
        }
        
        async fn cleanup_old_updates(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError> {
            let mut updates = self.updates.lock().unwrap();
            
            // Get updates for this script, sort by ID desc, keep only the first keep_count
            let mut script_updates: Vec<_> = updates.iter()
                .filter(|u| u.script_id == script_id)
                .collect();
            script_updates.sort_by(|a, b| b.id.cmp(&a.id));
            
            let keep_ids: std::collections::HashSet<i64> = script_updates.iter()
                .take(keep_count as usize)
                .map(|u| u.id)
                .collect();
            
            updates.retain(|u| u.script_id != script_id || keep_ids.contains(&u.id));
            
            Ok(())
        }
        
        async fn get_update_count(&self, script_id: Uuid) -> Result<i64, AppError> {
            let updates = self.updates.lock().unwrap();
            Ok(updates.iter()
                .filter(|u| u.script_id == script_id)
                .count() as i64)
        }
    }
} 