use std::sync::Arc;
use sqlx::{PgPool, QueryBuilder};
use tokio::time::{timeout, Duration};
use uuid::Uuid;
use tracing::{info, error, debug, trace};
use std::process::Command;

/// Get current process memory usage in MB
fn get_process_memory() -> f64 {
    if let Ok(output) = Command::new("ps")
        .args(&["--no-headers", "-o", "rss", "-p", &std::process::id().to_string()])
        .output()
    {
        if let Ok(rss_str) = String::from_utf8(output.stdout) {
            if let Ok(rss_kb) = rss_str.trim().parse::<f64>() {
                return rss_kb / 1024.0; // Convert KB to MB
            }
        }
    }
    0.0
}

use super::{YjsProcessorService, ContentExtractorService, HtmlParserService};
use super::content_extractor_service::ContentBlock;

pub struct SnapshotCoordinatorService {
    pool: Arc<PgPool>,
    yjs_processor: YjsProcessorService,
    content_extractor: ContentExtractorService,
    html_parser: HtmlParserService,
}

impl SnapshotCoordinatorService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            yjs_processor: YjsProcessorService::new(pool.clone()),
            content_extractor: ContentExtractorService::new(),
            html_parser: HtmlParserService::new(pool.clone()),
            pool,
        }
    }

    /// Creates a complete snapshot for a script
    pub async fn create_snapshot(&self, script_id: Uuid) -> Result<(), anyhow::Error> {
        let start_mem = get_process_memory();
        error!("[SNAPSHOT_START] script: {}, memory: {} MB", script_id, start_mem);

        // Get last processed update ID
        let last_processed_id = self.get_last_processed_update_id(script_id).await?;
        error!("[SNAPSHOT_LAST_ID] script: {}, last_processed_id: {}", script_id, last_processed_id);

        // Fetch and process YJS updates
        let before_fetch_mem = get_process_memory();
        error!("[SNAPSHOT_FETCH_START] script: {}, memory: {} MB", script_id, before_fetch_mem);
        
        let updates = self.yjs_processor.fetch_updates_since(script_id, last_processed_id).await?;
        
        let after_fetch_mem = get_process_memory();
        if updates.is_empty() {
            error!("[SNAPSHOT_NO_UPDATES] script: {}, memory_delta: {} MB", 
                  script_id, after_fetch_mem - before_fetch_mem);
        } else {
            error!("[SNAPSHOT_UPDATES_FETCHED] script: {}, count: {}, memory_delta: {} MB", 
                  script_id, updates.len(), after_fetch_mem - before_fetch_mem);
        }

        // Create and bootstrap YJS document
        let before_doc_mem = get_process_memory();
        error!("[SNAPSHOT_CREATE_DOC] script: {}, memory_before: {} MB", script_id, before_doc_mem);
        let doc = self.yjs_processor.create_document();
        
        let after_doc_mem = get_process_memory();
        error!("[SNAPSHOT_DOC_CREATED] script: {}, memory_delta: {} MB", 
              script_id, after_doc_mem - before_doc_mem);
        
        // Apply updates to the document
        let before_apply_mem = get_process_memory();
        error!("[SNAPSHOT_APPLY_START] script: {}, update_count: {}, memory: {} MB", 
              script_id, updates.len(), before_apply_mem);
        
        let last_applied_id = match self.yjs_processor.apply_updates(&doc, &updates, script_id) {
            Ok(id) => {
                let after_apply_mem = get_process_memory();
                error!("[SNAPSHOT_APPLY_SUCCESS] script: {}, last_id: {:?}, memory_delta: {} MB", 
                      script_id, id, after_apply_mem - before_apply_mem);
                id
            },
            Err(e) => {
                let after_apply_mem = get_process_memory();
                error!("[SNAPSHOT_APPLY_ERROR] script: {}, error: {}, memory_delta: {} MB, backtrace: {:?}", 
                      script_id, e, after_apply_mem - before_apply_mem, std::backtrace::Backtrace::capture());
                return Err(e);
            }
        };
        
        // Extract content blocks from the document
        let before_extract_mem = get_process_memory();
        error!("[SNAPSHOT_EXTRACT_START] script: {}, memory: {} MB", script_id, before_extract_mem);
        
        let mut content_blocks = self.content_extractor.extract_content_blocks(&doc, script_id)?;
        
        let after_extract_mem = get_process_memory();
        error!("[SNAPSHOT_EXTRACT_DONE] script: {}, blocks: {}, memory_delta: {} MB", 
              script_id, content_blocks.len(), after_extract_mem - before_extract_mem);
        
        // If no blocks found, try HTML snapshot fallback
        if content_blocks.is_empty() {
            content_blocks = self.try_html_snapshot_fallback(script_id).await?;
        }
        
        // Persist the blocks to database
        self.persist_blocks(script_id, content_blocks).await?;
        
        // Update snapshot metadata
        let final_last_processed_id = last_applied_id.unwrap_or(last_processed_id);
        self.update_snapshot_metadata(script_id, final_last_processed_id).await?;
        
        let end_mem = get_process_memory();
        error!("[SNAPSHOT_COMPLETE] script: {}, total_memory_delta: {} MB, final_memory: {} MB", 
              script_id, end_mem - start_mem, end_mem);
        Ok(())
    }

    /// Gets the last processed update ID for a script
    async fn get_last_processed_update_id(&self, script_id: Uuid) -> Result<i64, anyhow::Error> {
        let last_meta: Option<(Option<i64>,)> = sqlx::query_as(
            "SELECT last_processed_update_id FROM script_snapshots_meta WHERE script_id = $1"
        )
        .bind(script_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("DB error fetching last snapshot meta for {}: {}", script_id, e))?;

        Ok(last_meta.map_or(0, |(val,)| val.unwrap_or(0)))
    }

    /// Tries to create blocks from HTML snapshot as fallback
    async fn try_html_snapshot_fallback(&self, script_id: Uuid) -> Result<Vec<ContentBlock>, anyhow::Error> {
        debug!("Content snapshot fallback: No blocks from YJS, trying content snapshot...");
        
        if let Some((content, format)) = self.html_parser.fetch_content_snapshot(script_id).await? {
            info!("📸 Using enhanced content snapshot fallback for script_id: {}", script_id);
            
            match self.html_parser.parse_html_to_blocks(&content, script_id).await {
                Ok(parsed_blocks) => {
                    let mut blocks = Vec::new();
                    for (index, (block_type, block_content, page_number)) in parsed_blocks.into_iter().enumerate() {
                        blocks.push(ContentBlock {
                            block_type,
                            content: Some(block_content),
                            block_order: index as i32,
                            page_number,
                            metadata: Some(serde_json::json!({
                                "source": "content_snapshot_parsed",
                                "format": format.clone().unwrap_or_else(|| "html".to_string()),
                                "fallback_reason": "yjs_reconstruction_failed",
                                "page_number": page_number
                            })),
                        });
                    }
                    info!("✅ Created {} structured blocks from content snapshot", blocks.len());
                    return Ok(blocks);
                }
                Err(e) => {
                    error!("Failed to parse content snapshot HTML: {}. Falling back to single content block.", e);
                    // Fallback to single block
                    return Ok(vec![ContentBlock {
                        block_type: "content".to_string(),
                        content: Some(content),
                        block_order: 0,
                        page_number: 1,
                        metadata: Some(serde_json::json!({
                            "source": "content_snapshot",
                            "format": format.unwrap_or_else(|| "html".to_string()),
                            "fallback_reason": "yjs_reconstruction_failed_and_parse_failed"
                        })),
                    }]);
                }
            }
        }
        
        Ok(vec![])
    }

    /// Persists content blocks to the database
    async fn persist_blocks(&self, script_id: Uuid, blocks: Vec<ContentBlock>) -> Result<(), anyhow::Error> {
        if blocks.is_empty() {
            trace!("No blocks to persist for script_id: {}", script_id);
            return Ok(());
        }

        // Check for recent uploads to prevent overwriting
        if self.has_recent_uploads(script_id).await? {
            info!("🛡️ Skipping block overwrite for script_id: {} - contains recently uploaded content", script_id);
            return Ok(());
        }

        info!("Persisting {} blocks for script_id: {}", blocks.len(), script_id);
        
        // Use transaction with timeout for safety
        let transaction_timeout = Duration::from_secs(30);
        let pool_clone = self.pool.clone();
        let blocks_clone = blocks.clone();
        
        let result = timeout(transaction_timeout, async move {
            let mut db_tx = pool_clone.begin().await?;

            // Delete old blocks
            sqlx::query("DELETE FROM blocks WHERE script_id = $1")
                .bind(script_id)
                .execute(&mut *db_tx)
                .await?;
            
            trace!("Deleted old blocks for script_id: {}", script_id);

            // Batch insert new blocks
            if !blocks_clone.is_empty() {
                let mut query_builder = QueryBuilder::new(
                    "INSERT INTO blocks (script_id, block_type, content, block_order, page_number, metadata) "
                );
                
                query_builder.push_values(blocks_clone.iter(), |mut b, block| {
                    b.push_bind(script_id)
                     .push_bind(&block.block_type)
                     .push_bind(&block.content)
                     .push_bind(block.block_order)
                     .push_bind(block.page_number)
                     .push_bind(&block.metadata);
                });

                let batch_query = query_builder.build();
                batch_query.execute(&mut *db_tx).await?;
                
                trace!("Batch inserted {} blocks for script_id: {}", blocks_clone.len(), script_id);
            }

            db_tx.commit().await?;
            Ok::<(), anyhow::Error>(())
        }).await;

        match result {
            Ok(Ok(())) => {
                info!("✅ Successfully persisted {} blocks for script_id: {} (FAST BATCH)", blocks.len(), script_id);
                Ok(())
            }
            Ok(Err(e)) => {
                Err(anyhow::anyhow!("Database transaction failed for script {}: {}", script_id, e))
            }
            Err(_) => {
                Err(anyhow::anyhow!("Database transaction timed out after {} seconds for script {}", 
                                   transaction_timeout.as_secs(), script_id))
            }
        }
    }

    /// Checks if script has recent uploads that shouldn't be overwritten
    async fn has_recent_uploads(&self, script_id: Uuid) -> Result<bool, anyhow::Error> {
        let recent_upload_check = sqlx::query!(
            "SELECT COUNT(*) as count FROM blocks WHERE script_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'",
            script_id
        )
        .fetch_one(self.pool.as_ref())
        .await?;

        Ok(recent_upload_check.count.unwrap_or(0) > 0)
    }

    /// Updates snapshot metadata after successful processing
    async fn update_snapshot_metadata(&self, script_id: Uuid, last_processed_id: i64) -> Result<(), anyhow::Error> {
        sqlx::query(
            "INSERT INTO script_snapshots_meta (script_id, last_snapshot_at, last_processed_update_id) VALUES ($1, NOW(), $2) \
             ON CONFLICT (script_id) DO UPDATE SET last_snapshot_at = NOW(), last_processed_update_id = excluded.last_processed_update_id"
        )
        .bind(script_id)
        .bind(last_processed_id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to update script_snapshots_meta for script {}: {}", script_id, e))?;
        
        trace!("Updated script_snapshots_meta for script_id: {} with last_processed_id: {}", script_id, last_processed_id);
        Ok(())
    }

    /// Gets scripts that need snapshotting
    pub async fn get_scripts_needing_snapshot(&self) -> Result<Vec<Uuid>, anyhow::Error> {
        debug!("Checking for scripts needing snapshots...");
        
        let query = "
            WITH last_updates AS (
                SELECT 
                    script_id, 
                    MAX(created_at) as last_update_ts
                FROM yjs_document_updates
                GROUP BY script_id
            ),
            script_snapshot_info AS (
                SELECT 
                    script_id, 
                    last_snapshot_at,
                    last_processed_update_id
                FROM script_snapshots_meta
            )
            SELECT 
                lu.script_id
            FROM last_updates lu
            LEFT JOIN script_snapshot_info ssm ON lu.script_id = ssm.script_id
            WHERE 
                (ssm.last_snapshot_at IS NULL OR ssm.last_snapshot_at < NOW() - INTERVAL '5 seconds')
                OR
                (EXISTS (
                    SELECT 1 FROM yjs_document_updates ydu_check 
                    WHERE ydu_check.script_id = lu.script_id 
                    AND ydu_check.id > COALESCE(ssm.last_processed_update_id, 0)
                ))
            ORDER BY lu.script_id ASC";

        let scripts_to_snapshot: Vec<(Uuid,)> = sqlx::query_as(query)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch scripts needing snapshot: {}", e))?;

        let script_ids: Vec<Uuid> = scripts_to_snapshot.into_iter().map(|(id,)| id).collect();

        if !script_ids.is_empty() {
            info!("Found {} script(s) needing snapshot: {:?}", script_ids.len(), script_ids);
        } else {
            debug!("No scripts found needing snapshotting.");
        }
        
        Ok(script_ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_coordinator_creation() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let coordinator = SnapshotCoordinatorService::new(pool);
        
        // Test that coordinator can be created
        assert!(true);
    }

    #[tokio::test]
    async fn test_last_processed_update_id() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let coordinator = SnapshotCoordinatorService::new(pool);
        
        let script_id = uuid::Uuid::new_v4();
        let result = coordinator.get_last_processed_update_id(script_id).await.unwrap();
        
        // Should return 0 for non-existent script
        assert_eq!(result, 0);
    }
} 