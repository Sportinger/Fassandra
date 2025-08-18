use yrs::{
    self,
    sync::{Message as YrsSyncMessage, SyncMessage as YrsInnerSyncMessage},
    updates::decoder::{Decode as YrsDecodeTrait, DecoderV1},
    Doc, ReadTxn, Transact, Update,
    WriteTxn,
    XmlFragment,
};
use yrs::encoding::read::Cursor as YrsIoCursor;
use tracing::{error, warn, debug, trace};
use uuid::Uuid;
use std::sync::Arc;
use sqlx::PgPool;
use hex;

/// Get current memory usage in bytes (simplified version using process memory)
fn get_memory_usage() -> usize {
    // For now, use process memory as a proxy
    if let Ok(output) = std::process::Command::new("ps")
        .args(&["--no-headers", "-o", "rss", "-p", &std::process::id().to_string()])
        .output()
    {
        if let Ok(rss_str) = String::from_utf8(output.stdout) {
            if let Ok(rss_kb) = rss_str.trim().parse::<usize>() {
                return rss_kb * 1024; // Convert KB to bytes
            }
        }
    }
    0
}

/// Format bytes into human-readable string
fn format_bytes(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.2} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

#[derive(Debug)]
pub struct YjsUpdate {
    pub id: i64,
    pub update_data: Vec<u8>,
}

pub struct YjsProcessorService {
    pool: Arc<PgPool>,
}

impl YjsProcessorService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Creates a new YJS document with bootstrapped fragments
    pub fn create_document(&self) -> Doc {
        let doc = Doc::new();
        
        // Bootstrap the document with required fragments
        self.bootstrap_document(&doc);
        
        doc
    }

    /// Bootstraps a YJS document with required fragments
    fn bootstrap_document(&self, doc: &Doc) {
        // Ensure that the Yjs document starts with the XmlFragments that the
        // frontend editor writes to ("default", "content", "prosemirror").
        // If these fragments don't exist _before_ we apply updates, any ops
        // targeting them are effectively no-ops and the document stays empty.
        let mut bootstrap_txn = doc.transact_mut();
        for name in ["default", "content", "prosemirror"] {
            // Create both XmlFragment (for structured content) and YText (for plain text content)
            bootstrap_txn.get_or_insert_xml_fragment(name);
            bootstrap_txn.get_or_insert_text(name);
        }
    }

    /// Fetches YJS updates from database since the last processed update
    pub async fn fetch_updates_since(&self, script_id: Uuid, last_processed_id: i64) -> Result<Vec<YjsUpdate>, anyhow::Error> {
        let before_mem = get_memory_usage();
        error!("[FETCH_START] Script: {}, last_id: {}, memory: {}", 
               script_id, last_processed_id, format_bytes(before_mem));
        
        let updates = sqlx::query_as!(
            YjsUpdate,
            r#"
            SELECT id, update_data
            FROM yjs_recent_updates
            WHERE script_id = $1 AND id > $2
            ORDER BY created_at ASC, id ASC
            "#,
            script_id,
            last_processed_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("DB error fetching Yjs updates for script {}: {}", script_id, e))?;
        
        let after_mem = get_memory_usage();
        let total_size: usize = updates.iter().map(|u| u.update_data.len()).sum();
        
        error!("[FETCH_COMPLETE] Script: {}, fetched: {} updates, total_size: {}, memory_delta: {}", 
               script_id, updates.len(), format_bytes(total_size), 
               format_bytes(after_mem.saturating_sub(before_mem)));
        
        // Log first few updates for debugging
        for (idx, update) in updates.iter().take(3).enumerate() {
            error!("[DB_UPDATE] idx: {}, id: {}, size: {}, first_50_hex: {:?}", 
                   idx, update.id, update.update_data.len(),
                   hex::encode(&update.update_data[..update.update_data.len().min(50)]));
        }
        
        Ok(updates)
    }

    /// Applies YJS updates to a document and returns the last successfully applied update ID
    pub fn apply_updates(&self, doc: &Doc, updates: &[YjsUpdate], script_id: Uuid) -> Result<Option<i64>, anyhow::Error> {
        if updates.is_empty() {
            return Ok(None);
        }

        let mut last_successfully_applied_id: Option<i64> = None;
        
        // Scope for the mutable transaction to apply updates
        {
            let mut txn = doc.transact_mut();
            
            for db_update in updates {
                let payload = &db_update.update_data;
                if payload.is_empty() {
                    warn!("Skipping empty Yjs update payload for script_id: {}, update_id: {}", script_id, db_update.id);
                    continue;
                }
                
                let before_apply_mem = get_memory_usage();
                error!("[APPLY_UPDATE_START] update_id: {}, script: {}, size: {}, memory: {}, first_50_hex: {:?}", 
                      db_update.id, script_id, payload.len(), format_bytes(before_apply_mem),
                      hex::encode(&payload[..payload.len().min(50)]));

                // Try to decode and apply the update
                match self.decode_and_apply_update(&mut txn, payload, script_id, db_update.id) {
                    Ok(()) => {
                        let after_apply_mem = get_memory_usage();
                        error!("[APPLY_UPDATE_SUCCESS] update_id: {}, memory_delta: {}", 
                              db_update.id, format_bytes(after_apply_mem.saturating_sub(before_apply_mem)));
                        last_successfully_applied_id = Some(db_update.id);
                    }
                    Err(e) => {
                        let after_apply_mem = get_memory_usage();
                        error!("[APPLY_UPDATE_FAILED] update_id: {}, script: {}, error: {}, memory_delta: {}, backtrace: {:?}", 
                              db_update.id, script_id, e, 
                              format_bytes(after_apply_mem.saturating_sub(before_apply_mem)),
                              std::backtrace::Backtrace::capture());
                        break; // Stop processing on first error
                    }
                }
            }
        }
        
        // Log document state after applying updates
        self.log_document_state(doc, script_id);
        
        Ok(last_successfully_applied_id)
    }

    /// Decodes and applies a single YJS update
    fn decode_and_apply_update(
        &self,
        txn: &mut yrs::TransactionMut,
        payload: &[u8],
        script_id: Uuid,
        update_id: i64,
    ) -> Result<(), anyhow::Error> {
        // Safety check: Updates should not be unreasonably large
        const MAX_UPDATE_PAYLOAD_SIZE: usize = 10_000_000; // 10MB max for update payload
        if payload.len() > MAX_UPDATE_PAYLOAD_SIZE {
            error!("Update payload too large ({} bytes) for script {}, update {}", payload.len(), script_id, update_id);
            return Err(anyhow::anyhow!("Update payload exceeds maximum size of {} bytes", MAX_UPDATE_PAYLOAD_SIZE));
        }
        
        // Log full update for small updates that might be problematic
        if payload.len() <= 100 {
            error!("[DECODE_SMALL_UPDATE] update_id: {}, full_hex: {}", update_id, hex::encode(payload));
        }
        
        // Analyze update structure and add CRITICAL validation
        if payload.len() >= 2 {
            let msg_type = payload[0];
            let msg_subtype = if payload.len() > 1 { Some(payload[1]) } else { None };
            error!("[DECODE_UPDATE_TYPE] update_id: {}, msg_type: {:#04x}, subtype: {:?}, size: {}", 
                   update_id, msg_type, msg_subtype.map(|b| format!("{:#04x}", b)), payload.len());
            
            // CRITICAL VALIDATION: Block sync protocol messages that shouldn't be in database
            // These cause 15GB+ memory allocation attempts
            if msg_type == 0x00 {
                error!(
                    "[DECODE_SYNC_BLOCKED] CRITICAL: Sync protocol message found in database! This should never be persisted. \
                    script: {}, update_id: {}, msg_type: {:#04x}, subtype: {:?}, size: {}, hex: {}. \
                    Skipping to prevent memory explosion.",
                    script_id, update_id, msg_type, msg_subtype.map(|b| format!("{:#04x}", b)), 
                    payload.len(), hex::encode(&payload[..payload.len().min(50)])
                );
                // Return success to continue processing other updates, but don't apply this one
                return Ok(());
            }
        }
        
        // Try to decode as direct YJS Update first (most common case for stored updates)
        match Update::decode_v1(payload) {
            Ok(update) => {
                error!("[DECODE_V1_SUCCESS] update_id: {}, script: {}, decoded_update_size: {:?}", 
                      update_id, script_id, std::mem::size_of_val(&update));
                
                // MEMORY CAP: Check memory before applying update
                let before_mem = get_memory_usage();
                const MEMORY_SPIKE_THRESHOLD: usize = 100_000_000; // 100MB threshold for single operation
                
                // Wrap apply_update in a catch_unwind to prevent crashes
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    txn.apply_update(update)
                }));
                
                // Check memory after operation
                let after_mem = get_memory_usage();
                let mem_delta = after_mem.saturating_sub(before_mem);
                
                if mem_delta > MEMORY_SPIKE_THRESHOLD {
                    error!(
                        "[MEMORY_SPIKE_DETECTED] CRITICAL: Large memory allocation detected! \
                        script: {}, update_id: {}, memory_delta: {}, before: {}, after: {}. \
                        This indicates a potential bug in YJS update processing.",
                        script_id, update_id, format_bytes(mem_delta), 
                        format_bytes(before_mem), format_bytes(after_mem)
                    );
                }
                
                match result {
                    Ok(Ok(())) => return Ok(()),
                    Ok(Err(e)) => {
                        error!("Failed to apply YJS V1 update {} for script {}: {:?}", update_id, script_id, e);
                        return Err(anyhow::anyhow!("Failed to apply YJS V1 update: {}", e));
                    }
                    Err(panic_info) => {
                        error!("PANIC while applying YJS V1 update {} for script {}: {:?}", update_id, script_id, panic_info);
                        return Err(anyhow::anyhow!("Critical error (panic) while applying YJS update"));
                    }
                }
            }
            Err(e_v1) => {
                trace!("Failed to decode as V1 update ({:?}), trying V2 for script_id: {}, update_id: {}", e_v1, script_id, update_id);
                
                match Update::decode_v2(payload) {
                    Ok(update) => {
                        debug!("Successfully decoded and applying direct V2 update {} for script {}", update_id, script_id);
                        
                        // MEMORY CAP: Check memory before applying update
                        let before_mem = get_memory_usage();
                        const MEMORY_SPIKE_THRESHOLD: usize = 100_000_000; // 100MB threshold
                        
                        // Wrap apply_update in a catch_unwind to prevent crashes
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            txn.apply_update(update)
                        }));
                        
                        // Check memory after operation
                        let after_mem = get_memory_usage();
                        let mem_delta = after_mem.saturating_sub(before_mem);
                        
                        if mem_delta > MEMORY_SPIKE_THRESHOLD {
                            error!(
                                "[MEMORY_SPIKE_DETECTED] CRITICAL: Large memory allocation in V2 update! \
                                script: {}, update_id: {}, memory_delta: {}, before: {}, after: {}",
                                script_id, update_id, format_bytes(mem_delta), 
                                format_bytes(before_mem), format_bytes(after_mem)
                            );
                        }
                        
                        match result {
                            Ok(Ok(())) => return Ok(()),
                            Ok(Err(e)) => {
                                error!("Failed to apply YJS V2 update {} for script {}: {:?}", update_id, script_id, e);
                                return Err(anyhow::anyhow!("Failed to apply YJS V2 update: {}", e));
                            }
                            Err(panic_info) => {
                                error!("PANIC while applying YJS V2 update {} for script {}: {:?}", update_id, script_id, panic_info);
                                return Err(anyhow::anyhow!("Critical error (panic) while applying YJS update"));
                            }
                        }
                    }
                    Err(e_v2) => {
                        trace!("Failed to decode as direct update ({:?}), trying YrsSyncMessage for script_id: {}, update_id: {}", e_v2, script_id, update_id);
                        
                        // Fallback: try to decode as YrsSyncMessage (less common for stored updates)
                        match self.decode_sync_message(txn, payload, script_id, update_id) {
                            Ok(()) => return Ok(()),
                            Err(sync_err) => {
                                return Err(anyhow::anyhow!(
                                    "Failed to decode Yjs update (tried UpdateV1, UpdateV2, YrsSyncMessage) for script {}, update_id {}: V1Err: {:?}, V2Err: {:?}, SyncErr: {:?}\nPayload HEX: {}", 
                                    script_id, update_id, e_v1, e_v2, sync_err, hex::encode(payload)
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    /// Decodes YrsSyncMessage and applies it to the transaction
    fn decode_sync_message(
        &self,
        txn: &mut yrs::TransactionMut,
        payload: &[u8],
        script_id: Uuid,
        update_id: i64,
    ) -> Result<(), anyhow::Error> {
        match YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(payload))) {
            Ok(outer_message) => {
                trace!("Successfully decoded YrsSyncMessage for script_id: {}, update_id: {}", script_id, update_id);
                
                match outer_message {
                    YrsSyncMessage::Sync(sync_message_enum) => {
                        match sync_message_enum {
                            YrsInnerSyncMessage::SyncStep1(sv_bytes) => {
                                // IMPORTANT: Skip SyncStep1 messages during snapshot processing
                                // SyncStep1 is a client telling the server what state it has - it's not an update to apply
                                // These messages should never be stored in the database in the first place
                                // They're only meant for real-time sync negotiation between clients
                                // 
                                // The previous implementation incorrectly tried to generate a full state update
                                // using encode_state_as_update_v1() which caused memory explosions with corrupted counters
                                // especially in production where network latency causes out-of-order message delivery
                                
                                error!("[SYNCSTEP1_SKIP] Skipping SyncStep1 message during snapshot processing - script: {}, update_id: {}, sv_len: {}", 
                                      script_id, update_id, sv_bytes.len());
                                
                                // Do nothing - SyncStep1 messages should not modify the document state
                                // They are only used for sync negotiation in real-time connections
                            }
                            YrsInnerSyncMessage::SyncStep2(update_payload_bytes) => {
                                trace!("Handling SyncStep2 for script_id: {}, update_id: {}", script_id, update_id);
                                let update = Update::decode_v1(&update_payload_bytes)?;
                                if let Err(e) = txn.apply_update(update) {
                                    error!("Failed to apply YJS SyncStep2 update {} for script {}: {:?}", update_id, script_id, e);
                                    return Err(anyhow::anyhow!("Failed to apply YJS SyncStep2 update: {}", e));
                                }
                            }
                            YrsInnerSyncMessage::Update(update_payload_bytes) => {
                                trace!("Handling Update for script_id: {}, update_id: {}", script_id, update_id);
                                let update = Update::decode_v1(&update_payload_bytes)?;
                                if let Err(e) = txn.apply_update(update) {
                                    error!("Failed to apply YJS Update message {} for script {}: {:?}", update_id, script_id, e);
                                    return Err(anyhow::anyhow!("Failed to apply YJS Update message: {}", e));
                                }
                            }
                        }
                    }
                    YrsSyncMessage::Awareness(_awareness_data) => {
                        trace!("Skipping awareness update during snapshot creation for script_id: {}, update_id: {}", script_id, update_id);
                        // Skip awareness updates - they shouldn't be stored in the database anyway
                    }
                    _ => {
                        trace!("Received unhandled YrsSyncMessage variant for script_id: {}, update_id: {}. Message: {:?}", script_id, update_id, outer_message);
                    }
                }
                Ok(())
            }
            Err(e) => Err(anyhow::anyhow!("Failed to decode YrsSyncMessage: {}", e)),
        }
    }

    /// Logs the current state of the YJS document for debugging
    fn log_document_state(&self, doc: &Doc, script_id: Uuid) {
        let txn = doc.transact();
        
        // Log root references
        let root_refs: Vec<String> = txn.root_refs().map(|(key, _)| key.to_string()).collect();
        
        error!("[DOC_STATE] script: {}, root_refs: {:?}, memory: {}", 
               script_id, root_refs, format_bytes(get_memory_usage()));
        
        // Log default fragment state
        if let Some(default_fragment) = txn.get_xml_fragment("default") {
            error!("[DOC_STATE] default_fragment_len: {} for script {}", default_fragment.len(&txn), script_id);
        } else {
            error!("[DOC_STATE] No default fragment found for script {}", script_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;
    use yrs::ReadTxn;

    #[tokio::test]
    async fn test_document_bootstrapping() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let service = YjsProcessorService::new(pool);
        
        let doc = service.create_document();
        let txn = doc.transact();
        
        // Verify that required fragments exist
        assert!(txn.get_xml_fragment("default").is_some());
        assert!(txn.get_xml_fragment("content").is_some());
        assert!(txn.get_xml_fragment("prosemirror").is_some());
        
        // Verify that required text fields exist
        assert!(txn.get_text("default").is_some());
        assert!(txn.get_text("content").is_some());
        assert!(txn.get_text("prosemirror").is_some());
    }
} 