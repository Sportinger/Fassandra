//! PDF Script Parser Service
//!
//! Uses Claude Code to parse PDF scripts and store them in the database.
//! This service integrates with the pdf-script-parser agent to extract
//! theatrical content from PDFs.

use std::sync::Arc;
use std::path::Path;
use anyhow::Result;
use tracing::{info, error};
use sqlx::PgPool;

use crate::error::AppError;
use crate::repositories::user_repository::UserRepository;
use crate::application::script_application_service::ScriptApplicationService;
use crate::services::claude_code_parser_service::ClaudeCodeParserService;

/// Service for parsing PDF scripts and inserting them into the database
pub struct PDFScriptParserService {
    user_repository: Arc<dyn UserRepository>,
    script_service: Arc<ScriptApplicationService>,
    db_pool: Arc<PgPool>,
}

impl PDFScriptParserService {
    pub fn new(
        user_repository: Arc<dyn UserRepository>,
        script_service: Arc<ScriptApplicationService>,
        db_pool: Arc<PgPool>,
    ) -> Self {
        Self {
            user_repository,
            script_service,
            db_pool,
        }
    }

    /// Parse a PDF script for a given user (by email or username)
    pub async fn parse_pdf_for_user(
        &self,
        pdf_path: &str,
        user_identifier: &str,
        api_key: &str,
    ) -> Result<uuid::Uuid, AppError> {
        // Verify PDF exists
        if !Path::new(pdf_path).exists() {
            return Err(AppError::BadRequest(format!("PDF file not found: {}", pdf_path)));
        }

        info!("Starting PDF parsing for user: {} with file: {}", user_identifier, pdf_path);

        // Verify user exists (check both email and username)
        let user = self.user_repository.find_by_email(user_identifier).await?
            .or(self.user_repository.find_by_username(user_identifier).await?)
            .ok_or_else(|| AppError::NotFound(format!("User not found: {}", user_identifier)))?;

        info!("Found user: {} (ID: {})", user.username, user.id);

        // Create Claude Code parser service with database pool
        let parser = ClaudeCodeParserService::new(api_key.to_string(), self.db_pool.clone());

        // Use the new method that handles SQL execution and iteration
        match parser.parse_pdf_with_sql_execution(pdf_path, &user.email).await {
            Ok(script_id) => {
                info!("Successfully parsed PDF and created script with ID: {}", script_id);
                Ok(script_id)
            }
            Err(e) => {
                error!("Failed to parse PDF: {}", e);
                Err(e)
            }
        }
    }

    /// Parse a PDF script using streaming for progress updates
    pub async fn parse_pdf_with_progress<F>(
        &self,
        pdf_path: &str,
        user_identifier: &str,
        api_key: &str,
        progress_callback: F,
    ) -> Result<(), AppError>
    where
        F: Fn(String) + Send + 'static,
    {
        // Verify PDF exists
        if !Path::new(pdf_path).exists() {
            return Err(AppError::BadRequest(format!("PDF file not found: {}", pdf_path)));
        }

        info!("Starting streaming PDF parsing for user: {} with file: {}", user_identifier, pdf_path);

        // Verify user exists
        let user = self.user_repository.find_by_email(user_identifier).await?
            .or(self.user_repository.find_by_username(user_identifier).await?)
            .ok_or_else(|| AppError::NotFound(format!("User not found: {}", user_identifier)))?;

        info!("Found user: {} (ID: {})", user.username, user.id);

        // Create Claude Code parser service
        let parser = ClaudeCodeParserService::new(api_key.to_string(), self.db_pool.clone());

        // Use streaming method
        parser.parse_pdf_with_streaming(pdf_path, &user.email, progress_callback).await
    }

    /// Lists all scripts for a user by username
    pub async fn list_user_scripts_by_username(
        &self,
        username: &str,
    ) -> Result<Vec<crate::models::script::Script>, AppError> {
        // Find user by username
        let user = self.user_repository
            .find_by_username(username)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("User '{}' not found", username)))?;

        // Get user's scripts
        self.script_service.list_user_scripts(user.id).await
    }
}