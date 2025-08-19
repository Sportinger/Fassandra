//! Chunked Parsing Orchestrator
//!
//! Manages the parsing of large scripts in chunks, coordinating with Claude
//! to process scripts in 10-page increments with progress tracking.

use std::sync::Arc;
use sqlx::PgPool;
use uuid::Uuid;
use anyhow::{Result, anyhow};
use tracing::{info, error, debug, warn};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::services::yjs_script_builder_service::YjsScriptBuilderService;
use crate::services::claude_session_service::ClaudeSessionService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingSession {
    pub session_id: Uuid,
    pub script_id: Uuid,
    pub status: ParsingStatus,
    pub total_pages: i32,
    pub total_chunks: i32,
    pub current_chunk: i32,
    pub chunks_completed: i32,
    pub pages_processed: i32,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub errors: Vec<String>,
    pub username: String,
    pub pdf_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParsingStatus {
    Initializing,
    Processing,
    WaitingForChunk,
    Compacting,
    Completed,
    Failed,
}

pub struct ChunkedParsingOrchestrator {
    db_pool: Arc<PgPool>,
    sessions: Arc<RwLock<HashMap<Uuid, ParsingSession>>>,
    yjs_builder: Arc<YjsScriptBuilderService>,
    claude_service: Arc<ClaudeSessionService>,
}

impl ChunkedParsingOrchestrator {
    pub fn new(
        db_pool: Arc<PgPool>,
        claude_service: Arc<ClaudeSessionService>
    ) -> Self {
        Self {
            db_pool: db_pool.clone(),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            yjs_builder: Arc::new(YjsScriptBuilderService::new(db_pool)),
            claude_service,
        }
    }

    /// Start parsing a script in chunks
    pub async fn start_parsing(
        &self,
        pdf_path: &str,
        username: &str,
        total_pages: i32,
    ) -> Result<ParsingSession> {
        let session_id = Uuid::new_v4();
        let script_id = Uuid::new_v4();
        
        // Calculate number of chunks (10 pages per chunk)
        let total_chunks = (total_pages + 9) / 10; // Round up division
        
        let session = ParsingSession {
            session_id,
            script_id,
            status: ParsingStatus::Initializing,
            total_pages,
            total_chunks,
            current_chunk: 1,
            chunks_completed: 0,
            pages_processed: 0,
            started_at: Utc::now(),
            updated_at: Utc::now(),
            errors: vec![],
            username: username.to_string(),
            pdf_path: pdf_path.to_string(),
        };
        
        // Store session
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id, session.clone());
        }
        
        info!("Started chunked parsing session {} for script {} ({} pages, {} chunks)", 
              session_id, script_id, total_pages, total_chunks);
        
        // Start the first chunk processing
        let orchestrator = self.clone();
        let session_clone = session.clone();
        tokio::spawn(async move {
            if let Err(e) = orchestrator.process_next_chunk(session_clone).await {
                error!("Failed to start processing first chunk: {}", e);
            }
        });
        
        Ok(session)
    }

    /// Process the next chunk in the sequence
    async fn process_next_chunk(&self, mut session: ParsingSession) -> Result<()> {
        if session.current_chunk > session.total_chunks {
            // All chunks processed, mark as complete
            session.status = ParsingStatus::Completed;
            self.update_session(&session).await;
            info!("Parsing session {} completed successfully", session.session_id);
            return Ok(());
        }
        
        session.status = ParsingStatus::Processing;
        self.update_session(&session).await;
        
        let pages_start = (session.current_chunk - 1) * 10 + 1;
        let pages_end = std::cmp::min(session.current_chunk * 10, session.total_pages);
        
        info!("Processing chunk {} of {} (pages {}-{}) for session {}", 
              session.current_chunk, session.total_chunks, pages_start, pages_end, session.session_id);
        
        // Here we would normally call Claude to process the chunk
        // For now, we'll simulate the chunk processing
        
        // Update progress
        session.chunks_completed = session.current_chunk;
        session.pages_processed = pages_end;
        session.current_chunk += 1;
        session.updated_at = Utc::now();
        
        if session.current_chunk <= session.total_chunks {
            session.status = ParsingStatus::WaitingForChunk;
        } else {
            session.status = ParsingStatus::Compacting;
        }
        
        self.update_session(&session).await;
        
        // Continue with next chunk would normally be triggered by the next webhook call
        // or by a scheduled task. For now, we just complete this chunk.
        // The next chunk will be processed when claude_session_service calls us again.
        
        Ok(())
    }

    /// Process a chunk response from Claude
    pub async fn process_chunk_response(
        &self,
        session_id: Uuid,
        chunk_json: &str,
    ) -> Result<()> {
        let session = self.get_session(session_id).await
            .ok_or_else(|| anyhow!("Session not found"))?;
        
        // Process the chunk through YJS builder
        let result = self.yjs_builder
            .build_script_from_json(chunk_json, Some(session.script_id), &session.username)
            .await?;
        
        if !result.success {
            let mut session = session;
            session.errors.extend(result.errors);
            session.status = ParsingStatus::Failed;
            self.update_session(&session).await;
            return Err(anyhow!("Failed to process chunk: {}", result.message));
        }
        
        // Update session progress
        let mut session = session;
        session.chunks_completed = result.chunk_number.unwrap_or(session.chunks_completed);
        session.pages_processed = session.chunks_completed * 10;
        session.updated_at = Utc::now();
        
        // Check if more chunks needed
        if session.chunks_completed < session.total_chunks {
            session.current_chunk = session.chunks_completed + 1;
            session.status = ParsingStatus::WaitingForChunk;
            self.update_session(&session).await;
            
            // Trigger next chunk processing
            let orchestrator = self.clone();
            tokio::spawn(async move {
                if let Err(e) = orchestrator.process_next_chunk(session).await {
                    error!("Failed to process next chunk: {}", e);
                }
            });
        } else {
            // All chunks complete
            session.status = ParsingStatus::Completed;
            self.update_session(&session).await;
            info!("All chunks processed for session {}", session_id);
            
            // Trigger compaction
            self.trigger_compaction(session.script_id).await?;
        }
        
        Ok(())
    }

    /// Get the status of a parsing session
    pub async fn get_session_status(&self, session_id: Uuid) -> Option<ParsingSession> {
        self.get_session(session_id).await
    }

    /// Get all active sessions
    pub async fn get_active_sessions(&self) -> Vec<ParsingSession> {
        let sessions = self.sessions.read().await;
        sessions.values()
            .filter(|s| s.status != ParsingStatus::Completed && s.status != ParsingStatus::Failed)
            .cloned()
            .collect()
    }

    /// Clean up old sessions
    pub async fn cleanup_old_sessions(&self, hours: i64) {
        let cutoff = Utc::now() - chrono::Duration::hours(hours);
        let mut sessions = self.sessions.write().await;
        
        sessions.retain(|_, session| {
            session.updated_at > cutoff || 
            (session.status != ParsingStatus::Completed && session.status != ParsingStatus::Failed)
        });
        
        debug!("Cleaned up old parsing sessions");
    }

    async fn get_session(&self, session_id: Uuid) -> Option<ParsingSession> {
        let sessions = self.sessions.read().await;
        sessions.get(&session_id).cloned()
    }

    async fn update_session(&self, session: &ParsingSession) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.session_id, session.clone());
    }

    async fn trigger_compaction(&self, script_id: Uuid) -> Result<()> {
        // Compaction happens automatically via the compaction service
        // We just log that the script is ready for compaction
        info!("Script {} ready for compaction", script_id);
        Ok(())
    }

    /// Handle chunk completion message from Claude
    pub async fn handle_chunk_complete(&self, session_id: Uuid, message: &str) -> Result<()> {
        // Parse message like "[CHUNK_COMPLETE] Chunk 2 of 5 processed (pages 11-20)"
        if let Some(session) = self.get_session(session_id).await {
            let mut session = session;
            
            // Extract chunk number from message
            if let Some(captures) = regex::Regex::new(r"Chunk (\d+) of (\d+)")
                .unwrap()
                .captures(message) 
            {
                if let (Some(chunk_num), Some(total)) = (
                    captures.get(1).and_then(|m| m.as_str().parse::<i32>().ok()),
                    captures.get(2).and_then(|m| m.as_str().parse::<i32>().ok())
                ) {
                    session.chunks_completed = chunk_num;
                    session.total_chunks = total;
                    session.pages_processed = chunk_num * 10;
                    session.updated_at = Utc::now();
                    
                    if chunk_num < total {
                        session.current_chunk = chunk_num + 1;
                        session.status = ParsingStatus::WaitingForChunk;
                    } else {
                        session.status = ParsingStatus::Compacting;
                    }
                    
                    self.update_session(&session).await;
                }
            }
        }
        
        Ok(())
    }
}

impl Clone for ChunkedParsingOrchestrator {
    fn clone(&self) -> Self {
        Self {
            db_pool: self.db_pool.clone(),
            sessions: self.sessions.clone(),
            yjs_builder: self.yjs_builder.clone(),
            claude_service: self.claude_service.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ParsingStatusResponse {
    pub session_id: Uuid,
    pub script_id: Uuid,
    pub status: String,
    pub chunks_completed: i32,
    pub chunks_total: i32,
    pub pages_processed: i32,
    pub pages_total: i32,
    pub current_chunk: i32,
    pub errors: Vec<String>,
    pub progress_percentage: f32,
}

impl From<ParsingSession> for ParsingStatusResponse {
    fn from(session: ParsingSession) -> Self {
        let progress_percentage = if session.total_pages > 0 {
            (session.pages_processed as f32 / session.total_pages as f32) * 100.0
        } else {
            0.0
        };
        
        Self {
            session_id: session.session_id,
            script_id: session.script_id,
            status: format!("{:?}", session.status),
            chunks_completed: session.chunks_completed,
            chunks_total: session.total_chunks,
            pages_processed: session.pages_processed,
            pages_total: session.total_pages,
            current_chunk: session.current_chunk,
            errors: session.errors,
            progress_percentage,
        }
    }
}