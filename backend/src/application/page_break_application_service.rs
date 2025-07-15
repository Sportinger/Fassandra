//! Page Break Application Service
//!
//! Orchestrates page break management workflows.
//! Handles complex business logic around page numbering and block ordering.

use std::sync::Arc;
use uuid::Uuid;
use sqlx::PgPool;
use chrono::{DateTime, Utc};
use serde::Serialize;
use tracing::{info, warn};
use anyhow::{Result, Context};
use crate::error::AppError;
use crate::models::script::Script;
use crate::domain::script_service::ScriptService;
use crate::repositories::script_repository::{ScriptRepository, PostgresScriptRepository};
use crate::repositories::user_repository::{UserRepository, PostgresUserRepository};
use crate::repositories::block_repository::{BlockRepository, PostgresBlockRepository};

/// Request payload for updating page breaks
#[derive(Debug, serde::Deserialize)]
pub struct UpdatePageBreaksRequest {
    /// List of blocks with their updated page numbers
    pub blocks: Vec<BlockPageUpdate>,
}

/// Individual block page number update
#[derive(Debug, serde::Deserialize)]
pub struct BlockPageUpdate {
    /// Block ID
    pub block_id: Uuid,
    /// New page number for the block
    pub page_number: i32,
}

/// Response for getting page breaks
#[derive(Debug, serde::Serialize)]
pub struct PageBreaksResponse {
    /// Script ID
    pub script_id: Uuid,
    /// List of blocks with their page numbers
    pub blocks: Vec<BlockPageInfo>,
}

/// Block page information
#[derive(Debug, serde::Serialize)]
pub struct BlockPageInfo {
    /// Block ID
    pub block_id: Uuid,
    /// Block type
    pub block_type: String,
    /// Block content preview (first 100 chars)
    pub content_preview: String,
    /// Current page number
    pub page_number: i32,
    /// Block order within the script
    pub block_order: i32,
}

/// Application service for page break operations
pub struct PageBreakApplicationService {
    script_service: Arc<ScriptService>,
    pool: Arc<PgPool>,
}

impl PageBreakApplicationService {
    /// Creates a new PageBreakApplicationService
    pub fn new(script_service: Arc<ScriptService>, pool: Arc<PgPool>) -> Self {
        Self {
            script_service,
            pool,
        }
    }

    /// Gets page break information for a script with proper authorization
    pub async fn get_page_breaks(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<PageBreaksResponse, AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Getting page breaks for script");

        // Verify script access through domain service
        self.script_service.verify_script_access(script_id, user_id).await?;

        // Get blocks with page information
        let blocks = sqlx::query!(
            "SELECT id, block_type, content, page_number, block_order 
             FROM blocks 
             WHERE script_id = $1 
             ORDER BY page_number ASC, block_order ASC",
            script_id
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        let block_info: Vec<BlockPageInfo> = blocks
            .into_iter()
            .map(|block| {
                let content_preview = if block.content.len() > 100 {
                    format!("{}...", &block.content[..100])
                } else {
                    block.content
                };

                BlockPageInfo {
                    block_id: block.id,
                    block_type: block.block_type,
                    content_preview,
                    page_number: block.page_number,
                    block_order: block.block_order,
                }
            })
            .collect();

        let response = PageBreaksResponse {
            script_id,
            blocks: block_info,
        };

        info!(user_id = %user_id, script_id = %script_id, block_count = response.blocks.len(), "Successfully retrieved page breaks");
        Ok(response)
    }

    /// Updates page breaks for a script with proper authorization and validation
    pub async fn update_page_breaks(
        &self,
        script_id: Uuid,
        user_id: Uuid,
        request: UpdatePageBreaksRequest,
    ) -> Result<(), AppError> {
        info!(user_id = %user_id, script_id = %script_id, "Updating page breaks for script");

        // Verify script write access through domain service
        self.script_service.verify_script_write_access(script_id, user_id).await?;

        // Business validation for page break updates
        self.validate_page_break_updates(script_id, &request).await?;

        // Execute the updates in a transaction
        self.execute_page_break_updates(script_id, request).await?;

        info!(user_id = %user_id, script_id = %script_id, "Successfully updated page breaks");
        Ok(())
    }

    /// Validates page break update requests
    async fn validate_page_break_updates(
        &self,
        script_id: Uuid,
        request: &UpdatePageBreaksRequest,
    ) -> Result<(), AppError> {
        // Check if all blocks belong to the script
        for block_update in &request.blocks {
            let block_exists = sqlx::query!(
                "SELECT id FROM blocks WHERE id = $1 AND script_id = $2",
                block_update.block_id,
                script_id
            )
            .fetch_optional(self.pool.as_ref())
            .await?
            .is_some();

            if !block_exists {
                warn!("Block {} does not belong to script {}", block_update.block_id, script_id);
                return Err(AppError::BadRequest("One or more blocks do not belong to this script".into()));
            }

            // Validate page number range
            if block_update.page_number < 1 {
                warn!("Invalid page number {} for block {}", block_update.page_number, block_update.block_id);
                return Err(AppError::BadRequest("Page numbers must be greater than 0".into()));
            }
        }

        Ok(())
    }

    /// Executes page break updates in a transaction
    async fn execute_page_break_updates(
        &self,
        script_id: Uuid,
        request: UpdatePageBreaksRequest,
    ) -> Result<(), AppError> {
        // Start transaction for atomic updates
        let mut tx = self.pool.begin().await?;

        // Update page numbers for each block
        for block_update in request.blocks {
            sqlx::query!(
                "UPDATE blocks SET page_number = $1 WHERE id = $2 AND script_id = $3",
                block_update.page_number,
                block_update.block_id,
                script_id
            )
            .execute(&mut *tx)
            .await?;
        }

        // Commit transaction
        tx.commit().await?;

        Ok(())
    }

    /// Gets page break statistics for a script
    pub async fn get_page_break_statistics(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<PageBreakStatistics, AppError> {
        // Verify script access
        self.script_service.verify_script_access(script_id, user_id).await?;

        let stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_blocks,
                MAX(page_number) as max_page,
                MIN(page_number) as min_page,
                COUNT(DISTINCT page_number) as total_pages
            FROM blocks 
            WHERE script_id = $1
            "#,
            script_id
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(PageBreakStatistics {
            script_id,
            total_blocks: stats.total_blocks.unwrap_or(0) as usize,
            total_pages: stats.total_pages.unwrap_or(0) as usize,
            max_page: stats.max_page.unwrap_or(0),
            min_page: stats.min_page.unwrap_or(0),
        })
    }

    /// Reorders blocks within a page based on block_order
    pub async fn reorder_blocks_within_page(
        &self,
        script_id: Uuid,
        user_id: Uuid,
        page_number: i32,
        block_order_updates: Vec<BlockOrderUpdate>,
    ) -> Result<(), AppError> {
        info!(user_id = %user_id, script_id = %script_id, page_number = page_number, "Reordering blocks within page");

        // Verify script write access
        self.script_service.verify_script_write_access(script_id, user_id).await?;

        // Validate block order updates
        self.validate_block_order_updates(script_id, page_number, &block_order_updates).await?;

        // Execute the reordering
        self.execute_block_order_updates(script_id, page_number, block_order_updates).await?;

        info!(user_id = %user_id, script_id = %script_id, page_number = page_number, "Successfully reordered blocks within page");
        Ok(())
    }

    /// Validates block order updates
    async fn validate_block_order_updates(
        &self,
        script_id: Uuid,
        page_number: i32,
        updates: &[BlockOrderUpdate],
    ) -> Result<(), AppError> {
        // Check if all blocks belong to the script and page
        for update in updates {
            let block_exists = sqlx::query!(
                "SELECT id FROM blocks WHERE id = $1 AND script_id = $2 AND page_number = $3",
                update.block_id,
                script_id,
                page_number
            )
            .fetch_optional(self.pool.as_ref())
            .await?
            .is_some();

            if !block_exists {
                warn!("Block {} does not belong to script {} page {}", update.block_id, script_id, page_number);
                return Err(AppError::BadRequest("One or more blocks do not belong to this script/page".into()));
            }
        }

        Ok(())
    }

    /// Executes block order updates
    async fn execute_block_order_updates(
        &self,
        script_id: Uuid,
        page_number: i32,
        updates: Vec<BlockOrderUpdate>,
    ) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await?;

        for update in updates {
            sqlx::query!(
                "UPDATE blocks SET block_order = $1 WHERE id = $2 AND script_id = $3 AND page_number = $4",
                update.new_order,
                update.block_id,
                script_id,
                page_number
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}

/// Statistics about page breaks for a script
#[derive(Debug, serde::Serialize)]
pub struct PageBreakStatistics {
    pub script_id: Uuid,
    pub total_blocks: usize,
    pub total_pages: usize,
    pub max_page: i32,
    pub min_page: i32,
}

/// Block order update for reordering within a page
#[derive(Debug, serde::Deserialize)]
pub struct BlockOrderUpdate {
    pub block_id: Uuid,
    pub new_order: i32,
} 