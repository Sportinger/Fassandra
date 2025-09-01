use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use anyhow::{Result, anyhow};
use tokio::time::{timeout, Duration};
use std::time::Instant;

// Embed the detailed parsing prompt so the Claude CLI reliably emits
// the expected progress markers that our parser understands.
// This avoids relying on the model to read a file path string.
const PARSING_PROMPT_MD: &str = include_str!("prompt.md");
#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub id: Uuid,
    pub status: SessionStatus,
    pub progress: u8,
    pub output: Vec<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub username: String,
    pub pdf_filename: String,
    pub script_id: Option<Uuid>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Starting,
    Processing,
    ParsingPdf,
    CreatingJson,
    InsertingData,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug)]
pub struct ClaudeSessionService {
    sessions: Arc<RwLock<HashMap<Uuid, Arc<Mutex<SessionInfo>>>>>,
    active_session: Arc<Mutex<Option<Uuid>>>, // Only one active session allowed
    active_process: Arc<Mutex<Option<u32>>>, // Store the process ID for cancellation
}

impl ClaudeSessionService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            active_session: Arc::new(Mutex::new(None)),
            active_process: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start_session(
        &self,
        pdf_path: String,
        username: String,
        update_callback: impl Fn(Uuid, SessionUpdate) + Send + Sync + 'static,
    ) -> Result<Uuid> {
        // Check if there's already an active session
        let mut active = self.active_session.lock().await;
        if active.is_some() {
            return Err(anyhow!("Another Claude Code session is already running"));
        }

        let session_id = Uuid::new_v4();
        let session_info = Arc::new(Mutex::new(SessionInfo {
            id: session_id,
            status: SessionStatus::Starting,
            progress: 0,
            output: Vec::new(),
            started_at: Utc::now(),
            completed_at: None,
            username: username.clone(),
            pdf_filename: pdf_path.split('/').last().unwrap_or("unknown.pdf").to_string(),
            script_id: None,
            error: None,
        }));

        // Store session
        self.sessions.write().await.insert(session_id, session_info.clone());
        *active = Some(session_id);

        // Spawn task to run Claude Code
        let active_session = self.active_session.clone();
        let active_process = self.active_process.clone();
        let update_callback = Arc::new(update_callback);
        
        tokio::spawn(async move {
            let result = Self::run_claude_code(
                session_id,
                session_info.clone(),
                pdf_path,
                username,
                update_callback.clone(),
                active_process.clone(),
            ).await;

            // Update final status
            let mut info = session_info.lock().await;
            match result {
                Ok(script_id) => {
                    info.status = SessionStatus::Complete;
                    info.progress = 100;
                    info.script_id = Some(script_id);
                    info.completed_at = Some(Utc::now());
                    update_callback(session_id, SessionUpdate::Complete { script_id });
                }
                Err(e) => {
                    info.status = SessionStatus::Failed;
                    info.error = Some(e.to_string());
                    info.completed_at = Some(Utc::now());
                    update_callback(session_id, SessionUpdate::Failed { 
                        error: e.to_string() 
                    });
                }
            }

            // Clear active session and process
            let mut active = active_session.lock().await;
            *active = None;
            let mut process = active_process.lock().await;
            *process = None;
        });

        Ok(session_id)
    }

    async fn run_claude_code(
        session_id: Uuid,
        session_info: Arc<Mutex<SessionInfo>>,
        pdf_path: String,
        username: String,
        update_callback: Arc<dyn Fn(Uuid, SessionUpdate) + Send + Sync>,
        active_process: Arc<Mutex<Option<u32>>>,
    ) -> Result<Uuid> {
        const MEMORY_FILE: &str = "/tmp/script_data.json";
        // Update status to processing
        {
            let mut info = session_info.lock().await;
            info.status = SessionStatus::Processing;
            info.progress = 10;
        }
        update_callback(session_id, SessionUpdate::Status { 
            status: SessionStatus::Processing,
            progress: 10,
        });

        // Convert host path to container path
        let container_pdf_path = pdf_path.replace(
            "/home/admins/projects/pessoa/backend",
            "/app"
        );

        // Prepare the command - inline the full instructions to maximize
        // adherence to required [PROGRESS]/[CHUNK_COMPLETE] markers.
        let prompt = format!(
            "{}\n\n---\nRuntime Parameters\n- PDF path: {}\n- Username: {}\n\nIMPORTANT:\n- Emit progress markers exactly as specified above (lines starting with [PROGRESS] and [CHUNK_COMPLETE]).\n- After finishing all chunks, run exactly one import using: ./yjs_to_db.sh /tmp/script_data.json {}\n- After successful import, output exactly: iam done with my job rom\n",
            PARSING_PROMPT_MD,
            container_pdf_path,
            username,
            username
        );

        // Log the paths for debugging
        tracing::info!("Starting Claude Code with PDF path: {}", container_pdf_path);
        tracing::info!("Original PDF path: {}", pdf_path);
        
        // Check if the PDF file exists
        if !tokio::fs::metadata(&container_pdf_path).await.is_ok() {
            tracing::error!("PDF file does not exist at: {}", container_pdf_path);
            return Err(anyhow!("PDF file not found at: {}", container_pdf_path));
        }

        // Try to pre-read page count with pdfinfo to provide immediate chunk info
        if let Ok(output) = Command::new("pdfinfo").arg(&container_pdf_path).output().await {
            if output.status.success() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    if let Some(line) = text.lines().find(|l| l.starts_with("Pages:")) {
                        let pages_str = line.split(':').nth(1).map(|s| s.trim()).unwrap_or("");
                        if let Ok(total_pages) = pages_str.parse::<u32>() {
                            let total_chunks = ((total_pages + 4) / 5).max(1);
                            // Set early status and emit chunk info
                            Self::update_progress(&session_info, &update_callback, session_id, 12, SessionStatus::ParsingPdf).await;
                            update_callback(session_id, SessionUpdate::ChunkInfo { total_pages, total_chunks });
                            // Also append a Claude-style progress line so WebSocket log stream picks it up
                            {
                                let mut info = session_info.lock().await;
                                let line = format!(
                                    "[PROGRESS] Starting chunked parsing - Total pages: {}, Chunks: {}",
                                    total_pages, total_chunks
                                );
                                info.output.push(line.clone());
                                // Also log so operators can grep backend logs
                                tracing::info!("[Claude] {}", line);
                            }
                        }
                    }
                }
            }
        }
        
        // Use the executor script if it exists, otherwise try direct execution
        let executor_path = "/app/claude-executor.sh";
        let use_executor = tokio::fs::metadata(executor_path).await.is_ok();
        
        let mut cmd = if use_executor {
            tracing::info!("Using Claude executor script");
            Command::new(executor_path)
        } else {
            // Fall back to direct execution
            tracing::info!("Executor script not found, using direct Claude execution");
            // Use full path to claude binary to avoid PATH issues
            let claude_path = if tokio::fs::metadata("/home/appuser/.npm-global/bin/claude").await.is_ok() {
                "/home/appuser/.npm-global/bin/claude"
            } else {
                "claude" // Fallback to PATH lookup
            };
            tracing::info!("Using Claude at: {}", claude_path);
            let mut cmd = Command::new(claude_path);
            cmd.arg("--print")
                .arg("--output-format").arg("stream-json") // stream incremental output as JSON lines
                .arg("--verbose") // increase verbosity (safe)
                .arg("--dangerously-skip-permissions");
            cmd
        };
        
        tracing::info!("Running with prompt: {}", prompt);
        
        // Run Claude Code
        let mut child = cmd
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                tracing::error!("Failed to spawn Claude process: {}", e);
                anyhow!("Failed to start Claude Code: {}", e)
            })?;
        
        // Store the process ID
        if let Some(pid) = child.id() {
            let mut process = active_process.lock().await;
            *process = Some(pid);
        }

        // Send the prompt
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            tracing::info!("Sending prompt to Claude stdin");
            stdin.write_all(prompt.as_bytes()).await
                .map_err(|e| {
                    tracing::error!("Failed to write prompt to stdin: {}", e);
                    anyhow!("Failed to send prompt to Claude: {}", e)
                })?;
            stdin.shutdown().await
                .map_err(|e| {
                    tracing::error!("Failed to close stdin: {}", e);
                    anyhow!("Failed to close Claude stdin: {}", e)
                })?;
            tracing::info!("Prompt sent successfully");
        } else {
            tracing::error!("Failed to get stdin handle");
            return Err(anyhow!("Failed to get Claude stdin"));
        }

        // Read output
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| anyhow!("No stderr"))?;
        
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();
        let mut heartbeat = tokio::time::interval(Duration::from_secs(3));
        let mut last_activity = Instant::now();

        let mut all_output = Vec::new();
        let mut found_completion = false;
        let mut script_id = None;

        // NOTE: chunk memory file monitor intentionally disabled per request — rely on CLI streaming

        // Set a timeout of 10 minutes
        let timeout_duration = Duration::from_secs(600);
        
        let process_result = timeout(timeout_duration, async {
            loop {
                tokio::select! {
                    Ok(Some(line)) = stdout_reader.next_line() => {
                        last_activity = Instant::now();
                        all_output.push(line.clone());
                        
                        // Log Claude output for debugging
                        tracing::info!("[Claude] {}", line);
                        
                        // Update session output
                        {
                            let mut info = session_info.lock().await;
                            info.output.push(line.clone());
                        }
                        
                        // Try to parse stream-json and extract human text, but always forward raw line
                        let mut forwarded = false;
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                            if let Some(obj) = v.as_object() {
                                // Prefer "data" / "text" / "message" fields if present
                                if let Some(s) = obj.get("data").and_then(|x| x.as_str())
                                    .or_else(|| obj.get("text").and_then(|x| x.as_str()))
                                    .or_else(|| obj.get("message").and_then(|x| x.as_str())) {
                                    update_callback(session_id, SessionUpdate::Output { line: s.to_string() });
                                    forwarded = true;
                                }
                            }
                        }
                        if !forwarded {
                            // Fallback: forward entire line
                            update_callback(session_id, SessionUpdate::Output { line: line.clone() });
                        }
                        
                        // Check for progress indicators
                        if line.contains("[PROGRESS]") {
                            // Check for chunked parsing mode
                            if line.contains("Starting chunked parsing") {
                                // "[PROGRESS] Starting chunked parsing - Total pages: Y, Chunks: Z"
                                if let Some((total_pages, total_chunks)) = Self::extract_chunked_info(&line) {
                                    tracing::info!("Starting chunked parsing: {} pages, {} chunks", total_pages, total_chunks);
                                    Self::update_progress(&session_info, &update_callback, session_id, 5, SessionStatus::ParsingPdf).await;
                                    
                                    // Send chunk info update
                                    update_callback(session_id, SessionUpdate::ChunkInfo { 
                                        total_pages,
                                        total_chunks 
                                    });
                                }
                            } else if line.contains("Page") && line.contains("processed") {
                                // Parse page progress: "[PROGRESS] Page X of Y processed"
                                if let Some(progress_info) = Self::parse_page_progress(&line) {
                                    let (current_page, total_pages) = progress_info;
                                    let progress_percent = ((current_page as f32 / total_pages as f32) * 80.0) as u8;
                                    // Use 80% for parsing completion, leaving 20% for JSON creation and DB insertion
                                    Self::update_progress(&session_info, &update_callback, session_id, 
                                        progress_percent.min(80), SessionStatus::ParsingPdf).await;
                                    
                                    // Send detailed progress update
                                    update_callback(session_id, SessionUpdate::PageProgress { 
                                        current_page, 
                                        total_pages 
                                    });
                                }
                            } else if line.contains("Starting PDF parsing") {
                                // Extract total pages from: "[PROGRESS] Starting PDF parsing - Total pages: Y"
                                if let Some(total) = Self::extract_total_pages(&line) {
                                    tracing::info!("PDF has {} total pages", total);
                                    Self::update_progress(&session_info, &update_callback, session_id, 10, SessionStatus::ParsingPdf).await;
                                }
                            }
                        } else if line.contains("[CHUNK_COMPLETE]") {
                            // Handle chunk completion: "[CHUNK_COMPLETE] Chunk X of Z processed (pages A-B)"
                            if let Some((chunk_num, total_chunks, pages_start, pages_end)) = Self::parse_chunk_complete(&line) {
                                let chunk_progress = (chunk_num as f32 / total_chunks as f32 * 80.0) as u8;
                                Self::update_progress(&session_info, &update_callback, session_id, 
                                    chunk_progress, SessionStatus::ParsingPdf).await;
                                
                                // Send chunk progress update
                                update_callback(session_id, SessionUpdate::ChunkProgress { 
                                    current_chunk: chunk_num,
                                    total_chunks,
                                    pages_start,
                                    pages_end 
                                });
                            }
                        } else if line.contains("Reading PDF file") {
                            Self::update_progress(&session_info, &update_callback, session_id, 15, SessionStatus::ParsingPdf).await;
                        } else if line.contains("Extracting text") || line.contains("Parsing script structure") {
                            Self::update_progress(&session_info, &update_callback, session_id, 20, SessionStatus::ParsingPdf).await;
                        } else if line.contains("Creating JSON") {
                            Self::update_progress(&session_info, &update_callback, session_id, 85, SessionStatus::CreatingJson).await;
                        } else if line.contains("json_to_db") || line.contains("Pushing JSON to database") || line.contains("Pushing YJS JSON to database") {
                            Self::update_progress(&session_info, &update_callback, session_id, 90, SessionStatus::InsertingData).await;
                        } else if line.contains("Success: Data inserted into database") || line.contains("Success: Script inserted as YJS document") {
                            // Try to extract script ID from previous lines
                            for prev_line in all_output.iter().rev().take(10) {
                                if let Some(id) = Self::extract_script_id(prev_line) {
                                    script_id = Some(id);
                                    break;
                                }
                            }
                        } else if line.starts_with("Script ID:") || line.starts_with("Script Id:") {
                            if let Some(id) = Self::extract_script_id(&line) { script_id = Some(id); }
                        } else if line.starts_with("Chunk processed") {
                            // Fallback progress based on importer output, e.g.:
                            // "Chunk processed (X of Y)" — map to 85-95% range so the UI keeps moving
                            // Try to parse numbers between parentheses
                            if let Some(start) = line.find('(') {
                                if let Some(end) = line.find(')') {
                                    let nums = &line[start+1..end];
                                    let parts: Vec<&str> = nums.split(" of ").collect();
                                    if parts.len() == 2 {
                                        if let (Ok(cur), Ok(total)) = (parts[0].trim().parse::<u32>(), parts[1].trim().parse::<u32>()) {
                                            // Map chunk progress into 85-95% band
                                            let pct = 85u8.saturating_add(((cur as f32 / total as f32) * 10.0).round() as u8).min(95);
                                            Self::update_progress(&session_info, &update_callback, session_id, pct, SessionStatus::CreatingJson).await;
                                            // Also send a chunk_progress-style update to frontend expectations
                                            update_callback(session_id, SessionUpdate::ChunkProgress { 
                                                current_chunk: cur,
                                                total_chunks: total,
                                                pages_start: 0,
                                                pages_end: 0,
                                            });
                                        }
                                    }
                                }
                            }
                        } else if line.contains("iam done with my job rom") {
                            found_completion = true;
                            break;
                        }
                    }
                    Ok(Some(line)) = stderr_reader.next_line() => {
                        last_activity = Instant::now();
                        all_output.push(format!("[STDERR] {}", line));
                        
                        // Update session output
                        {
                            let mut info = session_info.lock().await;
                            info.output.push(format!("[STDERR] {}", line));
                        }
                        
                        // Send output update (stderr)
                        update_callback(session_id, SessionUpdate::Output { line: format!("[STDERR] {}", line) });
                    }
                    _ = heartbeat.tick() => {
                        // Heartbeat progress: if no activity for a while, gently advance progress up to 80%
                        if last_activity.elapsed() > Duration::from_secs(5) {
                            let current = { session_info.lock().await.progress };
                            if current < 80 {
                                let next = (current + 1).min(80);
                                Self::update_progress(&session_info, &update_callback, session_id, next, SessionStatus::ParsingPdf).await;
                            }
                        }
                    }
                    else => break,
                }
            }

            // Wait for process to complete
            child.wait().await
        }).await;

        match process_result {
            Ok(Ok(status)) => {
                // Check if the process was cancelled (killed)
                if !status.success() {
                    // Check if session was cancelled
                    let info = session_info.lock().await;
                    if info.status == SessionStatus::Cancelled {
                        return Err(anyhow!("Session was cancelled by user"));
                    }
                    drop(info);
                    
                    if !found_completion {
                        tracing::error!("Claude process exited with status: {}, found_completion: {}", status, found_completion);
                        tracing::error!("Last 10 lines of output:");
                        for line in all_output.iter().rev().take(10) {
                            tracing::error!("  {}", line);
                        }
                        return Err(anyhow!("Claude Code process failed with exit code: {}", status.code().unwrap_or(-1)));
                    }
                }
            }
            Ok(Err(e)) => return Err(anyhow!("Process error: {}", e)),
            Err(_) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                return Err(anyhow!("Claude Code session timed out after 10 minutes"));
            }
        }

        // Generate a script ID if we couldn't extract one
        let final_script_id = script_id.unwrap_or_else(Uuid::new_v4);
        
        Ok(final_script_id)
    }

    async fn update_progress(
        session_info: &Arc<Mutex<SessionInfo>>,
        update_callback: &Arc<dyn Fn(Uuid, SessionUpdate) + Send + Sync>,
        session_id: Uuid,
        progress: u8,
        status: SessionStatus,
    ) {
        let mut info = session_info.lock().await;
        info.status = status.clone();
        info.progress = progress;
        drop(info);
        
        update_callback(session_id, SessionUpdate::Status { status, progress });
    }

    fn extract_chunked_info(line: &str) -> Option<(u32, u32)> {
        // Parse "[PROGRESS] Starting chunked parsing - Total pages: Y, Chunks: Z"
        let total_pages = if let Some(start) = line.find("Total pages: ") {
            let remaining = &line[start + 13..];
            remaining.split(',').next()?.trim().parse::<u32>().ok()?
        } else {
            return None;
        };
        
        let total_chunks = if let Some(start) = line.find("Chunks: ") {
            let remaining = &line[start + 8..];
            remaining.split_whitespace().next()?.parse::<u32>().ok()?
        } else {
            return None;
        };
        
        Some((total_pages, total_chunks))
    }
    
    fn parse_chunk_complete(line: &str) -> Option<(u32, u32, u32, u32)> {
        // Parse "[CHUNK_COMPLETE] Chunk X of Z processed (pages A-B)"
        let chunk_info = if let Some(start) = line.find("Chunk ") {
            let remaining = &line[start + 6..];
            let parts: Vec<&str> = remaining.split(" of ").collect();
            if parts.len() < 2 {
                return None;
            }
            let current = parts[0].parse::<u32>().ok()?;
            let total_str = parts[1].split(" processed").next()?;
            let total = total_str.parse::<u32>().ok()?;
            (current, total)
        } else {
            return None;
        };
        
        let pages_info = if let Some(start) = line.find("(pages ") {
            let remaining = &line[start + 7..];
            let end_idx = remaining.find(')')?;
            let page_range = &remaining[..end_idx];
            let parts: Vec<&str> = page_range.split('-').collect();
            if parts.len() == 2 {
                let start_page = parts[0].parse::<u32>().ok()?;
                let end_page = parts[1].parse::<u32>().ok()?;
                (start_page, end_page)
            } else {
                return None;
            }
        } else {
            return None;
        };
        
        Some((chunk_info.0, chunk_info.1, pages_info.0, pages_info.1))
    }
    
    fn extract_script_id(line: &str) -> Option<Uuid> {
        // Try to extract UUID from output lines
        if let Some(start) = line.find("script_id:") {
            let id_str = &line[start + 10..].trim();
            if let Ok(id) = Uuid::parse_str(id_str) {
                return Some(id);
            }
        }
        
        // Also try to find raw UUIDs in the line
        let words: Vec<&str> = line.split_whitespace().collect();
        for word in words {
            if let Ok(id) = Uuid::parse_str(word) {
                return Some(id);
            }
        }

        None
    }
    
    fn parse_page_progress(line: &str) -> Option<(u32, u32)> {
        // Parse "[PROGRESS] Page X of Y processed"
        if let Some(start) = line.find("Page ") {
            let remaining = &line[start + 5..];
            let parts: Vec<&str> = remaining.split(" of ").collect();
            if parts.len() >= 2 {
                if let Ok(current) = parts[0].parse::<u32>() {
                    // Extract just the number from "Y processed" or similar
                    let total_str = parts[1].split_whitespace().next()?;
                    if let Ok(total) = total_str.parse::<u32>() {
                        return Some((current, total));
                    }
                }
            }
        }
        None
    }
    
    fn extract_total_pages(line: &str) -> Option<u32> {
        // Extract total from "[PROGRESS] Starting PDF parsing - Total pages: Y"
        if let Some(start) = line.find("Total pages: ") {
            let remaining = &line[start + 13..];
            let total_str = remaining.split_whitespace().next()?;
            if let Ok(total) = total_str.parse::<u32>() {
                return Some(total);
            }
        }
        None
    }

    pub async fn get_session(&self, session_id: Uuid) -> Option<SessionInfo> {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(&session_id) {
            Some(session.lock().await.clone())
        } else {
            None
        }
    }

    pub async fn get_session_logs(&self, session_id: Uuid, since_line: usize) -> Option<Vec<String>> {
        let sessions = self.sessions.read().await;
        if let Some(session) = sessions.get(&session_id) {
            let info = session.lock().await;
            Some(info.output.iter().skip(since_line).cloned().collect())
        } else {
            None
        }
    }

    pub async fn cancel_session(&self, session_id: Uuid) -> Result<()> {
        let mut active = self.active_session.lock().await;
        if *active == Some(session_id) {
            // Get and kill the process
            let mut active_proc = self.active_process.lock().await;
            if let Some(pid) = active_proc.take() {
                // Kill the docker exec process
                match tokio::process::Command::new("kill")
                    .arg(pid.to_string())
                    .status()
                    .await
                {
                    Ok(status) => {
                        if !status.success() {
                            tracing::warn!("Failed to kill process {}: {}", pid, status);
                        } else {
                            tracing::info!("Successfully killed Claude Code process {}", pid);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Error killing process {}: {}", pid, e);
                    }
                }
                
                // Also try to kill any claude processes
                let _ = tokio::process::Command::new("pkill")
                    .args(&["-f", "claude"])
                    .status()
                    .await;
            }
            
            *active = None;
            *active_proc = None;
            
            // Update session status
            let sessions = self.sessions.read().await;
            if let Some(session) = sessions.get(&session_id) {
                let mut info = session.lock().await;
                info.status = SessionStatus::Cancelled;
                info.completed_at = Some(Utc::now());
                info.error = Some("Session cancelled by user".to_string());
            }
            
            Ok(())
        } else {
            Err(anyhow!("Session not found or not active"))
        }
    }

    pub async fn cleanup_old_sessions(&self, max_age_hours: i64) {
        let now = Utc::now();
        let mut sessions = self.sessions.write().await;
        
        sessions.retain(|_, session| {
            if let Ok(info) = session.try_lock() {
                let age = now.signed_duration_since(info.started_at);
                age.num_hours() < max_age_hours
            } else {
                true // Keep if we can't lock
            }
        });
    }
}

#[derive(Debug, Clone)]
pub enum SessionUpdate {
    Status { status: SessionStatus, progress: u8 },
    Output { line: String },
    PageProgress { current_page: u32, total_pages: u32 },
    ChunkInfo { total_pages: u32, total_chunks: u32 },
    ChunkProgress { current_chunk: u32, total_chunks: u32, pages_start: u32, pages_end: u32 },
    Complete { script_id: Uuid },
    Failed { error: String },
}
