use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use anyhow::{Result, anyhow};
use tokio::time::{timeout, Duration};
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

        // Prepare the command
        let prompt = format!(
            "Parse the PDF at {} using the instructions in /app/src/services/prompt.md\n\
             The username is: {}\n\
             When complete, the json_to_db.sh script should have successfully inserted the data.",
            container_pdf_path,
            username
        );

        // Log the paths for debugging
        tracing::info!("Starting Claude Code with PDF path: {}", container_pdf_path);
        tracing::info!("Original PDF path: {}", pdf_path);
        
        // Run Claude Code directly (we're already inside the container)
        let mut child = Command::new("/home/appuser/.npm-global/bin/claude")
            .arg("--print")
            .arg("--dangerously-skip-permissions")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;
        
        // Store the process ID
        if let Some(pid) = child.id() {
            let mut process = active_process.lock().await;
            *process = Some(pid);
        }

        // Send the prompt
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            stdin.write_all(prompt.as_bytes()).await?;
            stdin.shutdown().await?;
        }

        // Read output
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| anyhow!("No stderr"))?;
        
        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let mut all_output = Vec::new();
        let mut found_completion = false;
        let mut script_id = None;

        // Set a timeout of 10 minutes
        let timeout_duration = Duration::from_secs(600);
        
        let process_result = timeout(timeout_duration, async {
            loop {
                tokio::select! {
                    Ok(Some(line)) = stdout_reader.next_line() => {
                        all_output.push(line.clone());
                        
                        // Update session output
                        {
                            let mut info = session_info.lock().await;
                            info.output.push(line.clone());
                        }
                        
                        // Send output update
                        update_callback(session_id, SessionUpdate::Output { 
                            line: line.clone() 
                        });
                        
                        // Check for progress indicators
                        if line.contains("Reading PDF file") {
                            Self::update_progress(&session_info, &update_callback, session_id, 20, SessionStatus::ParsingPdf).await;
                        } else if line.contains("Extracting text") || line.contains("Parsing script structure") {
                            Self::update_progress(&session_info, &update_callback, session_id, 40, SessionStatus::ParsingPdf).await;
                        } else if line.contains("Creating JSON") {
                            Self::update_progress(&session_info, &update_callback, session_id, 60, SessionStatus::CreatingJson).await;
                        } else if line.contains("json_to_db") || line.contains("Pushing JSON to database") {
                            Self::update_progress(&session_info, &update_callback, session_id, 80, SessionStatus::InsertingData).await;
                        } else if line.contains("Success: Data inserted into database") {
                            // Try to extract script ID from previous lines
                            for prev_line in all_output.iter().rev().take(10) {
                                if let Some(id) = Self::extract_script_id(prev_line) {
                                    script_id = Some(id);
                                    break;
                                }
                            }
                        } else if line.contains("iam done with my job rom") {
                            found_completion = true;
                            break;
                        }
                    }
                    Ok(Some(line)) = stderr_reader.next_line() => {
                        all_output.push(format!("[STDERR] {}", line));
                        
                        // Update session output
                        {
                            let mut info = session_info.lock().await;
                            info.output.push(format!("[STDERR] {}", line));
                        }
                        
                        // Send output update
                        update_callback(session_id, SessionUpdate::Output { 
                            line: format!("[STDERR] {}", line) 
                        });
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
                        return Err(anyhow!("Claude Code process failed or didn't complete properly"));
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
    Complete { script_id: Uuid },
    Failed { error: String },
}