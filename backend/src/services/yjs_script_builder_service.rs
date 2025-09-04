//! YJS Script Builder Service
//!
//! This service takes chunked JSON data (5-page windows) and builds YJS documents.
//! It replaces the old json_to_db_service by directly creating YJS updates
//! instead of inserting blocks into the database.

use std::sync::Arc;
use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use anyhow::{Result, anyhow};
use tracing::{info, error, debug};
use yrs::{Doc, Options, Transact, ReadTxn, WriteTxn, StateVector};
use yrs::{XmlElementPrelim, XmlTextPrelim, Text, XmlFragment as _};
// use yrs::updates::encoder::Encode; // Not needed; we use encode via transact

// Define the structures for chunks (since yjs_document_builder is disabled)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptMetadata {
    pub title: String,
    pub author: Option<String>,
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptChunk {
    pub mode: String,
    pub chunk: Option<ChunkInfo>,
    pub metadata: Option<ScriptMetadata>,
    pub content: Vec<ContentItem>,
    pub context: Option<ChunkContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkInfo {
    pub number: i32,
    pub total: i32,
    pub pages_start: i32,
    pub pages_end: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkContext {
    pub last_scene: Option<String>,
    pub last_speaker: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentItem {
    #[serde(rename = "type")]
    pub content_type: String,
    pub content: String,
    pub page: Option<i32>,
    pub scene_number: Option<String>,
    pub speaker: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BuildResult {
    pub success: bool,
    pub script_id: Option<Uuid>,
    pub chunk_number: Option<i32>,
    pub total_chunks: Option<i32>,
    pub items_processed: i32,
    pub errors: Vec<String>,
    pub message: String,
}

pub struct YjsScriptBuilderService {
    db_pool: Arc<PgPool>,
}

impl YjsScriptBuilderService {
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        Self { db_pool }
    }

    /// Process a script chunk and store it as YJS update
    pub async fn build_script_from_json(&self, json_str: &str, script_id: Option<Uuid>, username: &str) -> Result<BuildResult> {
        let _errors: Vec<String> = Vec::new();

        // Parse JSON according to chunked format
        let chunk: ScriptChunk = match serde_json::from_str(json_str) {
            Ok(data) => data,
            Err(e) => {
                error!("Failed to parse JSON: {}", e);
                return Ok(BuildResult {
                    success: false,
                    script_id: None,
                    chunk_number: None,
                    total_chunks: None,
                    items_processed: 0,
                    errors: vec![format!("JSON parse error: {}", e)],
                    message: "Failed to parse JSON".to_string(),
                });
            }
        };

        // Determine script ID (use provided or generate new for first chunk)
        let script_id = script_id.unwrap_or_else(Uuid::new_v4);
        
        // Get user ID
        let user_id = self.get_user_id(username).await?;

        // Always process chunked (fallback to chunked if mode is missing)
        match chunk.mode.as_str() {
            "chunked" => self.process_chunked_script(&chunk, script_id, user_id).await,
            _ => self.process_chunked_script(&chunk, script_id, user_id).await,
        }
    }

    async fn process_chunked_script(&self, chunk: &ScriptChunk, script_id: Uuid, user_id: Uuid) -> Result<BuildResult> {
        let chunk_info = chunk.chunk.as_ref().ok_or_else(|| anyhow!("Missing chunk info"))?;
        
        info!("Processing chunk {} of {} for script {}", 
              chunk_info.number, chunk_info.total, script_id);

        // If this is the first chunk, create the script record and initialize an empty base state
        if chunk_info.number == 1 {
            if let Some(metadata) = &chunk.metadata {
                self.create_script_record(script_id, user_id, metadata).await?;
                // Initialize a minimal base state like manual scripts do (will be overwritten at finalization)
                self.initialize_empty_base_state(script_id).await.ok();
            }
        }

        // Load or create YJS document
        let doc = self.load_or_create_document(script_id).await?;
        // Capture state vector BEFORE applying this chunk, so we can compute a DIFF update
        use yrs::updates::decoder::Decode as _;
        let prev_sv_bytes = { let t = doc.transact(); t.state_vector().encode_v1() };

        // Apply chunk content to document
        self.apply_chunk_to_document(&doc, chunk)?;

        // Get a DIFF update against the previous state vector to avoid overwriting user edits
        let prev_sv = yrs::StateVector::decode_v1(&prev_sv_bytes)
            .unwrap_or_else(|_| yrs::StateVector::default());
        let update = doc.transact().encode_state_as_update_v1(&prev_sv);

        // Store the update
        self.store_yjs_update(script_id, user_id, update).await?;

        // If this is the last chunk, finalize by compacting recent updates into base state immediately
        if chunk_info.number == chunk_info.total {
            info!("Last chunk processed, finalizing script {} into base state", script_id);
            if let Err(e) = self.compact_now_to_base(script_id).await {
                error!("Failed to finalize script {} into base state: {}", script_id, e);
            }
        }

        Ok(BuildResult {
            success: true,
            script_id: Some(script_id),
            chunk_number: Some(chunk_info.number),
            total_chunks: Some(chunk_info.total),
            items_processed: chunk.content.len() as i32,
            errors: vec![],
            message: format!("Chunk {} of {} processed successfully", chunk_info.number, chunk_info.total),
        })
    }

    async fn process_full_script(&self, chunk: &ScriptChunk, script_id: Uuid, user_id: Uuid) -> Result<BuildResult> {
        info!("Processing full script {}", script_id);

        // Create script record
        if let Some(metadata) = &chunk.metadata {
            self.create_script_record(script_id, user_id, metadata).await?;
        }

        // Create new YJS document
        // Create doc with default options
        let doc = Doc::with_options(Options::default());

        // Apply content to document
        self.apply_chunk_to_document(&doc, chunk)?;

        // Get the initial state as update
        let update = doc.transact().encode_state_as_update_v1(&StateVector::default());

        // Store as base state for full scripts
        self.store_initial_yjs_state(script_id, update).await?;

        Ok(BuildResult {
            success: true,
            script_id: Some(script_id),
            chunk_number: None,
            total_chunks: None,
            items_processed: chunk.content.len() as i32,
            errors: vec![],
            message: "Script processed successfully".to_string(),
        })
    }

    async fn create_script_record(&self, script_id: Uuid, user_id: Uuid, metadata: &ScriptMetadata) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO scripts (id, created_by, title, created_at, is_public)
            VALUES ($1, $2, $3, NOW(), false)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                created_at = NOW()
            "#,
            script_id,
            user_id,
            metadata.title
        )
        .execute(&*self.db_pool)
        .await?;

        info!("Created script record: {} - '{}'", script_id, metadata.title);
        Ok(())
    }

    // Initialize an empty YJS base state similar to manual script creation
    async fn initialize_empty_base_state(&self, script_id: Uuid) -> Result<()> {
        use yrs::{Doc, Options, Transact};
        use yrs::updates::encoder::Encode;
        use yrs::{XmlElementPrelim, XmlFragment as _};

        let doc = Doc::with_options(Options::default());
        {
            let mut txn = doc.transact_mut();
            let default_fragment = txn.get_or_insert_xml_fragment("default");
            // Add an initial empty paragraph
            default_fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
            txn.get_or_insert_text("prosemirror");
            txn.get_or_insert_map("metadata");
        }
        let base_state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();

        sqlx::query(
            r#"
            INSERT INTO yjs_base_states 
                (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, NOW(), 0, 0, $4)
            ON CONFLICT (script_id) DO NOTHING
            "#
        )
        .bind(script_id)
        .bind(base_state.as_slice())
        .bind(state_vector.as_slice())
        .bind(base_state.len() as i32)
        .execute(&*self.db_pool)
        .await?;
        Ok(())
    }

    // Compact current updates into base state immediately (synchronous finalization)
    async fn compact_now_to_base(&self, script_id: Uuid) -> Result<()> {
        use crate::services::yjs_compaction_service::load_document;
        use yrs::updates::encoder::Encode;
        use yrs::Transact;

        // Load doc = base + recent updates
        let doc = load_document(&*self.db_pool, script_id).await?;
        let new_base = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();

        // Save/overwrite base state
        sqlx::query(
            r#"
            INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, 
                COALESCE((SELECT MAX(id) FROM yjs_recent_updates WHERE script_id = $1), 0),
                (SELECT COUNT(*) FROM yjs_recent_updates WHERE script_id = $1),
                $4)
            ON CONFLICT (script_id)
            DO UPDATE SET 
                base_state = EXCLUDED.base_state,
                state_vector = EXCLUDED.state_vector,
                last_compacted_update_id = EXCLUDED.last_compacted_update_id,
                update_count = yjs_base_states.update_count + EXCLUDED.update_count,
                document_size = EXCLUDED.document_size,
                compacted_at = NOW()
            "#
        )
        .bind(script_id)
        .bind(new_base.as_slice())
        .bind(state_vector.as_slice())
        .bind(new_base.len() as i32)
        .execute(&*self.db_pool)
        .await?;

        // Mark updates as compacted now
        sqlx::query(
            r#"UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1 AND is_compacted = false"#
        )
        .bind(script_id)
        .execute(&*self.db_pool)
        .await?;

        Ok(())
    }

    async fn load_or_create_document(&self, script_id: Uuid) -> Result<Doc> {
        // Try to load existing document
        let base_state = sqlx::query!(
            "SELECT base_state FROM yjs_base_states WHERE script_id = $1",
            script_id
        )
        .fetch_optional(&*self.db_pool)
        .await?;

        // Create doc with default options
        let doc = Doc::with_options(Options::default());

        // Initialize required YJS structures
        {
            let mut txn = doc.transact_mut();
            // Create the standard YJS structures used by the editor
            txn.get_or_insert_xml_fragment("xmlFragment");
            txn.get_or_insert_text("prosemirror");
            txn.get_or_insert_map("metadata");
        }

        // Apply base state if exists
        if let Some(base) = base_state {
            if !base.base_state.is_empty() {
                use yrs::updates::decoder::Decode;
                if let Ok(update) = yrs::Update::decode_v1(&base.base_state) {
                    let mut wtxn = doc.transact_mut();
                    let _ = wtxn.apply_update(update);
                    drop(wtxn);
                }
            }
        }

        // Load and apply recent updates
        let updates = sqlx::query!(
            r#"
            SELECT update_data 
            FROM yjs_recent_updates 
            WHERE script_id = $1 AND NOT is_compacted
            ORDER BY id ASC
            "#,
            script_id
        )
        .fetch_all(&*self.db_pool)
        .await?;

        for update_row in updates {
            use yrs::updates::decoder::Decode;
            if let Ok(update) = yrs::Update::decode_v1(&update_row.update_data) {
                let mut wtxn = doc.transact_mut();
                let _ = wtxn.apply_update(update);
                drop(wtxn);
            }
        }

        Ok(doc)
    }

    fn apply_chunk_to_document(&self, doc: &Doc, chunk: &ScriptChunk) -> Result<()> {
        // Write plain text markers into 'prosemirror' field for legacy compatibility
        // AND populate a minimal TipTap-compatible structure in the 'default' fragment
        // so the editor can display content even without running the migration.
        let mut buffer = String::new();

        let mut current_page: i32 = -1;
        for item in &chunk.content {
            let page_num = item.page.unwrap_or(-1);
            if page_num >= 0 && page_num != current_page {
                current_page = page_num;
                buffer.push_str(&format!("[PAGE] {}\n\n", current_page));
            }

            match item.content_type.as_str() {
                "scene" | "scene_heading" => {
                    let title = if item.content.trim().is_empty() { "Untitled Scene".to_string() } else { item.content.clone() };
                    buffer.push_str(&format!("[SCENE] {}\n\n", title));
                }
                "dialogue" | "monologue" => {
                    let spk = item.speaker.as_deref().unwrap_or("").trim();
                    if !spk.is_empty() {
                        // Preserve paragraph breaks within dialogue
                        let parts: Vec<&str> = item.content.split('\n').collect();
                        if parts.is_empty() {
                            buffer.push_str(&format!("{}: \n\n", spk));
                        } else {
                            // First paragraph on same line
                            buffer.push_str(&format!("{}: {}\n", spk, parts[0].trim()));
                            for p in parts.iter().skip(1) {
                                buffer.push_str(&format!("{}\n", p.trim()));
                            }
                            buffer.push_str("\n\n");
                        }
                    } else {
                        // Fallback as paragraph
                        buffer.push_str(&format!("{}\n\n", item.content.trim()));
                    }
                }
                "stage_direction" | "reading" | _ => {
                    let txt = item.content.trim();
                    if !txt.is_empty() {
                        buffer.push_str(&format!("({})\n\n", txt));
                    }
                }
            }
        }

        // Apply to Y.Doc 'prosemirror' text (legacy)
        {
            let mut txn = doc.transact_mut();
            let txt = txn.get_or_insert_text("prosemirror");
            let cur_len = txt.len(&txn);
            if cur_len > 0 { txt.remove_range(&mut txn, 0, cur_len); }
            txt.push(&mut txn, &buffer);
        }

        // Also populate a structured TipTap-compatible document in the 'default' fragment
        {
            let mut txn = doc.transact_mut();
            let fragment = txn.get_or_insert_xml_fragment("default");
            // IMPORTANT: Do NOT clear previous content here.
            // The parser processes multiple chunks sequentially. Clearing would wipe
            // user edits made during an ongoing parsing session. Instead, we only append
            // content for each chunk, preserving existing content and edits.

            let mut current_page: i32 = -1;
            for item in &chunk.content {
                let page_num = item.page.unwrap_or(-1);
                if page_num >= 0 && page_num != current_page {
                    current_page = page_num;
                    let page_el = XmlElementPrelim::empty("pageIndicator");
                    let page_ref = fragment.push_back(&mut txn, page_el);
                    page_ref.push_back(&mut txn, XmlTextPrelim::new(format!("Page {}", current_page)));
                }

                match item.content_type.as_str() {
                    "scene" | "scene_heading" => {
                        let scene_el = XmlElementPrelim::empty("sceneBlock");
                        let scene_ref = fragment.push_back(&mut txn, scene_el);
                        let title = if item.content.trim().is_empty() { "Untitled Scene".to_string() } else { item.content.clone() };
                        scene_ref.push_back(&mut txn, XmlTextPrelim::new(title));
                    }
                    "dialogue" | "monologue" => {
                        let dlg_ref = fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                        let sp_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("speaker"));
                        if let Some(spk) = &item.speaker { if !spk.trim().is_empty() { sp_ref.push_back(&mut txn, XmlTextPrelim::new(spk.trim().to_string())); } }
                        let dtext_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                        let parts: Vec<&str> = item.content.split('\n').collect();
                        if parts.is_empty() {
                            let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut txn, XmlTextPrelim::new(String::new()));
                        } else {
                            for ptxt in parts {
                                let t = ptxt.trim();
                                if t.is_empty() { continue; }
                                let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(t.to_string()));
                            }
                        }
                    }
                    "stage_direction" | "reading" => {
                        let txt = item.content.trim();
                        if !txt.is_empty() {
                            let p = fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut txn, XmlTextPrelim::new(txt.to_string()));
                        }
                    }
                    _ => {
                        let txt = item.content.trim();
                        if !txt.is_empty() {
                            let p = fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut txn, XmlTextPrelim::new(txt.to_string()));
                        }
                    }
                }
            }
        }
        Ok(())
    }

    async fn store_yjs_update(&self, script_id: Uuid, user_id: Uuid, update: Vec<u8>) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO yjs_recent_updates 
                (script_id, user_id, update_data, created_at, expires_at, is_compacted)
            VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '2 hours', false)
            "#,
            script_id,
            user_id,
            update
        )
        .execute(&*self.db_pool)
        .await?;

        debug!("Stored YJS update for script {}: {} bytes", script_id, update.len());
        Ok(())
    }

    async fn store_initial_yjs_state(&self, script_id: Uuid, update: Vec<u8>) -> Result<()> {
        // For full scripts, store directly as base state
        sqlx::query!(
            r#"
            INSERT INTO yjs_base_states 
                (script_id, base_state, state_vector, compacted_at, update_count, document_size)
            VALUES ($1, $2, $3, NOW(), 1, $4)
            ON CONFLICT (script_id) DO UPDATE SET
                base_state = EXCLUDED.base_state,
                state_vector = EXCLUDED.state_vector,
                compacted_at = NOW(),
                document_size = EXCLUDED.document_size
            "#,
            script_id,
            update,
            vec![0u8], // Empty state vector for initial state
            update.len() as i32
        )
        .execute(&*self.db_pool)
        .await?;

        info!("Stored initial YJS state for script {}: {} bytes", script_id, update.len());
        Ok(())
    }

    async fn get_user_id(&self, username: &str) -> Result<Uuid> {
        let row = sqlx::query!(
            "SELECT id FROM users WHERE username = $1 OR email = $1",
            username
        )
        .fetch_optional(&*self.db_pool)
        .await?
        .ok_or_else(|| anyhow!("User not found: {}", username))?;

        Ok(row.id)
    }
}

/// Entry point for the JSON to YJS conversion (called by Claude Code)
pub async fn process_script_json(
    pool: Arc<PgPool>,
    json_str: &str,
    username: &str,
    script_id: Option<Uuid>
) -> Result<BuildResult> {
    let service = YjsScriptBuilderService::new(pool);
    service.build_script_from_json(json_str, script_id, username).await
}
