use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use sqlx::PgPool;
use crate::{error::AppError, models::script::Script};
use tracing::{info, error};

/// Escapes HTML special characters to prevent XSS attacks
fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

/// Generates a simple DIN A4 ratio thumbnail showing script content
/// 
/// Creates a compact preview of the script content with DIN A4 proportions
/// Returns a base64-encoded SVG image suitable for display
pub fn generate_script_thumbnail(_script: &Script, content_preview: &str) -> String {
    // Parse the formatted content and limit to first 100 words (reduced from 500)
    let words: Vec<&str> = content_preview
        .split_whitespace()
        .take(100) // Drastically reduced from 500 to 100 words
        .collect();
    
    let limited_content = words.join(" ");
    
    // Split into blocks for better formatting - take fewer blocks
    let content_blocks: Vec<&str> = limited_content
        .split("\n\n")
        .filter(|block| !block.trim().is_empty())
        .take(6) // Reduced from 10 to 6 blocks for the 9:16 format
        .collect();
    
    // 🔒 SECURITY: Escape HTML content to prevent XSS attacks in SVG thumbnails
    let escaped_blocks: Vec<String> = content_blocks
        .iter()
        .map(|block| escape_html(block))
        .collect();
    
    // Create SVG content in 9:16 format with transparent background
    let svg_content = format!(
        "<svg width=\"150\" height=\"267\" xmlns=\"http://www.w3.org/2000/svg\">\
<foreignObject x=\"5\" y=\"5\" width=\"140\" height=\"257\">\
<div xmlns=\"http://www.w3.org/1999/xhtml\" style=\"\
font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;\
font-size: 8px;\
line-height: 1.3;\
color: #000;\
padding: 5px;\
overflow: hidden;\
height: 100%;\
background: transparent;\
\">{}</div>\
</foreignObject>\
</svg>",
        escaped_blocks.join("<br/><br/>")
    );
    
    // Encode as base64 data URL
    let base64_svg = general_purpose::STANDARD.encode(svg_content.as_bytes());
    format!("data:image/svg+xml;base64,{}", base64_svg)
}

/// Formats block content for display in thumbnail
fn format_block_content(block_type: &str, content: &str) -> String {
    // Try to parse JSON content if it looks like structured data
    if content.starts_with('{') || content.starts_with('"') {
        match serde_json::from_str::<serde_json::Value>(content) {
            Ok(json) => match block_type {
                "dialogue" => {
                    if let (Some(speaker), Some(line)) = (json.get("speaker"), json.get("line")) {
                        format!("<strong>{}:</strong> {}", 
                            escape_html(speaker.as_str().unwrap_or("Speaker")), 
                            escape_html(line.as_str().unwrap_or("")))
                    } else {
                        escape_html(content)
                    }
                }
                "monologue" => {
                    if let (Some(speaker), Some(lines)) = (json.get("speaker"), json.get("lines")) {
                        let lines_text = if let Some(arr) = lines.as_array() {
                            arr.iter()
                                .map(|v| escape_html(v.as_str().unwrap_or("")))
                                .collect::<Vec<_>>()
                                .join("<br/>")
                        } else {
                            escape_html(lines.as_str().unwrap_or(""))
                        };
                        format!("<strong>{}:</strong><br/>{}", 
                            escape_html(speaker.as_str().unwrap_or("Speaker")), 
                            lines_text)
                    } else {
                        escape_html(content)
                    }
                }
                "stage_direction" => {
                    if let Some(desc) = json.get("description").or_else(|| json.get("text")) {
                        format!("<em>({})</em>", escape_html(desc.as_str().unwrap_or("")))
                    } else {
                        format!("<em>({})</em>", escape_html(content))
                    }
                }
                "joint_dialogue" => {
                    if let (Some(speakers), Some(line)) = (json.get("speakers"), json.get("line")) {
                        let speakers_text = if let Some(arr) = speakers.as_array() {
                            arr.iter()
                                .map(|v| escape_html(v.as_str().unwrap_or("")))
                                .collect::<Vec<_>>()
                                .join("/")
                        } else {
                            escape_html(speakers.as_str().unwrap_or("Speakers"))
                        };
                        format!("<strong>{}:</strong> {}", speakers_text, escape_html(line.as_str().unwrap_or("")))
                    } else {
                        escape_html(content)
                    }
                }
                "reading" => {
                    if let (Some(speaker), Some(text)) = (json.get("speaker"), json.get("reading_text")) {
                        format!("<strong>{}:</strong> <em>(Reading)</em> {}", 
                            escape_html(speaker.as_str().unwrap_or("Reader")), 
                            escape_html(text.as_str().unwrap_or("")))
                    } else {
                        escape_html(content)
                    }
                }
                "paragraph" => {
                    // For paragraphs, the content might be double-JSON-encoded
                    if let Some(text) = json.as_str() {
                        escape_html(text)
                    } else {
                        escape_html(content)
                    }
                }
                _ => escape_html(content)
            }
            Err(_) => escape_html(content)
        }
    } else {
        // Plain text content
        match block_type {
            "stage_direction" => format!("<em>({})</em>", escape_html(content)),
            _ => escape_html(content)
        }
    }
}

/// Updates the thumbnail for a script by fetching its content and generating a preview
pub async fn update_script_thumbnail(pool: &PgPool, script_id: Uuid) -> Result<String, AppError> {
    info!("Generating thumbnail for script: {}", script_id);
    
    // Fetch script and its blocks content
    let (script, blocks) = crate::core::lib::get_script_with_blocks(pool, script_id).await?
        .ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;
    info!("Fetched script '{}' with {} blocks", script.title, blocks.len());
    
    if blocks.is_empty() {
        info!("⚠️ Script '{}' has no blocks, generating empty thumbnail", script.title);
    }
    
    // Format blocks properly for thumbnail display
    let formatted_blocks: Vec<String> = blocks
        .iter()
        .take(8) // Reduced from 12 to 8 - limit to what fits on page
        .map(|block| format_block_content(&block.block_type, &block.content))
        .collect();
    
    let content_preview = formatted_blocks.join("\n\n");
    info!("Content preview length: {} characters", content_preview.len());
    
    // Generate thumbnail
    let thumbnail = generate_script_thumbnail(&script, &content_preview);
    info!("Generated thumbnail with {} characters", thumbnail.len());
    
    // Update script with new thumbnail
    sqlx::query!(
        "UPDATE scripts SET thumbnail = $1 WHERE id = $2",
        thumbnail,
        script_id
    )
    .execute(pool)
    .await
    .map_err(|e| {
        error!("Failed to update script thumbnail in database: {}", e);
        AppError::Internal(anyhow::Error::msg("Failed to update script thumbnail"))
    })?;
    
    info!("Successfully updated thumbnail for script: {}", script_id);
    Ok(thumbnail)
}

/// Generates thumbnails for all scripts that don't have one
pub async fn generate_missing_thumbnails(pool: &PgPool) -> Result<usize, AppError> {
    info!("Generating thumbnails for scripts without thumbnails");
    
    let scripts_without_thumbnails = sqlx::query_as!(
        Script,
        "SELECT id, title, created_by, created_at, COALESCE(is_public, false) as \"is_public!\", thumbnail FROM scripts WHERE thumbnail IS NULL"
    )
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to fetch scripts for thumbnail generation")))?;
    
    let mut count = 0;
    for script in scripts_without_thumbnails {
        match update_script_thumbnail(pool, script.id).await {
            Ok(_) => count += 1,
            Err(e) => error!("Failed to generate thumbnail for script {}: {}", script.id, e),
        }
    }
    
    info!("Generated {} thumbnails", count);
    Ok(count)
}

/// Regenerates thumbnails for ALL scripts (forces refresh)
pub async fn regenerate_all_thumbnails(pool: &PgPool) -> Result<usize, AppError> {
    info!("Regenerating thumbnails for ALL scripts");
    
    let all_scripts = sqlx::query_as!(
        Script,
        "SELECT id, title, created_by, created_at, COALESCE(is_public, false) as \"is_public!\", thumbnail FROM scripts"
    )
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::Internal(anyhow::Error::msg("Failed to fetch scripts for thumbnail regeneration")))?;
    
    let total_scripts = all_scripts.len();
    info!("Found {} scripts to process for thumbnail regeneration", total_scripts);
    
    let mut count = 0;
    for script in all_scripts {
        info!("Processing script '{}' (ID: {}) for thumbnail generation", script.title, script.id);
        match update_script_thumbnail(pool, script.id).await {
            Ok(_) => {
                count += 1;
                info!("✅ Successfully generated thumbnail for script '{}'", script.title);
            },
            Err(e) => {
                error!("❌ Failed to regenerate thumbnail for script '{}' ({}): {}", script.title, script.id, e);
            }
        }
    }
    
    info!("Regenerated {} thumbnails out of {} scripts", count, total_scripts);
    Ok(count)
} 