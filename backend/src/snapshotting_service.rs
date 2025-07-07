use sqlx::PgPool;
use tokio::time::Duration;
use std::sync::Arc;
use uuid::Uuid;
use yrs::{
    self,
    sync::{Message as YrsSyncMessage, SyncMessage as YrsInnerSyncMessage},
    types::xml::{TreeWalker, XmlFragmentRef, XmlOut},
    updates::decoder::{Decode as YrsDecodeTrait, DecoderV1},
    Doc, ReadTxn, Transact, Update,
    Xml, GetString,
    WriteTxn,
};
use yrs::encoding::read::Cursor as YrsIoCursor;
use tracing::{info, error, warn, debug, trace};
use hex;
use std::collections::HashMap;
use crate::analysis::structs::{ContentElement, Dialogue, StageDirection, Monologue, JointDialogue, Reading};

// Fixed interval configuration  
const SNAPSHOT_INTERVAL_SECONDS: u64 = 2;  // Run every 2 seconds for faster persistence

#[derive(Debug)]
struct SnapshotYjsUpdate {
    id: i64,
    update_data: Vec<u8>,
    #[allow(dead_code)]
    user_id: Option<Uuid>,
    #[allow(dead_code)]
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
struct NewBlockForSnapshot {
    block_type: String,
    content: Option<String>,
    block_order: i32,
    metadata: Option<serde_json::Value>,
}

async fn create_snapshot_for_script(pool: Arc<PgPool>, script_id: Uuid) -> Result<(), anyhow::Error> {
    trace!("[SnapshottingService] Attempting to create snapshot for script_id: {}", script_id);

    let last_meta: Option<(i64,)> = sqlx::query_as("SELECT last_processed_update_id FROM script_snapshots_meta WHERE script_id = $1")
        .bind(script_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("DB error fetching last snapshot meta for {}: {}", script_id, e))?;

    let last_processed_update_id_from_meta: i64 = last_meta.map_or(0, |(val,)| val.into());
    trace!("Last processed update ID from meta for script {}: {}", script_id, last_processed_update_id_from_meta);

    let updates_to_apply = match sqlx::query_as!(
        SnapshotYjsUpdate,
        r#"
        SELECT id, update_data, user_id, created_at
        FROM yjs_document_updates
        WHERE script_id = $1 AND id > $2
        ORDER BY created_at ASC, id ASC
        "#,
        script_id,
        last_processed_update_id_from_meta
    )
    .fetch_all(pool.as_ref())
    .await
    {
        Ok(updates) => updates,
        Err(e) => {
            error!("Error fetching Yjs updates for script {}: {:?}", script_id, e);
            anyhow::bail!("DB error fetching Yjs updates for snapshot for script {}: {}", script_id, e)
        }
    };

    debug!(
        "Fetched {} Yjs updates for script {} to apply to snapshot (since ID {}).",
        updates_to_apply.len(),
        script_id,
        last_processed_update_id_from_meta
    );

    if updates_to_apply.is_empty() {
        trace!("No new updates to apply for script {}. Snapshotting cycle may skip block updates but will update meta timestamp.", script_id);
    }
    
    let doc = Doc::new();
    let mut last_successfully_applied_update_id_in_batch: Option<i64> = None;

    // Scope for the mutable transaction to apply updates
    {
        let mut txn = doc.transact_mut(); // Create TransactionMut here, within its own scope
        for db_update in &updates_to_apply {
            let payload = &db_update.update_data;
            if payload.is_empty() {
                warn!("Skipping empty Yjs update payload for script_id: {}, update_id: {}", script_id, db_update.id);
                continue;
            }
            
            // Add detailed logging
            debug!(
                "Processing update {} for script {}: {} bytes, first 10 bytes hex: {}", 
                db_update.id, 
                script_id, 
                payload.len(),
                hex::encode(&payload[..payload.len().min(10)])
            );

            match YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(payload))) {
                Ok(outer_message) => {
                    trace!("Successfully decoded YrsSyncMessage for script_id: {}, update_id: {}", script_id, db_update.id);
                    match outer_message {
                        YrsSyncMessage::Sync(sync_message_enum) => {
                            match sync_message_enum {
                                YrsInnerSyncMessage::SyncStep1(sv_bytes) => {
                                    trace!("Handling SyncStep1 (as inner SyncMessage) for script_id: {}, update_id: {}", script_id, db_update.id);
                                    let sv = sv_bytes;
                                    // txn.encode_state_as_update_v1 needs &self, not &mut self.
                                    // It's okay to call on txn which is TransactionMut as it also implements ReadTxn.
                                    let update_bytes = txn.encode_state_as_update_v1(&sv);
                                    let update = Update::decode_v1(&update_bytes)?;
                                    txn.apply_update(update);
                                    last_successfully_applied_update_id_in_batch = Some(db_update.id);
                                }
                                YrsInnerSyncMessage::SyncStep2(update_payload_bytes) => {
                                    trace!("Handling SyncStep2 (as inner SyncMessage) for script_id: {}, update_id: {}", script_id, db_update.id);
                                    let update = Update::decode_v1(&update_payload_bytes)?;
                                    txn.apply_update(update);
                                    last_successfully_applied_update_id_in_batch = Some(db_update.id);
                                }
                                YrsInnerSyncMessage::Update(update_payload_bytes) => {
                                    trace!("Handling Update (as inner SyncMessage) for script_id: {}, update_id: {}", script_id, db_update.id);
                                    let update = Update::decode_v1(&update_payload_bytes)?;
                                    txn.apply_update(update);
                                    last_successfully_applied_update_id_in_batch = Some(db_update.id);
                                }
                            }
                        }
                        YrsSyncMessage::Auth(_reason) => {
                            warn!("Received Auth message during snapshot creation for script_id: {}, update_id: {}. Ignoring.", script_id, db_update.id);
                        }
                        YrsSyncMessage::Awareness(_awareness_data) => { // awareness_data is not cloned or used, so mark as such
                            trace!("Handling Awareness for script_id: {}, update_id: {}", script_id, db_update.id);
                            warn!("Awareness update received for script_id: {}, update_id: {}. Currently unhandled pending investigation.", script_id, db_update.id);
                        }
                        _ => {
                            trace!("Received unhandled YrsSyncMessage variant for script_id: {}, update_id: {}. Message: {:?}", script_id, db_update.id, outer_message);
                        }
                    }
                }
                Err(sync_err) => {
                    trace!("Failed to decode as YrsSyncMessage ({:?}), trying as direct yrs::Update for script_id: {}, update_id: {}", sync_err, script_id, db_update.id);
                    match Update::decode_v1(payload) {
                        Ok(update) => {
                            txn.apply_update(update);
                            last_successfully_applied_update_id_in_batch = Some(db_update.id);
                        }
                        Err(e_v1) => {
                            trace!("Failed to decode as V1 update ({:?}), trying V2 for script_id: {}, update_id: {}", e_v1, script_id, db_update.id);
                            match Update::decode_v2(payload) {
                                Ok(update) => {
                                    txn.apply_update(update);
                                    last_successfully_applied_update_id_in_batch = Some(db_update.id);
                                }
                                Err(e_v2) => {
                                    error!(
                                        "Failed to decode Yjs update (tried SyncMessage, UpdateV1, UpdateV2) for script {}, update_id {}: SyncErr: {:?}, V1Err: {:?}, V2Err: {:?}\nPayload HEX: {}", 
                                        script_id, db_update.id, sync_err, e_v1, e_v2, hex::encode(payload)
                                    );
                                    break; 
                                }
                            }
                        }
                    }
                }
            }
        }
    } // txn (TransactionMut) goes out of scope here

    debug!(
        "Starting serialization of Yjs doc to blocks for script_id: {}",
        script_id
    );
    
    // Start a new read-only transaction to obtain the XmlFragment and for the TreeWalker
    let mut txn_ro = doc.transact();

    // Debug: Let's see what's actually in the Yjs document
    debug!("Inspecting Yjs document structure for script_id: {}", script_id);
    
    // Check specific fragments that might exist
    if let Some(_) = txn_ro.get_xml_fragment("default") {
        debug!("Found 'default' XmlFragment for script_id: {}", script_id);
    }
    if let Some(_) = txn_ro.get_xml_fragment("prosemirror") {
        debug!("Found 'prosemirror' XmlFragment for script_id: {}", script_id);
    }
    
    // Let's also check what the document state vector looks like
    let state_vector = txn_ro.state_vector();
    debug!("Document state vector for script_id {}: {:?}", script_id, state_vector);

    // Try multiple fragment names used by different editors
    let fragment_candidates = ["default", "content", "prosemirror"];
    let mut fragment_name = None;
    
    // First, try standard fragments
    for &candidate in &fragment_candidates {
        if txn_ro.get_xml_fragment(candidate).is_some() {
            fragment_name = Some(candidate);
            break;
        }
    }
    
    // If no standard fragment found, check all available fragments
    let fragment_name = if let Some(name) = fragment_name {
        name
    } else {
        debug!("🔍 No standard fragments found. Checking all available fragments for script_id: {}", script_id);
        
        // Collect fragment names first to avoid borrow issues
        let available_fragment_names: Vec<String> = txn_ro.root_refs()
            .filter_map(|(key, _)| {
                if txn_ro.get_xml_fragment(key.as_ref()).is_some() {
                    Some(key.to_string())
                } else {
                    None
                }
            })
            .collect();
        
        if let Some(first_fragment) = available_fragment_names.first() {
            debug!("📋 Found alternative fragment '{}' for script_id: {}", first_fragment, script_id);
            // We need to return a string slice, so we'll use a known fragment name
            // Since we're going to create 'default' anyway, let's just use that
            "default" 
        } else {
            debug!("⚠️ No fragments found, will create 'default' for script_id: {}", script_id);
            "default"
        }
    };
        
    debug!("✅ Using fragment '{}' for script_id: {}", fragment_name, script_id);
    
    // Store fragment name for use in error messages
    let fragment_name_for_errors = fragment_name.to_string();
    
    let final_content_xml_fragment_ref: XmlFragmentRef = match txn_ro.get_xml_fragment(fragment_name) {
        Some(fragment) => fragment,
        None => {
            warn!(
                "XmlFragment '{}' not found for script {}. Creating it now. This might indicate an issue with initial Yjs doc structure from client.",
                fragment_name, script_id
            );
            drop(txn_ro); // Drop the read-only transaction before starting a mutable one.

            // Scope for the mutable transaction to create the fragment.
            {
                let mut txn_mut = doc.transact_mut();
                txn_mut.get_or_insert_xml_fragment(fragment_name);
                // txn_mut is dropped here, committing the change.
            }

            // Re-establish the read-only transaction after potential modification.
            txn_ro = doc.transact();
            // This time, the fragment must exist.
            txn_ro.get_xml_fragment(fragment_name).ok_or_else(|| {
                anyhow::anyhow!(
                    "Failed to get or create '{}' XmlFragment for script {} after attempting creation",
                    fragment_name, script_id
                )
            })?
        }
    };

    let mut blocks_to_insert: Vec<NewBlockForSnapshot> = Vec::new();
    let mut current_order = 0;

    trace!("[SnapshottingService] Starting TreeWalker for script_id: {}", script_id);
    for top_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(final_content_xml_fragment_ref.as_ref(), &txn_ro) {
        match &top_item_out {
            XmlOut::Element(e) => {
                let tag = e.tag();
                let mut child_text_content = String::new();
                for child_item in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(e.as_ref(), &txn_ro) {
                    if let XmlOut::Text(text_ref) = child_item {
                        child_text_content.push_str(&text_ref.get_string(&txn_ro));
                    }
                }
                info!("[SnapshottingService] TreeWalker item for script_id: {}: XmlOut::Element - Tag: '{}', Raw Child Text: '{}'", script_id, tag, child_text_content.trim());
            }
            XmlOut::Text(t) => {
                let text_content = t.get_string(&txn_ro);
                info!("[SnapshottingService] TreeWalker item for script_id: {}: XmlOut::Text - Content: '{}'", script_id, text_content.trim());
            }
            XmlOut::Fragment(_) => {
                info!("[SnapshottingService] TreeWalker item for script_id: {}: XmlOut::Fragment", script_id);
            }
        }

        if let XmlOut::Element(elem_ref) = top_item_out {
            let attributes_map: std::collections::HashMap<String, String> =
                elem_ref.attributes(&txn_ro)
                    .map(|(k, v_str)| (k.to_string(), v_str.to_string()))
                    .collect();
            
            let tag_name = elem_ref.tag().to_string();
            trace!("Processing XML element with tag: '{}', attributes: {:?} for script_id: {}", tag_name, attributes_map, script_id);

            let pessoa_block_type_str = attributes_map.get("data-type").map(|s| s.as_str());

            // Extract text content from direct children (non-recursive for simplicity here, adjust if deep text needed)
            let mut current_element_text_content = String::new();
            for child_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(elem_ref.as_ref(), &txn_ro) {
                if let XmlOut::Text(text_ref) = child_item_out {
                    current_element_text_content.push_str(&text_ref.get_string(&txn_ro));
                }
            }
            current_element_text_content = current_element_text_content.trim().to_string();

            let mut processed_as_pessoa_block = false;

            if let Some(p_block_type) = pessoa_block_type_str {
                let content_element_result: Result<ContentElement, String> = match p_block_type {
                    "dialogue" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        Ok(ContentElement::Dialogue(Dialogue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker,
                            line: Some(current_element_text_content.clone()),
                            extra: HashMap::new(),
                        }))
                    },
                    "stage_direction" => {
                        Ok(ContentElement::StageDirection(StageDirection {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            description: current_element_text_content.clone(),
                        }))
                    },
                    "monologue" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        Ok(ContentElement::Monologue(Monologue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker,
                            lines: vec![current_element_text_content.clone()], // Assuming single line for now from direct text
                        }))
                    },
                    "joint_dialogue" => {
                        let speakers_str = attributes_map.get("data-speakers").map(|s| s.to_string()).unwrap_or_else(String::new);
                        let speakers = speakers_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                        Ok(ContentElement::JointDialogue(JointDialogue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speakers,
                            line: Some(current_element_text_content.clone()),
                            extra: HashMap::new(),
                        }))
                    },
                    "reading" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        let source = attributes_map.get("data-source").map(|s| s.to_string());
                        let language = attributes_map.get("data-language").map(|s| s.to_string());
                        Ok(ContentElement::Reading(Reading {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker,
                            source,
                            language,
                                                                reading_text: current_element_text_content.clone(),
                        }))
                    },
                    _ => Err(format!("Unknown Pessoa block type attribute: {}", p_block_type)),
                };

                if let Ok(content_element) = content_element_result {
                    match serde_json::to_string(&content_element) {
                        Ok(json_content) => {
                            let mut remaining_attributes = attributes_map.clone();
                            remaining_attributes.remove("data-type");
                            remaining_attributes.remove("data-id");
                            // Remove type-specific attributes already handled
                            match p_block_type {
                                "dialogue" | "monologue" => { remaining_attributes.remove("data-speaker"); }
                                "reading" => {
                                    remaining_attributes.remove("data-speaker");
                                    remaining_attributes.remove("data-source");
                                    remaining_attributes.remove("data-language");
                                }
                                "joint_dialogue" => { remaining_attributes.remove("data-speakers"); }
                                _ => {}
                            }

                            info!("[SnapshottingService] Creating Pessoa block: type='{}', order={}, script_id: {}", p_block_type, current_order, script_id);
                            blocks_to_insert.push(NewBlockForSnapshot {
                                block_type: p_block_type.to_string(),
                                content: Some(json_content),
                                block_order: current_order,
                                metadata: if remaining_attributes.is_empty() { None } else { Some(serde_json::to_value(remaining_attributes).unwrap_or_default()) },
                            });
                            current_order += 1;
                            processed_as_pessoa_block = true;
                        },
                        Err(e) => {
                            error!("Failed to serialize ContentElement for type {}: Error: {}", p_block_type, e);
                        }
                    }
                } else if let Err(msg) = content_element_result {
                     debug!("Did not process element with tag '{}' as known Pessoa type via 'data-type': {}. Attributes: {:?}", tag_name, msg, attributes_map);
                }
            }

            if !processed_as_pessoa_block {
                let generic_block_type = tag_name; // Use the element's tag name as the generic block type
                
                // For generic blocks, the content is the direct text content extracted earlier
                let generic_block_content = current_element_text_content; // Already trimmed

                let allowed_generic_types = [
                    "paragraph", "heading", "blockquote", "code_block", "list_item", 
                    "image", "table", "table_row", "table_cell", "horizontal_rule", "text"
                ];

                if allowed_generic_types.contains(&generic_block_type.as_str()) {
                    info!("[SnapshottingService] Creating generic block: type='{}', order={}, content='{}...', script_id: {}", generic_block_type, current_order, generic_block_content.chars().take(50).collect::<String>(), script_id);
                    blocks_to_insert.push(NewBlockForSnapshot {
                        block_type: generic_block_type.clone(),
                        content: Some(serde_json::to_string(&generic_block_content).unwrap_or_else(|e| {
                            error!("Failed to serialize generic_block_content to JSON for type {}: {}. Using error placeholder.", generic_block_type, e);
                            serde_json::json!({"error": "serialization failed", "original_content": generic_block_content}).to_string()
                        })),
                        block_order: current_order,
                        // For generic blocks, store all original attributes as metadata
                        metadata: if attributes_map.is_empty() { None } else { Some(serde_json::to_value(attributes_map.clone()).unwrap_or_default()) },
                    });
                    current_order += 1;
                } else {
                    warn!(
                        "Skipping unknown generic block type '{}' (content: '{}') during serialization for script_id: {}",
                        generic_block_type, generic_block_content, script_id
                    );
                }
            }
        } else if let XmlOut::Text(text_ref) = top_item_out {
            let loose_text_original = text_ref.get_string(&txn_ro);
            let loose_text_trimmed = loose_text_original.trim().to_string();

            if !loose_text_trimmed.is_empty() {
                // Check if the loose_text already seems to be pre-formatted (e.g. by frontend error)
                if loose_text_trimmed.starts_with("(paragraph:") {
                    warn!(
                        "Found pre-formatted loose text in XmlFragment for script_id {}: '{}'. Skipping automatic wrapping.",
                        script_id, loose_text_trimmed
                    );
                } else {
                    let mut skip_this_loose_text = false;
                    if let Some(last_block) = blocks_to_insert.last() {
                        if last_block.block_type == "paragraph" {
                            if let Some(ref last_content_json_str) = last_block.content {
                                // The content is a JSON string representing the actual text, e.g., ""Hello""
                                match serde_json::from_str::<String>(last_content_json_str) {
                                    Ok(last_block_actual_text) => {
                                        if last_block_actual_text == loose_text_trimmed {
                                            warn!(
                                                "Skipping loose text '{}' for script_id {} as it appears to duplicate the content of the immediately preceding paragraph block.",
                                                loose_text_trimmed, script_id
                                            );
                                            skip_this_loose_text = true;
                                        }
                                    }
                                    Err(e) => {
                                        // This case should ideally not happen if content is always a JSON string of a string
                                        error!(
                                            "Failed to deserialize last block content for duplicate check. Last content: '{}', Error: {}. Script_id: {}",
                                            last_content_json_str, e, script_id
                                        );
                                    }
                                }
                            }
                        }
                    }

                    if !skip_this_loose_text {
                        info!("Found loose uncontained text for script_id {}: '{}'. Wrapping in paragraph.", script_id, loose_text_trimmed);
                        blocks_to_insert.push(NewBlockForSnapshot {
                            block_type: "paragraph".to_string(),
                            content: Some(serde_json::to_string(&loose_text_trimmed).unwrap_or_else(|e| {
                                 error!("Failed to serialize loose_text_trimmed to JSON for paragraph: {}. Using error placeholder. Original text: '{}'", e, loose_text_trimmed);
                                 serde_json::json!({"error": "serialization failed", "original_content": loose_text_trimmed}).to_string()
                            })),
                            block_order: current_order,
                            metadata: None,
                        });
                        current_order += 1;
                    }
                }
            }
        }
    } // End of for top_item_out in TreeWalker loop

    trace!("[SnapshottingService] Finished TreeWalker for script_id: {}. Total blocks to insert: {}", script_id, blocks_to_insert.len());

    if blocks_to_insert.is_empty() && !updates_to_apply.is_empty() {
        warn!(
            "No blocks extracted from XmlFragment '{}' for script_id: {}, though {} updates were applied. Document might be empty or structured differently than expected.",
            fragment_name_for_errors, script_id, updates_to_apply.len()
        );
    } else if blocks_to_insert.is_empty() {
        trace!("No blocks extracted, and no new updates were applied for script_id: {}", script_id);
    }

    if !blocks_to_insert.is_empty() {
        info!("[SnapshottingService] Attempting to update blocks table for script_id: {}. Found {} blocks from Yjs doc.", script_id, blocks_to_insert.len());
        let mut db_tx = pool.begin().await.map_err(|e| anyhow::anyhow!("Failed to begin DB transaction for snapshotting script {}: {}", script_id, e))?;

        sqlx::query("DELETE FROM blocks WHERE script_id = $1")
            .bind(script_id)
            .execute(&mut *db_tx)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to delete old blocks for script {}: {}", script_id, e))?;
        
        trace!("[SnapshottingService] Deleted old blocks for script_id: {}", script_id);

        for block_data in blocks_to_insert {
            let block_type_for_error_msg = block_data.block_type.clone();
            sqlx::query(
                "INSERT INTO blocks (script_id, block_type, content, block_order, metadata) VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(script_id)
            .bind(block_data.block_type)
            .bind(block_data.content)
            .bind(block_data.block_order)
            .bind(block_data.metadata)
            .execute(&mut *db_tx)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to insert new block (type: {}) for script {}: {}", block_type_for_error_msg, script_id, e))?;
        }
        trace!("[SnapshottingService] Inserted new blocks for script_id: {}", script_id);

        db_tx.commit().await.map_err(|e| anyhow::anyhow!("Failed to commit DB transaction for snapshotting script {}: {}", script_id, e))?;
        info!("[SnapshottingService] Successfully committed snapshot to blocks table for script_id: {}", script_id);

        let final_last_processed_id_for_meta = 
            last_successfully_applied_update_id_in_batch.unwrap_or(last_processed_update_id_from_meta);

        sqlx::query(
            "INSERT INTO script_snapshots_meta (script_id, last_snapshot_at, last_processed_update_id) VALUES ($1, NOW(), $2) \n             ON CONFLICT (script_id) DO UPDATE SET last_snapshot_at = NOW(), last_processed_update_id = excluded.last_processed_update_id"
        )
        .bind(script_id)
        .bind(final_last_processed_id_for_meta)
        .execute(pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to update script_snapshots_meta for script {}: {}", script_id, e))?;
        trace!("[SnapshottingService] Updated script_snapshots_meta for script_id: {} with last_processed_id: {}", script_id, final_last_processed_id_for_meta);

    } else {
        trace!("[SnapshottingService] No blocks extracted from Yjs document for script_id: {}. 'blocks' table not modified.", script_id);
        if let Some(last_id) = last_successfully_applied_update_id_in_batch {
            sqlx::query(
                "INSERT INTO script_snapshots_meta (script_id, last_snapshot_at, last_processed_update_id) VALUES ($1, NOW(), $2)\n                 ON CONFLICT (script_id) DO UPDATE SET last_snapshot_at = NOW(), last_processed_update_id = excluded.last_processed_update_id"
            )
            .bind(script_id)
            .bind(last_id)
            .execute(pool.as_ref())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update script_snapshots_meta (no new blocks, but updates processed) for script {}: {}", script_id, e))?;
            trace!("[SnapshottingService] Updated script_snapshots_meta for script_id: {} with last_processed_id: {} (no new blocks, but updates were processed).", script_id, last_id);
        } else if updates_to_apply.is_empty() && last_meta.is_some() { 
            sqlx::query(
                "UPDATE script_snapshots_meta SET last_snapshot_at = NOW() WHERE script_id = $1"
            )
            .bind(script_id)
            .execute(pool.as_ref())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update script_snapshots_meta (timestamp only) for script {}: {}", script_id, e))?;
            trace!("[SnapshottingService] Updated script_snapshots_meta (timestamp only, no new updates) for script_id: {}", script_id);
        } else {
            trace!("[SnapshottingService] No updates to process or no new blocks and no prior snapshot meta to update for script_id: {}", script_id);
        }
    }
    Ok(())
}

async fn get_scripts_needing_snapshot(pool: Arc<PgPool>) -> Result<Vec<Uuid>, anyhow::Error> {
    debug!("[SnapshottingService] Checking for scripts needing snapshots...");
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
            (ssm.last_snapshot_at IS NULL OR ssm.last_snapshot_at < NOW() - INTERVAL '1 second')
            OR
            (EXISTS (
                SELECT 1 FROM yjs_document_updates ydu_check 
                WHERE ydu_check.script_id = lu.script_id 
                AND ydu_check.id > COALESCE(ssm.last_processed_update_id, 0)
            ))
        ORDER BY lu.script_id ASC";

    let scripts_to_snapshot: Vec<(Uuid,)> = sqlx::query_as(query)
    .fetch_all(pool.as_ref())
    .await
    .map_err(|e| anyhow::anyhow!("Failed to fetch scripts needing snapshot: {}", e))?;

    let script_ids: Vec<Uuid> = scripts_to_snapshot.into_iter().map(|(id,)| id).collect();

    if !script_ids.is_empty() {
        info!("[SnapshottingService] Found {} script(s) needing snapshot: {:?}", script_ids.len(), script_ids);
    } else {
        debug!("[SnapshottingService] No scripts found needing snapshotting.");
    }
    Ok(script_ids)
}

pub async fn run_snapshotting_service(
    pool: Arc<PgPool>,
    _base_interval_duration: Duration, // Keep parameter for backwards compatibility
) {
    info!("🚀 Snapshotting Service Task SPAWNED and RUNNING every {} seconds!", SNAPSHOT_INTERVAL_SECONDS);
    
    let mut scripts_processed_count = 0u64;
    
    loop {
        tokio::time::sleep(Duration::from_secs(SNAPSHOT_INTERVAL_SECONDS)).await;
        
        debug!("🔍 [SnapshottingService] Running scheduled snapshot check...");
        
        match get_scripts_needing_snapshot(pool.clone()).await {
            Ok(script_ids) => {
                if script_ids.is_empty() {
                    debug!("[SnapshottingService] No scripts currently require snapshotting.");
                } else {
                    info!("📝 [SnapshottingService] Processing {} script(s) for snapshotting", script_ids.len());
                    for script_id in script_ids {
                        debug!("[SnapshottingService] Processing script_id: {} for snapshotting.", script_id);
                        match create_snapshot_for_script(pool.clone(), script_id).await {
                            Ok(_) => {
                                scripts_processed_count += 1;
                                info!("[SnapshottingService] ✅ Successfully processed snapshot for script_id: {}", script_id);
                            },
                            Err(e) => error!("[SnapshottingService] ❌ Error during snapshot for script_id: {}: {}", script_id, e),
                        }
                    }
                    info!("📊 [SnapshottingService] Completed snapshot batch. Total scripts processed: {}", scripts_processed_count);
                }
            }
            Err(e) => {
                error!("[SnapshottingService] Error fetching scripts needing snapshot: {}", e);
            }
        }
    }
} 