//! Handles communication with the Google Gemini API for script analysis.
//! 
//! This module provides PDF-based script analysis using Gemini's structured output capabilities.
//! Supports direct PDF upload to Gemini Files API with enforced JSON schema responses.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use thiserror::Error;
use crate::analysis::structs::Script as ParsedScript;
use std::collections::HashMap;

// --- Configuration ---

const GEMINI_API_URL_VAR: &str = "GEMINI_API_URL";
const GEMINI_API_KEY_VAR: &str = "GEMINI_API_KEY";
const GEMINI_FILES_API_URL: &str = "https://generativelanguage.googleapis.com/upload/v1beta/files";

// --- Structs for Gemini Structured Output Schema ---

#[derive(Serialize, Debug, Clone)]
struct Schema {
    #[serde(rename = "type")]
    schema_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nullable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "enum")]
    enum_values: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    items: Option<Box<Schema>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    properties: Option<HashMap<String, Schema>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    required: Option<Vec<String>>,
}

// --- Structs for API Interaction ---

#[derive(Serialize, Debug)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Serialize, Debug)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
    #[serde(rename = "responseSchema")]
    response_schema: Schema,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: i32,
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
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: ContentResponse,
}

#[derive(Deserialize, Debug)]
struct ContentResponse {
    parts: Vec<PartResponse>,
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
    #[error("HTTP request failed: {0}")]
    HttpRequest(String),
    #[error("API returned an error: Status {status}")]
    ApiError {
        status: reqwest::StatusCode,
    },
    #[error("Failed to deserialize API response: {0}")]
    Deserialization(String),
    #[error("No valid response candidate found")]
    NoCandidate,
    #[error("Failed to parse structured script from API response")]
    StructureParsing(String),
    #[error("File upload failed: {0}")]
    FileUpload(String),
    #[error("File processing timeout")]
    FileProcessingTimeout,
}

impl From<reqwest::Error> for GeminiApiError {
    fn from(err: reqwest::Error) -> Self {
        tracing::error!("HTTP request error: {}", err);
        
        let sanitized_message = if err.is_timeout() {
            "Request timeout"
        } else if err.is_connect() {
            "Connection failed"
        } else if err.is_request() {
            "Invalid request"
        } else if err.is_decode() {
            "Response decode error"
        } else if err.is_redirect() {
            "Redirect error"
        } else {
            "HTTP request failed"
        };
        
        GeminiApiError::HttpRequest(sanitized_message.to_string())
    }
}

impl From<serde_json::Error> for GeminiApiError {
    fn from(err: serde_json::Error) -> Self {
        tracing::error!("JSON deserialization error: {}", err);
        GeminiApiError::Deserialization("JSON format error".to_string())
    }
}

// --- Schema Definitions ---

/// Creates a comprehensive JSON schema for theater script analysis
fn create_script_analysis_schema() -> Schema {
    // Content element schema for individual script components
    let content_element_schema = Schema {
        schema_type: "object".to_string(),
        description: Some("Individual script content element".to_string()),
        properties: Some({
            let mut props = HashMap::new();
            
            // Required type field
            props.insert("type".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Type of script element".to_string()),
                enum_values: Some(vec![
                    "dialogue".to_string(),
                    "monologue".to_string(),
                    "stage_direction".to_string(),
                    "joint_dialogue".to_string(),
                    "reading".to_string(),
                ]),
                ..Default::default()
            });
            
            // Page number (required)
            props.insert("page_number".to_string(), Schema {
                schema_type: "integer".to_string(),
                description: Some("Page number in original PDF".to_string()),
                ..Default::default()
            });
            
            // Scene number (optional)
            props.insert("scene_number".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Scene or section number (e.g., '1', '2', 'PROLOG', 'ACT I')".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Scene title (optional)
            props.insert("scene_title".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Scene title or name if available".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Speaker (for dialogue/monologue)
            props.insert("speaker".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Character or speaker name".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Line (for dialogue)
            props.insert("line".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Spoken dialogue text".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Lines (for monologue)
            props.insert("lines".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Array of spoken text lines".to_string()),
                items: Some(Box::new(Schema {
                    schema_type: "string".to_string(),
                    ..Default::default()
                })),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Description (for stage directions)
            props.insert("description".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Stage direction description".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Speakers (for joint dialogue)
            props.insert("speakers".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Multiple speakers for joint dialogue".to_string()),
                items: Some(Box::new(Schema {
                    schema_type: "string".to_string(),
                    ..Default::default()
                })),
                nullable: Some(true),
                ..Default::default()
            });
            
            // Reading text and metadata
            props.insert("reading_text".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Text being read aloud".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("source".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Source of the reading".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("language".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Language if different from main script".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props
        }),
        required: Some(vec!["type".to_string(), "page_number".to_string()]),
        ..Default::default()
    };
    
    // Section schema
    let section_schema = Schema {
        schema_type: "object".to_string(),
        description: Some("Script section (act, scene, etc.)".to_string()),
        properties: Some({
            let mut props = HashMap::new();
            
            props.insert("section_number".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Section number or identifier".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("title".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Section title".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("participants".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Characters appearing in this section".to_string()),
                items: Some(Box::new(Schema {
                    schema_type: "string".to_string(),
                    ..Default::default()
                })),
                ..Default::default()
            });
            
            props.insert("setting_note".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Setting or location description".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("content".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Content elements in this section".to_string()),
                items: Some(Box::new(content_element_schema)),
                ..Default::default()
            });
            
            props
        }),
        required: Some(vec!["content".to_string()]),
        ..Default::default()
    };
    
    // Main script schema
    Schema {
        schema_type: "object".to_string(),
        description: Some("Complete theater script analysis".to_string()),
        properties: Some({
            let mut props = HashMap::new();
            
            props.insert("title".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Main script title".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("subtitle".to_string(), Schema {
                schema_type: "string".to_string(),
                description: Some("Script subtitle".to_string()),
                nullable: Some(true),
                ..Default::default()
            });
            
            props.insert("adaptation_by".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Authors or adaptors".to_string()),
                items: Some(Box::new(Schema {
                    schema_type: "string".to_string(),
                    ..Default::default()
                })),
                ..Default::default()
            });
            
            props.insert("sections".to_string(), Schema {
                schema_type: "array".to_string(),
                description: Some("Script sections".to_string()),
                items: Some(Box::new(section_schema)),
                ..Default::default()
            });
            
            props
        }),
        required: Some(vec![
            "title".to_string(),
            "adaptation_by".to_string(),
            "sections".to_string()
        ]),
        ..Default::default()
    }
}

impl Default for Schema {
    fn default() -> Self {
        Schema {
            schema_type: "string".to_string(),
            description: None,
            format: None,
            nullable: None,
            enum_values: None,
            items: None,
            properties: None,
            required: None,
        }
    }
}

// --- API Functions ---

/// Upload a PDF file to Gemini Files API for processing
pub async fn upload_pdf_to_gemini(
    http_client: &Client,
    pdf_bytes: &[u8],
    filename: &str,
) -> Result<UploadedFile, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;

    tracing::info!("Uploading PDF to Gemini: {} ({} bytes)", filename, pdf_bytes.len());

    // Step 1: Initiate resumable upload for PDF
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
        .header("X-Goog-Upload-Header-Content-Length", pdf_bytes.len().to_string())
        .header("X-Goog-Upload-Header-Content-Type", "application/pdf")
        .header("Content-Type", "application/json")
        .json(&metadata)
        .send()
        .await?;

    if !initiate_response.status().is_success() {
        let status = initiate_response.status();
        let body = initiate_response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        tracing::error!("Upload initiation failed with status: {}, body: {}", status, body);
        return Err(GeminiApiError::ApiError { status });
    }

    // Extract upload URL from response headers
    let upload_url = initiate_response
        .headers()
        .get("x-goog-upload-url")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| GeminiApiError::FileUpload("No upload URL in response headers".to_string()))?;

    // Step 2: Upload the PDF file content
    let upload_response = http_client
        .put(upload_url)
        .header("Content-Length", pdf_bytes.len().to_string())
        .header("X-Goog-Upload-Offset", "0")
        .header("X-Goog-Upload-Command", "upload, finalize")
        .body(pdf_bytes.to_vec())
        .send()
        .await?;

    if !upload_response.status().is_success() {
        let status = upload_response.status();
        let body = upload_response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        tracing::error!("File upload failed with status: {}, body: {}", status, body);
        return Err(GeminiApiError::ApiError { status });
    }

    let upload_result: FileUploadResponse = upload_response.json().await?;
    tracing::info!("Successfully uploaded PDF to Gemini: {}", upload_result.file.uri);
    
    Ok(upload_result.file)
}

/// Wait for file to be processed by Gemini
async fn wait_for_file_processing(
    http_client: &Client,
    file_name: &str,
    max_wait_seconds: u64,
) -> Result<(), GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;
    
    let file_info_url = format!("https://generativelanguage.googleapis.com/v1beta/{}", file_name);
    let start_time = std::time::Instant::now();
    
    loop {
        if start_time.elapsed().as_secs() > max_wait_seconds {
            return Err(GeminiApiError::FileProcessingTimeout);
        }
        
        let response = http_client
            .get(&file_info_url)
            .query(&[("key", &api_key)])
            .send()
            .await?;
            
        if response.status().is_success() {
            let file_info: serde_json::Value = response.json().await?;
            if let Some(state) = file_info.get("state").and_then(|s| s.as_str()) {
                match state {
                    "ACTIVE" => {
                        tracing::info!("File processing complete: {}", file_name);
                        return Ok(());
                    }
                    "PROCESSING" => {
                        tracing::debug!("File still processing: {}", file_name);
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        continue;
                    }
                    "FAILED" => {
                        return Err(GeminiApiError::FileUpload("File processing failed".to_string()));
                    }
                    _ => {
                        tracing::warn!("Unknown file state: {}", state);
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        continue;
                    }
                }
            }
        }
        
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
}

/// Analyze a PDF theater script using Gemini with structured output
pub async fn analyze_pdf_script(
    http_client: &Client,
    pdf_bytes: &[u8],
    filename: &str,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_KEY_VAR.to_string()))?;
    let api_url = env::var(GEMINI_API_URL_VAR)
        .map_err(|_| GeminiApiError::MissingEnvVar(GEMINI_API_URL_VAR.to_string()))?;

    tracing::info!("Starting PDF script analysis for: {}", filename);

    // Upload PDF to Gemini
    let uploaded_file = upload_pdf_to_gemini(http_client, pdf_bytes, filename).await?;
    
    // Wait for file processing
    wait_for_file_processing(http_client, &uploaded_file.name, 120).await?;

    // Create analysis prompt
    let analysis_prompt = format!(
        "Analyze this theater script PDF and extract its complete structure. 

CRITICAL REQUIREMENTS:
- Extract ALL dialogue text, not just speaker names
- Include accurate page numbers from the PDF
- Identify all speakers, scenes, and stage directions
- Extract scene numbers and titles from stage directions (e.g., '1/ PROLOG', '2/ DER TOD')
- Preserve the original order and structure
- For dialogue: include the full spoken text
- For stage directions: capture complete descriptions AND extract scene info
- Scene numbers and titles should be extracted precisely

SCENE EXTRACTION RULES:
- When you see patterns like '1/ PROLOG', '2/ DER TOD', 'ACT I', 'SCENE 2', extract:
  - scene_number: '1', '2', 'ACT I', 'SCENE 2'
  - scene_title: 'PROLOG', 'DER TOD', etc.
- Apply scene_number and scene_title to ALL content elements within that scene
- Continue using the same scene info until a new scene marker appears

The PDF contains a theater script. Please provide a comprehensive analysis with:
1. Title and subtitle
2. All sections (acts, scenes) with proper numbering
3. Complete dialogue with speaker names and full text
4. Stage directions with descriptions AND scene markers
5. Accurate page numbers for all elements
6. Scene numbers and titles for all content elements

Filename: {}",
        filename
    );

    // Configure structured output
    let generation_config = GenerationConfig {
        response_mime_type: "application/json".to_string(),
        response_schema: create_script_analysis_schema(),
        max_output_tokens: 32768, // Maximum tokens for comprehensive analysis
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
                Part::Text { text: analysis_prompt },
            ],
        }],
        generation_config,
    };

    tracing::info!("Sending PDF analysis request to Gemini API");
    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)])
        .json(&request_payload)
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        tracing::error!("Gemini API request failed with status: {}, body: {}", status, body);
        return Err(GeminiApiError::ApiError { status });
    }

    let response_body: GeminiResponse = response.json().await?;

    let model_response_text = response_body
        .candidates
        .get(0)
        .and_then(|c| c.content.parts.get(0))
        .map(|p| p.text.trim())
        .ok_or(GeminiApiError::NoCandidate)?;

    tracing::info!("Received response from Gemini API ({} chars)", model_response_text.len());
    tracing::debug!("Gemini response preview: {}", &model_response_text[..std::cmp::min(500, model_response_text.len())]);

    // Parse structured JSON response directly (no need for cleaning since we enforced schema)
    let parsed_script: ParsedScript = serde_json::from_str(model_response_text)
        .map_err(|e| {
            tracing::error!("Failed to parse structured JSON response: {}", e);
            tracing::error!("Response content: {}", model_response_text);
            GeminiApiError::StructureParsing("Structured output parsing failed".to_string())
        })?;

    tracing::info!("Successfully parsed script with {} sections", parsed_script.sections.len());
    Ok(parsed_script)
} 