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
        trace!("Fetching YJS updates for script {} since ID {}", script_id, last_processed_id);
        
        let updates = sqlx::query_as!(
            YjsUpdate,
            r#"
            SELECT id, update_data
            FROM yjs_document_updates
            WHERE script_id = $1 AND id > $2
            ORDER BY created_at ASC, id ASC
            "#,
            script_id,
            last_processed_id
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("DB error fetching Yjs updates for script {}: {}", script_id, e))?;
        
        if !updates.is_empty() {
            debug!("📝 Fetched {} YJS updates for script {} (incremental from ID {})", 
                   updates.len(), script_id, last_processed_id);
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
                
                debug!("Processing update {} for script {}: {} bytes", db_update.id, script_id, payload.len());

                // Try to decode and apply the update
                match self.decode_and_apply_update(&mut txn, payload, script_id, db_update.id) {
                    Ok(()) => {
                        last_successfully_applied_id = Some(db_update.id);
                    }
                    Err(e) => {
                        error!("Failed to apply update {} for script {}: {}", db_update.id, script_id, e);
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
        // Try to decode as direct YJS Update first (most common case for stored updates)
        match Update::decode_v1(payload) {
            Ok(update) => {
                debug!("Successfully decoded and applying direct V1 update {} for script {}", update_id, script_id);
                if let Err(e) = txn.apply_update(update) {
                    error!("Failed to apply YJS V1 update {} for script {}: {:?}", update_id, script_id, e);
                    return Err(anyhow::anyhow!("Failed to apply YJS V1 update: {}", e));
                }
                return Ok(());
            }
            Err(e_v1) => {
                trace!("Failed to decode as V1 update ({:?}), trying V2 for script_id: {}, update_id: {}", e_v1, script_id, update_id);
                
                match Update::decode_v2(payload) {
                    Ok(update) => {
                        debug!("Successfully decoded and applying direct V2 update {} for script {}", update_id, script_id);
                        if let Err(e) = txn.apply_update(update) {
                            error!("Failed to apply YJS V2 update {} for script {}: {:?}", update_id, script_id, e);
                            return Err(anyhow::anyhow!("Failed to apply YJS V2 update: {}", e));
                        }
                        return Ok(());
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
                                trace!("Handling SyncStep1 for script_id: {}, update_id: {}, sv_bytes len: {}", script_id, update_id, sv_bytes.len());
                                
                                // Safety check: SyncStep1 state vectors should be reasonably small
                                const MAX_STATE_VECTOR_SIZE: usize = 10_000; // 10KB max for state vector
                                if sv_bytes.len() > MAX_STATE_VECTOR_SIZE {
                                    error!("State vector too large ({} bytes) for script {}, update {}", sv_bytes.len(), script_id, update_id);
                                    return Err(anyhow::anyhow!("State vector exceeds maximum size of {} bytes", MAX_STATE_VECTOR_SIZE));
                                }
                                
                                // Validate state vector before encoding to prevent massive memory allocation
                                if let Err(e) = self.validate_state_vector(&sv_bytes) {
                                    error!("Invalid state vector for script {}, update {}: {}", script_id, update_id, e);
                                    return Err(e);
                                }
                                
                                let sv = sv_bytes;
                                
                                // Use catch_unwind to prevent memory allocation panics from crashing the server
                                let update_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                                    txn.encode_state_as_update_v1(&sv)
                                }));
                                
                                let update_bytes = match update_result {
                                    Ok(bytes) => bytes,
                                    Err(_) => {
                                        error!("Memory allocation panic when encoding state vector for script {}, update {}", script_id, update_id);
                                        return Err(anyhow::anyhow!("Failed to encode state vector: memory allocation error"));
                                    }
                                };
                                
                                // Safety check: Generated update should not be unreasonably large
                                const MAX_UPDATE_SIZE: usize = 100_000_000; // 100MB max for generated update
                                if update_bytes.len() > MAX_UPDATE_SIZE {
                                    error!("Generated update too large ({} bytes) for script {}, update {}", update_bytes.len(), script_id, update_id);
                                    return Err(anyhow::anyhow!("Generated update exceeds maximum size of {} bytes", MAX_UPDATE_SIZE));
                                }
                                
                                let update = Update::decode_v1(&update_bytes)?;
                                if let Err(e) = txn.apply_update(update) {
                                    error!("Failed to apply YJS SyncStep1 update {} for script {}: {:?}", update_id, script_id, e);
                                    return Err(anyhow::anyhow!("Failed to apply YJS SyncStep1 update: {}", e));
                                }
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
        debug!("After applying updates, YJS document root refs for script {}: {:?}", script_id, root_refs);
        
        // Log default fragment state
        if let Some(default_fragment) = txn.get_xml_fragment("default") {
            debug!("After applying updates, default fragment length for script {}: {}", script_id, default_fragment.len(&txn));
        } else {
            debug!("After applying updates, no default fragment found for script {}", script_id);
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