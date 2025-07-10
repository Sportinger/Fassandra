# 🤖 AI Integration

Comprehensive documentation for Pessoa's AI-powered script analysis using Google Gemini API.

## 🎯 Overview

Pessoa integrates Google's Gemini API to provide intelligent script analysis, automatically extracting dialogue, stage directions, speaker information, and structural elements from uploaded Word documents. This AI-powered feature transforms raw scripts into structured, collaborative documents.

## 🏗️ Technology Stack

| Technology | Purpose | Role |
|------------|---------|------|
| **Google Gemini API** | Large Language Model | Script analysis and structure extraction |
| **docx-rs** | Document parsing | Extract text from DOCX files |
| **Rust reqwest** | HTTP client | API communication |
| **Custom prompts** | AI instruction | Guide analysis output format |
| **JSON Schema** | Data validation | Ensure consistent AI responses |

## 📁 Integration Architecture

### 🔄 Processing Pipeline

```
DOCX Upload → Text Extraction → AI Analysis → Structure Parsing → Database Storage → Editor Loading
```

### 📊 Data Flow

```
User uploads DOCX
       ↓
Extract plain text (docx-rs)
       ↓
Send to Gemini API with structured prompt
       ↓
Receive JSON response with script structure
       ↓
Parse and validate response
       ↓
Store in database as structured script
       ↓
Load in collaborative editor
```

## 🔧 Implementation Details

### 📝 Text Extraction

```rust
/// Extract plain text from DOCX files using docx-rs
pub fn extract_text_from_docx(docx_bytes: &[u8]) -> Result<String, AnalysisError> {
    // Read DOCX structure
    let docx_file = read_docx(docx_bytes)
        .map_err(|e| AnalysisError::DocxParsing(format!("Failed to read DOCX: {}", e)))?;

    let mut text_content = String::new();
    
    // Extract text from all paragraphs
    for child in docx_file.document.children {
        if let DocumentChild::Paragraph(paragraph) = child {
            for content in paragraph.children {
                if let ParagraphChild::Run(run) = content {
                    for run_child in run.children {
                        if let RunChild::Text(text_node) = run_child {
                            text_content.push_str(&text_node.text);
                        }
                    }
                }
            }
            text_content.push('\n'); // Preserve paragraph breaks
        }
    }

    Ok(text_content.trim().to_string())
}
```

### 🧠 Gemini API Client

```rust
/// Comprehensive Gemini API integration
pub async fn call_gemini_for_parsing(
    http_client: &Client,
    script_text: &str,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var("GEMINI_API_KEY")
        .map_err(|_| GeminiApiError::MissingEnvVar("GEMINI_API_KEY".to_string()))?;
    let api_url = env::var("GEMINI_API_URL")
        .map_err(|_| GeminiApiError::MissingEnvVar("GEMINI_API_URL".to_string()))?;

    // Load and format analysis prompt
    let prompt = SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", script_text);

    let request = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part { text: prompt }],
        }],
        generation_config: Some(GenerationConfig {
            response_mime_type: "application/json".to_string(),
            max_output_tokens: Some(8192), // Prevent truncation
            response_schema: None, // Flexible parsing for better reliability
        }),
    };

    // Send request with comprehensive error handling
    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)])
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Gemini API request failed: {:?}", e);
            GeminiApiError::Reqwest(e)
        })?;

    // Check response status
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
        tracing::error!("Gemini API error: {} - {}", status, body);
        return Err(GeminiApiError::ApiError { status, body });
    }

    // Parse response
    let response_body: GeminiResponse = response.json().await
        .map_err(|e| {
            tracing::error!("Failed to parse Gemini response: {}", e);
            GeminiApiError::Deserialization(e)
        })?;

    // Extract response text
    let response_text = response_body
        .candidates
        .get(0)
        .and_then(|c| c.content.parts.get(0))
        .map(|p| p.text.trim())
        .ok_or(GeminiApiError::NoCandidate)?;

    // Clean JSON response (remove markdown formatting if present)
    let clean_json = response_text
        .strip_prefix("```json")
        .unwrap_or(response_text)
        .strip_suffix("```")
        .unwrap_or(response_text)
        .trim();

    tracing::debug!("Cleaned Gemini response: {}", &clean_json[..clean_json.len().min(200)]);

    // Parse structured response
    let parsed_script: ParsedScript = serde_json::from_str(clean_json)
        .map_err(|e| {
            tracing::error!("Failed to parse Gemini JSON: {}", e);
            tracing::error!("Raw response: {}", clean_json);
            GeminiApiError::StructureParsing(e.to_string())
        })?;

    Ok(parsed_script)
}
```

### 📋 Request/Response Types

```rust
/// Gemini API request structure
#[derive(Serialize, Debug)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    generation_config: Option<GenerationConfig>,
}

#[derive(Serialize, Debug)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
    #[serde(rename = "responseSchema")]
    response_schema: Option<Schema>,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: Option<i32>,
}

#[derive(Serialize, Debug)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Debug)]
struct Part {
    text: String,
}

/// Gemini API response structure
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
```

## 🎭 Script Analysis Prompt

### 📝 Analysis Prompt Template

```prompt
IMPORTANT: Your *only* output must be a single, valid JSON object conforming exactly to the structure described below. Do not output arrays at the root level. Do not include explanations, markdown formatting, or any text outside the single JSON object.

The desired JSON output structure MUST follow this format (matching the target Rust structs):

{
  "id": "generated-uuid",
  "source_filename": "original_filename.docx",
  "title": "Extracted Script Title",
  "subtitle": "Extracted Subtitle",
  "adaptation_by": ["Author 1", "Author 2"],
  "sections": [
    {
      "id": "generated-uuid",
      "section_number": "1",
      "title": "PROLOGUE",
      "participants": ["Speaker A", "Speaker B: Actor Name"],
      "setting_note": "Optional setting note for the section",
      "content": [
        {
          "type": "dialogue", 
          "id": "generated-uuid",
          "speaker": "SPEAKER_NAME",
          "line": "The dialogue text."
        },
        {
          "type": "stage_direction",
          "id": "generated-uuid",
          "description": "The stage direction text."
        },
        {
           "type": "monologue",
           "id": "generated-uuid",
           "speaker": "SPEAKER_NAME",
           "lines": [
             "Line 1 of monologue.",
             "Line 2 of monologue."
            ]
        },
        {
           "type": "joint_dialogue",
           "id": "generated-uuid",
           "speakers": ["Speaker 1", "Speaker 2"],
           "line": "The joint dialogue text."
        },
        {
           "type": "reading",
           "id": "generated-uuid",
           "speaker": "SPEAKER_NAME",
           "source": "Source of reading (e.g., Tagebuch)",
           "language": "Language (e.g., English)",
           "reading_text": "Text being read."
        }
      ],
      "extra": {}
    }
  ],
  "extra": {}
}

Parsing Rules:
1. Root Object: The entire output must be a single JSON object.
2. Top Level Fields: Include title, subtitle, adaptation_by (list of authors), and sections array.
3. Sections Array: Each element must have section_number, title, participants, setting_note, and content array.
4. Content Array: Each element represents a script element with a type field matching: dialogue, monologue, stage_direction, joint_dialogue, reading.
5. Field Names: Use exact field names as shown above.
6. Order Preservation: Maintain the order of elements as they appear in the source.

Script Text to Analyze:
---
{}
---

REMEMBER: Respond *ONLY* with the single, valid JSON object based *exactly* on the structure and field names described above. No explanations, no markdown, no text before or after the JSON object.
```

### 🏗️ Parsed Script Structure

```rust
/// Main script structure returned by AI analysis
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)]
pub struct Script {
    pub id: Option<String>,
    pub source_filename: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    #[serde(default)]
    pub adaptation_by: Vec<String>,
    #[serde(default)]
    pub sections: Vec<Section>,
    
    // Catch additional fields from AI
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// Script section with metadata
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)]
pub struct Section {
    pub id: Option<String>,
    pub section_number: Option<Value>, // AI might return string or number
    pub title: Option<String>,
    #[serde(default)]
    pub participants: Vec<String>,
    pub setting_note: Option<String>,
    #[serde(default)]
    pub content: Vec<ContentElement>,
    
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// Content elements within sections
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentElement {
    Dialogue(Dialogue),
    Monologue(Monologue),
    StageDirection(StageDirection),
    JointDialogue(JointDialogue),
    Reading(Reading),
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Dialogue {
    pub id: Option<String>,
    pub speaker: Option<String>,
    pub line: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Monologue {
    pub id: Option<String>,
    pub speaker: Option<String>,
    #[serde(default)]
    pub lines: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct StageDirection {
    pub id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct JointDialogue {
    pub id: Option<String>,
    pub speakers: Vec<String>,
    pub line: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Reading {
    pub id: Option<String>,
    pub speaker: Option<String>,
    pub source: Option<String>,
    pub language: Option<String>,
    pub reading_text: Option<String>,
}
```

## 🔄 Upload Pipeline

### 📤 Complete Upload Handler

```rust
/// Complete script upload and analysis pipeline
pub async fn upload_and_parse_script(
    mut multipart: Multipart,
) -> Result<Json<ParsedScript>, impl IntoResponse> {
    let http_client = Client::new();
    let mut extracted_text: Option<String> = None;
    let mut original_filename: Option<String> = None;

    // Process multipart form data
    while let Some(field) = multipart.next_field().await.map_err(|err| {
        tracing::error!("Error reading multipart field: {}", err);
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read upload data"})))
    })? {
        let name = field.name().unwrap_or("").to_string();
        let filename = field.file_name().map(String::from);
        
        if name == "scriptFile" {
            original_filename = filename.clone();
            tracing::info!("Processing uploaded file: {:?}", original_filename.as_deref().unwrap_or("unknown"));
            
            let bytes = field.bytes().await.map_err(|err| {
                tracing::error!("Failed to read file bytes: {}", err);
                (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to read file content"})))
            })?;

            tracing::info!("Read {} bytes from upload", bytes.len());

            // Extract text from DOCX
            let text = extract_text_from_docx(&bytes).map_err(|err| {
                tracing::error!("DOCX text extraction failed: {}", err);
                (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": format!("Failed to extract text from DOCX: {}", err)})))
            })?;
            
            extracted_text = Some(text);
            break;
        }
    }

    // Ensure we have extracted text
    let script_text = match extracted_text {
        Some(text) => text,
        None => {
            tracing::error!("No scriptFile field found in multipart request");
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Missing 'scriptFile' in upload"}))));
        }
    };

    // Call Gemini API for analysis
    tracing::info!("Calling Gemini API for script analysis...");
    let parsed_script_result = call_gemini_for_parsing(&http_client, &script_text).await;

    match parsed_script_result {
        Ok(mut script) => {
            tracing::info!("Successfully parsed script using Gemini AI");
            script.source_filename = original_filename;
            Ok(Json(script))
        }
        Err(e) => {
            tracing::error!("Gemini API call failed: {}", e);
            
            // Map errors to appropriate HTTP status codes
            let status_code = match e {
                GeminiApiError::MissingEnvVar(_) => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiApiError::Reqwest(_) => StatusCode::BAD_GATEWAY,
                GeminiApiError::ApiError { status, .. } => status,
                GeminiApiError::Deserialization(_) => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiApiError::NoCandidate => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiApiError::StructureParsing(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };
            
            Err((status_code, Json(json!({"error": format!("Script parsing failed: {}", e)}))))
        }
    }
}
```

### 🔄 Script Creation from Analysis

```rust
/// Create database script entry from AI analysis
pub async fn create_script_from_parsed(
    pool: &PgPool,
    parsed_script: &ParsedScript,
    user_id: Uuid,
) -> Result<Uuid, AppError> {
    let script_title = extract_main_title(
        parsed_script.title.as_deref().unwrap_or("Untitled Script")
    );
    
    // Create script entry
    let script_id = sqlx::query_scalar!(
        "INSERT INTO scripts (title, created_by, created_at) VALUES ($1, $2, $3) RETURNING id",
        script_title,
        user_id,
        Utc::now()
    )
    .fetch_one(pool)
    .await?;
    
    // Create blocks from parsed content
    let mut block_order = 0;
    for section in &parsed_script.sections {
        // Section header block
        if let Some(section_title) = &section.title {
            create_block_from_content(
                pool,
                script_id,
                "heading1",
                section_title,
                block_order,
                None,
            ).await?;
            block_order += 1;
        }
        
        // Content blocks
        for element in &section.content {
            let (block_type, content, metadata) = match element {
                ContentElement::Dialogue(dialogue) => {
                    let content = format!(
                        "{}: {}",
                        dialogue.speaker.as_deref().unwrap_or("Unknown"),
                        dialogue.line.as_deref().unwrap_or("")
                    );
                    ("dialogue", content, Some(json!({
                        "speaker": dialogue.speaker,
                        "line": dialogue.line
                    })))
                }
                
                ContentElement::StageDirection(direction) => {
                    let content = format!("({})", direction.description.as_deref().unwrap_or(""));
                    ("stage_direction", content, None)
                }
                
                ContentElement::Monologue(monologue) => {
                    let content = format!(
                        "{}: {}",
                        monologue.speaker.as_deref().unwrap_or("Unknown"),
                        monologue.lines.join(" ")
                    );
                    ("monologue", content, Some(json!({
                        "speaker": monologue.speaker,
                        "lines": monologue.lines
                    })))
                }
                
                ContentElement::JointDialogue(joint) => {
                    let content = format!(
                        "{}: {}",
                        joint.speakers.join(" & "),
                        joint.line.as_deref().unwrap_or("")
                    );
                    ("joint_dialogue", content, Some(json!({
                        "speakers": joint.speakers,
                        "line": joint.line
                    })))
                }
                
                ContentElement::Reading(reading) => {
                    let content = format!(
                        "{} reads: {}",
                        reading.speaker.as_deref().unwrap_or("Unknown"),
                        reading.reading_text.as_deref().unwrap_or("")
                    );
                    ("reading", content, Some(json!({
                        "speaker": reading.speaker,
                        "source": reading.source,
                        "language": reading.language,
                        "reading_text": reading.reading_text
                    })))
                }
                
                ContentElement::Unknown => {
                    ("paragraph", "Unknown content element".to_string(), None)
                }
            };
            
            create_block_from_content(
                pool,
                script_id,
                block_type,
                &content,
                block_order,
                metadata,
            ).await?;
            block_order += 1;
        }
    }
    
    tracing::info!("Created script {} with {} blocks", script_id, block_order);
    Ok(script_id)
}
```

## 🚨 Error Handling

### 🔍 Comprehensive Error Types

```rust
/// AI integration error types
#[derive(Error, Debug)]
pub enum GeminiApiError {
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),
    
    #[error("HTTP request error: {0}")]
    Reqwest(#[from] reqwest::Error),
    
    #[error("API returned error: Status {status}, Body: {body}")]
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

/// Document analysis error types
#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("Failed to read or parse DOCX file: {0}")]
    DocxParsing(String),
    
    #[error("IO error processing script: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Script format error: {0}")]
    Format(String),
}
```

### 🛠️ Error Recovery Strategies

```rust
/// Robust error handling with fallback strategies
pub async fn parse_script_with_fallback(
    script_text: &str,
    http_client: &Client,
) -> Result<ParsedScript, GeminiApiError> {
    // Primary attempt with full text
    match call_gemini_for_parsing(http_client, script_text).await {
        Ok(result) => return Ok(result),
        Err(e) => {
            tracing::warn!("Primary parsing failed: {}", e);
            
            // Fallback: try with truncated text if too long
            if script_text.len() > 10000 {
                let truncated = &script_text[..10000];
                tracing::info!("Retrying with truncated text ({} chars)", truncated.len());
                
                match call_gemini_for_parsing(http_client, truncated).await {
                    Ok(result) => return Ok(result),
                    Err(fallback_error) => {
                        tracing::error!("Fallback parsing also failed: {}", fallback_error);
                    }
                }
            }
            
            // Return original error if all fallbacks fail
            Err(e)
        }
    }
}
```

## 🧪 Testing AI Integration

### 🔬 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_docx_text_extraction() {
        let test_docx = include_bytes!("../tests/fixtures/test_script.docx");
        let extracted_text = extract_text_from_docx(test_docx).unwrap();
        
        assert!(extracted_text.contains("SCENE 1"));
        assert!(extracted_text.len() > 100);
    }
    
    #[tokio::test]
    async fn test_gemini_api_integration() {
        if env::var("GEMINI_API_KEY").is_err() {
            return; // Skip if no API key
        }
        
        let client = Client::new();
        let test_script = "HAMLET: To be or not to be, that is the question.";
        
        let result = call_gemini_for_parsing(&client, test_script).await;
        assert!(result.is_ok());
        
        let parsed = result.unwrap();
        assert!(parsed.sections.len() > 0);
    }
    
    #[test]
    fn test_parsed_script_serialization() {
        let script = ParsedScript {
            title: Some("Test Script".to_string()),
            sections: vec![
                Section {
                    title: Some("Act 1".to_string()),
                    content: vec![
                        ContentElement::Dialogue(Dialogue {
                            speaker: Some("Hamlet".to_string()),
                            line: Some("To be or not to be".to_string()),
                            ..Default::default()
                        })
                    ],
                    ..Default::default()
                }
            ],
            ..Default::default()
        };
        
        let json = serde_json::to_string(&script).unwrap();
        let deserialized: ParsedScript = serde_json::from_str(&json).unwrap();
        
        assert_eq!(script, deserialized);
    }
}
```

### 🎭 Integration Testing

```rust
#[tokio::test]
async fn test_full_upload_pipeline() {
    let pool = setup_test_db().await;
    let user_id = create_test_user(&pool).await;
    
    // Create test DOCX file
    let test_docx = create_test_docx_with_content(
        "Test Script\n\nHAMLET: To be or not to be, that is the question."
    );
    
    // Test upload endpoint
    let response = test_upload_script(&test_docx).await;
    assert!(response.status().is_success());
    
    let parsed_script: ParsedScript = response.json().await.unwrap();
    assert_eq!(parsed_script.title, Some("Test Script".to_string()));
    assert!(parsed_script.sections.len() > 0);
    
    // Test script creation
    let script_id = create_script_from_parsed(&pool, &parsed_script, user_id).await.unwrap();
    
    // Verify script was created correctly
    let script = get_script_with_blocks(&pool, script_id).await.unwrap();
    assert_eq!(script.title, "Test Script");
    assert!(script.blocks.len() > 0);
}
```

## ⚡ Performance Optimizations

### 🚀 Optimization Strategies

1. **Text Preprocessing**: Clean and optimize text before sending to API
2. **Chunking**: Split large scripts into manageable chunks
3. **Caching**: Cache analysis results for identical content
4. **Async Processing**: Background processing for large uploads
5. **Retry Logic**: Exponential backoff for API failures

```rust
/// Optimized text preprocessing
fn preprocess_script_text(text: &str) -> String {
    text
        // Remove excessive whitespace
        .trim()
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        // Limit length to prevent API timeouts
        .chars()
        .take(50000) // Reasonable limit for Gemini
        .collect()
}

/// Async processing for large uploads
pub async fn process_large_script_async(
    script_text: String,
    user_id: Uuid,
    pool: PgPool,
) -> Result<Uuid, AppError> {
    tokio::spawn(async move {
        let client = Client::new();
        let parsed_script = call_gemini_for_parsing(&client, &script_text).await?;
        create_script_from_parsed(&pool, &parsed_script, user_id).await
    })
    .await
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Async processing failed: {}", e)))?
}
```

## 📊 Monitoring and Analytics

### 📈 Usage Metrics

```rust
/// Track AI usage and performance
pub async fn log_ai_usage(
    script_length: usize,
    processing_time: Duration,
    success: bool,
) {
    tracing::info!(
        "AI analysis: {} chars, {} ms, success: {}",
        script_length,
        processing_time.as_millis(),
        success
    );
    
    // Could be extended to send to monitoring service
}

/// Health check for AI service
pub async fn check_ai_service_health() -> bool {
    let client = Client::new();
    let test_text = "Test script content.";
    
    match call_gemini_for_parsing(&client, test_text).await {
        Ok(_) => true,
        Err(e) => {
            tracing::error!("AI service health check failed: {}", e);
            false
        }
    }
}
```

---

## 🔗 Related Documentation

- **[System Architecture](README.md)** - High-level system overview
- **[Backend Architecture](backend.md)** - Rust backend implementation
- **[Frontend Architecture](frontend.md)** - React frontend implementation  
- **[Database Schema](database.md)** - PostgreSQL schema documentation
- **[API Reference](../api/README.md)** - Complete API documentation 