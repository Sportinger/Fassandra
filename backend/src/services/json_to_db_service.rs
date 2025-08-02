//! JSON to Database Service
//!
//! This service takes JSON data and inserts it into the database.
//! It's designed to be called by Claude Code from within the Docker container.
//! Follows the structure defined in prompt.md

use std::sync::Arc;
use sqlx::{PgPool, Row};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use anyhow::{Result, anyhow};
use tracing::{info, error, debug};

// Script data structure as defined in prompt.md
#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptData {
    pub title: String,
    pub subtitle: Option<String>,
    pub adaptation_by: Option<Vec<String>>,
    pub sections: Vec<Section>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Section {
    pub section_number: String,
    pub title: Option<String>,
    pub participants: Option<Vec<String>>,
    pub setting_note: Option<String>,
    pub content: Vec<ContentItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentItem {
    #[serde(rename = "type")]
    pub content_type: String,
    pub page_number: Option<i32>,
    pub scene_number: Option<String>,
    pub scene_title: Option<String>,
    pub speaker: Option<String>,
    pub line: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InsertResult {
    pub success: bool,
    pub script_id: Option<Uuid>,
    pub blocks_inserted: i32,
    pub errors: Vec<String>,
}

pub struct JsonToDbService {
    db_pool: Arc<PgPool>,
}

impl JsonToDbService {
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        Self { db_pool }
    }

    /// Insert script data from JSON into the database
    pub async fn insert_script_from_json(&self, json_str: &str, username: &str) -> Result<InsertResult> {
        let mut errors = Vec::new();
        let mut blocks_inserted = 0;

        // Parse JSON according to prompt.md format
        let script_data: ScriptData = match serde_json::from_str(json_str) {
            Ok(data) => data,
            Err(e) => {
                error!("Failed to parse JSON: {}", e);
                return Ok(InsertResult {
                    success: false,
                    script_id: None,
                    blocks_inserted: 0,
                    errors: vec![format!("JSON parse error: {}", e)],
                });
            }
        };

        // Start transaction
        let mut tx = self.db_pool.begin().await?;

        // Get user ID
        let user_id = match self.get_user_id(&mut tx, username).await {
            Ok(id) => id,
            Err(e) => {
                error!("Failed to get user ID for {}: {}", username, e);
                errors.push(format!("User lookup error: {}", e));
                return Ok(InsertResult {
                    success: false,
                    script_id: None,
                    blocks_inserted: 0,
                    errors,
                });
            }
        };

        // Generate script ID
        let script_id = Uuid::new_v4();
        info!("Inserting script '{}' for user {}", script_data.title, username);

        // Insert script
        match sqlx::query(
            r#"
            INSERT INTO scripts (id, title, created_by, is_public)
            VALUES ($1, $2, $3, $4)
            "#
        )
        .bind(&script_id)
        .bind(&script_data.title)
        .bind(&user_id)
        .bind(false) // Default to private
        .execute(&mut *tx)
        .await
        {
            Ok(_) => {
                info!("Successfully inserted script: {}", script_id);
            }
            Err(e) => {
                error!("Failed to insert script: {}", e);
                errors.push(format!("Script insert error: {}", e));
                tx.rollback().await?;
                return Ok(InsertResult {
                    success: false,
                    script_id: None,
                    blocks_inserted: 0,
                    errors,
                });
            }
        }

        // Process sections and insert blocks
        let mut block_order = 0;
        let mut current_scene_number: Option<String> = None;
        let mut current_scene_title: Option<String> = None;

        for section in &script_data.sections {
            for content_item in &section.content {
                // Update scene context if this is a scene block
                if content_item.content_type == "scene" {
                    current_scene_number = content_item.scene_number.clone();
                    current_scene_title = content_item.scene_title.clone();
                }

                let block_id = Uuid::new_v4();
                
                // Map content_type to the block_type expected by frontend
                let block_type = match content_item.content_type.as_str() {
                    "scene" => "scene-block", // Frontend expects 'scene-block'
                    other => other, // Keep other types as-is
                };
                
                // Format content as JSON based on block type
                let content = match content_item.content_type.as_str() {
                    "dialogue" => {
                        json!({
                            "speaker": content_item.speaker.as_ref().unwrap_or(&"UNKNOWN".to_string()),
                            "line": content_item.line.as_ref().unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    "monologue" => {
                        json!({
                            "speaker": content_item.speaker.as_ref().unwrap_or(&"UNKNOWN".to_string()),
                            "line": content_item.line.as_ref().unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    "stage_direction" => {
                        json!({
                            "description": content_item.description.as_ref()
                                .or(content_item.line.as_ref())
                                .unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    "scene" => {
                        // For scene blocks, the frontend uses scene_number and scene_title from block fields,
                        // not from the JSON content
                        json!({
                            "scene_number": content_item.scene_number.as_ref().unwrap_or(&"".to_string()),
                            "scene_title": content_item.scene_title.as_ref().unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    "joint_dialogue" => {
                        json!({
                            "speakers": section.participants.as_ref()
                                .or(Some(&vec![content_item.speaker.clone().unwrap_or_default()]))
                                .unwrap(),
                            "line": content_item.line.as_ref().unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    "reading" => {
                        json!({
                            "text": content_item.line.as_ref()
                                .or(content_item.description.as_ref())
                                .unwrap_or(&"".to_string())
                        }).to_string()
                    },
                    _ => {
                        // For any other type, try to use line or description
                        json!({
                            "content": content_item.line.as_ref()
                                .or(content_item.description.as_ref())
                                .unwrap_or(&"".to_string())
                        }).to_string()
                    }
                };

                // Prepare metadata
                let mut metadata = json!({});
                if let Some(setting) = &section.setting_note {
                    metadata["setting_note"] = json!(setting);
                }
                if let Some(participants) = &section.participants {
                    metadata["participants"] = json!(participants);
                }

                // Use scene context for blocks that don't have their own
                let block_scene_number = content_item.scene_number.clone()
                    .or(current_scene_number.clone());
                let block_scene_title = content_item.scene_title.clone()
                    .or(current_scene_title.clone());

                match sqlx::query(
                    r#"
                    INSERT INTO blocks (
                        id, script_id, content, block_type, 
                        block_order, page_number, metadata,
                        scene_number, scene_title
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    "#
                )
                .bind(&block_id)
                .bind(&script_id)
                .bind(&content)
                .bind(&block_type) // Use mapped block_type instead of content_type
                .bind(&block_order)
                .bind(content_item.page_number.unwrap_or(1))
                .bind(if metadata.as_object().unwrap().is_empty() { None } else { Some(&metadata) })
                .bind(&block_scene_number)
                .bind(&block_scene_title)
                .execute(&mut *tx)
                .await
                {
                    Ok(_) => {
                        blocks_inserted += 1;
                        debug!("Inserted {} block at order {}", block_type, block_order);
                    }
                    Err(e) => {
                        error!("Failed to insert block at order {}: {}", block_order, e);
                        errors.push(format!("Block {} insert error: {}", block_order, e));
                    }
                }

                block_order += 1;
            }
        }

        // Commit or rollback based on success
        if blocks_inserted > 0 && errors.is_empty() {
            tx.commit().await?;
            info!("Successfully inserted {} blocks for script {}", blocks_inserted, script_id);
            
            Ok(InsertResult {
                success: true,
                script_id: Some(script_id),
                blocks_inserted,
                errors,
            })
        } else if blocks_inserted > 0 {
            // Partial success - still commit but report errors
            tx.commit().await?;
            
            Ok(InsertResult {
                success: false,
                script_id: Some(script_id),
                blocks_inserted,
                errors,
            })
        } else {
            // Complete failure
            tx.rollback().await?;
            
            Ok(InsertResult {
                success: false,
                script_id: None,
                blocks_inserted: 0,
                errors,
            })
        }
    }

    /// Get user ID from username or email
    async fn get_user_id(&self, tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, username: &str) -> Result<Uuid> {
        let row = sqlx::query(
            r#"
            SELECT id FROM users 
            WHERE username = $1 OR email = $1
            LIMIT 1
            "#
        )
        .bind(username)
        .fetch_one(&mut **tx)
        .await
        .map_err(|_| anyhow!("User not found: {}", username))?;

        let user_id: Uuid = row.get("id");
        Ok(user_id)
    }

    /// Validate JSON structure without inserting
    pub async fn validate_json(&self, json_str: &str) -> Result<Vec<String>> {
        let mut errors = Vec::new();

        // Try to parse JSON
        let script_data: ScriptData = match serde_json::from_str(json_str) {
            Ok(data) => data,
            Err(e) => {
                errors.push(format!("JSON parse error: {}", e));
                return Ok(errors);
            }
        };

        // Validate required fields
        if script_data.title.is_empty() {
            errors.push("Title is required".to_string());
        }

        if script_data.sections.is_empty() {
            errors.push("At least one section is required".to_string());
        }

        // Validate sections
        for (section_idx, section) in script_data.sections.iter().enumerate() {
            if section.content.is_empty() {
                errors.push(format!("Section {} has no content", section_idx + 1));
            }

            // Validate content items
            for (idx, item) in section.content.iter().enumerate() {
                let valid_types = ["scene", "dialogue", "monologue", "stage_direction", "joint_dialogue", "reading"];
                if !valid_types.contains(&item.content_type.as_str()) {
                    errors.push(format!(
                        "Section {} item {} has invalid type '{}'. Valid types: {:?}",
                        section_idx + 1, idx + 1, item.content_type, valid_types
                    ));
                }

                // Validate required fields based on type
                match item.content_type.as_str() {
                    "dialogue" | "monologue" => {
                        if item.speaker.is_none() {
                            errors.push(format!(
                                "Section {} item {} ({}): speaker is required",
                                section_idx + 1, idx + 1, item.content_type
                            ));
                        }
                        if item.line.is_none() {
                            errors.push(format!(
                                "Section {} item {} ({}): line is required",
                                section_idx + 1, idx + 1, item.content_type
                            ));
                        }
                    },
                    "stage_direction" => {
                        if item.description.is_none() && item.line.is_none() {
                            errors.push(format!(
                                "Section {} item {} (stage_direction): description or line is required",
                                section_idx + 1, idx + 1
                            ));
                        }
                    },
                    "scene" => {
                        if item.scene_number.is_none() {
                            errors.push(format!(
                                "Section {} item {} (scene): scene_number is required",
                                section_idx + 1, idx + 1
                            ));
                        }
                    },
                    _ => {}
                }
            }
        }

        Ok(errors)
    }
}