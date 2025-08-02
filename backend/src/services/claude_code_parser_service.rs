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

    /// Parse PDF and execute SQL with iteration on errors
    pub async fn parse_pdf_with_sql_execution(
        &self,
        pdf_path: &str,
        username: &str,
    ) -> Result<Uuid, AppError> {
        info!("Starting Claude Code PDF parsing with SQL execution for path: {} and user: {}", pdf_path, username);
        
        // Verify PDF exists
        if !Path::new(pdf_path).exists() {
            error!("PDF not found at path: {}", pdf_path);
            return Err(AppError::BadRequest(format!("PDF not found: {}", pdf_path)));
        }

        let mut iteration = 0;
        let max_iterations = 5;
        let mut last_error = String::new();
        
        while iteration < max_iterations {
            iteration += 1;
            info!("Iteration {} of {}", iteration, max_iterations);
            
            // Create the prompt with error feedback if this is a retry
            let prompt = if iteration == 1 {
                format!(
                    r#"Please parse the PDF script and generate SQL to insert it into the database.

PDF Path: {}
Username: {}

IMPORTANT: Your output MUST be valid PostgreSQL SQL statements that:
1. Start with BEGIN;
2. Insert into the 'scripts' table first (with title, created_by user ID, etc)
3. Insert all blocks into the 'blocks' table with proper ordering
4. End with COMMIT;
5. Use the exact database schema from prompt.md
6. Look up the user ID by email/username before generating SQL
7. Generate deterministic UUIDs using gen_random_uuid()

Output ONLY the SQL statements, no explanations or markdown code blocks."#,
                    pdf_path, username
                )
            } else {
                format!(
                    r#"The previous SQL execution failed with this error:

{}

Please fix the SQL and try again. Remember:
- Check user exists first by email/username
- Use proper UUID format
- Escape single quotes in strings
- Follow the exact schema from prompt.md

PDF Path: {}
Username: {}

Output ONLY the corrected SQL statements."#,
                    last_error, pdf_path, username
                )
            };

            if self.debug_mode {
                debug!("Claude Code prompt (iteration {}):\n{}", iteration, prompt);
            }

            // Call Claude Code
            match self.get_sql_from_claude(&prompt).await {
                Ok(sql_content) => {
                    if self.debug_mode {
                        debug!("Received SQL from Claude Code:\n{}", sql_content);
                    }
                    
                    // Try to execute the SQL
                    match self.execute_sql(&sql_content).await {
                        Ok(script_id) => {
                            info!("Successfully executed SQL and created script with ID: {}", script_id);
                            return Ok(script_id);
                        }
                        Err(e) => {
                            warn!("SQL execution failed on iteration {}: {}", iteration, e);
                            last_error = format!("SQL Error: {}", e);
                            
                            if iteration == max_iterations {
                                error!("Max iterations reached. Giving up.");
                                return Err(AppError::Internal(anyhow!(
                                    "Failed to generate valid SQL after {} attempts. Last error: {}", 
                                    max_iterations, last_error
                                )));
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to get SQL from Claude Code: {}", e);
                    return Err(e);
                }
            }
        }
        
        Err(AppError::Internal(anyhow!("Unexpected error in iteration loop")))
    }

    /// Get SQL output from Claude Code
    async fn get_sql_from_claude(&self, prompt: &str) -> Result<String, AppError> {
        // Build the Claude Code command
        let mut cmd = TokioCommand::new("claude");
        cmd.arg("-p")
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
        let script_id = self.parse_pdf_with_sql_execution(pdf_path, username).await?;
        Ok(script_id.to_string())
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