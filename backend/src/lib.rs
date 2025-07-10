//! Core data structures and database access functions for the backend service.
//!
//! This module defines the main types (User, Script, Block, Edit) and provides
//! async functions for interacting with the database, such as fetching scripts,
//! creating scripts and blocks, and updating content. All docstrings follow Rust
//! documentation standards.

pub mod error;
pub mod auth;
pub mod ws;
pub mod analysis;
pub mod gemini_api;
pub mod api;
pub mod models;
pub mod handlers;
pub mod thumbnail;
pub mod persistence_event;
pub mod async_db_writer;
pub mod services;
pub mod service_manager;
pub mod snapshotting_service;

#[cfg(test)]
mod test_yjs;

use chrono::Utc;
use sqlx::{PgPool, Row}; // Removed unused import: Transaction
use tokio::time::{timeout, Duration};
use uuid::Uuid;
use anyhow::Error;
// Removed unused import: use std::sync::Arc;

use error::AppError;
type Result<T> = std::result::Result<T, AppError>;

// Add tracing import
use tracing::{info, error, debug};

// Define a default timeout duration. Consider making this configurable.
const DB_TIMEOUT: Duration = Duration::from_secs(5);

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

/// Fetches all scripts from the database.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
///
/// # Returns
/// * `Result<Vec<Script>>` - A vector of scripts on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn get_scripts(pool: &PgPool) -> Result<Vec<models::script::Script>> {
    sqlx::query_as_unchecked!(
        models::script::Script,
        "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))
}

/// Creates a new script in the database.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `title` - Title of the new script.
/// * `user_id` - Optional user ID of the creator.
///
/// # Returns
/// * `Result<Uuid>` - The ID of the newly created script on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn create_script(pool: &PgPool, title: &str, user_id: Uuid) -> Result<models::script::Script> {
    let script = sqlx::query_as_unchecked!(
        models::script::Script,
        "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, created_by, created_at, is_public, thumbnail",
        Uuid::new_v4(),
        title,
        user_id,
        Utc::now(),
        false, // Default to private
        None::<String> // No thumbnail initially
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok(script)
}

/// Fetches a script and its associated blocks by script ID.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script to fetch.
///
/// # Returns
/// * `Result<(Script, Vec<Block>)>` - The script and its blocks on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn get_script_with_blocks(pool: &PgPool, script_id: Uuid) -> Result<(models::script::Script, Vec<models::block::Block>)> {
    let script = sqlx::query_as_unchecked!(
        models::script::Script,
        "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    let blocks = sqlx::query_as_unchecked!(
        models::block::Block,
        "SELECT id, script_id, block_type, content, created_at, block_order FROM blocks WHERE script_id = $1 ORDER BY block_order ASC, created_at ASC",
        script_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok((script, blocks))
}

/// Creates a new block for a given script.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script to add the block to.
/// * `block_type` - The type of the block (e.g., "text").
/// * `content` - The content of the block.
///
/// # Returns
/// * `Result<Uuid>` - The ID of the newly created block on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn create_block(pool: &PgPool, script_id: Uuid, block_type: &str, content: &str) -> Result<Uuid> {
    let query = sqlx::query("INSERT INTO blocks (script_id, block_type, content, block_order) VALUES ($1, $2, $3, $4) RETURNING id")
        .bind(script_id)
        .bind(block_type)
        .bind(content)
        .bind(0); // Default block_order for manually created blocks
    let row = timeout(DB_TIMEOUT, query.fetch_one(pool))
        .await
        .map_err(|_| AppError::Internal(Error::msg("Database timeout".to_string())))??;
    Ok(row.get("id"))
}

/// Updates the content of a block and records the edit in the edits table.
///
/// # Arguments
/// * `tx` - Reference to a PostgreSQL transaction.
/// * `block_id` - The ID of the block to update.
/// * `new_content` - The new content for the block.
/// * `user_id` - The ID of the user making the edit.
///
/// # Returns
/// * `Result<()>` - Ok on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn update_block_content(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    block_id: Uuid,
    content: &str,
    user_id: Uuid,
) -> Result<()> {
    sqlx::query!(
        "UPDATE blocks SET content = $1 WHERE id = $2",
        content,
        block_id
    )
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    sqlx::query!(
        "INSERT INTO edits (id, block_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, $5)",
        Uuid::new_v4(),
        block_id,
        user_id,
        content,
        Utc::now()
    )
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(())
}

/// Fetches the edit history for a given block.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `block_id` - The ID of the block whose history to fetch.
///
/// # Returns
/// * `Result<Vec<Edit>>` - A vector of edits on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn get_block_history(pool: &PgPool, block_id: Uuid) -> Result<Vec<models::edit::Edit>> {
    let edits = timeout(
        DB_TIMEOUT,
        sqlx::query_as_unchecked!(
            models::edit::Edit,
            "SELECT id, block_id, user_id, content, created_at FROM edits WHERE block_id=$1 ORDER BY created_at",
            block_id
        )
        .fetch_all(pool)
    )
    .await
    .map_err(|_| AppError::Internal(Error::msg("Database timeout".to_string())))??;
    Ok(edits)
}

/// Updates a block's content and records the edit, wrapped in a transaction.
pub async fn update_block(
    pool: &PgPool,
    block_id: Uuid,
    content: &str,
    user_id: Uuid,
) -> Result<()> {
    let mut tx = pool.begin().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    update_block_content(&mut tx, block_id, content, user_id).await?;
    tx.commit().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    Ok(())
}

/// Deletes a script from the database.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script to delete.
///
/// # Returns
/// * `Result<()>` - Ok on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if the database query fails or times out.
pub async fn delete_script(pool: &PgPool, script_id: Uuid) -> Result<()> {
    sqlx::query!(
        "DELETE FROM scripts WHERE id = $1",
        script_id
    )
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok(())
}

/// Creates a new script and its blocks from parsed script data.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `parsed_script` - The structured script data parsed from the AI analysis.
/// * `user_id` - The ID of the user creating the script.
///
/// # Returns
/// * `Result<Uuid>` - The ID of the newly created script on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if database operations fail.
pub async fn create_script_from_parsed(
    pool: &PgPool,
    parsed_script: &crate::analysis::structs::Script,
    user_id: Uuid,
) -> Result<Uuid> {
    info!(%user_id, "Attempting to start transaction for script creation.");
    let mut tx = pool.begin().await.map_err(|e| {
        error!(error = %e, "Failed to begin transaction");
        AppError::Db(e)
    })?;
    info!("Transaction started successfully.");

    // 1. Create the script entry
    let new_script_id = Uuid::new_v4();
    let raw_title = parsed_script.title.as_deref().unwrap_or("Untitled Script");
    // Extract just the main title (first line or first few words) to avoid long titles
    let script_title = extract_main_title(raw_title);
    let created_at = Utc::now();

    info!(%new_script_id, title = %script_title, %user_id, "Attempting to insert script record.");
    // Use sqlx::query() instead of macro
    sqlx::query("INSERT INTO scripts (id, title, created_by, created_at, is_public) VALUES ($1, $2, $3, $4, $5)")
        .bind(new_script_id)
        .bind(script_title)
        .bind(user_id)
        .bind(created_at)
        .bind(false) // Default to private
        .execute(&mut *tx)
        .await
        .map_err(|e| {
             error!(error = %e, script_id = %new_script_id, "Failed to insert script record ");
             AppError::Db(e)
        })?;
    info!(%new_script_id, "Script record inserted successfully.");


    // 2. Iterate through sections and content elements to create blocks
    for (section_index, section) in parsed_script.sections.iter().enumerate() {
        for (element_index, element) in section.content.iter().enumerate() {
            debug!(%new_script_id, section_index, element_index, "Processing content element for block creation.");
            let (block_type, content_json) = match element {
                crate::analysis::structs::ContentElement::Dialogue(d) => ("dialogue", serde_json::to_string(d)),
                crate::analysis::structs::ContentElement::Monologue(m) => ("monologue", serde_json::to_string(m)),
                crate::analysis::structs::ContentElement::StageDirection(sd) => ("stage_direction", serde_json::to_string(sd)),
                crate::analysis::structs::ContentElement::JointDialogue(jd) => ("joint_dialogue", serde_json::to_string(jd)),
                crate::analysis::structs::ContentElement::Reading(r) => ("reading", serde_json::to_string(r)),
                crate::analysis::structs::ContentElement::Unknown => ("unknown", Ok("{}".to_string())),
            };

            let content_str = content_json.map_err(|e| {
                error!(error = %e, script_id = %new_script_id, section_index, element_index, "Failed to serialize content element ");
                 AppError::Internal(Error::new(e).context("Failed to serialize content element "))
            })?;
            let block_created_at = Utc::now();
            let block_id = Uuid::new_v4();

            info!(%block_id, %new_script_id, %block_type, "Attempting to insert block record.");
            // Use sqlx::query() instead of macro
            sqlx::query("INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order) VALUES ($1, $2, $3, $4, $5, $6)")
                .bind(block_id)
                .bind(new_script_id)
                .bind(block_type)
                .bind(content_str.clone()) // Clone content_str for logging in case of error
                .bind(block_created_at)
                .bind((section_index * 1000 + element_index) as i32) // Set proper block order
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    error!(error = %e, %block_id, script_id = %new_script_id, %block_type, content = %content_str, "Failed to insert block record ");
                    AppError::Db(e)
                })?;
            info!(%block_id, script_id = %new_script_id, "Block record inserted successfully.");
        }
    }

    // Commit transaction
    info!(%new_script_id, "Attempting to commit transaction.");
    tx.commit().await.map_err(|e| {
        error!(error = %e, script_id = %new_script_id, "Failed to commit transaction ");
        AppError::Db(e)
    })?;
    info!(%new_script_id, "Transaction committed successfully.");


    Ok(new_script_id)
}

/// Updates a script's content by parsing HTML from TipTap editor and converting to blocks.
///
/// This function provides the missing link between collaborative editing (Yjs/TipTap) 
/// and persistent storage (PostgreSQL blocks table).
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script to update.
/// * `html_content` - HTML content from the TipTap editor.
/// * `user_id` - The ID of the user making the edit.
///
/// # Returns
/// * `Result<()>` - Ok on success, or an AppError on failure.
///
/// # Errors
/// Returns an error if HTML parsing or database operations fail.
pub async fn update_script_content_from_html(
    pool: &PgPool,
    script_id: Uuid,
    html_content: &str,
    _user_id: Uuid,
) -> Result<()> {
    tracing::debug!("📝 Parsing HTML content for script {}: {} chars", script_id, html_content.len());
    
    // Parse HTML into blocks
    let blocks = parse_html_to_blocks(html_content)?;
    let blocks_count = blocks.len();
    tracing::info!("✅ Parsed {} blocks from HTML for script {}", blocks_count, script_id);
    
    // Start transaction to update blocks atomically
    let mut tx = pool.begin().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    
    // Delete existing blocks for this script
    sqlx::query("DELETE FROM blocks WHERE script_id = $1")
        .bind(script_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    
    tracing::debug!("🗑️ Deleted existing blocks for script {}", script_id);
    
    // Insert new blocks
    for (index, (block_type, content)) in blocks.into_iter().enumerate() {
        sqlx::query(
            "INSERT INTO blocks (script_id, block_type, content, block_order, created_at) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(script_id)
        .bind(block_type)
        .bind(content)
        .bind(index as i32)
        .bind(Utc::now())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    }
    
    tracing::debug!("📝 Inserted {} new blocks for script {}", blocks_count, script_id);
    
    // Note: We skip recording edits for HTML updates since it would require a valid block_id
    // The blocks themselves serve as the audit trail for content changes
    
    // Commit transaction
    tx.commit().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;
    
    tracing::info!("✅ Successfully updated script {} with {} blocks", script_id, blocks_count);
    Ok(())
}

/// Removes HTML tags and attributes from a string, keeping only text content.
///
/// This function strips all HTML tags (including those with attributes) and returns clean text.
fn remove_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut chars = html.chars().peekable();
    
    while let Some(ch) = chars.next() {
        match ch {
            '<' => {
                in_tag = true;
            }
            '>' => {
                in_tag = false;
            }
            _ => {
                if !in_tag {
                    result.push(ch);
                }
            }
        }
    }
    
    // Clean up extra whitespace and decode HTML entities
    result
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

/// Parses HTML content from TipTap editor into structured blocks.
///
/// This function converts TipTap HTML into the block format expected by the database.
/// It handles paragraphs, headings, and attempts to identify speaker patterns for dialogue.
///
/// # Arguments
/// * `html_content` - HTML string from TipTap editor.
///
/// # Returns
/// * `Result<Vec<(String, String)>>` - Vector of (block_type, content) tuples.
///
/// # Errors
/// Returns an error if HTML parsing fails.
fn parse_html_to_blocks(html_content: &str) -> Result<Vec<(String, String)>> {
    let mut blocks = Vec::new();
    
    // Simple HTML parsing - split by paragraphs and headings
    // For production, you might want to use a proper HTML parser like `scraper` or `html5ever`
    
    // Clean up the HTML and split into elements
    let cleaned = html_content
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n");
    
    // Split by paragraph tags
    let elements: Vec<&str> = cleaned
        .split("</p>")
        .filter(|s| !s.trim().is_empty())
        .collect();
    
    for element in elements {
        // Remove ALL HTML tags and attributes, not just specific ones
        let content = remove_html_tags(element).trim().to_string();
        
        if content.is_empty() {
            continue;
        }
        
        // Split content by line breaks to handle multiple lines within one HTML element
        let lines: Vec<&str> = content.split('\n')
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect();
        
        // Process each line as a separate block
        for line in lines {
            let line_content = line.to_string();
            
            // Determine block type based on content patterns
            let block_type = if element.contains("<h1>") {
                "heading1"
            } else if element.contains("<h2>") {
                "heading2"  
            } else if element.contains("<h3>") {
                "heading3"
            } else if line_content.starts_with('(') && line_content.ends_with(')') && line_content.len() > 2 {
                // Stage direction - text fully enclosed in parentheses
                "stage_direction"
            } else if line_content.contains(':') && line_content.split(':').count() == 2 {
                // More conservative dialogue detection - must have exactly one colon
                let parts: Vec<&str> = line_content.split(':').collect();
                let potential_speaker = parts[0].trim();
                let potential_line = parts[1].trim();
                
                // Only treat as dialogue if speaker looks like a name (short, no spaces except for compound names)
                if potential_speaker.len() > 0 && potential_speaker.len() < 30 
                    && potential_line.len() > 0 
                    && !potential_speaker.contains('\n')
                    && potential_speaker.chars().next().unwrap_or(' ').is_alphabetic() {
                    "dialogue"
                } else {
                    "paragraph"
                }
            } else {
                // Default to paragraph for all other content
                "paragraph"
            };
            
            // Create JSON content based on block type
            let final_content = match block_type {
                "dialogue" => {
                    // Split at the first colon (validate colon exists)
                    let colon_pos = match line_content.find(':') {
                        Some(pos) => pos,
                        None => return Err(AppError::Internal(Error::msg(format!(
                            "Invalid dialogue format: missing colon in line: {}", line_content
                        )))),
                    };
                    let speaker = line_content[..colon_pos].trim();
                    let line = line_content[colon_pos + 1..].trim();
                    serde_json::json!({
                        "speaker": speaker,
                        "line": line
                    }).to_string()
                },
                "stage_direction" => {
                    let description = line_content.trim_start_matches('(').trim_end_matches(')').trim();
                    serde_json::json!({
                        "description": description
                    }).to_string()
                },
                _ => {
                    // For paragraphs and headings, store content as simple JSON string
                    serde_json::json!(line_content).to_string()
                }
            };
            
            blocks.push((block_type.to_string(), final_content));
        }
    }
    
    // If no blocks were parsed, create a default empty paragraph
    if blocks.is_empty() {
        blocks.push(("paragraph".to_string(), serde_json::json!("").to_string()));
    }
    
    Ok(blocks)
}

// === Script Layout Management Functions ===

/// Gets all layouts for a specific script.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script.
///
/// # Returns
/// * `Result<Vec<models::script_layout::ScriptLayout>>` - Vector of layouts on success, or an AppError on failure.
pub async fn get_script_layouts(pool: &PgPool, script_id: Uuid) -> Result<Vec<models::script_layout::ScriptLayout>> {
    sqlx::query_as!(
        models::script_layout::ScriptLayout,
        "SELECT id, script_id, name, description, created_by, created_at, updated_at, is_default, layout_config 
         FROM script_layouts 
         WHERE script_id = $1 
         ORDER BY COALESCE(is_default, false) DESC, created_at ASC",
        script_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))
}

/// Gets the default layout for a script.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script.
///
/// # Returns
/// * `Result<Option<models::script_layout::ScriptLayout>>` - The default layout if it exists, or None.
pub async fn get_default_script_layout(pool: &PgPool, script_id: Uuid) -> Result<Option<models::script_layout::ScriptLayout>> {
    sqlx::query_as!(
        models::script_layout::ScriptLayout,
        "SELECT id, script_id, name, description, created_by, created_at, updated_at, is_default, layout_config 
         FROM script_layouts 
         WHERE script_id = $1 AND COALESCE(is_default, false) = true
         LIMIT 1",
        script_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))
}

/// Creates a new layout for a script.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `script_id` - The ID of the script.
/// * `request` - The layout creation request.
/// * `user_id` - The ID of the user creating the layout.
///
/// # Returns
/// * `Result<models::script_layout::ScriptLayout>` - The created layout on success, or an AppError on failure.
pub async fn create_script_layout(
    pool: &PgPool, 
    script_id: Uuid, 
    request: &models::script_layout::CreateScriptLayoutRequest,
    user_id: Uuid
) -> Result<models::script_layout::ScriptLayout> {
    let mut tx = pool.begin().await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    // If this is set as default, unset other defaults first
    if request.is_default.unwrap_or(false) {
        sqlx::query("UPDATE script_layouts SET is_default = false WHERE script_id = $1")
            .bind(script_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    }
    
    let layout = sqlx::query_as!(
        models::script_layout::ScriptLayout,
        "INSERT INTO script_layouts (script_id, name, description, created_by, is_default, layout_config) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, script_id, name, description, created_by, created_at, updated_at, is_default, layout_config",
        script_id,
        request.name,
        request.description,
        Some(user_id),
        request.is_default.unwrap_or(false),
        request.layout_config
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    tx.commit().await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok(layout)
}

/// Updates an existing script layout.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `layout_id` - The ID of the layout to update.
/// * `request` - The layout update request.
/// * `user_id` - The ID of the user updating the layout.
///
/// # Returns
/// * `Result<models::script_layout::ScriptLayout>` - The updated layout on success, or an AppError on failure.
pub async fn update_script_layout(
    pool: &PgPool,
    layout_id: Uuid,
    request: &models::script_layout::UpdateScriptLayoutRequest,
    _user_id: Uuid
) -> Result<models::script_layout::ScriptLayout> {
    let mut tx = pool.begin().await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    // Get current layout to check script_id for default handling
    let current_layout = sqlx::query!("SELECT script_id FROM script_layouts WHERE id = $1", layout_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    // If setting as default, unset other defaults first
    if let Some(true) = request.is_default {
        sqlx::query("UPDATE script_layouts SET is_default = false WHERE script_id = $1")
            .bind(current_layout.script_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    }
    
    let layout = sqlx::query_as!(
        models::script_layout::ScriptLayout,
        "UPDATE script_layouts 
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             layout_config = COALESCE($4, layout_config),
             is_default = COALESCE($5, is_default),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, script_id, name, description, created_by, created_at, updated_at, is_default, layout_config",
        layout_id,
        request.name,
        request.description,
        request.layout_config,
        request.is_default
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    tx.commit().await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok(layout)
}

/// Deletes a script layout.
///
/// # Arguments
/// * `pool` - Reference to a PostgreSQL connection pool.
/// * `layout_id` - The ID of the layout to delete.
///
/// # Returns
/// * `Result<()>` - Ok on success, or an AppError on failure.
pub async fn delete_script_layout(pool: &PgPool, layout_id: Uuid) -> Result<()> {
    sqlx::query("DELETE FROM script_layouts WHERE id = $1")
        .bind(layout_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(Error::msg(e.to_string())))?;
    
    Ok(())
}

pub async fn health_check() -> &'static str {
    "OK"
} 