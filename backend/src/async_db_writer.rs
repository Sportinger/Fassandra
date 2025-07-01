use tokio::sync::mpsc::Receiver;
use sqlx::PgPool;
use uuid::Uuid;
use crate::persistence_event::YjsPersistenceEvent;
use crate::models::yjs_update::YjsDocumentUpdate; // Assuming this is the correct path

async fn save_yjs_update(pool: &PgPool, event: &YjsPersistenceEvent) -> Result<(), sqlx::Error> {
    // Convert the string script_id to UUID
    let script_id = Uuid::parse_str(&event.script_id).unwrap_or_else(|_| {
        tracing::error!("Failed to parse script_id: {}", event.script_id);
        Uuid::nil() // Use a nil UUID as fallback - should be handled better in production
    });
    
    sqlx::query_as::<_, YjsDocumentUpdate>(
        "INSERT INTO yjs_document_updates (script_id, user_id, update_data, created_at) VALUES ($1, $2, $3, $4) RETURNING id, script_id, user_id, update_data, created_at"
    )
    .bind(script_id)
    .bind(event.user_id) 
    .bind(&event.update_data)
    .bind(event.received_at) 
    .fetch_one(pool)
    .await?;
    Ok(())
}

pub async fn run_async_db_writer(
    mut rx: Receiver<YjsPersistenceEvent>,
    pool: PgPool,
) {
    tracing::info!("Async DB Writer service started.");
    while let Some(event) = rx.recv().await {
        tracing::debug!("Received Yjs update for script {}: user {:?}, size: {} bytes", 
            event.script_id, event.user_id, event.update_data.len());
        
        match save_yjs_update(&pool, &event).await {
            Ok(_) => {
                tracing::info!("✅ Successfully saved Yjs update to DB for script_id: {} from user_id: {:?} ({}bytes) - will be processed by snapshotting service", 
                    event.script_id, event.user_id, event.update_data.len());
            }
            Err(e) => {
                tracing::error!(
                    "❌ Failed to save Yjs update for script_id: {} from user_id: {:?}. Error: {}",
                    event.script_id, event.user_id, e
                );
                // Implement retry logic or dead-letter queue as per YJS_PERSISTENCE_STRATEGY.md
                // For now, just logging the error.
            }
        }
    }
    tracing::info!("Async DB Writer service stopped as channel was closed.");
} 