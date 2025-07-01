//! Handles communication with the Google Gemini API for script analysis.

use reqwest::Client;
use serde::{Deserialize, Serialize};
 // Using Value for flexibility initially
use std::env;
use thiserror::Error;
use std::fs;
use std::path::Path;
use crate::analysis::structs::Script as ParsedScript;
use std::collections::HashMap;

//ulla --- Configuration ---

// TODO: Determine the correct Gemini API endpoint
const GEMINI_API_URL_VAR: &str = "GEMINI_API_URL"; // e.g., "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
const GEMINI_API_KEY_VAR: &str = "GEMINI_API_KEY";

// --- Structs for OpenAPI Schema Definition (subset used by Gemini) ---

#[derive(Serialize, Debug, Clone)] // Clone needed for static definition
#[serde(rename_all = "SCREAMING_SNAKE_CASE")] // Match API enum style
enum SchemaType {
    String,
    Number, // Represents float/double
    Integer,
    Boolean,
    Array,
    Object,
}

#[derive(Serialize, Debug, Clone)] // REMOVED Default here
struct Schema {
    #[serde(rename = "type")]
    schema_type: SchemaType,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>, // e.g., "int64", "double", "date-time"
    #[serde(skip_serializing_if = "Option::is_none")]
    nullable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    enum_values: Option<Vec<String>>, // Field name adjusted for clarity
    // For arrays
    #[serde(skip_serializing_if = "Option::is_none")]
    items: Option<Box<Schema>>, // Use Box for recursive type
    // For objects
    #[serde(skip_serializing_if = "Option::is_none")]
    properties: Option<HashMap<String, Schema>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    required: Option<Vec<String>>,
    // propertyOrdering is mentioned but might not be strictly needed if we match struct order
}

// --- Function to build the target response schema ---

fn get_script_response_schema() -> Schema {
    // Define a helper to create a basic String schema
    let string_schema = || Schema {
        schema_type: SchemaType::String,
        description: None, format: None, nullable: None, enum_values: None, items: None, properties: None, required: None,
    };
    let nullable_string_schema = || Schema {
        schema_type: SchemaType::String,
        description: None, format: None, nullable: Some(true), enum_values: None, items: None, properties: None, required: None,
    };
    let id_schema = || Schema {
         schema_type: SchemaType::String, 
         description: Some("UUID".to_string()), format: None, 
         nullable: None, enum_values: None, items: None, properties: None, required: None,
    };
    let string_array_schema = || Schema {
        schema_type: SchemaType::Array,
        items: Some(Box::new(string_schema())),
        description: None, format: None, nullable: None, enum_values: None, properties: None, required: None,
    };
    
    // Define schema for the ContentElement object 
    // Include ALL possible fields from the enum variants as optional properties.
    // Use descriptions to guide the AI on which field to use for which type.
    let content_element_item_schema = Schema {
        schema_type: SchemaType::Object, 
        description: Some("A script element. Must include a 'type' field (dialogue, monologue, stage_direction, joint_dialogue, reading)".to_string()),
        format: None, nullable: None, enum_values: None, items: None, 
        properties: Some(HashMap::from([
            // Required type tag
            ("type".to_string(), Schema {
                schema_type: SchemaType::String,
                description: Some("Type of script element (dialogue, monologue, stage_direction, joint_dialogue, reading)".to_string()),
                format: None, nullable: None, enum_values: None, items: None, properties: None, required: None,
            }),
            // Dialogue/JointDialogue field
            ("line".to_string(), Schema {
                schema_type: SchemaType::String,
                description: Some("The spoken text for 'dialogue' or 'joint_dialogue' types.".to_string()),
                format: None, 
                nullable: Some(false), // Make the line field non-nullable in the schema
                enum_values: None, 
                items: None, 
                properties: None, required: None,
            }), 
             // Monologue field
            ("lines".to_string(), Schema { 
                schema_type: SchemaType::Array, 
                items: Some(Box::new(string_schema())), 
                description: Some("Array of spoken text lines for 'monologue' type.".to_string()),
                format: None, nullable: Some(true), enum_values: None, properties: None, required: None 
            }),
            // StageDirection field
            ("description".to_string(), Schema {
                 schema_type: SchemaType::String,
                 description: Some("The text content for 'stage_direction' type.".to_string()),
                 format: None, nullable: Some(true), enum_values: None, items: None, properties: None, required: None,
            }),
            // Common speaker field (used by Dialogue, Monologue, Reading)
            ("speaker".to_string(), nullable_string_schema()), 
            // JointDialogue field
            ("speakers".to_string(), Schema { 
                schema_type: SchemaType::Array, 
                items: Some(Box::new(string_schema())), 
                description: Some("Array of speakers for 'joint_dialogue' type.".to_string()),
                format: None, nullable: Some(true), enum_values: None, properties: None, required: None 
            }), 
             // Reading fields
            ("source".to_string(), nullable_string_schema()),
            ("language".to_string(), nullable_string_schema()),
            ("reading_text".to_string(), Schema { // Use 'reading_text' specifically for Reading type to avoid confusion
                schema_type: SchemaType::String, 
                description: Some("The text content for 'reading' type.".to_string()),
                format: None, nullable: Some(true), enum_values: None, items: None, properties: None, required: None,
            }), 
            // ID field (common)
             ("id".to_string(), id_schema()), // Include ID as optional in schema
        ])),
        required: Some(vec!["type".to_string()]), // Only 'type' is strictly required by the schema definition itself
    };

    // Define schema for Section
    let section_schema = Schema {
        schema_type: SchemaType::Object,
        description: Some("Represents a major section like a Scene or Act".to_string()),
        properties: Some(HashMap::from([
            ("id".to_string(), id_schema()),
            ("section_number".to_string(), nullable_string_schema()),
            ("title".to_string(), nullable_string_schema()),
            ("participants".to_string(), string_array_schema()),
            ("setting_note".to_string(), nullable_string_schema()),
            ("content".to_string(), Schema {
                schema_type: SchemaType::Array,
                description: Some("Array of script elements".to_string()),
                items: Some(Box::new(content_element_item_schema.clone())), // Use the updated object schema
                format: None, nullable: None, enum_values: None, properties: None, required: None,
            }),
        ])),
        required: None, 
        format: None, nullable: None, enum_values: None, items: None,
    };

    // Define the top-level Script schema
    Schema {
        schema_type: SchemaType::Object,
        description: Some("Represents the entire parsed script".to_string()),
        properties: Some(HashMap::from([
            ("id".to_string(), id_schema()),
            ("source_filename".to_string(), nullable_string_schema()),
            ("title".to_string(), nullable_string_schema()),
            ("subtitle".to_string(), nullable_string_schema()),
            ("adaptation_by".to_string(), string_array_schema()), 
            ("sections".to_string(), Schema {
                schema_type: SchemaType::Array,
                items: Some(Box::new(section_schema.clone())), 
                description: None, format: None, nullable: None, enum_values: None, properties: None, required: None, 
            }),
        ])),
        required: Some(vec!["sections".to_string()]),
        format: None, nullable: None, enum_values: None, items: None,
    }
}

// --- Structs for API Interaction ---

#[derive(Serialize, Debug)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig", skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
}

#[derive(Serialize, Debug)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
    #[serde(rename = "responseSchema", skip_serializing_if = "Option::is_none")]
    response_schema: Option<Schema>, // Add the schema field here
    #[serde(rename = "maxOutputTokens", skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<i32>, // Add max output tokens to prevent truncation
}

#[derive(Serialize, Debug)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Debug)]
struct Part {
    text: String,
}

#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
    // promptFeedback might also be useful
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: ContentResponse,
    // finishReason, index, safetyRatings etc.
}

#[derive(Deserialize, Debug)]
struct ContentResponse {
    parts: Vec<PartResponse>,
    // role ("model")
}

#[derive(Deserialize, Debug)]
struct PartResponse {
    text: String,
}


// --- Error Handling ---

#[derive(Error, Debug)]
pub enum GeminiApiError {
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("API returned an error: Status {status}, Body: {body}")]
    ApiError {
        status: reqwest::StatusCode,
        body: String,
    },
    #[error("Failed to deserialize API response: {0}")]
    Deserialization(#[from] serde_json::Error),
    #[error("No valid response candidate found")]
    NoCandidate,
    #[error("Failed to parse structured script from API response: {0}")]
    StructureParsing(String),
}

// --- API Client Function ---

// Load the prompt template at compile time
// Path is relative to the current file (gemini_api.rs)
const SCRIPT_ANALYSIS_PROMPT_TEMPLATE: &str = include_str!("prompts/script_analysis.prompt");

/// Calls the Gemini API to parse the script text.
///
/// # Arguments
/// * `http_client` - A reqwest::Client instance.
/// * `script_text` - The plain text extracted from the DOCX file.
///
/// # Returns
/// * `Ok(ParsedScript)` containing the structured data parsed by the AI.
/// * `Err(GeminiApiError)` if any step fails.
pub async fn call_gemini_for_parsing(
    http_client: &Client,
    script_text: &str,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;
    let api_url = env::var(GEMINI_API_URL_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_URL_VAR.to_string()))?;

    // Format the prompt using the loaded template and the script text
    // Use the loaded template directly
    let prompt = SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", script_text);

    // --- Configure for JSON output with Schema --- 
    let generation_config = GenerationConfig {
        response_mime_type: "application/json".to_string(),
        response_schema: None, // TEMPORARILY DISABLE SCHEMA to test if it's causing the issue
        max_output_tokens: Some(8192), // Set high token limit to prevent truncation (Gemini 1.5 Flash supports up to 8192)
    };
    // ------------------------------------------

    let request_payload = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: prompt }], // Send the formatted prompt
        }],
        generation_config: Some(generation_config), // Add the config here
    };

    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)]) // API key as query parameter
        .json(&request_payload)
        .send()
        .await
        // Add detailed logging for Reqwest errors
        .map_err(|e| {
            eprintln!("Detailed Reqwest Error: {:?}", e);
            // Check for specific error kinds if helpful
            if e.is_timeout() {
                eprintln!("Error Type: Request Timeout");
            } else if e.is_connect() {
                eprintln!("Error Type: Connection Error");
            } else if e.is_request() {
                eprintln!("Error Type: Request Body Error");
            } // Add more checks if needed based on reqwest::Error kinds
            
            // Return the original error wrapped in our enum
            GeminiApiError::Reqwest(e) 
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        return Err(GeminiApiError::ApiError { status, body });
    }

    let response_body = response.json::<GeminiResponse>().await?;

    let model_response_text_raw = response_body
        .candidates
        .get(0)
        .and_then(|c| c.content.parts.get(0))
        .map(|p| p.text.trim())
        .ok_or(GeminiApiError::NoCandidate)?;

    let model_response_text = model_response_text_raw
        .strip_prefix("```json")
        .unwrap_or(model_response_text_raw)
        .strip_suffix("```")
        .unwrap_or(model_response_text_raw)
        .trim();

    println!("--- Gemini Cleaned Response Text ---
{}
---", model_response_text);

    let output_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("target").join("test_outputs");
    fs::create_dir_all(&output_dir).expect("Failed to create test output directory");
    let output_filename = "gemini_response_partial_frankenstein.json"; // Keep the filename for now
    let output_path = output_dir.join(output_filename);
    fs::write(&output_path, model_response_text)
        .expect("Failed to write Gemini response to file");
    println!("Saved Gemini JSON response to: {:?}", output_path);

    let parsed_script: ParsedScript = serde_json::from_str(model_response_text)
        .map_err(|e| {
            eprintln!("Failed to parse JSON: {}", e);
            eprintln!("Raw JSON string was:
{}", model_response_text);
            GeminiApiError::StructureParsing(e.to_string())
         })?;

    Ok(parsed_script)
} 