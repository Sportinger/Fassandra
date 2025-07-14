//! Block repository for database operations.
//!
//! Provides clean abstractions for block-related database operations.

use async_trait::async_trait;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::models::block::Block;
use crate::error::AppError;

/// Repository trait for block operations
#[async_trait]
pub trait BlockRepository: Send + Sync {
    /// Find blocks by script ID
    async fn find_by_script_id(&self, script_id: Uuid) -> Result<Vec<Block>, AppError>;
    
    /// Create a new block
    async fn create(&self, block: &Block) -> Result<(), AppError>;
    
    /// Update an existing block
    async fn update(&self, block: &Block) -> Result<(), AppError>;
    
    /// Delete a block
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
}

/// PostgreSQL implementation of BlockRepository
pub struct PostgresBlockRepository {
    pool: Arc<PgPool>,
}

impl PostgresBlockRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BlockRepository for PostgresBlockRepository {
    async fn find_by_script_id(&self, script_id: Uuid) -> Result<Vec<Block>, AppError> {
        let blocks = sqlx::query_as!(
            Block,
            "SELECT id, script_id, block_type, content, block_order, page_number, created_at, metadata FROM blocks WHERE script_id = $1 ORDER BY block_order ASC",
            script_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(blocks)
    }
    
    async fn create(&self, block: &Block) -> Result<(), AppError> {
        sqlx::query!(
            "INSERT INTO blocks (id, script_id, block_type, content, block_order, page_number, created_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            block.id,
            block.script_id,
            block.block_type,
            block.content,
            block.block_order,
            block.page_number,
            block.created_at,
            block.metadata
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn update(&self, block: &Block) -> Result<(), AppError> {
        sqlx::query!(
            "UPDATE blocks SET block_type = $2, content = $3, block_order = $4, page_number = $5, metadata = $6 WHERE id = $1",
            block.id,
            block.block_type,
            block.content,
            block.block_order,
            block.page_number,
            block.metadata
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
    
    async fn delete(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            "DELETE FROM blocks WHERE id = $1",
            id
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Db(e))?;
        
        Ok(())
    }
} 