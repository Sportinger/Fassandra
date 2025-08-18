//! Script Application Service
//!
//! Orchestrates script creation, upload, and management workflows.
//! This service handles complex business logic that spans multiple domains.

use crate::error::AppError;
use crate::models::script::Script;
use crate::models::block::Block;
use std::sync::Arc;
use uuid::Uuid;
use tracing::{error, info, warn};
use serde::Serialize;
use sqlx::PgPool;
use anyhow::Result;
use crate::analysis::structs::Script as ParsedScript;
use crate::domain::script_service::ScriptService;

/// Content snapshot data structure
#[derive(Debug, Serialize)]
pub struct ContentSnapshot {
    pub script_id: Uuid,
    pub content: String,
    pub format: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Application service for script operations
pub struct ScriptApplicationService {
    script_service: Arc<ScriptService>,
    pool: Arc<PgPool>,
}

impl ScriptApplicationService {
    /// Creates a new ScriptApplicationService
    pub fn new(script_service: Arc<ScriptService>, pool: Arc<PgPool>) -> Self {
        Self {
            script_service,
            pool,
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
            .bind(script_title)
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
                
                let block_created_at = chrono::Utc::now();
                let block_id = Uuid::new_v4();

                info!(block_id = %block_id, script_id = %new_script_id, block_type = %block_type, page_number, scene_number = ?scene_number, scene_title = ?scene_title, "Inserting block record with clean JSON content and separate metadata");
                sqlx::query("INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)")
                    .bind(block_id)
                    .bind(new_script_id)
                    .bind(block_type)
                    .bind(clean_content_json.clone())
                    .bind(block_created_at)
                    .bind((section_index * 1000 + element_index) as i32) // Set proper block order
                    .bind(page_number) // Store page number in dedicated column
                    .bind(scene_number.clone()) // Store scene number in dedicated column (clone to avoid move)
                    .bind(scene_title.clone()) // Store scene title in dedicated column (clone to avoid move)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| {
                        error!(error = %e, block_id = %block_id, script_id = %new_script_id, block_type = %block_type, content = %clean_content_json, "Failed to insert block record");
                        AppError::Db(e)
                    })?;
                info!(block_id = %block_id, script_id = %new_script_id, page_number, scene_number = ?scene_number, scene_title = ?scene_title, "Block record inserted successfully with clean JSON content and separate metadata");
            }
        }

        // Commit transaction
        info!(script_id = %new_script_id, "Committing transaction");
        tx.commit().await.map_err(|e| {
            error!(error = %e, script_id = %new_script_id, "Failed to commit transaction");
            AppError::Db(e)
        })?;
        info!(script_id = %new_script_id, "Transaction committed successfully");

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

    /// Lists all scripts for a user
    pub async fn list_user_scripts(&self, user_id: Uuid) -> Result<Vec<Script>, AppError> {
        let scripts = sqlx::query_as::<_, Script>(
            "SELECT id, title, created_by, created_at, is_public, thumbnail 
             FROM scripts 
             WHERE created_by = $1 
             ORDER BY created_at DESC"
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

    /// Stores a content snapshot for a script
    pub async fn store_content_snapshot(
        &self,
        script_id: Uuid,
        content: String,
        format: String,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        info!(script_id = %script_id, user_id = %user_id, content_length = content.len(), "Storing content snapshot");

        // Input validation
        if content.len() > 10_000_000 {  // 10MB limit
            return Err(AppError::BadRequest("Content too large".to_string()));
        }

        if !["html", "json"].contains(&format.as_str()) {
            return Err(AppError::BadRequest("Invalid format, must be 'html' or 'json'".to_string()));
        }

        // Check access through domain service
        if !self.check_script_access(script_id, user_id).await? {
            warn!("User {} attempted to store content for script {} without access", user_id, script_id);
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        sqlx::query(
            r#"
            INSERT INTO script_snapshots_meta (script_id, content_snapshot, snapshot_format, created_at, last_snapshot_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (script_id) 
            DO UPDATE SET 
                content_snapshot = $2,
                snapshot_format = $3,
                created_at = NOW(),
                last_snapshot_at = NOW()
            "#
        )
        .bind(script_id)
        .bind(content)
        .bind(format)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to store content snapshot for script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to store content snapshot"))
        })?;

        info!(script_id = %script_id, user_id = %user_id, "Successfully stored content snapshot");
        Ok(())
    }

    /// Retrieves a content snapshot for a script
    pub async fn get_content_snapshot(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<ContentSnapshot, AppError> {
        // Check access
        if !self.check_script_access(script_id, user_id).await? {
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        let snapshot_result = sqlx::query_as::<_, (Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>)>(
            "SELECT content_snapshot, snapshot_format, created_at FROM script_snapshots_meta WHERE script_id = $1"
        )
        .bind(script_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to get content snapshot for script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to get content snapshot"))
        })?;

        match snapshot_result {
            Some((content_snapshot, snapshot_format, created_at)) => Ok(ContentSnapshot {
                script_id,
                content: content_snapshot.unwrap_or_default(),
                format: snapshot_format.unwrap_or_else(|| "html".to_string()),
                created_at,
            }),
            None => Err(AppError::NotFound("No content snapshot found".to_string())),
        }
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
                // Encode the document state for transmission
                use yrs::{Transact, ReadTxn};
                let state = doc.transact().encode_state_as_update_v1(&yrs::StateVector::default());
                info!(
                    script_id = %script_id,
                    user_id = %user_id,
                    state_size = state.len(),
                    "Successfully loaded script with YJS state"
                );
                Ok(Some((script, state)))
            }
            Err(e) => {
                error!("Failed to load YJS document for script {}: {}", script_id, e);
                // Return empty state instead of failing completely
                Ok(Some((script, Vec::new())))
            }
        }
    }

    /// Retrieves a script with all its blocks for authorized users (DEPRECATED - use get_script_with_yjs)
    pub async fn get_script_with_blocks(
        &self,
        script_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<(Script, Vec<Block>)>, AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Getting script with blocks");

        // Check access authorization
        if !self.check_script_access(script_id, user_id).await? {
            warn!("User {} attempted to access script {} without permission", user_id, script_id);
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        // Get the script
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

        // Get associated blocks ordered by block_order and page_number
        let blocks = sqlx::query_as::<_, Block>(
            r#"
            SELECT id, script_id, block_type, content, created_at, block_order, page_number, scene_number, scene_title, metadata
            FROM blocks 
            WHERE script_id = $1 
            ORDER BY block_order ASC, page_number ASC, created_at ASC
            "#
        )
        .bind(script_id)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to fetch blocks for script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to fetch script blocks"))
        })?;

        info!(
            script_id = %script_id, 
            user_id = %user_id, 
            blocks_count = blocks.len(),
            "Successfully retrieved script with blocks"
        );

        Ok(Some((script, blocks)))
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
} 