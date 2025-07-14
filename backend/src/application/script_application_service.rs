//! Script Application Service
//!
//! Orchestrates script creation, upload, and management workflows.
//! This service handles complex business logic that spans multiple domains.

use std::sync::Arc;
use sqlx::PgPool;
use sqlx::Row;
use tracing::{info, error, warn};
use uuid::Uuid;
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::analysis::structs::Script as ParsedScript;
use crate::analysis::parser::{extract_text_with_pages_from_docx, text_with_pages_to_string_with_page_markers};
use crate::domain::script_service::ScriptService;
use crate::error::AppError;
use crate::external::gemini_api::{call_gemini_for_parsing, GeminiApiError};
use crate::models::script::Script;

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
        let raw_title = parsed_script.title.as_deref().unwrap_or("Untitled Script");
        // Extract just the main title (first line or first few words) to avoid long titles
        let script_title = Self::extract_main_title(raw_title);
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
                let (block_type, content_json, page_number) = match element {
                    crate::analysis::structs::ContentElement::Dialogue(d) => {
                        ("dialogue", serde_json::to_string(d), d.page_number)
                    },
                    crate::analysis::structs::ContentElement::Monologue(m) => {
                        ("monologue", serde_json::to_string(m), m.page_number)
                    },
                    crate::analysis::structs::ContentElement::StageDirection(sd) => {
                        ("stage_direction", serde_json::to_string(sd), sd.page_number)
                    },
                    crate::analysis::structs::ContentElement::JointDialogue(jd) => {
                        ("joint_dialogue", serde_json::to_string(jd), jd.page_number)
                    },
                    crate::analysis::structs::ContentElement::Reading(r) => {
                        ("reading", serde_json::to_string(r), r.page_number)
                    },
                    crate::analysis::structs::ContentElement::Unknown => {
                        ("unknown", Ok("{}".to_string()), 1) // Default to page 1 for unknown elements
                    },
                };

                let content_str = content_json.map_err(|e| {
                    error!(error = %e, script_id = %new_script_id, section_index, element_index, "Failed to serialize content element");
                    AppError::Internal(anyhow::anyhow!("Failed to serialize content element"))
                })?;
                let block_created_at = chrono::Utc::now();
                let block_id = Uuid::new_v4();

                info!(block_id = %block_id, script_id = %new_script_id, block_type = %block_type, page_number, "Inserting block record with AI-provided page number");
                sqlx::query("INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number) VALUES ($1, $2, $3, $4, $5, $6, $7)")
                    .bind(block_id)
                    .bind(new_script_id)
                    .bind(block_type)
                    .bind(content_str.clone())
                    .bind(block_created_at)
                    .bind((section_index * 1000 + element_index) as i32) // Set proper block order
                    .bind(page_number) // Use AI-provided page number directly
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| {
                        error!(error = %e, block_id = %block_id, script_id = %new_script_id, block_type = %block_type, content = %content_str, "Failed to insert block record");
                        AppError::Db(e)
                    })?;
                info!(block_id = %block_id, script_id = %new_script_id, page_number, "Block record inserted successfully with AI-provided page number");
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
    fn extract_main_title(raw_title: &str) -> &str {
        // First, try to get the first line (split by newlines)
        let first_line = raw_title.lines().next().unwrap_or(raw_title);
        
        // If the first line is still very long, take only the first 5 words
        let words: Vec<&str> = first_line.split_whitespace().collect();
        if words.len() > 5 {
            // Find the position after the 5th word
            let mut char_count = 0;
            let mut word_count = 0;
            for (i, c) in first_line.char_indices() {
                if c.is_whitespace() {
                    word_count += 1;
                    if word_count == 5 {
                        char_count = i;
                        break;
                    }
                }
            }
            if char_count > 0 {
                &first_line[..char_count]
            } else {
                first_line
            }
        } else {
            first_line
        }
    }

    /// Uploads and parses a script with comprehensive validation
    pub async fn upload_and_parse_script(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<ParsedScript, AppError> {
        info!(filename = %filename, "Processing script upload");

        // Comprehensive file validation
        Self::validate_file_upload(&file_data, filename, content_type)?;

        // Extract text with page information
        let text_with_pages = extract_text_with_pages_from_docx(&file_data)
            .map_err(|e| {
                error!("Failed to extract text from DOCX: {}", e);
                AppError::BadRequest("Invalid or corrupted DOCX file".into())
            })?;

        info!("Extracted {} text elements with page information", text_with_pages.len());

        // Convert to enhanced text for Gemini processing
        let enhanced_text = text_with_pages_to_string_with_page_markers(&text_with_pages);

        // Parse via Gemini API
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| {
                error!("Failed to create HTTP client: {}", e);
                AppError::Internal(anyhow::anyhow!("Service temporarily unavailable"))
            })?;

        let parsed_script = call_gemini_for_parsing(&enhanced_text, &http_client)
            .await
            .map_err(|e| {
                error!("Gemini API call failed: {}", e);
                AppError::Internal(anyhow::anyhow!("Script parsing failed. Please try again."))
            })?;

        info!("Successfully parsed script with {} sections", parsed_script.sections.len());
        Ok(parsed_script)
    }

    /// Lists all scripts accessible to a user (owned, shared, or public)
    pub async fn list_user_scripts(&self, user_id: Uuid) -> Result<Vec<Script>, AppError> {
        info!(user_id = %user_id, "Listing user scripts");

        // User validation is handled by authentication middleware
        // Business logic doesn't need separate user existence validation

        let scripts = sqlx::query_as::<_, Script>(
            r#"
            SELECT DISTINCT s.id, s.title, s.created_by, s.created_at, s.is_public, s.thumbnail 
            FROM scripts s
            WHERE s.created_by = $1
               OR s.is_public = TRUE
               OR EXISTS (
                   SELECT 1 FROM script_shares ss 
                   WHERE ss.script_id = s.id 
                   AND ss.shared_with_user_id = $1
               )
            ORDER BY s.created_at DESC
            "#
        )
        .bind(user_id)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Failed to fetch scripts for user {}: {}", user_id, e);
            AppError::Internal(anyhow::anyhow!("Failed to fetch scripts"))
        })?;

        info!(user_id = %user_id, script_count = scripts.len(), "Successfully listed user scripts");
        Ok(scripts)
    }

    /// Creates a new script with validation
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
    pub async fn update_script(&self, script_id: Uuid, title: String, user_id: Uuid) -> Result<Script, AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Updating script");

        // Input validation
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
        }
        if title.len() > 500 {
            return Err(AppError::BadRequest("Script title too long".to_string()));
        }

        // Check ownership through domain service
        if !self.check_script_ownership(script_id, user_id).await? {
            warn!("User {} attempted to update script {} without ownership", user_id, script_id);
            return Err(AppError::Forbidden("You can only update scripts you own".to_string()));
        }

        let script = sqlx::query_as::<_, Script>(
            "UPDATE scripts SET title = $1 WHERE id = $2 
             RETURNING id, title, created_by, created_at, is_public, thumbnail"
        )
        .bind(title.trim())
        .bind(script_id)
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

        // Check ownership through domain service
        if !self.check_script_ownership(script_id, user_id).await? {
            warn!("User {} attempted to delete script {} without ownership", user_id, script_id);
            return Err(AppError::Forbidden("You can only delete scripts you own".to_string()));
        }

        sqlx::query("DELETE FROM scripts WHERE id = $1")
            .bind(script_id)
            .execute(self.pool.as_ref())
            .await
            .map_err(|e| {
                error!("Failed to delete script {}: {}", script_id, e);
                AppError::Internal(anyhow::anyhow!("Failed to delete script"))
            })?;

        info!(script_id = %script_id, user_id = %user_id, "Successfully deleted script");
        Ok(())
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
    pub async fn get_content_snapshot(&self, script_id: Uuid, user_id: Uuid) -> Result<ContentSnapshot, AppError> {
        info!(script_id = %script_id, user_id = %user_id, "Retrieving content snapshot");

        // Check access through domain service
        if !self.check_script_access(script_id, user_id).await? {
            return Err(AppError::Forbidden("Access denied".to_string()));
        }

        let snapshot_result = sqlx::query_as::<_, (Option<String>, Option<String>, chrono::DateTime<chrono::Utc>)>(
            "SELECT content_snapshot, snapshot_format, created_at 
             FROM script_snapshots_meta 
             WHERE script_id = $1 AND content_snapshot IS NOT NULL 
             ORDER BY created_at DESC LIMIT 1"
        )
        .bind(script_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Database error fetching content snapshot for script {}: {}", script_id, e);
            AppError::Internal(anyhow::anyhow!("Database error"))
        })?;

        let snapshot = match snapshot_result {
            Some((content_snapshot, snapshot_format, created_at)) => {
                if let Some(content) = content_snapshot {
                    info!("Retrieved content snapshot for script {}: {} chars", script_id, content.len());
                    ContentSnapshot {
                        script_id,
                        content,
                        format: snapshot_format.unwrap_or_else(|| "html".to_string()),
                        created_at: Some(created_at),
                    }
                } else {
                    ContentSnapshot {
                        script_id,
                        content: String::new(),
                        format: "html".to_string(),
                        created_at: None,
                    }
                }
            }
            None => {
                info!("No content snapshot found for script {}, returning empty content", script_id);
                ContentSnapshot {
                    script_id,
                    content: String::new(),
                    format: "html".to_string(),
                    created_at: None,
                }
            }
        };

        info!(script_id = %script_id, user_id = %user_id, "Successfully retrieved content snapshot");
        Ok(snapshot)
    }

    /// Checks if user has access to a script (owns it, it's public, or shared with them)
    async fn check_script_access(&self, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let row = sqlx::query(
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
            ) as has_access
            "#
        )
        .bind(script_id)
        .bind(user_id)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Database error checking script access: {}", e);
            AppError::Internal(anyhow::anyhow!("Database access error"))
        })?;

        Ok(row.try_get::<bool, _>("has_access").unwrap_or(false))
    }

    /// Checks if user owns a script (required for modification operations)
    async fn check_script_ownership(&self, script_id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let row = sqlx::query(
            "SELECT EXISTS(SELECT 1 FROM scripts WHERE id = $1 AND created_by = $2) as owns_script"
        )
        .bind(script_id)
        .bind(user_id)
        .fetch_one(self.pool.as_ref())
        .await
        .map_err(|e| {
            error!("Database error checking script ownership: {}", e);
            AppError::Internal(anyhow::anyhow!("Database access error"))
        })?;

        Ok(row.try_get::<bool, _>("owns_script").unwrap_or(false))
    }

    /// Comprehensive file validation for script uploads
    fn validate_file_upload(data: &[u8], filename: &str, content_type: &str) -> Result<(), AppError> {
        // File size validation (10MB limit)
        const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;
        if data.len() > MAX_FILE_SIZE {
            warn!("File too large: {} bytes (max: {} bytes)", data.len(), MAX_FILE_SIZE);
            return Err(AppError::BadRequest("File size exceeds 10MB limit".into()));
        }

        // Minimum file size validation
        if data.len() < 100 {
            warn!("File too small: {} bytes", data.len());
            return Err(AppError::BadRequest("File appears to be empty or corrupted".into()));
        }

        // Filename extension validation
        if !filename.to_lowercase().ends_with(".docx") {
            warn!("Unsupported file type: {}", filename);
            return Err(AppError::BadRequest("Only DOCX files are supported".into()));
        }

        // File signature validation
        if data.len() < 4 || &data[0..2] != b"PK" {
            warn!("Invalid DOCX file: missing ZIP signature");
            return Err(AppError::BadRequest("Invalid DOCX file format".into()));
        }

        // DOCX structure validation
        if !Self::validate_docx_structure(data) {
            warn!("Invalid DOCX structure detected for file: {}", filename);
            return Err(AppError::BadRequest("Invalid DOCX file format - corrupted or not a valid DOCX file".into()));
        }

        // MIME type validation
        if !content_type.is_empty() {
            let allowed_mime_types = [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip",
                "application/octet-stream",
            ];

            let is_valid_mime = allowed_mime_types.iter().any(|&mime| content_type.contains(mime));
            if !is_valid_mime {
                warn!("Invalid MIME type: {} for file: {}", content_type, filename);
                return Err(AppError::BadRequest("Invalid file type. Expected DOCX format.".into()));
            }
        }

        // Security validation
        if Self::contains_suspicious_patterns(data) {
            warn!("Suspicious content patterns detected in file: {}", filename);
            return Err(AppError::BadRequest("File content validation failed".into()));
        }

        Ok(())
    }

    /// Validates DOCX file structure
    fn validate_docx_structure(data: &[u8]) -> bool {
        use std::io::Cursor;

        let reader = Cursor::new(data);
        let zip_result = zip::ZipArchive::new(reader);

        match zip_result {
            Ok(mut archive) => {
                let required_files = [
                    "[Content_Types].xml",
                    "word/document.xml",
                    "_rels/.rels",
                ];

                for required_file in &required_files {
                    if archive.by_name(required_file).is_err() {
                        warn!("Missing required DOCX component: {}", required_file);
                        return false;
                    }
                }

                // Validate Word document structure
                if let Ok(mut document_file) = archive.by_name("word/document.xml") {
                    let mut content = String::new();
                    if let Ok(_) = std::io::Read::read_to_string(&mut document_file, &mut content) {
                        if !content.contains("<w:document") || !content.contains("http://schemas.openxmlformats.org/wordprocessingml/") {
                            warn!("word/document.xml does not contain valid Word document structure");
                            return false;
                        }
                    } else {
                        warn!("Could not read word/document.xml content");
                        return false;
                    }
                }

                true
            }
            Err(_) => {
                warn!("ZIP archive parsing failed");
                false
            }
        }
    }

    /// Scans for suspicious patterns in file content
    fn contains_suspicious_patterns(data: &[u8]) -> bool {
        let sample_size = std::cmp::min(data.len(), 8192);
        let content_sample = String::from_utf8_lossy(&data[..sample_size]).to_lowercase();

        let suspicious_patterns = [
            "<script", "javascript:", "vbscript:", "eval(", "document.write",
            "mz", "#!/", "auto_open", "document_open", "workbook_open",
            "shell.application", "wscript.shell", "http://", "https://",
            "ftp://", "base64,", "data:application", "<!--[if",
            "activex", "clsid:", "progid:",
        ];

        for pattern in &suspicious_patterns {
            if content_sample.contains(pattern) {
                warn!("Detected suspicious pattern in file content: {}", pattern);
                return true;
            }
        }

        // Check for excessive binary content
        let binary_threshold = sample_size / 10;
        let binary_bytes = data[..sample_size].iter()
            .filter(|&&b| b < 32 && b != b'\n' && b != b'\r' && b != b'\t')
            .count();

        if binary_bytes > binary_threshold {
            warn!("Excessive binary content detected: {} binary bytes in {} sample", binary_bytes, sample_size);
            return true;
        }

        false
    }
} 