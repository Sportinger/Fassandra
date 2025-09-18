use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

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
    active_process: Arc<Mutex<Option<u32>>>,  // Store the process ID for cancellation
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
            pdf_filename: pdf_path
                .split('/')
                .last()
                .unwrap_or("unknown.pdf")
                .to_string(),
            script_id: None,
            error: None,
        }));

        // Store session
        self.sessions
            .write()
            .await
            .insert(session_id, session_info.clone());
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
            )
            .await;

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
                    update_callback(
                        session_id,
                        SessionUpdate::Failed {
                            error: e.to_string(),
                        },
                    );
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
        update_callback(
            session_id,
            SessionUpdate::Status {
                status: SessionStatus::Processing,
                progress: 10,
            },
        );

        // Resolve execution context and paths so the CLI starts in the right place
        // 1) Decide where helper scripts live and set the working directory there
        //    Prefer /app (container runtime). Fallback to repo backend directory on host.
        let in_container = tokio::fs::metadata("/app/json_mem.sh").await.is_ok()
            && tokio::fs::metadata("/app/yjs_to_db.sh").await.is_ok();

        // Try to locate scripts on host if not in container
        let host_backend_has_scripts = tokio::fs::metadata("./yjs_to_db.sh").await.is_ok()
            && tokio::fs::metadata("./json_mem.sh").await.is_ok();
        let host_repo_backend_has_scripts =
            tokio::fs::metadata("backend/yjs_to_db.sh").await.is_ok()
                && tokio::fs::metadata("backend/json_mem.sh").await.is_ok();

        // Determine execution CWD where ./json_mem.sh and ./yjs_to_db.sh will be available
        let exec_cwd = if in_container {
            std::path::PathBuf::from("/app")
        } else if host_backend_has_scripts {
            // current directory already contains scripts
            std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
        } else if host_repo_backend_has_scripts {
            std::path::PathBuf::from("backend")
        } else {
            // Fallback to /app to keep behavior predictable; prompt will still reference ./ scripts
            std::path::PathBuf::from("/app")
        };

        // 2) Convert host path to container path only when running in the container
        let container_pdf_path = if let Some(idx) = pdf_path.find("/backend") {
            let suffix = &pdf_path[idx + "/backend".len()..];
            format!("/app{}", suffix)
        } else {
            pdf_path.clone()
        };

        // The path that will be presented to the Claude CLI and used for existence checks
        let effective_input_path = if in_container {
            container_pdf_path.clone()
        } else {
            pdf_path.clone()
        };

        // Prepare the command - inline the full instructions to maximize
        // adherence to required [PROGRESS]/[CHUNK_COMPLETE] markers.
        // Helper script usage is relative to the working directory
        let mem_helper_cmd = "./json_mem.sh";
        let import_cmd = format!("./yjs_to_db.sh /tmp/script_data.json {}", username);

        let prompt = format!(
            "{}\n\n---\nRuntime Parameters\n- Input path: {} (directory of pre-split 5-page chunk PDFs)\n- Username: {}\n\nIMPORTANT:\n- Emit progress markers exactly as specified above (lines starting with [PROGRESS] and [CHUNK_COMPLETE]).\n- Do not edit /tmp/script_data.json directly. Initialize and append via: /app/json_mem.sh init, then /app/json_mem.sh add <chunk.json> /tmp/script_data.json\n- Validate each chunk with: jq -e . <chunk.json>; keep /tmp/script_data.json valid JSON after every append.\n- The input is a directory of pre-split chunk PDFs; iterate files in numeric order and process each PDF as one chunk. Use original page numbering via offsets (A..B) for each chunk.\n- After finishing all chunks, run exactly one import using: ./yjs_to_db.sh /tmp/script_data.json {}\n- After successful import, output exactly: iam done with my job rom\n",
            PARSING_PROMPT_MD,
            effective_input_path,
            username,
            username
        );
        // Patch helper paths inside IMPORTANT block to match our working directory
        // Replace the absolute /app helper paths with ./ to ensure they resolve under exec_cwd
        // Normalize helper paths. Keep importer command exact with the JSON file arg preserved.
        let prompt = prompt.replace("/app/json_mem.sh", mem_helper_cmd);

        // Logging: keep operational details concise at info level
        tracing::info!(
            "Starting Claude Code with input path: {}",
            effective_input_path
        );
        tracing::debug!("Original (host) path: {}", pdf_path);
        tracing::debug!("Execution working directory: {}", exec_cwd.display());

        // Check if the input path exists
        if !tokio::fs::metadata(&effective_input_path).await.is_ok() {
            tracing::error!("Input path does not exist: {}", effective_input_path);
            return Err(anyhow!("Input path not found: {}", effective_input_path));
        }

        // If input is a directory of pre-split PDFs, try to compute chunk/page info
        if let Ok(meta) = tokio::fs::metadata(&effective_input_path).await {
            if meta.is_dir() {
                let mut entries = tokio::fs::read_dir(&effective_input_path)
                    .await
                    .map_err(|e| anyhow!("Failed to read input directory: {}", e))?;
                let mut pdfs: Vec<String> = Vec::new();
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Ok(ft) = entry.file_type().await {
                        if ft.is_file() {
                            let p = entry.path();
                            if let Some(ext) = p.extension() {
                                if ext == "pdf" {
                                    pdfs.push(p.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
                pdfs.sort();
                if !pdfs.is_empty() {
                    let total_chunks = pdfs.len() as u32;
                    // Get last chunk page count via pdfinfo
                    let mut total_pages: u32 = 0;
                    if let Some(last) = pdfs.last() {
                        if let Ok(out) = Command::new("pdfinfo").arg(last).output().await {
                            if out.status.success() {
                                if let Ok(txt) = String::from_utf8(out.stdout) {
                                    if let Some(line) =
                                        txt.lines().find(|l| l.starts_with("Pages:"))
                                    {
                                        if let Ok(last_pages) = line
                                            .split(':')
                                            .nth(1)
                                            .map(|s| s.trim())
                                            .unwrap_or("")
                                            .parse::<u32>()
                                        {
                                            total_pages = (total_chunks - 1) * 5 + last_pages;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Fallback if we couldn't compute pages
                    if total_pages == 0 {
                        total_pages = total_chunks * 5;
                    }

                    Self::update_progress(
                        &session_info,
                        &update_callback,
                        session_id,
                        12,
                        SessionStatus::ParsingPdf,
                    )
                    .await;
                    update_callback(
                        session_id,
                        SessionUpdate::ChunkInfo {
                            total_pages,
                            total_chunks,
                        },
                    );
                    {
                        let mut info = session_info.lock().await;
                        let line = format!(
                            "[PROGRESS] Starting chunked parsing - Total pages: {}, Chunks: {}",
                            total_pages, total_chunks
                        );
                        info.output.push(line.clone());
                        tracing::info!("[Claude] {}", line);
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
            // Try multiple known locations, then PATH lookup. Allow override via CLAUDE_BIN.
            let mut candidates: Vec<String> = Vec::new();
            if let Ok(override_bin) = std::env::var("CLAUDE_BIN") {
                if !override_bin.trim().is_empty() {
                    candidates.push(override_bin);
                }
            }
            candidates.push("/home/appuser/.npm-global/bin/claude".to_string());
            candidates.push("/usr/local/bin/claude".to_string());
            candidates.push("/usr/bin/claude".to_string());
            // Final fallback uses PATH search
            let mut claude_path = String::from("claude");
            for c in candidates {
                if tokio::fs::metadata(&c).await.is_ok() {
                    claude_path = c;
                    break;
                }
            }
            let path_env = std::env::var("PATH").unwrap_or_else(|_| "<unset>".into());
            tracing::info!("Using Claude at: {}", claude_path);
            tracing::debug!("PATH={}", path_env);
            let mut cmd = Command::new(claude_path);
            cmd.arg("--print")
                .arg("--output-format")
                .arg("stream-json") // stream incremental output as JSON lines
                .arg("--verbose") // increase verbosity (safe)
                .arg("--dangerously-skip-permissions");
            cmd
        };

        // Ensure Claude CLI sees the correct auth/config.
        // Goal: make automated session use the same login as a manual `claude` on host.
        // Strategy:
        // 1) Respect explicit overrides via env: CLAUDE_HOME, XDG_CONFIG_HOME, CLAUDE_CONFIG_DIR.
        // 2) Try common locations, including /home/appuser, /root, /app.
        // 3) Prefer XDG (~/.config/claude-code) but also support legacy ~/.claude.
        let mut configured_auth_env = false;

        // Helper to wire envs once we decide on paths (does not touch configured_auth_env)
        let mut apply_env = |home_dir: &str, xdg_cfg: &str| {
            tracing::info!(
                "Using Claude config from HOME={} XDG_CONFIG_HOME={}",
                home_dir,
                xdg_cfg
            );
            cmd.env("HOME", home_dir);
            cmd.env("XDG_CONFIG_HOME", xdg_cfg);
            let xdg_cache = format!("{}/.cache", home_dir);
            cmd.env("XDG_CACHE_HOME", &xdg_cache);
        };

        // 1) Explicit overrides
        let env_home = std::env::var("CLAUDE_HOME").ok();
        let env_xdg = std::env::var("XDG_CONFIG_HOME").ok();
        let env_cfg_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
        if let (Some(h), Some(x)) = (env_home.as_deref(), env_xdg.as_deref()) {
            let cfg_dir = std::path::Path::new(x).join("claude-code");
            let legacy_dir = std::path::Path::new(h).join(".claude");
            if cfg_dir.exists() || legacy_dir.exists() {
                apply_env(h, x);
                configured_auth_env = true;
            }
        }
        if !configured_auth_env {
            if let Some(dir) = env_cfg_dir.as_deref() {
                let p = std::path::Path::new(dir);
                // Accept either .../claude-code or a parent directory containing it
                let (home_dir, xdg_cfg) = if p.ends_with("claude-code") {
                    // XDG is parent of claude-code, HOME stays as current or /home/appuser if available
                    let parent = p.parent().unwrap_or(std::path::Path::new("/home/appuser"));
                    // Pick a reasonable HOME
                    let home_guess = env_home.as_deref().unwrap_or("/home/appuser");
                    (home_guess.to_string(), parent.to_string_lossy().to_string())
                } else {
                    // Provided path is already XDG_CONFIG_HOME
                    let home_guess = env_home.as_deref().unwrap_or("/home/appuser");
                    (home_guess.to_string(), dir.to_string())
                };
                let cfg_dir = std::path::Path::new(&xdg_cfg).join("claude-code");
                let legacy_dir = std::path::Path::new(&home_dir).join(".claude");
                if cfg_dir.exists() || legacy_dir.exists() {
                    apply_env(&home_dir, &xdg_cfg);
                    configured_auth_env = true;
                }
            }
        }

        // 2) Common locations (if no explicit env worked)
        if !configured_auth_env {
            let candidate_configs = [
                ("/home/appuser", "/home/appuser/.config"),
                ("/root", "/root/.config"),
                ("/app", "/app/.config"),
            ];
            for (home_dir, xdg_cfg) in candidate_configs {
                let cfg_dir = std::path::Path::new(xdg_cfg).join("claude-code");
                let legacy_dir = std::path::Path::new(home_dir).join(".claude");
                if cfg_dir.exists() || legacy_dir.exists() {
                    apply_env(home_dir, xdg_cfg);
                    configured_auth_env = true;
                    break;
                }
            }
        }

        if !configured_auth_env {
            tracing::warn!(
                "Claude config not found in common locations; using HOME={}. Consider setting CLAUDE_CONFIG_DIR or mounting ~/.config/claude-code.",
                std::env::var("HOME").unwrap_or_else(|_| "<unset>".into())
            );
        }
        // Do not log the full prompt at info level to avoid noisy or sensitive output
        tracing::debug!("Running with embedded parsing prompt (chunked PDF parser)");

        // Run Claude Code
        let mut child = cmd
            .current_dir(&exec_cwd)
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
            stdin.write_all(prompt.as_bytes()).await.map_err(|e| {
                tracing::error!("Failed to write prompt to stdin: {}", e);
                anyhow!("Failed to send prompt to Claude: {}", e)
            })?;
            stdin.shutdown().await.map_err(|e| {
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

        // Determine log verbosity for forwarding to frontend. Default is concise (no raw stream).
        let concise_mode = std::env::var("CLAUDE_LOG_VERBOSITY")
            .map(|v| v.to_lowercase() != "debug")
            .unwrap_or(true);

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
                        tracing::debug!("[Claude] {}", line);
                        
                        // Append to session output only if concise-safe (progress markers) or in debug verbosity
                        let is_progress_line = line.contains("[PROGRESS]") || line.contains("[CHUNK_COMPLETE]");
                        if !concise_mode || is_progress_line {
                            let mut info = session_info.lock().await;
                            info.output.push(line.clone());
                        }
                        
                        // Forward output to frontend only in debug verbosity
                        if !concise_mode {
                            let mut forwarded = false;
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                                if let Some(obj) = v.as_object() {
                                    if let Some(s) = obj.get("data").and_then(|x| x.as_str())
                                        .or_else(|| obj.get("text").and_then(|x| x.as_str()))
                                        .or_else(|| obj.get("message").and_then(|x| x.as_str())) {
                                        update_callback(session_id, SessionUpdate::Output { line: s.to_string() });
                                        forwarded = true;
                                    }
                                }
                            }
                            if !forwarded {
                                update_callback(session_id, SessionUpdate::Output { line: line.clone() });
                            }
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
                        
                        // Append stderr to session output only in debug verbosity
                        if !concise_mode {
                            let mut info = session_info.lock().await;
                            info.output.push(format!("[STDERR] {}", line));
                        }
                        
                        // Send output update (stderr) only in debug verbosity
                        if !concise_mode {
                            update_callback(session_id, SessionUpdate::Output { line: format!("[STDERR] {}", line) });
                        }
                    }
                    _ = heartbeat.tick() => {
                        // Heartbeat disabled: rely solely on real CLI output for progress
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
                        tracing::error!(
                            "Claude process exited with status: {}, found_completion: {}",
                            status,
                            found_completion
                        );
                        tracing::error!("Last 10 lines of output:");
                        for line in all_output.iter().rev().take(10) {
                            tracing::error!("  {}", line);
                        }
                        return Err(anyhow!(
                            "Claude Code process failed with exit code: {}",
                            status.code().unwrap_or(-1)
                        ));
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

    pub async fn get_session_logs(
        &self,
        session_id: Uuid,
        since_line: usize,
    ) -> Option<Vec<String>> {
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
    Status {
        status: SessionStatus,
        progress: u8,
    },
    Output {
        line: String,
    },
    PageProgress {
        current_page: u32,
        total_pages: u32,
    },
    ChunkInfo {
        total_pages: u32,
        total_chunks: u32,
    },
    ChunkProgress {
        current_chunk: u32,
        total_chunks: u32,
        pages_start: u32,
        pages_end: u32,
    },
    Complete {
        script_id: Uuid,
    },
    Failed {
        error: String,
    },
}
