use tokio::sync::mpsc::Receiver;
use sqlx::PgPool;
use uuid::Uuid;
use crate::services::persistence_event::YjsPersistenceEvent;
use crate::models::yjs_update::YjsDocumentUpdate; // Assuming this is the correct path
use hex;

async fn save_yjs_update(pool: &PgPool, event: &YjsPersistenceEvent) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // 🔒 CRITICAL SECURITY: Never use fallback UUIDs - fail fast to prevent data corruption
    let script_id = Uuid::parse_str(&event.script_id).map_err(|e| {
        tracing::error!("CRITICAL: Invalid script_id format '{}': {}. Rejecting update to prevent data corruption.", event.script_id, e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;
    
    sqlx::query_as::<_, YjsDocumentUpdate>(
        "INSERT INTO yjs_document_updates (script_id, user_id, update_data, created_at) VALUES ($1, $2, $3, $4) RETURNING id, script_id, user_id, update_data, created_at"
    )
    .bind(script_id)
    .bind(event.user_id) 
    .bind(&event.update_data)
    .bind(event.received_at) 
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("CRITICAL: Database error saving Yjs update for script_id '{}': {}. Data persistence failed!", event.script_id, e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;
    
    Ok(())
}

pub async fn run_async_db_writer(
    mut rx: Receiver<YjsPersistenceEvent>,
    pool: PgPool,
) {
    tracing::info!("Async DB Writer service started.");
    while let Some(event) = rx.recv().await {
        // Enhanced logging for debugging
        if event.update_data.len() <= 100 {
            tracing::error!("[DB_WRITER_RECEIVED] script: {}, user: {:?}, size: {}, full_hex: {}",
                event.script_id, event.user_id, event.update_data.len(), hex::encode(&event.update_data));
        } else {
            tracing::error!("[DB_WRITER_RECEIVED] script: {}, user: {:?}, size: {}, first_50_hex: {}",
                event.script_id, event.user_id, event.update_data.len(), 
                hex::encode(&event.update_data[..event.update_data.len().min(50)]));
        }
        
        // Validate update before storing
        if event.update_data.len() >= 2 {
            let msg_type = event.update_data[0];
            tracing::error!("[DB_WRITER_VALIDATE] script: {}, msg_type: {:#04x}, size: {}",
                event.script_id, msg_type, event.update_data.len());
            
            // Check for suspicious patterns
            if msg_type == 0x00 && event.update_data.len() < 10 {
                // Small updates starting with 0x00 can be problematic
                tracing::error!("[DB_WRITER_WARNING] Suspicious small update pattern detected for script: {}",
                    event.script_id);
            }
        }
        
        match save_yjs_update(&pool, &event).await {
            Ok(_) => {
                tracing::info!("✅ Successfully saved Yjs update to DB for script_id: {} from user_id: {:?} ({}bytes) - will be processed by snapshotting service", 
                    event.script_id, event.user_id, event.update_data.len());
            }
            Err(e) => {
                tracing::error!(
                    "❌ CRITICAL: Failed to save Yjs update for script_id: {} from user_id: {:?}. Error: {}. DATA PERSISTENCE FAILED!",
                    event.script_id, event.user_id, e
                );
                // 🔒 CRITICAL SECURITY: Never ignore persistence failures
                // This error indicates potential data loss and should be investigated immediately
                // TODO: Implement retry logic or dead-letter queue as per YJS_PERSISTENCE_STRATEGY.md
                // For now, logging as CRITICAL to ensure monitoring systems catch this
            }
        }
    }
    tracing::info!("Async DB Writer service stopped as channel was closed.");
} 