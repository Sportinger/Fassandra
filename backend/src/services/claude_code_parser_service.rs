use std::path::Path;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tokio::process::Command as TokioCommand;
use crate::error::AppError;
use anyhow::anyhow;
use tracing::{debug, info, warn, error};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct ParseRequest {
    pub pdf_path: String,
    pub username: String,
    pub script_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeCodeMessage {
    #[serde(rename = "type")]
    message_type: String,
    subtype: Option<String>,
    result: Option<String>,
    is_error: Option<bool>,
    session_id: Option<String>,
    total_cost_usd: Option<f64>,
}

pub struct ClaudeCodeParserService {
    api_key: String,
    debug_mode: bool,
    db_pool: Arc<PgPool>,
}

impl ClaudeCodeParserService {
    pub fn new(api_key: String, db_pool: Arc<PgPool>) -> Self {
        // Enable debug mode based on environment variable
        let debug_mode = std::env::var("CLAUDE_CODE_DEBUG")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);
            
        Self { api_key, debug_mode, db_pool }
    }

    /// Parse PDF and let Claude Code handle SQL execution with iteration
    pub async fn parse_pdf_with_claude_control(
        &self,
        pdf_path: &str,
        username: &str,
    ) -> Result<Uuid, AppError> {
        info!("Starting Claude Code controlled PDF parsing for path: {} and user: {}", pdf_path, username);
        
        // Verify PDF exists
        if !Path::new(pdf_path).exists() {
            error!("PDF not found at path: {}", pdf_path);
            return Err(AppError::BadRequest(format!("PDF not found: {}", pdf_path)));
        }

        // Read the prompt from prompt.md at runtime
        let prompt_path = "/app/src/services/prompt.md";
        let prompt_template = tokio::fs::read_to_string(prompt_path).await
            .unwrap_or_else(|e| {
                warn!("Failed to read prompt.md from {}: {}, using fallback", prompt_path, e);
                // Fallback to a basic prompt if file not found
                String::from("You are a PDF script parser. Parse the given PDF and generate SQL to insert it into the database.")
            });
        
        // Create the specific prompt with PDF path and username
        let prompt = format!(
            "{}\n\nPDF Path: {}\nUsername: {}\n\nIMPORTANT: Follow the 'Docker Environment SQL Execution' section in the prompt.",
            prompt_template, pdf_path, username
        );

        // Build the Claude Code command
        let mut cmd = TokioCommand::new("claude");
        cmd.arg("--print")  // Non-interactive mode
            .arg("--max-turns")
            .arg("20")  // Allow more turns for iteration
            .env("ANTHROPIC_API_KEY", &self.api_key)
            .env("HOME", "/tmp") // Use /tmp as home since it's writable
            .env("CLAUDE_CODE_SETTINGS_PATH", "/tmp/.config/claude-code/settings.json") // Explicit settings path
            .stdin(std::process::Stdio::piped());

        if self.debug_mode {
            cmd.arg("--verbose");
        }

        // Spawn the process
        let mut child = cmd.spawn().map_err(|e| {
            error!("Failed to spawn Claude Code: {}", e);
            AppError::Internal(anyhow!("Failed to spawn Claude Code: {}", e))
        })?;

        // Write the prompt to stdin
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            stdin.write_all(prompt.as_bytes()).await.map_err(|e| {
                error!("Failed to write prompt to Claude Code stdin: {}", e);
                AppError::Internal(anyhow!("Failed to write prompt: {}", e))
            })?;
            stdin.shutdown().await.map_err(|e| {
                error!("Failed to close stdin: {}", e);
                AppError::Internal(anyhow!("Failed to close stdin: {}", e))
            })?;
        }

        // Wait for the process to complete
        info!("Executing Claude Code CLI with full control...");
        let output = child.wait_with_output().await.map_err(|e| {
            error!("Failed to wait for Claude Code: {}", e);
            AppError::Internal(anyhow!("Failed to wait for Claude Code: {}", e))
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        if self.debug_mode {
            debug!("Claude Code stdout:\n{}", stdout);
            if !stderr.is_empty() {
                warn!("Claude Code stderr:\n{}", stderr);
            }
        }

        if !output.status.success() {
            error!("Claude Code failed with exit code: {:?}", output.status.code());
            return Err(AppError::Internal(anyhow!(
                "Claude Code failed: {}",
                stderr
            )));
        }

        // Extract script ID from Claude's output
        // Look for "DONE: <uuid>" pattern
        let script_id = if let Some(done_pos) = stdout.find("DONE: ") {
            let uuid_start = done_pos + 6;
            let uuid_section = &stdout[uuid_start..];
            if let Some(end_pos) = uuid_section.find(|c: char| c.is_whitespace() || c == '\n') {
                let uuid_str = &uuid_section[..end_pos];
                Uuid::parse_str(uuid_str).map_err(|e| {
                    AppError::Internal(anyhow!("Failed to parse UUID from Claude output: {}", e))
                })?
            } else {
                let uuid_str = uuid_section.trim();
                Uuid::parse_str(uuid_str).map_err(|e| {
                    AppError::Internal(anyhow!("Failed to parse UUID from Claude output: {}", e))
                })?
            }
        } else {
            return Err(AppError::Internal(anyhow!(
                "Claude Code did not output 'DONE: <script_id>' - process may have failed"
            )));
        };

        info!("Claude Code successfully completed. Script ID: {}", script_id);
        Ok(script_id)
    }

    /// Get SQL output from Claude Code
    async fn get_sql_from_claude(&self, prompt: &str) -> Result<String, AppError> {
        // Build the Claude Code command
        let mut cmd = TokioCommand::new("claude");
        cmd.arg("--print")  // Use --print for non-interactive headless mode
            .arg(prompt)
            .arg("--output-format")
            .arg("json");
            
        // Add verbose flag if in debug mode
        if self.debug_mode {
            cmd.arg("--verbose");
        }
        
        cmd.arg("--max-turns")
            .arg("10")  // Allow multiple turns for complex parsing
            .env("ANTHROPIC_API_KEY", &self.api_key);

        // Execute Claude Code
        info!("Executing Claude Code CLI...");
        let output = cmd.output().await.map_err(|e| {
            error!("Failed to execute Claude Code: {}", e);
            AppError::Internal(anyhow!("Failed to execute Claude Code: {}", e))
        })?;

        // Log stdout and stderr for debugging
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        if self.debug_mode || !stderr.is_empty() {
            debug!("Claude Code stdout:\n{}", stdout);
            if !stderr.is_empty() {
                warn!("Claude Code stderr:\n{}", stderr);
            }
        }

        if !output.status.success() {
            error!("Claude Code failed with exit code: {:?}", output.status.code());
            return Err(AppError::Internal(anyhow!(
                "Claude Code failed: {}",
                stderr
            )));
        }

        // Parse the JSON response
        let message: ClaudeCodeMessage = serde_json::from_str(&stdout).map_err(|e| {
            error!("Failed to parse JSON response: {}", e);
            if self.debug_mode {
                error!("Raw response was:\n{}", stdout);
            }
            AppError::Internal(anyhow!("Failed to parse Claude Code response: {}", e))
        })?;

        // Check if there was an error
        if message.is_error.unwrap_or(false) {
            error!("Claude Code reported an error: {:?}", message.result);
            return Err(AppError::Internal(anyhow!(
                "Claude Code reported an error: {:?}",
                message.result
            )));
        }

        // Extract SQL from result
        let sql_content = message.result.ok_or_else(|| {
            AppError::Internal(anyhow!("No SQL content in Claude Code response"))
        })?;

        Ok(sql_content)
    }

    /// Execute SQL and extract script ID
    async fn execute_sql(&self, sql_content: &str) -> Result<Uuid, anyhow::Error> {
        // Start a transaction
        let mut tx = self.db_pool.begin().await?;
        
        // Execute the raw SQL using query!
        let _ = sqlx::query(&sql_content)
            .execute(&mut *tx)
            .await?;
        
        // Try to extract the script ID from the SQL content
        // Look for the UUID in the INSERT INTO scripts statement
        let script_id = if let Some(id_match) = sql_content.find("INSERT INTO scripts") {
            let remaining = &sql_content[id_match..];
            if let Some(values_pos) = remaining.find("VALUES") {
                let values_section = &remaining[values_pos..];
                if let Some(uuid_start) = values_section.find('\'') {
                    let uuid_section = &values_section[uuid_start + 1..];
                    if let Some(uuid_end) = uuid_section.find('\'') {
                        let uuid_str = &uuid_section[..uuid_end];
                        Uuid::parse_str(uuid_str)?
                    } else {
                        return Err(anyhow!("Could not find UUID end quote"));
                    }
                } else {
                    return Err(anyhow!("Could not find UUID start quote"));
                }
            } else {
                return Err(anyhow!("Could not find VALUES clause"));
            }
        } else {
            return Err(anyhow!("Could not find INSERT INTO scripts statement"));
        };
        
        // Commit the transaction
        tx.commit().await?;
        
        info!("Successfully inserted script with ID: {}", script_id);
        Ok(script_id)
    }

    // Keep the original methods for backward compatibility
    pub async fn parse_pdf_script(
        &self,
        pdf_path: &str,
        username: &str,
    ) -> Result<String, AppError> {
        // This now calls the new method and returns the script ID as string
        let script_id = self.parse_pdf_with_claude_control(pdf_path, username).await?;
        Ok(script_id.to_string())
    }
    
    // Alias for backward compatibility
    pub async fn parse_pdf_with_sql_execution(
        &self,
        pdf_path: &str,
        username: &str,
    ) -> Result<Uuid, AppError> {
        self.parse_pdf_with_claude_control(pdf_path, username).await
    }

    pub async fn parse_pdf_with_streaming(
        &self,
        pdf_path: &str,
        username: &str,
        progress_callback: impl Fn(String),
    ) -> Result<(), AppError> {
        use tokio::io::{AsyncBufReadExt, BufReader};
        
        info!("Starting Claude Code streaming PDF parsing for path: {} and user: {}", pdf_path, username);
        
        let prompt = format!(
            r#"Please use the pdf-script-parser agent to parse the following PDF script:

PDF Path: {}
Username: {}

Execute the full parsing workflow using the pdf-script-parser agent."#,
            pdf_path, username
        );

        if self.debug_mode {
            debug!("Claude Code streaming prompt:\n{}", prompt);
        }

        let mut cmd = TokioCommand::new("claude");
        cmd.arg("-p")
            .arg(&prompt)
            .arg("--output-format")
            .arg("stream-json");
            
        // Add verbose flag if in debug mode
        if self.debug_mode {
            cmd.arg("--verbose");
        }
            
        cmd.arg("--max-turns")
            .arg("10")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())  // Capture stderr for debugging
            .env("ANTHROPIC_API_KEY", &self.api_key);

        info!("Spawning Claude Code process...");
        let mut child = cmd.spawn().map_err(|e| {
            error!("Failed to spawn Claude Code: {}", e);
            AppError::Internal(anyhow!("Failed to spawn Claude Code: {}", e))
        })?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take();
        
        // Spawn a task to read stderr if available
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    warn!("Claude Code stderr: {}", line);
                }
            });
        }
        
        let mut reader = BufReader::new(stdout).lines();

        // Process streaming output
        while let Some(line) = reader.next_line().await.map_err(|e| {
            error!("Failed to read stream: {}", e);
            AppError::Internal(anyhow!("Failed to read stream: {}", e))
        })? {
            if self.debug_mode {
                debug!("Claude Code stream line: {}", line);
            }
            
            // Send progress updates
            progress_callback(line.clone());
            
            // Parse each JSON message
            if let Ok(msg) = serde_json::from_str::<ClaudeCodeMessage>(&line) {
                if self.debug_mode {
                    debug!("Parsed streaming message: {:?}", msg);
                }
                
                if msg.message_type == "result" && msg.is_error.unwrap_or(false) {
                    error!("Claude Code streaming error: {:?}", msg.result);
                    return Err(AppError::Internal(anyhow!(
                        "Claude Code error: {:?}",
                        msg.result
                    )));
                }
            }
        }

        // Wait for process to complete
        info!("Waiting for Claude Code process to complete...");
        let status = child.wait().await.map_err(|e| {
            error!("Failed to wait for Claude Code: {}", e);
            AppError::Internal(anyhow!("Failed to wait for Claude Code: {}", e))
        })?;

        if !status.success() {
            error!("Claude Code process failed with exit code: {:?}", status.code());
            return Err(AppError::Internal(anyhow!("Claude Code process failed")));
        }

        info!("Claude Code streaming parsing completed successfully");
        Ok(())
    }
} 