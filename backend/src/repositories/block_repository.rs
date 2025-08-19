//! Block repository for database operations.
//!
//! NOTE: This functionality is deprecated - we now use YJS for script management

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
/// NOTE: Deprecated - returns empty results
pub struct PostgresBlockRepository {
    _pool: Arc<PgPool>,
}

impl PostgresBlockRepository {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { _pool: pool }
    }
}

#[async_trait]
impl BlockRepository for PostgresBlockRepository {
    async fn find_by_script_id(&self, _script_id: Uuid) -> Result<Vec<Block>, AppError> {
        // Deprecated - return empty
        Ok(vec![])
    }
    
    async fn create(&self, _block: &Block) -> Result<(), AppError> {
        // Deprecated - no-op
        Ok(())
    }
    
    async fn update(&self, _block: &Block) -> Result<(), AppError> {
        // Deprecated - no-op
        Ok(())
    }
    
    async fn delete(&self, _id: Uuid) -> Result<(), AppError> {
        // Deprecated - no-op
        Ok(())
    }
} 