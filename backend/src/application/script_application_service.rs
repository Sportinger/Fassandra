//! Script Application Service
//!
//! Orchestrates script creation, upload, and management workflows.
//! This service handles complex business logic that spans multiple domains.

use std::sync::Arc;
use sqlx::PgPool;
use tracing::{info, error, warn};
use uuid::Uuid;

use crate::analysis::structs::Script as ParsedScript;
use crate::analysis::parser::{extract_text_with_pages_from_docx, text_with_pages_to_string_with_page_markers};
use crate::domain::script_service::ScriptService;
use crate::error::AppError;
use crate::gemini_api::{call_gemini_for_parsing, GeminiApiError};
use crate::create_script_from_parsed;

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
        let script_id = create_script_from_parsed(&self.pool, parsed_script, user_id).await?;

        info!(script_id = %script_id, user_id = %user_id, "Successfully created script");
        Ok(script_id)
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