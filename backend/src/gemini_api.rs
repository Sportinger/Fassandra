//! Handles communication with the Google Gemini API for script analysis.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use thiserror::Error;
use crate::analysis::structs::Script as ParsedScript;
use std::collections::HashMap;

//ulla --- Configuration ---

// TODO: Determine the correct Gemini API endpoint
const GEMINI_API_URL_VAR: &str = "GEMINI_API_URL"; // e.g., "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
const GEMINI_API_KEY_VAR: &str = "GEMINI_API_KEY";
const GEMINI_FILES_API_URL: &str = "https://generativelanguage.googleapis.com/upload/v1beta/files";

// --- Structs for OpenAPI Schema Definition (subset used by Gemini) ---

#[derive(Serialize, Debug, Clone)] // REMOVED Default here
struct Schema {
    #[serde(rename = "type")]
    schema_type: String, // Changed from SchemaType to String since enum is removed
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
#[serde(untagged)]
enum Part {
    Text { text: String },
    FileData { 
        #[serde(rename = "file_data")]
        file_data: FileData 
    },
}

#[derive(Serialize, Debug)]
struct FileData {
    #[serde(rename = "mime_type")]
    mime_type: String,
    #[serde(rename = "file_uri")]
    file_uri: String,
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

// --- File Upload Structs ---

#[derive(Serialize, Debug)]
struct FileUploadMetadata {
    file: FileMetadata,
}

#[derive(Serialize, Debug)]
struct FileMetadata {
    #[serde(rename = "display_name")]
    display_name: String,
}

#[derive(Deserialize, Debug)]
struct FileUploadResponse {
    file: UploadedFile,
}

#[derive(Deserialize, Debug)]
struct UploadedFile {
    name: String,
    #[serde(rename = "uri")]
    uri: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    state: String,
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
    #[error("File upload failed: {0}")]
    FileUpload(String),
}

// --- API Client Function ---

// Load the prompt template at compile time
// Path is relative to the current file (gemini_api.rs)
const SCRIPT_ANALYSIS_PROMPT_TEMPLATE: &str = include_str!("prompts/script_analysis.prompt");

/// Uploads a DOCX file to Gemini Files API and returns the file URI.
///
/// # Arguments
/// * `http_client` - A reqwest::Client instance.
/// * `docx_bytes` - The DOCX file content as bytes.
/// * `filename` - The original filename for display purposes.
///
/// # Returns
/// * `Ok(String)` containing the file URI on success.
/// * `Err(GeminiApiError)` if upload fails.
pub async fn upload_docx_to_gemini(
    http_client: &Client,
    docx_bytes: &[u8],
    filename: &str,
) -> Result<UploadedFile, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;

    // Step 1: Initiate resumable upload
    let metadata = FileUploadMetadata {
        file: FileMetadata {
            display_name: filename.to_string(),
        },
    };

    let initiate_response = http_client
        .post(GEMINI_FILES_API_URL)
        .query(&[("key", &api_key)])
        .header("X-Goog-Upload-Protocol", "resumable")
        .header("X-Goog-Upload-Command", "start")
        .header("X-Goog-Upload-Header-Content-Length", docx_bytes.len().to_string())
        .header("X-Goog-Upload-Header-Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        .header("Content-Type", "application/json")
        .json(&metadata)
        .send()
        .await?;

    if !initiate_response.status().is_success() {
        let status = initiate_response.status();
        let body = initiate_response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        return Err(GeminiApiError::FileUpload(format!("Upload initiation failed: Status {}, Body: {}", status, body)));
    }

    // Extract upload URL from response headers
    let upload_url = initiate_response
        .headers()
        .get("x-goog-upload-url")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| GeminiApiError::FileUpload("No upload URL in response headers".to_string()))?;

    // Step 2: Upload the actual file content
    let upload_response = http_client
        .put(upload_url)
        .header("Content-Length", docx_bytes.len().to_string())
        .header("X-Goog-Upload-Offset", "0")
        .header("X-Goog-Upload-Command", "upload, finalize")
        .body(docx_bytes.to_vec())
        .send()
        .await?;

    if !upload_response.status().is_success() {
        let status = upload_response.status();
        let body = upload_response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        return Err(GeminiApiError::FileUpload(format!("File upload failed: Status {}, Body: {}", status, body)));
    }

    let upload_result: FileUploadResponse = upload_response.json().await?;
    Ok(upload_result.file)
}

/// Extracts valid JSON from a response that might have trailing text.
///
/// Gemini sometimes returns valid JSON followed by additional text. This function
/// finds the JSON portion by tracking brace balance.
fn extract_valid_json(text: &str) -> Result<String, GeminiApiError> {
    let text = text.trim();
    
    // Find the start of JSON (first '{')
    let start_pos = text.find('{').ok_or_else(|| {
        GeminiApiError::StructureParsing("No JSON object found in response".to_string())
    })?;
    
    // Track brace balance to find the end of the JSON object
    let mut brace_count = 0;
    let mut in_string = false;
    let mut escape_next = false;
    let mut end_pos = start_pos;
    
    for (i, ch) in text[start_pos..].char_indices() {
        let actual_pos = start_pos + i;
        
        if escape_next {
            escape_next = false;
            continue;
        }
        
        match ch {
            '\\' if in_string => escape_next = true,
            '"' => in_string = !in_string,
            '{' if !in_string => {
                brace_count += 1;
            },
            '}' if !in_string => {
                brace_count -= 1;
                if brace_count == 0 {
                    end_pos = actual_pos + 1; // Include the closing brace
                    break;
                }
            },
            _ => {}
        }
    }
    
    if brace_count != 0 {
        return Err(GeminiApiError::StructureParsing("Unbalanced braces in JSON".to_string()));
    }
    
    Ok(text[start_pos..end_pos].to_string())
}

/// Calls the Gemini API to parse a DOCX file directly.
///
/// # Arguments
/// * `http_client` - A reqwest::Client instance.
/// * `docx_bytes` - The DOCX file content as bytes.
/// * `filename` - The original filename for context.
///
/// # Returns
/// * `Ok(ParsedScript)` containing the structured data parsed by the AI.
/// * `Err(GeminiApiError)` if any step fails.
pub async fn call_gemini_for_docx_parsing(
    http_client: &Client,
    docx_bytes: &[u8],
    filename: &str,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;
    let api_url = env::var(GEMINI_API_URL_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_URL_VAR.to_string()))?;

    // Upload the DOCX file first
    let uploaded_file = upload_docx_to_gemini(http_client, docx_bytes, filename).await?;

    // Wait for file processing if needed
    // TODO: Add polling logic for file state if required
    
    // Create prompt that specifically asks for page number information
    let enhanced_prompt = format!(
        "Analyze this theater script DOCX file and extract its structure. Pay special attention to page breaks and page numbers in the original document. {}",
        SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", "the uploaded DOCX file")
    );

    // Configure for JSON output with enhanced prompt
    let generation_config = GenerationConfig {
        response_mime_type: "application/json".to_string(),
        response_schema: None, // TEMPORARILY DISABLE SCHEMA to test if it's causing the issue
        max_output_tokens: Some(32768), // Increase to maximum supported by Gemini 1.5 Flash (32K tokens) to prevent truncation
    };

    let request_payload = GeminiRequest {
        contents: vec![Content {
            parts: vec![
                Part::FileData { 
                    file_data: FileData {
                        mime_type: uploaded_file.mime_type,
                        file_uri: uploaded_file.uri,
                    }
                },
                Part::Text { text: enhanced_prompt },
            ],
        }],
        generation_config: Some(generation_config),
    };

    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)]) // API key as query parameter
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| {
            eprintln!("Detailed Reqwest Error: {:?}", e);
            if e.is_timeout() {
                eprintln!("Error Type: Request Timeout");
            } else if e.is_connect() {
                eprintln!("Error Type: Connection Error");
            } else if e.is_request() {
                eprintln!("Error Type: Request Body Error");
            }
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
        .unwrap_or(model_response_text_raw);

    // Extract valid JSON from the response (handle trailing characters)
    let json_text = extract_valid_json(model_response_text)?;
    
    // Parse the response into our ParsedScript structure
    let parsed_script: ParsedScript = serde_json::from_str(&json_text)
        .map_err(|e| {
            eprintln!("JSON parsing error: {}", e);
            eprintln!("Raw response: {}", model_response_text);
            eprintln!("Extracted JSON: {}", json_text);
            GeminiApiError::StructureParsing(format!("Failed to parse JSON response: {}", e))
        })?;

    Ok(parsed_script)
}

/// Calls the Gemini API to parse the script text (legacy function for backward compatibility).
///
/// # Arguments
/// * `http_client` - A reqwest::Client instance.
/// * `script_text` - The plain text extracted from the DOCX file.
///
/// # Returns
/// * `Ok(ParsedScript)` containing the structured data parsed by the AI.
/// * `Err(GeminiApiError)` if any step fails.
pub async fn call_gemini_for_parsing(
    script_text: &str,
    http_client: &Client,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;
    let api_url = env::var(GEMINI_API_URL_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_URL_VAR.to_string()))?;

    // Format the prompt using the loaded template and the script text
    let prompt = SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", script_text);

    // Create JSON schema for structured output with page numbers
    let content_schema = Schema {
        schema_type: "object".to_string(),
        description: Some("Script content element".to_string()),
        format: None,
        nullable: None,
        enum_values: None,
        items: None,
        properties: Some({
            let mut props = HashMap::new();
            props.insert("type".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Type of content element".to_string()),
                format: None,
                nullable: None,
                enum_values: Some(vec![
                    "dialogue".to_string(),
                    "monologue".to_string(), 
                    "stage_direction".to_string(),
                    "joint_dialogue".to_string(),
                    "reading".to_string()
                ]),
                items: None,
                properties: None,
                required: None,
            });
            props.insert("page_number".to_string(), Schema {
                schema_type: "integer".to_string(),
                description: Some("Page number where this content appears".to_string()),
                format: None,
                nullable: None,
                enum_values: None,
                items: None,
                properties: None,
                required: None,
            });
            props.insert("speaker".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Speaker name for dialogue/monologue".to_string()),
                format: None,
                nullable: Some(true),
                enum_values: None,
                items: None,
                properties: None,
                required: None,
            });
            props.insert("line".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Dialogue line".to_string()),
                format: None,
                nullable: Some(true),
                enum_values: None,
                items: None,
                properties: None,
                required: None,
            });
            props.insert("description".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Stage direction description".to_string()),
                format: None,
                nullable: Some(true),
                enum_values: None,
                items: None,
                properties: None,
                required: None,
            });
            props
        }),
        required: Some(vec!["type".to_string(), "page_number".to_string()]),
    };

    let response_schema = Schema {
        schema_type: "object".to_string(),
        description: Some("Parsed theater script".to_string()),
        format: None,
        nullable: None,
        enum_values: None,
        items: None,
        properties: Some({
            let mut props = HashMap::new();
            props.insert("title".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Script title".to_string()),
                format: None,
                nullable: None,
                enum_values: None,
                items: None,
                properties: None,
                required: None,
            });
            props.insert("sections".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Script sections".to_string()),
                format: None,
                nullable: None,
                enum_values: None,
                items: Some(Box::new(Schema {
                    schema_type: "object".to_string(),
                    description: Some("Script section".to_string()),
                    format: None,
                    nullable: None,
                    enum_values: None,
                    items: None,
                    properties: Some({
                        let mut section_props = HashMap::new();
                        section_props.insert("content".to_string(), Schema {
                            schema_type: "array".to_string(),
                            description: Some("Section content".to_string()),
                            format: None,
                            nullable: None,
                            enum_values: None,
                            items: Some(Box::new(content_schema.clone())),
                            properties: None,
                            required: None,
                        });
                        section_props
                    }),
                    required: Some(vec!["content".to_string()]),
                })),
                properties: None,
                required: None,
            });
            props
        }),
        required: Some(vec!["title".to_string(), "sections".to_string()]),
    };

    // Configure for JSON output with structured schema
    let generation_config = GenerationConfig {
        response_mime_type: "application/json".to_string(),
        response_schema: Some(response_schema),
        max_output_tokens: Some(32768), // Increase to maximum supported by Gemini 1.5 Flash (32K tokens) to prevent truncation
    };

    let request_payload = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part::Text { text: prompt }], // Send the formatted prompt
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
        .unwrap_or(model_response_text_raw);

    // Extract valid JSON from the response (handle trailing characters)
    let json_text = extract_valid_json(model_response_text)?;
    
    // Parse the response into our ParsedScript structure
    let parsed_script: ParsedScript = serde_json::from_str(&json_text)
        .map_err(|e| {
            eprintln!("JSON parsing error: {}", e);
            eprintln!("Raw response: {}", model_response_text);
            eprintln!("Extracted JSON: {}", json_text);
            GeminiApiError::StructureParsing(format!("Failed to parse JSON response: {}", e))
        })?;

    Ok(parsed_script)
} 