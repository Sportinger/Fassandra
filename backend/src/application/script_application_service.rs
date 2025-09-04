//! Script Application Service
//!
//! Orchestrates script creation, upload, and management workflows.
//! This service handles complex business logic that spans multiple domains.

use crate::error::AppError;
use crate::models::script::Script;
use std::sync::Arc;
use uuid::Uuid;
use tracing::{error, info, warn};
use sqlx::PgPool;
use anyhow::Result;
use crate::analysis::structs::Script as ParsedScript;
use crate::domain::script_service::ScriptService;
use yrs::updates::encoder::Encode;
use yrs::{ReadTxn, WriteTxn};


/// Application service for script operations
pub struct ScriptApplicationService {
    script_service: Arc<ScriptService>,
    pool: Arc<PgPool>,
    // yjs_base_state_service: Arc<YjsBaseStateService>,
}

impl ScriptApplicationService {
    /// Creates a new ScriptApplicationService
    pub fn new(script_service: Arc<ScriptService>, pool: Arc<PgPool>) -> Self {
        // let yjs_base_state_service = Arc::new(YjsBaseStateService::new((*pool).clone()));
        Self {
            script_service,
            pool,
            // yjs_base_state_service,
        }
    }

    /// Gets a reference to the database pool
    pub fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    /// Creates a script from parsed data with full validation and business logic
    pub async fn create_script_from_parsed(
        &self,
        parsed_script: &ParsedScript,
        user_id: Uuid,
    ) -> Result<Uuid, AppError> {
        info!(user_id = %user_id, "Creating script from parsed data");

        // Business validation through domain service
        self.script_service.validate_script_creation(user_id).await?;

        // Create the script with all business rules applied
        let script_id = self.create_script_from_parsed_internal(parsed_script, user_id).await?;

        info!(script_id = %script_id, user_id = %user_id, "Successfully created script");
        Ok(script_id)
    }

    /// Internal method to create script from parsed data
    async fn create_script_from_parsed_internal(
        &self,
        parsed_script: &ParsedScript,
        user_id: Uuid,
    ) -> Result<Uuid, AppError> {
        info!(user_id = %user_id, "Starting transaction for script creation");
        let mut tx = self.pool.begin().await.map_err(|e| {
            error!(error = %e, "Failed to begin transaction");
            AppError::Db(e)
        })?;
        info!("Transaction started successfully");

        // 1. Create the script entry
        let new_script_id = Uuid::new_v4();
        // Use filename as title instead of AI-extracted title for uploads
        let script_title = if let Some(source_filename) = &parsed_script.source_filename {
            // Extract title from filename: remove .pdf extension and clean up
            let clean_filename = source_filename
                .trim_end_matches(".pdf")
                .trim_end_matches(".PDF")
                .replace('_', " ")
                .replace('-', " ");
            
            // Capitalize first letter and limit length
            let mut chars = clean_filename.chars();
            let title = match chars.next() {
                None => "Uploaded Script".to_string(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            };
            
            // Limit length and add ellipsis if too long
            if title.len() > 100 {
                format!("{}...", &title[..97])
            } else {
                title
            }
        } else {
            // Fallback for manual scripts or if filename is missing
            Self::extract_main_title(
                parsed_script.title.as_deref().unwrap_or("Untitled Script")
            )
        };
        let created_at = chrono::Utc::now();

        info!(script_id = %new_script_id, title = %script_title, user_id = %user_id, "Inserting script record");
        sqlx::query("INSERT INTO scripts (id, title, created_by, created_at, is_public) VALUES ($1, $2, $3, $4, $5)")
            .bind(new_script_id)
            .bind(script_title.clone())
            .bind(user_id)
            .bind(created_at)
            .bind(false) // Default to private
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                error!(error = %e, script_id = %new_script_id, "Failed to insert script record");
                AppError::Db(e)
            })?;
        info!(script_id = %new_script_id, "Script record inserted successfully");

        // 2. Iterate through sections and content elements to create blocks
        for (section_index, section) in parsed_script.sections.iter().enumerate() {
            for (element_index, element) in section.content.iter().enumerate() {
                tracing::debug!(script_id = %new_script_id, section_index, element_index, "Processing content element for block creation");
                
                // Extract metadata using the new helper methods
                let page_number = element.get_page_number();
                let scene_number = element.get_scene_number();
                let scene_title = element.get_scene_title();
                
                // Convert to clean content JSON (without metadata)
                let clean_content_json = element.to_clean_content_json().map_err(|e| {
                    error!(error = %e, script_id = %new_script_id, section_index, element_index, "Failed to serialize clean content element");
                    AppError::Internal(anyhow::anyhow!("Failed to serialize clean content element"))
                })?;
                
                // Determine block type
                let block_type = match element {
                    crate::analysis::structs::ContentElement::Scene(_) => "scene-block",
                    crate::analysis::structs::ContentElement::Dialogue(_) => "dialogue",
                    crate::analysis::structs::ContentElement::Monologue(_) => "monologue",
                    crate::analysis::structs::ContentElement::StageDirection(_) => "stage_direction",
                    crate::analysis::structs::ContentElement::JointDialogue(_) => "joint_dialogue",
                    crate::analysis::structs::ContentElement::Reading(_) => "reading",
                    crate::analysis::structs::ContentElement::Unknown => "unknown",
                };
                
                // Blocks table deprecated - skip block insertion
                let block_id = Uuid::new_v4();
                info!(block_id = %block_id, script_id = %new_script_id, block_type = %block_type, page_number, scene_number = ?scene_number, scene_title = ?scene_title, "Skipping block insertion (deprecated)");
            }
        }

        // Commit transaction for script metadata
        info!(script_id = %new_script_id, "Committing transaction");
        tx.commit().await.map_err(|e| {
            error!(error = %e, script_id = %new_script_id, "Failed to commit transaction");
            AppError::Db(e)
        })?;
        info!(script_id = %new_script_id, "Transaction committed successfully");

        // Build initial YJS document from parsed content into the 'default' fragment (TipTap field)
        use yrs::{Doc, Options, Transact, XmlElementPrelim, XmlFragment, XmlTextPrelim};
        let doc = Doc::with_options(Options::default());
        {
            let mut txn = doc.transact_mut();
            let default_fragment = txn.get_or_insert_xml_fragment("default");
            txn.get_or_insert_text("prosemirror");
            txn.get_or_insert_map("metadata");

            let mut current_page: i32 = -1;
            for section in &parsed_script.sections {
                for element in &section.content {
                    let page_num = element.get_page_number();
                    if page_num >= 0 && page_num != current_page {
                        current_page = page_num;
                        let page_el = XmlElementPrelim::empty("pageIndicator");
                        let page_ref = default_fragment.push_back(&mut txn, page_el);
                        page_ref.push_back(&mut txn, XmlTextPrelim::new(format!("Page {}", current_page)));
                    }

                    match element {
                        crate::analysis::structs::ContentElement::Scene(s) => {
                            let scene_el = XmlElementPrelim::empty("sceneBlock");
                            let scene_ref = default_fragment.push_back(&mut txn, scene_el);
                            let title = if !s.scene_title.is_empty() { s.scene_title.clone() } else { s.scene_number.clone() };
                            if !title.is_empty() {
                                scene_ref.push_back(&mut txn, XmlTextPrelim::new(title));
                            }
                        }
                        crate::analysis::structs::ContentElement::Dialogue(d) => {
                            let dlg_ref = default_fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                            let sp_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("speaker"));
                            if let Some(spk) = &d.speaker { sp_ref.push_back(&mut txn, XmlTextPrelim::new(spk.clone())); }
                            let dtext_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                            if let Some(line) = &d.line { 
                                let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(line.clone()));
                            }
                            if let Some(lines) = &d.lines {
                                for l in lines {
                                    let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                    p.push_back(&mut txn, XmlTextPrelim::new(l.clone()));
                                }
                            }
                        }
                        crate::analysis::structs::ContentElement::Monologue(m) => {
                            let dlg_ref = default_fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                            let sp_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("speaker"));
                            if let Some(spk) = &m.speaker { sp_ref.push_back(&mut txn, XmlTextPrelim::new(spk.clone())); }
                            let dtext_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                            if let Some(line) = &m.line { 
                                let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(line.clone()));
                            }
                            if let Some(lines) = &m.lines {
                                for l in lines {
                                    let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                    p.push_back(&mut txn, XmlTextPrelim::new(l.clone()));
                                }
                            }
                        }
                        crate::analysis::structs::ContentElement::StageDirection(sd) => {
                            let mut text = String::new();
                            if let Some(t) = &sd.description { text = t.clone(); }
                            if text.is_empty() { if let Some(t) = &sd.line { text = t.clone(); } }
                            if text.is_empty() { if let Some(t) = &sd.reading_text { text = t.clone(); } }
                            if !text.is_empty() {
                                let p = default_fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(text));
                            }
                        }
                        crate::analysis::structs::ContentElement::Reading(r) => {
                            let mut text = String::new();
                            if let Some(t) = &r.reading_text { text = t.clone(); }
                            if text.is_empty() { if let Some(t) = &r.description { text = t.clone(); } }
                            if text.is_empty() { if let Some(t) = &r.line { text = t.clone(); } }
                            if !text.is_empty() {
                                let p = default_fragment.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(text));
                            }
                        }
                        crate::analysis::structs::ContentElement::JointDialogue(jd) => {
                            let dlg_ref = default_fragment.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                            let sp_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("speaker"));
                            if let Some(spk) = &jd.speaker { sp_ref.push_back(&mut txn, XmlTextPrelim::new(spk.clone())); }
                            let dtext_ref = dlg_ref.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                            if let Some(line) = &jd.line { 
                                let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                p.push_back(&mut txn, XmlTextPrelim::new(line.clone()));
                            }
                            if let Some(lines) = &jd.lines {
                                for l in lines {
                                    let p = dtext_ref.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                                    p.push_back(&mut txn, XmlTextPrelim::new(l.clone()));
                                }
                            }
                        }
                        crate::analysis::structs::ContentElement::Unknown => {}
                    }
                }
            }
        }

        // Persist as initial base state
        let base_state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();
        sqlx::query(
            r#"
            INSERT INTO yjs_base_states 
                (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, NOW(), 0, 0, $4)
            ON CONFLICT (script_id) DO UPDATE SET 
                base_state = EXCLUDED.base_state,
                state_vector = EXCLUDED.state_vector,
                last_compacted_update_id = EXCLUDED.last_compacted_update_id,
                update_count = EXCLUDED.update_count,
                document_size = EXCLUDED.document_size,
                compacted_at = NOW()
            "#
        )
        .bind(new_script_id)
        .bind(base_state.as_slice())
        .bind(state_vector.as_slice())
        .bind(base_state.len() as i32)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to persist initial YJS base state for script {}: {}", new_script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to persist initial YJS base state"))
        })?;
        
        Ok(new_script_id)
    }

    /// Extracts the main title from a potentially long title string.
    /// Takes the first line or first few words to create a clean, short title.
    fn extract_main_title(raw_title: &str) -> String {
        // Split by newlines and take the first line
        let first_line = raw_title.lines().next().unwrap_or(raw_title);
        
        // If still too long, take first 100 characters
        if first_line.len() > 100 {
            format!("{}...", &first_line[..97])
        } else {
            first_line.trim().to_string()
        }
    }

    /// Validates file upload for PDF scripts
    fn validate_pdf_upload(file_data: &[u8], filename: &str, content_type: &str) -> Result<(), AppError> {
        // File size validation (50MB max)
        if file_data.len() > 50 * 1024 * 1024 {
            return Err(AppError::BadRequest("File size exceeds 50MB limit".into()));
        }

        // Minimum file size (to avoid empty files)
        if file_data.len() < 1024 {
            return Err(AppError::BadRequest("File too small to be a valid PDF".into()));
        }

        // File extension validation
        if !filename.to_lowercase().ends_with(".pdf") {
            return Err(AppError::BadRequest("Only PDF files are supported".into()));
        }

        // MIME type validation
        let expected_types = [
            "application/pdf",
            "application/octet-stream"  // Some browsers use this for PDFs
        ];
        if !expected_types.contains(&content_type) {
            warn!("Unexpected content type for PDF: {}", content_type);
            // Don't reject based on MIME type alone as it can be unreliable
        }

        // Basic PDF header validation (PDF files start with %PDF-)
        if !file_data.starts_with(b"%PDF-") {
            return Err(AppError::BadRequest("File does not appear to be a valid PDF".into()));
        }

        Ok(())
    }

    /// Creates a simple script with just a title
    pub async fn create_script(&self, title: String, user_id: Uuid) -> Result<Script, AppError> {
        info!(user_id = %user_id, title = %title, "Creating new script");

        // Input validation
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
        }
        if title.len() > 500 {
            return Err(AppError::BadRequest("Script title too long".to_string()));
        }

        // Business validation
        self.script_service.validate_script_creation(user_id).await?;

        let script = sqlx::query_as::<_, Script>(
            "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, title, created_by, created_at, is_public, thumbnail"
        )
        .bind(Uuid::new_v4())
        .bind(title.trim())
        .bind(user_id)
        .bind(chrono::Utc::now())
        .bind(false)
        .bind(None::<String>)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to create script for user {}: {}", user_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to create script"))
        })?;

        info!(script_id = %script.id, user_id = %user_id, "Successfully created script");
        
        // Initialize empty YJS base state for the new script
        self.initialize_yjs_base_state(script.id).await?;
        
        Ok(script)
    }

    /// Updates a script with ownership verification
    pub async fn update_script(
        &self,
        script_id: Uuid,
        title: String,
        user_id: Uuid,
    ) -> Result<Script, AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Updating script");

        // Input validation
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
        }
        if title.len() > 500 {
            return Err(AppError::BadRequest("Script title too long".to_string()));
        }

        // Check ownership/access
        if !self.check_script_access(script_id, user_id).await? {
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        let script = sqlx::query_as::<_, Script>(
            "UPDATE scripts SET title = $2 WHERE id = $1 
             RETURNING id, title, created_by, created_at, is_public, thumbnail"
        )
        .bind(script_id)
        .bind(title.trim())
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to update script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to update script"))
        })?;

        info!(script_id = %script_id, user_id = %user_id, "Successfully updated script");
        Ok(script)
    }

    /// Deletes a script with ownership verification
    pub async fn delete_script(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Deleting script");

        // Check ownership/access
        if !self.check_script_access(script_id, user_id).await? {
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        let rows_affected = sqlx::query("DELETE FROM scripts WHERE id = $1")
            .bind(script_id)
            .execute(self.pool.as_ref())
            .await
            .map_err(|e| {
                error!("Failed to delete script {}: {}", script_id, e);
                AppError::Internal(anyhow::anyhow!("Failed to delete script"))
            })?
            .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NotFound("Script not found".to_string()));
        }

        info!(script_id = %script_id, user_id = %user_id, "Successfully deleted script");
        Ok(())
    }

    /// Lists all scripts for a user (including public scripts and shared scripts)
    pub async fn list_user_scripts(&self, user_id: Uuid) -> Result<Vec<Script>, AppError> {
        let scripts = sqlx::query_as::<_, Script>(
            "SELECT DISTINCT s.id, s.title, s.created_by, s.created_at, s.is_public, s.thumbnail 
             FROM scripts s
             LEFT JOIN script_shares ss ON s.id = ss.script_id
             WHERE s.created_by = $1                    -- User's own scripts
                OR s.is_public = true                   -- Public scripts from anyone
                OR ss.shared_with_user_id = $1          -- Scripts shared with user
             ORDER BY s.created_at DESC"
        )
        .bind(user_id)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to list scripts for user {}: {}", user_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to list scripts"))
        })?;

        Ok(scripts)
    }



    /// Retrieves a script with YJS document state for authorized users
    pub async fn get_script_with_yjs(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<(Script, Vec<u8>)>, AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Getting script with YJS state");

        // Check access authorization
        if !self.check_script_access(script_id, user_id).await? {
            warn!("User {} attempted to access script {} without permission", user_id, script_id);
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        // Get the script metadata
        let script = sqlx::query_as::<_, Script>(
            "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1"
        )
        .bind(script_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to fetch script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to fetch script"))
        })?;

        let script = match script {
            Some(s) => s,
            None => {
                info!(script_id = %script_id, "Script not found");
                return Ok(None);
            }
        };

        // Load the YJS document using the compaction service
        match crate::services::yjs_compaction_service::load_document(self.pool.as_ref(), script_id).await {
            Ok(doc) => {
                // Opportunistic server-side migration: if the 'default' fragment is empty
                // but legacy 'prosemirror' text has content, materialize minimal paragraphs
                // into 'default' so frontends always see content.
                {
                    use yrs::{Transact, ReadTxn, WriteTxn, XmlElementPrelim, XmlTextPrelim};
                    let mut needs_migration = false;
                    let prosemirror_len = {
                        let t = doc.transact();
                        let txt = t.get_text("prosemirror");
                        let len = txt.as_ref().map(|x| x.len(&t)).unwrap_or(0);
                        let default_len = t.get_xml_fragment("default").map(|f| f.len(&t)).unwrap_or(0);
                        needs_migration = default_len == 0 && len > 0;
                        len
                    };
                    if needs_migration && prosemirror_len > 0 {
                        let legacy = {
                            let t = doc.transact();
                            t.get_text("prosemirror").map(|x| x.to_string(&t)).unwrap_or_default()
                        };
                        let blocks: Vec<&str> = legacy
                            .split("\n\n")
                            .map(|b| b.trim())
                            .filter(|b| !b.is_empty())
                            .collect();
                        let mut w = doc.transact_mut();
                        let frag = w.get_or_insert_xml_fragment("default");
                        for b in blocks {
                            let p = frag.push_back(&mut w, XmlElementPrelim::empty("paragraph"));
                            p.push_back(&mut w, XmlTextPrelim::new(b.to_string()));
                        }
                    }
                }

                // Encode the document state for transmission
                use yrs::{Transact, ReadTxn};
                
                // Debug: Check what's in the document
                let txn = doc.transact();
                let has_content = txn.get_xml_fragment("default").is_some() || 
                                  txn.get_xml_fragment("xmlFragment").is_some() ||
                                  txn.get_xml_fragment("content").is_some();
                drop(txn);
                
                let state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
                info!(
                    script_id = %script_id,
                    user_id = %user_id,
                    state_size = state.len(),
                    has_content = has_content,
                    "Successfully loaded script with YJS state"
                );
                Ok(Some((script, state)))
            }
            Err(e) => {
                error!("Failed to load YJS document for script {}: {}", script_id, e);
                // Create a proper empty YJS document state instead of empty vec
                use yrs::{Doc, Options, Transact, ReadTxn, WriteTxn};
                let doc = Doc::with_options(Options::default());
                // Bootstrap with required fragments
                {
                    let mut txn = doc.transact_mut();
                    for name in ["default", "content", "prosemirror"] {
                        txn.get_or_insert_xml_fragment(name);
                        txn.get_or_insert_text(name);
                    }
                }
                let state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
                info!("Created fallback empty YJS state for script {} (size: {})", script_id, state.len());
                Ok(Some((script, state)))
            }
        }
    }


    /// Checks if a user has access to a script (owns it, it's public, or it's shared)
    async fn check_script_access(&self, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let has_access = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM scripts s
                WHERE s.id = $1 
                AND (
                    s.created_by = $2           -- User owns the script
                    OR s.is_public = true       -- Script is public
                    OR EXISTS (                 -- Script is shared with user
                        SELECT 1 FROM script_shares ss 
                        WHERE ss.script_id = s.id 
                        AND ss.shared_with_user_id = $2
                    )
                )
            )
            "#
        )
        .bind(script_id)
        .bind(user_id)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to check script access for user {}: {}", user_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to check permissions"))
        })?;

        Ok(has_access)
    }

    /// Initialize an empty YJS base state for a new script
    async fn initialize_yjs_base_state(&self, script_id: Uuid) -> Result<(), AppError> {
        use yrs::{Doc, Options, Transact};
        use yrs::updates::encoder::Encode;
        
        info!(script_id = %script_id, "Initializing empty YJS base state");
        
        // Create a new YJS document with default options
        let doc = Doc::with_options(Options::default());
        
        // Bootstrap with required fragments for TipTap editor
        {
            let mut txn = doc.transact_mut();
            // Create the standard YJS structures used by the editor
            let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
            let default_fragment = txn.get_or_insert_xml_fragment("default");
            txn.get_or_insert_xml_fragment("content");
            
            // Add an initial empty paragraph to make the document valid for TipTap
            // This is crucial - TipTap expects at least one paragraph element
            use yrs::{XmlElementPrelim, XmlFragment};
            let paragraph = XmlElementPrelim::empty("paragraph");
            default_fragment.push_back(&mut txn, paragraph);
            
            // Also ensure prosemirror text exists
            let prosemirror = txn.get_or_insert_text("prosemirror");
            
            // Add metadata
            txn.get_or_insert_map("metadata");
        }
        
        // Encode the initial state
        let base_state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();
        
        // Store in database
        sqlx::query!(
            r#"
            INSERT INTO yjs_base_states 
                (script_id, base_state, state_vector, compacted_at, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, NOW(), 0, 0, $4)
            ON CONFLICT (script_id) DO NOTHING
            "#,
            script_id,
            base_state.as_slice(),
            state_vector.as_slice(),
            base_state.len() as i32
        )
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to initialize YJS base state for script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to initialize YJS state"))
        })?;
        
        info!(script_id = %script_id, size = base_state.len(), "Successfully initialized YJS base state");
        Ok(())
    }
} 
