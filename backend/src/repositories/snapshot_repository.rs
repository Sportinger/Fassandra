//! Snapshot repository for managing script snapshots.
//!
//! Provides clean abstractions for script snapshot-related database operations.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::error::AppError;

/// Represents a script snapshot meta record
#[derive(Debug, Clone)]
pub struct SnapshotMeta {
    pub script_id: Uuid,
    pub last_processed_update_id: Option<i64>,
    pub last_snapshot_at: chrono::DateTime<chrono::Utc>,
}

/// Repository trait for snapshot operations
#[async_trait]
pub trait SnapshotRepository: Send + Sync {
    /// Get the latest snapshot meta for a script
    async fn get_latest_meta(&self, script_id: Uuid) -> Result<Option<SnapshotMeta>, AppError>;
    
    /// Create or update snapshot meta
    async fn upsert_meta(&self, script_id: Uuid, last_processed_update_id: i64, content_snapshot: Option<String>) -> Result<(), AppError>;
    
    /// Get all snapshots for a script
    async fn get_all_snapshots(&self, script_id: Uuid) -> Result<Vec<SnapshotMeta>, AppError>;
    
    /// Delete old snapshots (keep only recent ones)
    async fn cleanup_old_snapshots(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError>;
    
    /// Check if a snapshot exists for a script
    async fn exists(&self, script_id: Uuid) -> Result<bool, AppError>;
    
    /// Get snapshot count for a script
    async fn get_snapshot_count(&self, script_id: Uuid) -> Result<i64, AppError>;
}

/// PostgreSQL implementation of SnapshotRepository
pub struct PostgresSnapshotRepository {
    pool: Arc<PgPool>,
}

impl PostgresSnapshotRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SnapshotRepository for PostgresSnapshotRepository {
    async fn get_latest_meta(&self, script_id: Uuid) -> Result<Option<SnapshotMeta>, AppError> {
        let snapshot = sqlx::query_as!(
            SnapshotMeta,
            r#"
            SELECT script_id, last_processed_update_id, last_snapshot_at
            FROM script_snapshots_meta
            WHERE script_id = $1
            "#,
            script_id
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(snapshot)
    }
    
    async fn upsert_meta(&self, script_id: Uuid, last_processed_update_id: i64, content_snapshot: Option<String>) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            INSERT INTO script_snapshots_meta (script_id, last_processed_update_id, content_snapshot, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (script_id) DO UPDATE SET
                last_processed_update_id = EXCLUDED.last_processed_update_id,
                content_snapshot = EXCLUDED.content_snapshot,
                created_at = EXCLUDED.created_at
            "#,
            script_id,
            last_processed_update_id,
            content_snapshot
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn get_all_snapshots(&self, script_id: Uuid) -> Result<Vec<SnapshotMeta>, AppError> {
        let snapshots = sqlx::query_as!(
            SnapshotMeta,
            r#"
            SELECT script_id, last_processed_update_id, last_snapshot_at
            FROM script_snapshots_meta
            WHERE script_id = $1
            ORDER BY last_snapshot_at DESC
            "#,
            script_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(snapshots)
    }
    
    async fn cleanup_old_snapshots(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            DELETE FROM script_snapshots_meta
            WHERE script_id = $1 AND last_snapshot_at NOT IN (
                SELECT last_snapshot_at FROM script_snapshots_meta
                WHERE script_id = $1
                ORDER BY last_snapshot_at DESC
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
    
    async fn exists(&self, script_id: Uuid) -> Result<bool, AppError> {
        let exists = sqlx::query!(
            r#"
            SELECT EXISTS(SELECT 1 FROM script_snapshots_meta WHERE script_id = $1)
            "#,
            script_id
        )
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(exists.exists.unwrap_or(false))
    }
    
    async fn get_snapshot_count(&self, script_id: Uuid) -> Result<i64, AppError> {
        let record = sqlx::query!(
            r#"
            SELECT COUNT(*) as count
            FROM script_snapshots_meta
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
    pub struct MockSnapshotRepository {
        snapshots: std::sync::Arc<std::sync::Mutex<Vec<SnapshotMeta>>>,
        next_id: std::sync::Arc<std::sync::Mutex<i64>>,
    }
    
    impl MockSnapshotRepository {
        pub fn new() -> Self {
            Self {
                snapshots: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
                next_id: std::sync::Arc::new(std::sync::Mutex::new(1)),
            }
        }
        
        pub fn with_snapshots(snapshots: Vec<SnapshotMeta>) -> Self {
            let next_id = snapshots.iter().map(|s| s.id).max().unwrap_or(0) + 1;
            Self {
                snapshots: std::sync::Arc::new(std::sync::Mutex::new(snapshots)),
                next_id: std::sync::Arc::new(std::sync::Mutex::new(next_id)),
            }
        }
    }
    
    #[async_trait]
    impl SnapshotRepository for MockSnapshotRepository {
        async fn get_latest_meta(&self, script_id: Uuid) -> Result<Option<SnapshotMeta>, AppError> {
            let snapshots = self.snapshots.lock().unwrap();
            Ok(snapshots.iter()
                .filter(|s| s.script_id == script_id)
                .max_by_key(|s| s.created_at)
                .cloned())
        }
        
        async fn upsert_meta(&self, script_id: Uuid, last_processed_update_id: i64, content_snapshot: Option<String>) -> Result<(), AppError> {
            let mut snapshots = self.snapshots.lock().unwrap();
            let mut next_id = self.next_id.lock().unwrap();
            
            // Remove existing snapshot for this script_id
            snapshots.retain(|s| s.script_id != script_id);
            
            // Add new snapshot
            let id = *next_id;
            *next_id += 1;
            
            snapshots.push(SnapshotMeta {
                script_id,
                last_processed_update_id: Some(last_processed_update_id),
                last_snapshot_at: Utc::now(),
            });
            
            Ok(())
        }
        
        async fn get_all_snapshots(&self, script_id: Uuid) -> Result<Vec<SnapshotMeta>, AppError> {
            let snapshots = self.snapshots.lock().unwrap();
            Ok(snapshots.iter()
                .filter(|s| s.script_id == script_id)
                .cloned()
                .collect())
        }
        
        async fn cleanup_old_snapshots(&self, script_id: Uuid, keep_count: i64) -> Result<(), AppError> {
            let mut snapshots = self.snapshots.lock().unwrap();
            
            // Get snapshots for this script, sort by created_at desc, keep only the first keep_count
            let mut script_snapshots: Vec<_> = snapshots.iter()
                .filter(|s| s.script_id == script_id)
                .collect();
            script_snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            
            let keep_ids: std::collections::HashSet<i64> = script_snapshots.iter()
                .take(keep_count as usize)
                .map(|s| s.id)
                .collect();
            
            snapshots.retain(|s| s.script_id != script_id || keep_ids.contains(&s.id));
            
            Ok(())
        }
        
        async fn exists(&self, script_id: Uuid) -> Result<bool, AppError> {
            let snapshots = self.snapshots.lock().unwrap();
            Ok(snapshots.iter().any(|s| s.script_id == script_id))
        }
        
        async fn get_snapshot_count(&self, script_id: Uuid) -> Result<i64, AppError> {
            let snapshots = self.snapshots.lock().unwrap();
            Ok(snapshots.iter()
                .filter(|s| s.script_id == script_id)
                .count() as i64)
        }
    }
} 