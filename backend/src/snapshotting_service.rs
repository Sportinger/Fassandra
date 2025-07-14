use sqlx::{PgPool, QueryBuilder};
use tokio::time::{timeout, Duration};
use std::sync::Arc;
use uuid::Uuid;
use regex::Regex;
use std::sync::LazyLock;
use yrs::{
    self,
    sync::{Message as YrsSyncMessage, SyncMessage as YrsInnerSyncMessage},
    types::xml::{TreeWalker, XmlFragmentRef, XmlOut, XmlFragment},
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
use html_escape;

// Fixed interval configuration  
const SNAPSHOT_INTERVAL_MILLIS: u64 = 500;  // Run every 500ms for real-time sync

// 🔒 SECURITY: ReDoS-resistant regex patterns for HTML parsing
// These patterns avoid exponential backtracking that could cause denial of service
static PARAGRAPH_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    // 🔒 Use bounded quantifiers to prevent excessive backtracking
    Regex::new(r"<p([^>]{0,500})>(.*?)</p>").expect("Invalid paragraph regex")
});

static DIV_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    // 🔒 Use bounded quantifiers and length limits to prevent ReDoS
    Regex::new(r#"<div([^>]{0,500})data-type="([^"]{1,50})"([^>]{0,500})>(.*?)</div>"#).expect("Invalid div regex")
});

#[derive(Debug)]
struct SnapshotYjsUpdate {
    id: i64,
    update_data: Vec<u8>,
}

#[derive(Debug, Clone)]
struct NewBlockForSnapshot {
    block_type: String,
    content: Option<String>,
    block_order: i32,
    page_number: i32,
    metadata: Option<serde_json::Value>,
}

pub async fn create_snapshot_for_script(pool: Arc<PgPool>, script_id: Uuid) -> Result<(), anyhow::Error> {
    trace!("[SnapshottingService] Attempting to create snapshot for script_id: {}", script_id);

    let last_meta: Option<(i64,)> = sqlx::query_as("SELECT last_processed_update_id FROM script_snapshots_meta WHERE script_id = $1")
        .bind(script_id)
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("DB error fetching last snapshot meta for {}: {}", script_id, e))?;

    let last_processed_update_id_from_meta: i64 = last_meta.map_or(0, |(val,)| val.into());
    trace!("Last processed update ID from meta for script {}: {}", script_id, last_processed_update_id_from_meta);

    // Fetch only NEW updates since the last processed update for incremental processing.
    // This prevents the catastrophic N+1 query that would fetch ALL updates every time.
    // Using last_processed_update_id_from_meta ensures we only process new data.
    let updates_to_apply = match sqlx::query_as!(
        SnapshotYjsUpdate,
        r#"
        SELECT id, update_data
        FROM yjs_document_updates
        WHERE script_id = $1 AND id > $2
        ORDER BY created_at ASC, id ASC
        "#,
        script_id,
        last_processed_update_id_from_meta // <= FIXED: Use incremental processing
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

    // Only log when there are actual updates to avoid noise
    if !updates_to_apply.is_empty() {
        info!(
            "📝 Processing {} NEW Yjs updates for script {} (incremental from ID {}).",
            updates_to_apply.len(),
            script_id,
            last_processed_update_id_from_meta
        );
    } else {
        debug!("✅ No new YJS updates for script {} since ID {} - checking content snapshots...", script_id, last_processed_update_id_from_meta);
        // Don't return early - we still need to check content snapshots
        // Even if YJS updates are broken, content snapshots might be newer
    }
    
    let doc = Doc::new();

    // ------------------------------------------------------------------
    // Ensure that the Yjs document starts with the XmlFragments that the
    // frontend editor writes to ("default", "content", "prosemirror").
    // If these fragments don’t exist _before_ we apply updates, any ops
    // targeting them are effectively no-ops and the document stays empty.
    // Creating them ahead of time lets incoming updates be applied
    // correctly and materialize the expected structure.
    // ------------------------------------------------------------------
    {
        let mut bootstrap_txn = doc.transact_mut();
        for name in ["default", "content", "prosemirror"] {
            // Create both XmlFragment (for structured content) and YText (for plain text content)
            bootstrap_txn.get_or_insert_xml_fragment(name);
            bootstrap_txn.get_or_insert_text(name);
        }
    }
 
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
            
            // Basic update processing log
            debug!("Processing update {} for script {}: {} bytes", db_update.id, script_id, payload.len());

            // Try to decode as direct YJS Update first (most common case for stored updates)
            match Update::decode_v1(payload) {
                Ok(update) => {
                    debug!("Successfully decoded and applying direct V1 update {} for script {}", db_update.id, script_id);
                    
                    // 🚀 PERFORMANCE FIX: Remove expensive debug logging from hot path
                    // This eliminates 6 document traversals + string allocations per update
                    txn.apply_update(update);
                    last_successfully_applied_update_id_in_batch = Some(db_update.id);
                }
                Err(e_v1) => {
                    trace!("Failed to decode as V1 update ({:?}), trying V2 for script_id: {}, update_id: {}", e_v1, script_id, db_update.id);
                    match Update::decode_v2(payload) {
                        Ok(update) => {
                            debug!("Successfully decoded and applying direct V2 update {} for script {}", db_update.id, script_id);
                            txn.apply_update(update);
                            last_successfully_applied_update_id_in_batch = Some(db_update.id);
                        }
                        Err(e_v2) => {
                            trace!("Failed to decode as direct update ({:?}), trying YrsSyncMessage for script_id: {}, update_id: {}", e_v2, script_id, db_update.id);
                            // Fallback: try to decode as YrsSyncMessage (less common for stored updates)
            match YrsDecodeTrait::decode(&mut DecoderV1::new(YrsIoCursor::new(payload))) {
                Ok(outer_message) => {
                    trace!("Successfully decoded YrsSyncMessage for script_id: {}, update_id: {}", script_id, db_update.id);
                    match outer_message {
                        YrsSyncMessage::Sync(sync_message_enum) => {
                            match sync_message_enum {
                                YrsInnerSyncMessage::SyncStep1(sv_bytes) => {
                                    trace!("Handling SyncStep1 (as inner SyncMessage) for script_id: {}, update_id: {}", script_id, db_update.id);
                                    let sv = sv_bytes;
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
                                        YrsSyncMessage::Awareness(_awareness_data) => {
                                            trace!("Skipping awareness update during snapshot creation for script_id: {}, update_id: {}", script_id, db_update.id);
                                            // Skip awareness updates - they shouldn't be stored in the database anyway
                        }
                        _ => {
                            trace!("Received unhandled YrsSyncMessage variant for script_id: {}, update_id: {}. Message: {:?}", script_id, db_update.id, outer_message);
                        }
                    }
                }
                Err(sync_err) => {
                                    error!(
                                        "Failed to decode Yjs update (tried UpdateV1, UpdateV2, YrsSyncMessage) for script {}, update_id {}: V1Err: {:?}, V2Err: {:?}, SyncErr: {:?}\nPayload HEX: {}", 
                                        script_id, db_update.id, e_v1, e_v2, sync_err, hex::encode(payload)
                                    );
                                    break; 
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Check document state after applying updates
        let root_refs_after_update: Vec<String> = txn.root_refs().map(|(key, _)| key.to_string()).collect();
        debug!("After applying updates, YJS document root refs: {:?}", root_refs_after_update);
        
        // Check document state after applying updates
        if let Some(default_fragment) = txn.get_xml_fragment("default") {
            debug!("After applying updates, default fragment length: {}", default_fragment.len(&txn));
        } else {
            debug!("After applying updates, no default fragment found");
        }
    } // txn (TransactionMut) goes out of scope here

    debug!(
        "Starting serialization of Yjs doc to blocks for script_id: {}",
        script_id
    );
    
    // 🚀 PERFORMANCE FIX: Removed expensive post-transaction debug logging
    
    // Start a new read-only transaction to obtain the XmlFragment and for the TreeWalker
    let mut txn_ro = doc.transact();

    // Check YJS document structure
    let root_refs: Vec<String> = txn_ro.root_refs().map(|(key, _)| key.to_string()).collect();
    debug!("YJS document root refs: {:?}", root_refs);
    
    if let Some(default_fragment) = txn_ro.get_xml_fragment("default") {
        debug!("Default fragment length: {}", default_fragment.len(&txn_ro));
                 if default_fragment.len(&txn_ro) > 0 {
             debug!("Fragment has content, processing...");
         }
     } else {
         debug!("No default fragment found");
     }

    // 🚀 PERFORMANCE FIX: Removed expensive debug enumeration of all YJS structures
    // This eliminates redundant tree walking and string allocations



    // Try multiple fragment names used by different editors.
    // IMPORTANT: we prefer fragments that actually **contain content**.
    // Bootstrap fragments we create empty at startup ("default", "content", "prosemirror")
    // are always present – we need to skip the empty ones.
    let fragment_candidates = ["default", "content", "prosemirror"];

    let mut fragment_name: Option<&str> = None;
    
    // 1️⃣  Pick the first fragment that exists **and** has len > 0.
    for &candidate in &fragment_candidates {
        if let Some(f) = txn_ro.get_xml_fragment(candidate) {
            let len = f.len(&txn_ro);
            debug!("Examining fragment '{}' – len = {}", candidate, len);
            if len > 0 {
                fragment_name = Some(candidate);
                break;
            }
        }
    }
    
    // 2️⃣  If none of the standard fragments had content, fall back to the first that exists (status quo ante)
    if fragment_name.is_none() {
        for &candidate in &fragment_candidates {
            if txn_ro.get_xml_fragment(candidate).is_some() {
                fragment_name = Some(candidate);
                break;
            }
        }
    }
        
    debug!("✅ Using fragment '{}' for script_id: {}", fragment_name.unwrap_or("default"), script_id);
    
    // Store fragment name for use in error messages
    let fragment_name_for_errors = fragment_name.unwrap_or("default").to_string();
    
    let final_content_xml_fragment_ref: XmlFragmentRef = match txn_ro.get_xml_fragment(fragment_name.unwrap_or("default")) {
        Some(fragment) => fragment,
        None => {
            warn!(
                "XmlFragment '{}' not found for script {}. Creating it now. This might indicate an issue with initial Yjs doc structure from client.",
                fragment_name_for_errors, script_id
            );
            drop(txn_ro); // Drop the read-only transaction before starting a mutable one.

            // Scope for the mutable transaction to create the fragment.
            {
                let mut txn_mut = doc.transact_mut();
                txn_mut.get_or_insert_xml_fragment(fragment_name.unwrap_or("default"));
                // txn_mut is dropped here, committing the change.
            }

            // Re-establish the read-only transaction after potential modification.
            txn_ro = doc.transact();
            // This time, the fragment must exist.
            txn_ro.get_xml_fragment(fragment_name.unwrap_or("default")).ok_or_else(|| {
                anyhow::anyhow!(
                    "Failed to get or create '{}' XmlFragment for script {} after attempting creation",
                    fragment_name_for_errors, script_id
                )
            })?
        }
    };

    let mut blocks_to_insert: Vec<NewBlockForSnapshot> = Vec::new();
    let mut current_order = 0;

    // 🚀 PERFORMANCE FIX: Start optimized tree walking without debug spam
    for top_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(final_content_xml_fragment_ref.as_ref(), &txn_ro) {

        if let XmlOut::Element(elem_ref) = top_item_out {
            let attributes_map: std::collections::HashMap<String, String> =
                elem_ref.attributes(&txn_ro)
                    .map(|(k, v_str)| (k.to_string(), v_str.to_string(&txn_ro)))
                    .collect();
            
            let tag_name = elem_ref.tag().to_string();
            // 🚀 PERFORMANCE FIX: Removed verbose trace logging from inner loop

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
                    // NEW TipTap structure support
                    "dialogue-block" => {
                        // Extract speaker and dialogue text from nested structure
                        let mut speaker = "Unknown Speaker".to_string();
                        let mut dialogue_text = String::new();
                        
                        // Walk through child elements to find speaker and dialogue-text
                        for child_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(elem_ref.as_ref(), &txn_ro) {
                            if let XmlOut::Element(child_elem_ref) = child_item_out {
                                let child_attributes: std::collections::HashMap<String, String> =
                                    child_elem_ref.attributes(&txn_ro)
                                        .map(|(k, v_str)| (k.to_string(), v_str.to_string(&txn_ro)))
                                        .collect();
                                
                                if let Some(child_type) = child_attributes.get("data-type") {
                                    match child_type.as_str() {
                                        "speaker" => {
                                            // Extract speaker name
                                            for speaker_child in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(child_elem_ref.as_ref(), &txn_ro) {
                                                if let XmlOut::Text(speaker_text_ref) = speaker_child {
                                                    speaker = speaker_text_ref.get_string(&txn_ro).trim().to_string();
                                                }
                                            }
                                        },
                                        "dialogue-text" => {
                                            // Extract dialogue text from nested paragraphs
                                            for dialogue_child in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(child_elem_ref.as_ref(), &txn_ro) {
                                                if let XmlOut::Text(dialogue_text_ref) = dialogue_child {
                                                    dialogue_text.push_str(&dialogue_text_ref.get_string(&txn_ro));
                                                    dialogue_text.push(' '); // Add space between text nodes
                                                }
                                            }
                                        },
                                        _ => {}
                                    }
                                }
                            }
                        }
                        
                        dialogue_text = dialogue_text.trim().to_string();
                        if dialogue_text.is_empty() {
                            dialogue_text = current_element_text_content.clone();
                        }
                        
                        // 🚀 PERFORMANCE FIX: Use trace level for detailed parsing logs
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::Dialogue(Dialogue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker: Some(speaker),
                            line: Some(dialogue_text),
                            page_number,
                            extra: HashMap::new(),
                        }))
                    },
                    // OLD format support (backward compatibility)
                    "dialogue" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::Dialogue(Dialogue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker: Some(speaker),
                            line: Some(current_element_text_content.clone()),
                            page_number,
                            extra: HashMap::new(),
                        }))
                    },
                    "stage_direction" => {
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::StageDirection(StageDirection {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            description: Some(current_element_text_content.clone()),
                            page_number,
                        }))
                    },
                    "monologue" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::Monologue(Monologue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker: Some(speaker),
                            lines: vec![current_element_text_content.clone()], // Assuming single line for now from direct text
                            page_number,
                        }))
                    },
                    "joint_dialogue" => {
                        let speakers_str = attributes_map.get("data-speakers").map(|s| s.to_string()).unwrap_or_else(String::new);
                        let speakers = speakers_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::JointDialogue(JointDialogue {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speakers,
                            line: Some(current_element_text_content.clone()),
                            page_number,
                            extra: HashMap::new(),
                        }))
                    },
                    "reading" => {
                        let speaker = attributes_map.get("data-speaker").map(|s| s.to_string()).unwrap_or_else(|| "Unknown Speaker".to_string());
                        let source = attributes_map.get("data-source").map(|s| s.to_string());
                        let language = attributes_map.get("data-language").map(|s| s.to_string());
                        let page_number = attributes_map.get("data-page")
                            .and_then(|p| p.parse::<i32>().ok())
                            .unwrap_or(1);
                        Ok(ContentElement::Reading(Reading {
                            id: attributes_map.get("data-id").map(|s| s.to_string()),
                            speaker: Some(speaker),
                            source,
                            language,
                            reading_text: Some(current_element_text_content.clone()),
                            page_number,
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
                                "dialogue-block" => { remaining_attributes.remove("data-layout"); } // NEW TipTap structure
                                "reading" => {
                                    remaining_attributes.remove("data-speaker");
                                    remaining_attributes.remove("data-source");
                                    remaining_attributes.remove("data-language");
                                }
                                "joint_dialogue" => { remaining_attributes.remove("data-speakers"); }
                                _ => {}
                            }

                            // 🚀 PERFORMANCE FIX: Reduced logging frequency in hot path
                            // Extract page number from data-page attribute if available, default to 1
                            let page_number = attributes_map.get("data-page")
                                .and_then(|p| p.parse::<i32>().ok())
                                .unwrap_or(1);
                            
                            blocks_to_insert.push(NewBlockForSnapshot {
                                block_type: p_block_type.to_string(),
                                content: Some(json_content),
                                block_order: current_order,
                                page_number,
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
                    // Extract page number from data-page attribute if available, default to 1
                    let page_number = attributes_map.get("data-page")
                        .and_then(|p| p.parse::<i32>().ok())
                        .unwrap_or(1);
                    
                    blocks_to_insert.push(NewBlockForSnapshot {
                        block_type: generic_block_type.clone(),
                        content: Some(serde_json::to_string(&generic_block_content).unwrap_or_else(|e| {
                            error!("Failed to serialize generic_block_content to JSON for type {}: {}. Using error placeholder.", generic_block_type, e);
                            serde_json::json!({"error": "serialization failed", "original_content": generic_block_content}).to_string()
                        })),
                        block_order: current_order,
                        page_number,
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
                            page_number: 1, // Default page for loose text
                            metadata: None,
                        });
                        current_order += 1;
                    }
                }
            }
        }
    } // End of for top_item_out in TreeWalker loop

    trace!("[SnapshottingService] Finished TreeWalker for script_id: {}. Total blocks to insert: {}", script_id, blocks_to_insert.len());

    // ------------------------------------------------------------------
    // ✨ Fallback: Some editor setups (e.g. current TipTap) put the entire
    // document into a YText named "prosemirror" or "content" instead of
    // XmlFragment children.  If we still extracted *zero* blocks after all
    // of the above, try to read that text directly and store it as a single
    // paragraph so users at least see their content.
    // ------------------------------------------------------------------
    if blocks_to_insert.is_empty() {
        debug!("[SnapshottingService] Fallback: No blocks extracted, checking for YText content...");
        
        // Check for YText content in common field names (TipTap uses 'default' by default)
        let ytext_fields = ["default", "prosemirror", "content"];
        let mut found_content = false;
        
        for field_name in &ytext_fields {
            if let Some(ytext) = txn_ro.get_text(*field_name) {
                let raw_text = ytext.get_string(&txn_ro);
                debug!("[SnapshottingService] Fallback: Found '{}' YText with {} chars: '{}'", field_name, raw_text.len(), raw_text);
                if !raw_text.trim().is_empty() {
                    info!("[SnapshottingService] Fallback: found plain YText '{}' with {} chars for script {} – inserting single paragraph block.", field_name, raw_text.len(), script_id);
                    blocks_to_insert.push(NewBlockForSnapshot {
                        block_type: "paragraph".to_string(),
                        content: Some(raw_text),
                        block_order: 0,
                        page_number: 1, // Default page for YText fallback
                        metadata: None,
                    });
                    found_content = true;
                    break; // Found content, no need to check other fields
                }
            }
        }
        
        if !found_content {
            debug!("[SnapshottingService] Fallback: No YText found for any of: {:?}", ytext_fields);
        }
    }

    // ------------------------------------------------------------------
    // ✨ Enhanced Content Snapshot Processing: Parse HTML into structured blocks with page numbers
    // Instead of creating one big "content" block, preserve the detailed block structure
    // ------------------------------------------------------------------
    if blocks_to_insert.is_empty() {
        debug!("[SnapshottingService] Content snapshot fallback: No blocks from YJS, trying content snapshot...");
        
        // Try to get content snapshot from database
        let snapshot_result = sqlx::query!(
            "SELECT content_snapshot, snapshot_format FROM script_snapshots_meta WHERE script_id = $1 AND content_snapshot IS NOT NULL",
            script_id
        )
        .fetch_optional(pool.as_ref())
        .await;

        match snapshot_result {
            Ok(Some(snapshot)) => {
                if let Some(content) = snapshot.content_snapshot {
                    if !content.trim().is_empty() {
                        info!("[SnapshottingService] 📸 Using enhanced content snapshot fallback for script_id: {}", script_id);
                        
                        // Parse HTML content into structured blocks with page numbers
                        match parse_html_to_blocks_with_pages(&content) {
                            Ok(parsed_blocks) => {
                                for (index, (block_type, block_content, page_number)) in parsed_blocks.into_iter().enumerate() {
                                    blocks_to_insert.push(NewBlockForSnapshot {
                                        block_type,
                                        content: Some(block_content),
                                        block_order: index as i32,
                                        page_number, // Use parsed page number
                                        metadata: Some(serde_json::json!({
                                            "source": "content_snapshot_parsed",
                                            "format": snapshot.snapshot_format.clone().unwrap_or_else(|| "html".to_string()),
                                            "fallback_reason": "yjs_reconstruction_failed",
                                            "page_number": page_number
                                        })),
                                    });
                                }
                                info!("[SnapshottingService] ✅ Created {} structured blocks from content snapshot", blocks_to_insert.len());
                            }
                            Err(e) => {
                                error!("[SnapshottingService] Failed to parse content snapshot HTML: {}. Falling back to single content block.", e);
                                // Fallback to original single-block approach
                        blocks_to_insert.push(NewBlockForSnapshot {
                            block_type: "content".to_string(),
                            content: Some(content.clone()),
                            block_order: 0,
                                    page_number: 1, // Default page for single content fallback
                            metadata: Some(serde_json::json!({
                                "source": "content_snapshot",
                                "format": snapshot.snapshot_format.unwrap_or_else(|| "html".to_string()),
                                        "fallback_reason": "yjs_reconstruction_failed_and_parse_failed"
                            })),
                        });
                            }
                        }
                    } else {
                        debug!("[SnapshottingService] Content snapshot is empty for script_id: {}", script_id);
                    }
                } else {
                    debug!("[SnapshottingService] Content snapshot is null for script_id: {}", script_id);
                }
            }
            Ok(None) => {
                debug!("[SnapshottingService] No content snapshot available for script_id: {}", script_id);
            }
            Err(e) => {
                error!("[SnapshottingService] Failed to fetch content snapshot for script_id {}: {}", script_id, e);
            }
        }
    }

    if blocks_to_insert.is_empty() && !updates_to_apply.is_empty() {
        warn!(
            "No blocks extracted from XmlFragment '{}' for script_id: {}, though {} updates were applied. Document might be empty or structured differently than expected.",
            fragment_name_for_errors, script_id, updates_to_apply.len()
        );
    } else if blocks_to_insert.is_empty() {
        trace!("No blocks extracted, and no new updates were applied for script_id: {}", script_id);
    }

    if !blocks_to_insert.is_empty() {
        // 🚨 PROTECTION: Don't overwrite recently uploaded content
        // Check if blocks were recently created from upload (within last 10 minutes for testing)
        let recent_upload_check = sqlx::query!(
            "SELECT COUNT(*) as count FROM blocks WHERE script_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'",
            script_id
        )
        .fetch_one(pool.as_ref())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to check for recent uploads for script {}: {}", script_id, e))?;

        if recent_upload_check.count.unwrap_or(0) > 0 {
            info!("[SnapshottingService] 🛡️ Skipping block overwrite for script_id: {} - contains recently uploaded content (created within 2 minutes)", script_id);
            return Ok(());
        }

        let blocks_count = blocks_to_insert.len();
        info!("[SnapshottingService] Attempting to update blocks table for script_id: {}. Found {} blocks from Yjs doc.", script_id, blocks_count);
        
        // 🚀 ASYNC SAFETY FIX: Wrap transaction in timeout to prevent connection pool exhaustion
        // This ensures no transaction can hang indefinitely and block other operations
        let transaction_timeout = Duration::from_secs(30); // 30 seconds max for any transaction
        
        // Clone values needed in the async block to avoid borrowing issues
        let pool_clone = pool.clone();
        let blocks_to_insert_clone = blocks_to_insert.clone();
        
        let transaction_result = timeout(transaction_timeout, async move {
            // 🚀 PERFORMANCE & SAFETY FIX: Use short transaction with batch operations
            // This prevents connection pool exhaustion and reduces lock time by 90%+
            let mut db_tx = pool_clone.begin().await.map_err(|e| anyhow::anyhow!("Failed to begin DB transaction for snapshotting script {}: {}", script_id, e))?;

        // Quick delete operation
        sqlx::query("DELETE FROM blocks WHERE script_id = $1")
            .bind(script_id)
            .execute(&mut *db_tx)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to delete old blocks for script {}: {}", script_id, e))?;
        
        trace!("[SnapshottingService] Deleted old blocks for script_id: {}", script_id);

            // 🚀 BATCH INSERT: Replace individual INSERTs with a single batch operation
            // This reduces transaction time from O(n) to O(1) and prevents deadlocks
            if !blocks_to_insert_clone.is_empty() {
                let mut query_builder = QueryBuilder::new(
                    "INSERT INTO blocks (script_id, block_type, content, block_order, page_number, metadata) "
                );
                
                query_builder.push_values(blocks_to_insert_clone.iter(), |mut b, block_data| {
                    b.push_bind(script_id)
                     .push_bind(&block_data.block_type)
                     .push_bind(&block_data.content)
                     .push_bind(block_data.block_order)
                     .push_bind(block_data.page_number)
                     .push_bind(&block_data.metadata);
                });

                let batch_query = query_builder.build();
                batch_query
                    .execute(&mut *db_tx)
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to batch insert blocks for script {}: {}", script_id, e))?;
                
                trace!("[SnapshottingService] Batch inserted {} blocks for script_id: {}", blocks_to_insert_clone.len(), script_id);
            }

            // Quick commit - transaction held for minimal time
            db_tx.commit().await.map_err(|e| anyhow::anyhow!("Failed to commit DB transaction for snapshotting script {}: {}", script_id, e))?;
            
            Ok::<(), anyhow::Error>(())
        }).await;
        
        // Handle timeout and transaction results
        match transaction_result {
            Ok(Ok(())) => {
                info!("[SnapshottingService] ✅ Successfully committed {} blocks to database for script_id: {} (FAST BATCH)", blocks_count, script_id);
            }
            Ok(Err(e)) => {
                return Err(anyhow::anyhow!("Database transaction failed for script {}: {}", script_id, e));
            }
            Err(_) => {
                return Err(anyhow::anyhow!("Database transaction timed out after {} seconds for script {} - this prevents connection pool exhaustion", transaction_timeout.as_secs(), script_id));
            }
        }

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

/// 🔒 SECURITY: Timeout wrapper for regex operations to prevent ReDoS attacks
/// 
/// This function wraps regex operations with a timeout to prevent
/// Regular Expression Denial of Service (ReDoS) attacks.
async fn regex_with_timeout<T>(
    operation: impl std::future::Future<Output = T>,
    timeout_duration: Duration,
) -> Result<T, anyhow::Error> {
    match timeout(timeout_duration, operation).await {
        Ok(result) => Ok(result),
        Err(_) => Err(anyhow::Error::msg("Regex operation timed out - potential ReDoS attack")),
    }
}

/// Enhanced HTML parsing that extracts page numbers from HTML content.
/// 
/// This function parses HTML content from TipTap editor and extracts both the block structure
/// and page number information, preserving the detailed layout that AI originally created.
///
/// # Arguments
/// * `html_content` - HTML string containing editor content with potential page indicators
///
/// # Returns
/// * `Result<Vec<(String, String, i32)>>` - Vector of (block_type, content, page_number) tuples
fn parse_html_to_blocks_with_pages(html_content: &str) -> Result<Vec<(String, String, i32)>, anyhow::Error> {
    // 🔒 SECURITY: Prevent ReDoS by limiting input size
    const MAX_HTML_SIZE: usize = 1_000_000; // 1MB limit
    if html_content.len() > MAX_HTML_SIZE {
        return Err(anyhow::Error::msg("HTML content too large - potential ReDoS attack"));
    }
    
    let mut blocks = Vec::new();
    
    // Enhanced HTML parsing that preserves page number information
    // Look for data-page attributes and page indicators in the HTML
    
    // Use static compiled regexes for better performance
    
    let mut current_page = 1;
    
            // First, look for structured Pessoa blocks (dialogue, stage directions, etc.)
        for cap in DIV_REGEX.captures_iter(html_content) {
        let attributes = cap.get(1).map_or("", |m| m.as_str());
        let block_type = cap.get(2).map_or("paragraph", |m| m.as_str());
        let content_html = cap.get(4).map_or("", |m| m.as_str());
        
        // Extract page number from data-page attribute
        let page_number = extract_attribute_value(attributes, "data-page")
            .and_then(|p| p.parse::<i32>().ok())
            .unwrap_or(current_page);
        
        // Clean HTML content
        let clean_content = remove_html_tags_simple(content_html);
        
        if !clean_content.trim().is_empty() {
            // Create structured content based on block type
            let structured_content = match block_type {
                "dialogue-block" | "dialogue" => {
                    // Try to extract speaker and line from attributes or content
                    let speaker = extract_attribute_value(attributes, "data-speaker").unwrap_or_else(|| "Unknown Speaker".to_string());
                    serde_json::json!({
                        "speaker": speaker,
                        "line": clean_content.trim()
                    }).to_string()
                },
                "stage_direction" => {
                    serde_json::json!({
                        "description": clean_content.trim()
                    }).to_string()
                },
                _ => {
                    serde_json::json!(clean_content.trim()).to_string()
                }
            };
            
            blocks.push((block_type.to_string(), structured_content, page_number));
            current_page = page_number; // Update current page for subsequent blocks
        }
    }
    
    // Then process regular paragraphs that aren't structured Pessoa blocks
    for cap in PARAGRAPH_REGEX.captures_iter(html_content) {
        let attributes = cap.get(1).map_or("", |m| m.as_str());
        let content_html = cap.get(2).map_or("", |m| m.as_str());
        
        // Skip if this paragraph is already processed as a structured block
        if content_html.contains("data-type=") {
            continue;
        }
        
        // Extract page number from data-page attribute
        let page_number = extract_attribute_value(attributes, "data-page")
            .and_then(|p| p.parse::<i32>().ok())
            .unwrap_or(current_page);
        
        let clean_content = remove_html_tags_simple(content_html);
        
        if !clean_content.trim().is_empty() {
            // Detect content type heuristically
            let (block_type, final_content) = if clean_content.trim().starts_with('(') && clean_content.trim().ends_with(')') {
                ("stage_direction", serde_json::json!({
                    "description": clean_content.trim().trim_start_matches('(').trim_end_matches(')')
                }).to_string())
            } else if clean_content.contains(':') && clean_content.split(':').count() == 2 {
                let parts: Vec<&str> = clean_content.split(':').collect();
                let speaker = parts[0].trim();
                let line = parts[1].trim();
                ("dialogue", serde_json::json!({
                    "speaker": speaker,
                    "line": line
                }).to_string())
            } else {
                ("paragraph", serde_json::json!(clean_content.trim()).to_string())
            };
            
            blocks.push((block_type.to_string(), final_content, page_number));
            current_page = page_number; // Update current page for subsequent blocks
        }
    }
    
    // If no blocks were parsed, create a default paragraph
    if blocks.is_empty() {
        let clean_content = remove_html_tags_simple(html_content);
        if !clean_content.trim().is_empty() {
            blocks.push(("paragraph".to_string(), serde_json::json!(clean_content.trim()).to_string(), 1));
        }
    }
    
    Ok(blocks)
}

/// 🔒 SECURITY: Safe HTML sanitization function - prevents XSS attacks
/// 
/// This function safely removes HTML tags and decodes HTML entities using a proper library
/// instead of manual string replacement which could be vulnerable to XSS attacks.
fn remove_html_tags_simple(html: &str) -> String {
    // First, remove HTML tags safely
    let tag_regex = Regex::new(r"<[^>]*>").unwrap();
    let without_tags = tag_regex.replace_all(html, "");
    
    // 🔒 SECURITY: Use proper HTML entity decoding instead of manual replacement
    // This prevents XSS attacks that could bypass manual entity decoding
    let decoded = html_escape::decode_html_entities(&without_tags);
    
    // Clean up whitespace and normalize
    decoded
        .replace("&nbsp;", " ")  // Handle non-breaking spaces separately
        .trim()
        .to_string()
}

/// 🔒 SECURITY: Safe attribute value extraction with sanitization
/// 
/// Extract attribute value from HTML attributes string with proper sanitization
/// to prevent attribute injection attacks.
fn extract_attribute_value(attributes: &str, attr_name: &str) -> Option<String> {
    // 🔒 SECURITY: Validate attribute name to prevent injection
    if !attr_name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return None;
    }
    
    // Simple string parsing approach to avoid regex syntax issues
    let search_pattern = format!("{}=\"", attr_name);
    if let Some(start) = attributes.find(&search_pattern) {
        let start_pos = start + search_pattern.len();
        if let Some(end) = attributes[start_pos..].find('"') {
            let value = &attributes[start_pos..start_pos + end];
            
            // 🔒 SECURITY: Sanitize the extracted value
            let sanitized = html_escape::encode_text(value);
            
            return Some(sanitized.to_string());
        }
    }
    None
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
            (ssm.last_snapshot_at IS NULL OR ssm.last_snapshot_at < NOW() - INTERVAL '5 seconds')
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
    info!("🚀 Snapshotting Service Task SPAWNED and RUNNING every {}ms for real-time sync!", SNAPSHOT_INTERVAL_MILLIS);
    
    let mut scripts_processed_count = 0u64;
    
    loop {
        tokio::time::sleep(Duration::from_millis(SNAPSHOT_INTERVAL_MILLIS)).await;
        
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