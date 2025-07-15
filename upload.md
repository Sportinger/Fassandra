# 📄 Script Upload, Parsing & Database Writing - Complete Technical Documentation

## 🎯 Overview

This document provides a comprehensive guide to how script uploading, AI-powered parsing, and database writing works in the Pessoa theater collaboration platform. The system transforms uploaded PDF files into structured, collaborative theater scripts through Gemini's intelligent structured output capabilities with precise page number preservation.

## 🔄 Complete Upload Workflow

```mermaid
flowchart TD
    A[User selects PDF file] --> B[Frontend validation]
    B --> C[Multipart form upload to /api/s/upload]
    C --> D[Backend PDF validation]
    D --> E[Upload PDF to Gemini Files API]
    E --> F[Gemini structured output analysis]
    F --> G[Structured JSON with page numbers]
    G --> H[Database transaction start]
    H --> I[Create script record]
    I --> J[Create blocks from structured content]
    J --> K[Commit transaction]
    K --> L[Return parsed script data]
    L --> M[Frontend creates script from parsed data]
    M --> N[Final script available in editor]
```

## 📁 System Architecture

### 🏗️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **File Upload** | Axum Multipart | Handle PDF file uploads |
| **PDF Processing** | Gemini Files API | Direct PDF analysis with structured output |
| **AI Analysis** | Google Gemini API with JSON Schema | Intelligent script structure analysis |
| **Database** | PostgreSQL + SQLx | Persistent storage |
| **Real-time Sync** | YJS + WebSocket | Collaborative editing |
| **Frontend** | React + TypeScript | User interface |

### 🔗 Service Architecture

```
Frontend (React) 
    ↓ HTTP POST /api/s/upload (PDF)
Backend (Rust/Axum)
    ↓ ScriptApplicationService
PDF Upload (Gemini Files API)
    ↓ Direct PDF processing
AI Analysis (Gemini Structured Output)
    ↓ JSON with enforced schema
Database Writing (PostgreSQL)
    ↓ Scripts & Blocks tables
Collaborative Editor (YJS)
```

## 🚀 Stage 1: Frontend Upload Process

### 📤 File Selection & Validation

```typescript
// frontend/src/components/ScriptUploader.tsx
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        setSelectedFile(event.target.files[0]);
        setStatusMessage(null);
    }
};
```

### 🔄 Background Upload with Progress Tracking

The frontend provides real-time progress feedback through 11 detailed stages:

```typescript
// frontend/src/components/ScriptList.tsx - performRealBackgroundUpload()
const uploadStages = [
    { progress: 5, message: 'Validating file format...' },
    { progress: 10, message: 'Uploading filename.docx (2.3 MB)...' },
    { progress: 20, message: 'Transferring file to server...' },
    { progress: 35, message: 'File uploaded successfully. Starting content analysis...' },
    { progress: 45, message: 'Extracting text from Word document...' },
    { progress: 55, message: 'Analyzing script structure and dialogue...' },
    { progress: 65, message: 'Identifying speakers and characters...' },
    { progress: 75, message: 'Analysis complete! Found content, creating script...' },
    { progress: 85, message: 'Creating script database entry...' },
    { progress: 95, message: 'Finalizing script structure and metadata...' },
    { progress: 100, message: 'Script created successfully! Click to open.' }
];
```

### 📡 API Request Format

```typescript
// Upload to backend with multipart form data
const formData = new FormData();
formData.append('file', selectedFile); // Key must be 'file' to match backend expectation

const uploadResponse = await fetch('/api/s/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
});
```

## 🖥️ Stage 2: Backend Upload Handler

### 🔧 Route Configuration

```rust
// backend/src/handlers/script.rs
pub fn script_routes(rate_limiter: Arc<RateLimiter>) -> Router<ScriptServices> {
    Router::new()
        .route("/upload", post(upload_and_parse_script)
            .layer(middleware::from_fn_with_state(rate_limiter.clone(), rate_limit_middleware)))
        // ... other routes
}
```

### 📥 Multipart Processing

```rust
// backend/src/handlers/script.rs - upload_and_parse_script()
async fn upload_and_parse_script(
    State(services): State<ScriptServices>,
    mut multipart: Multipart,
) -> Result<Json<ParsedScript>, impl IntoResponse> {
    // Extract file from multipart form
    while let Some(field) = multipart.next_field().await? {
        if field.name() == Some("file") {
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field.content_type().unwrap_or("").to_string();
            let data = field.bytes().await?;

            // Delegate to application service for processing
            let parsed_script = services.script_service
                .upload_and_parse_script(data.to_vec(), &filename, &content_type)
                .await?;

            return Ok(Json(parsed_script));
        }
    }
    Err((StatusCode::BAD_REQUEST, Json(json!({"error": "No file provided"}))))
}
```

## 📄 Stage 3: DOCX Text Extraction

### 🔍 File Validation

```rust
// backend/src/application/script_application_service.rs
impl ScriptApplicationService {
    fn validate_file_upload(file_data: &[u8], filename: &str, content_type: &str) -> Result<(), AppError> {
        // File size validation (50MB max)
        if file_data.len() > 50 * 1024 * 1024 {
            return Err(AppError::BadRequest("File too large".into()));
        }

        // File type validation
        if !filename.to_lowercase().ends_with(".docx") {
            return Err(AppError::BadRequest("Only .docx files are supported".into()));
        }

        // MIME type validation
        let expected_types = [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream"
        ];
        if !expected_types.contains(&content_type) {
            return Err(AppError::BadRequest("Invalid file type".into()));
        }

        Ok(())
    }
}
```

### 📝 Enhanced Text Extraction with Page Information

```rust
// backend/src/analysis/parser.rs
pub fn extract_text_with_pages_from_docx(docx_bytes: &[u8]) -> Result<Vec<TextWithPage>, AnalysisError> {
    let docx_file = read_docx(docx_bytes)?;
    let mut text_elements = Vec::new();
    let mut current_page = 1;

    for child in docx_file.document.children {
        if let DocumentChild::Paragraph(paragraph) = child {
            let mut paragraph_text = String::new();
            
            // Extract text from paragraph
            for content in paragraph.children {
                if let ParagraphChild::Run(run) = content {
                    for run_child in run.children {
                        match run_child {
                            RunChild::Text(text_node) => {
                                paragraph_text.push_str(&text_node.text);
                            }
                            RunChild::Break(br) => {
                                // Page break detection
                                if matches!(br.break_type, Some(BreakType::Page)) {
                                    current_page += 1;
                                }
                            }
                        }
                    }
                }
            }

            if !paragraph_text.trim().is_empty() {
                text_elements.push(TextWithPage {
                    text: paragraph_text,
                    page_number: current_page,
                });
            }
        }
    }

    Ok(text_elements)
}
```

### 🔖 Page Marker Enhancement

```rust
// backend/src/analysis/parser.rs
pub fn text_with_pages_to_string_with_page_markers(text_with_pages: &[TextWithPage]) -> String {
    let mut result = String::new();
    let mut last_page = 0;

    for item in text_with_pages {
        // Insert page markers when page changes
        if item.page_number != last_page {
            if last_page > 0 {
                result.push_str(&format!("\n[PAGE_END:{}]\n", last_page));
            }
            result.push_str(&format!("[PAGE_START:{}]\n", item.page_number));
            last_page = item.page_number;
        }
        
        result.push_str(&item.text);
        result.push('\n');
    }

    if last_page > 0 {
        result.push_str(&format!("\n[PAGE_END:{}]\n", last_page));
    }

    result
}
```

## 🤖 Stage 4: AI Analysis with Gemini API

### 🔑 API Configuration

```rust
// backend/src/external/gemini_api.rs
const GEMINI_API_KEY_VAR: &str = "GEMINI_API_KEY";
const GEMINI_API_URL_VAR: &str = "GEMINI_API_URL";

// Environment configuration
// GEMINI_API_KEY=AIzaSyCGkJudo4e0YEgZZKQ8xXTPBOTB3cQCY_g
// GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent
```

### 📋 Structured Analysis Prompt

```rust
// backend/src/prompts/script_analysis.prompt
const SCRIPT_ANALYSIS_PROMPT_TEMPLATE: &str = r#"
You are an AI assistant specialized in analyzing theater scripts...

🚨 CRITICAL REQUIREMENT: You MUST extract the FULL DIALOGUE TEXT content, not just speaker names!

CRITICAL JSON STRUCTURE - USE EXACTLY THIS FORMAT:
{
  "title": "Main Title",
  "subtitle": "Subtitle if present", 
  "adaptation_by": ["Author Name 1", "Author Name 2"],
  "sections": [
    {
      "section_number": "1" or 1,
      "title": "Section Title", 
      "participants": ["Character1", "Character2"],
      "setting_note": "Setting description if present",
      "content": [
        {
          "type": "dialogue",
          "speaker": "CHARACTER_NAME",
          "line": "The spoken text",
          "page_number": 1
        },
        {
          "type": "stage_direction",
          "description": "Stage direction text",
          "page_number": 1
        }
      ]
    }
  ]
}

Script Text to Analyze:
---
{}
---
"#;
```

### 🔄 API Request Processing

```rust
// backend/src/external/gemini_api.rs
pub async fn call_gemini_for_parsing(
    script_text: &str,
    http_client: &Client,
) -> Result<ParsedScript, GeminiApiError> {
    let api_key = env::var(GEMINI_API_KEY_VAR)?;
    let api_url = env::var(GEMINI_API_URL_VAR)?;

    // Format the prompt with the enhanced text
    let prompt = SCRIPT_ANALYSIS_PROMPT_TEMPLATE.replace("{}", script_text);

    let request_payload = GeminiRequest {
        contents: vec![Content {
            parts: vec![Part::Text { text: prompt }],
        }],
        generation_config: Some(GenerationConfig {
            response_mime_type: "application/json".to_string(),
            max_output_tokens: Some(32768), // 32K tokens max for complex documents
            response_schema: None, // Flexible parsing
        }),
    };

    // Send request with timeout protection
    let response = http_client
        .post(&api_url)
        .query(&[("key", api_key)])
        .json(&request_payload)
        .timeout(Duration::from_secs(300)) // 5 minute timeout
        .send()
        .await?;

    // Parse and validate response
    let response_body: GeminiResponse = response.json().await?;
    let response_text = response_body
        .candidates
        .get(0)
        .and_then(|c| c.content.parts.get(0))
        .map(|p| p.text.trim())
        .ok_or(GeminiApiError::NoCandidate)?;

    // Clean and extract JSON
    let clean_json = response_text
        .strip_prefix("```json")
        .unwrap_or(response_text)
        .strip_suffix("```")
        .unwrap_or(response_text)
        .trim();

    let parsed_script: ParsedScript = serde_json::from_str(clean_json)?;
    Ok(parsed_script)
}
```

## 📊 Stage 5: Data Structures

### 🎭 Parsed Script Structure

```rust
// backend/src/analysis/structs.rs
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)]
pub struct Script {
    pub id: Option<String>,
    pub source_filename: Option<String>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub adaptation_by: Vec<String>,
    pub sections: Vec<Section>,
    pub extra: HashMap<String, Value>, // Catch unexpected AI fields
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)]
pub struct Section {
    pub id: Option<String>,
    pub section_number: Option<Value>, // AI might return string or number
    pub title: Option<String>,
    pub participants: Vec<String>,
    pub setting_note: Option<String>,
    pub content: Vec<ContentElement>,
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentElement {
    Dialogue(DialogueElement),
    Monologue(MonologueElement),
    StageDirection(StageDirectionElement),
    JointDialogue(JointDialogueElement),
    Reading(ReadingElement),
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct DialogueElement {
    pub speaker: String,
    pub line: String, // CRITICAL: Contains actual spoken text
    pub page_number: i32,
}
```

### 🗄️ Database Models

```rust
// backend/src/models/script.rs
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Script {
    pub id: Uuid,
    pub title: String,
    pub created_by: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub is_public: Option<bool>,
    pub thumbnail: Option<String>,
}

// backend/src/models/block.rs  
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Block {
    pub id: Uuid,
    pub script_id: Uuid,
    pub block_type: String, // "dialogue", "stage_direction", "monologue", etc.
    pub content: String,    // JSON serialized content element
    pub created_at: Option<DateTime<Utc>>,
    pub block_order: i32,   // Ordering within script
    pub page_number: i32,   // Original page from DOCX
    pub metadata: Option<serde_json::Value>,
}
```

## 💾 Stage 6: Database Writing Process

### 🔄 Transaction-Safe Script Creation

```rust
// backend/src/application/script_application_service.rs
async fn create_script_from_parsed_internal(
    &self,
    parsed_script: &ParsedScript,
    user_id: Uuid,
) -> Result<Uuid, AppError> {
    // Start database transaction for atomicity
    let mut tx = self.pool.begin().await?;

    // 1. Create the script entry
    let new_script_id = Uuid::new_v4();
    let script_title = Self::extract_main_title(
        parsed_script.title.as_deref().unwrap_or("Untitled Script")
    );
    let created_at = chrono::Utc::now();

    sqlx::query("INSERT INTO scripts (id, title, created_by, created_at, is_public) VALUES ($1, $2, $3, $4, $5)")
        .bind(new_script_id)
        .bind(script_title)
        .bind(user_id)
        .bind(created_at)
        .bind(false) // Default to private
        .execute(&mut *tx)
        .await?;

    // 2. Create blocks from content elements
    for (section_index, section) in parsed_script.sections.iter().enumerate() {
        for (element_index, element) in section.content.iter().enumerate() {
            let (block_type, content_json, page_number) = match element {
                ContentElement::Dialogue(d) => {
                    ("dialogue", serde_json::to_string(d)?, d.page_number)
                },
                ContentElement::Monologue(m) => {
                    ("monologue", serde_json::to_string(m)?, m.page_number)
                },
                ContentElement::StageDirection(sd) => {
                    ("stage_direction", serde_json::to_string(sd)?, sd.page_number)
                },
                ContentElement::JointDialogue(jd) => {
                    ("joint_dialogue", serde_json::to_string(jd)?, jd.page_number)
                },
                ContentElement::Reading(r) => {
                    ("reading", serde_json::to_string(r)?, r.page_number)
                },
                ContentElement::Unknown => {
                    ("unknown", "{}".to_string(), 1)
                },
            };

            let block_id = Uuid::new_v4();
            let block_order = (section_index * 1000 + element_index) as i32;

            sqlx::query("INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order, page_number) VALUES ($1, $2, $3, $4, $5, $6, $7)")
                .bind(block_id)
                .bind(new_script_id)
                .bind(block_type)
                .bind(content_json)
                .bind(created_at)
                .bind(block_order)
                .bind(page_number)
                .execute(&mut *tx)
                .await?;
        }
    }

    // 3. Commit transaction
    tx.commit().await?;
    Ok(new_script_id)
}
```

### 🏗️ Database Schema

```sql
-- backend/migrations/0001_create_tables.sql
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    thumbnail TEXT
);

CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON serialized content element
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    block_order INTEGER NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    metadata JSONB
);
```

## 🔄 Stage 7: Frontend Script Creation

### 📡 Create Script from Parsed Data

```typescript
// frontend/src/api.ts
export const createScriptFromParsed = async (parsedScriptData: ParsedScriptData): Promise<string> => {
    return apiService.post('/api/s/create_script_from_parsed', { 
        parsed_script: parsedScriptData 
    });
};
```

### 🎯 Handler Processing

```rust
// backend/src/handlers/script.rs
async fn create_script_from_parsed_handler(
    State(services): State<ScriptServices>,
    AuthUser{user_id}: AuthUser,
    Json(payload): Json<CreateScriptFromParsedPayload>,
) -> Result<Json<Uuid>, AppError> {
    let script_id = services.script_service
        .create_script_from_parsed(&payload.parsed_script, user_id)
        .await?;

    Ok(Json(script_id))
}

#[derive(serde::Deserialize, Debug)]
pub struct CreateScriptFromParsedPayload {
    parsed_script: ParsedScript,
}
```

## 🔒 Security & Error Handling

### 🛡️ Security Measures

1. **File Validation**
   - Size limits (50MB max)
   - MIME type verification
   - Extension validation (.docx only)

2. **API Security**
   - JWT authentication required
   - Rate limiting on upload endpoints
   - Environment variable protection for API keys

3. **Error Sanitization**
   ```rust
   // backend/src/external/gemini_api.rs
   impl From<reqwest::Error> for GeminiApiError {
       fn from(err: reqwest::Error) -> Self {
           // Log actual error server-side
           tracing::error!("HTTP request error: {}", err);
           
           // Return sanitized error without exposing URLs/keys
           let sanitized_message = if err.is_timeout() {
               "Request timeout"
           } else {
               "HTTP request failed"
           };
           
           GeminiApiError::HttpRequest(sanitized_message.to_string())
       }
   }
   ```

### ⚠️ Error Handling Strategy

```rust
// Comprehensive error mapping for user feedback
match parsed_script_result {
    Ok(script) => Ok(Json(script)),
    Err(e) => {
        let status_code = match e {
            GeminiApiError::MissingEnvVar(_) => StatusCode::INTERNAL_SERVER_ERROR,
            GeminiApiError::HttpRequest(_) => StatusCode::BAD_GATEWAY,
            GeminiApiError::ApiError { status, .. } => status,
            GeminiApiError::Deserialization(_) => StatusCode::INTERNAL_SERVER_ERROR,
            GeminiApiError::StructureParsing(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        
        Err((status_code, Json(json!({"error": format!("Script parsing failed: {}", e)}))))
    }
}
```

## 🚀 Performance Optimizations

### ⚡ Async Processing

- **Non-blocking uploads**: Multipart processing with streaming
- **Timeout protection**: 5-minute timeout for complex documents
- **Progress tracking**: Real-time feedback to users
- **Background processing**: Upload continues while user sees progress

### 🗄️ Database Optimizations

- **Transaction batching**: Atomic script+blocks creation
- **Proper indexing**: Script ID, user ID, block order
- **Connection pooling**: Efficient database resource usage

### 🧠 AI Optimizations

- **Token management**: 32K token limit to prevent truncation
- **Structured prompts**: Precise JSON schema guidance
- **Response parsing**: Robust JSON extraction from AI responses

## 🔄 Real-time Collaboration Integration

After script creation, the system seamlessly transitions to real-time collaborative editing:

### 📡 WebSocket Connection

```typescript
// YJS WebSocket Provider for real-time sync
const provider = new WebsocketProvider(
    'wss://your-domain.com/api/collab',
    scriptId,
    ydoc,
    { params: { token: jwtToken } }
);
```

### 💾 Persistence Strategy

```rust
// backend/src/services/async_db_writer.rs
pub async fn run_async_db_writer(
    mut rx: Receiver<YjsPersistenceEvent>,
    pool: PgPool,
) {
    while let Some(event) = rx.recv().await {
        // Save YJS updates to database
        match save_yjs_update(&pool, &event).await {
            Ok(_) => {
                tracing::info!("✅ Successfully saved Yjs update for script_id: {}", event.script_id);
            }
            Err(e) => {
                tracing::error!("❌ CRITICAL: Failed to save Yjs update: {}", e);
            }
        }
    }
}
```

## 📈 Monitoring & Debugging

### 📊 Logging Strategy

```rust
// Comprehensive logging throughout the pipeline
info!(filename = %filename, "Processing script upload");
info!("Extracted {} text elements with page information", text_with_pages.len());
info!("=== TEXT SENT TO GEMINI (first 1000 chars) ===");
info!(script_id = %script_id, user_id = %user_id, "Successfully created script");
```

### 🔍 Debug Information

- **File metadata**: Size, type, original filename
- **Text extraction**: Character count, page count
- **AI analysis**: Request/response logging
- **Database operations**: Transaction timing, record counts

## 🧪 Testing Strategy

### 🔬 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_script_creation_from_parsed_data() {
        // Test script creation with mock data
    }

    #[tokio::test]
    async fn test_docx_text_extraction() {
        // Test DOCX parsing with sample files
    }
}
```

### 🎭 Integration Tests

```typescript
// frontend/src/test/scripts.test.ts
describe('Script Upload Process', () => {
    it('should upload and parse a DOCX file successfully', async () => {
        // End-to-end upload test
    });
});
```

## 📚 API Reference

### 🔗 Upload Endpoint

**POST** `/api/s/upload`

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- `Content-Type: multipart/form-data`

**Body:**
- `file`: DOCX file (max 50MB)

**Response:**
```json
{
  "title": "Script Title",
  "subtitle": "Subtitle",
  "adaptation_by": ["Author Name"],
  "sections": [
    {
      "section_number": 1,
      "title": "Act I",
      "participants": ["Character1", "Character2"],
      "content": [
        {
          "type": "dialogue",
          "speaker": "Character1",
          "line": "Hello, world!",
          "page_number": 1
        }
      ]
    }
  ]
}
```

### 🎯 Script Creation Endpoint

**POST** `/api/s/create_script_from_parsed`

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- `Content-Type: application/json`

**Body:**
```json
{
  "parsed_script": {
    "title": "Script Title",
    "sections": [...],
    ...
  }
}
```

**Response:**
```json
"script-uuid-here"
```

## 🚀 Deployment Configuration

### 🔧 Environment Variables

```bash
# AI Integration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pessoa

# Server Configuration  
BACKEND_PORT=3000
MAX_REQUEST_BODY_SIZE=52428800  # 50MB
```

### 🐳 Docker Configuration

```dockerfile
# backend/Dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/backend /usr/local/bin/backend
CMD ["backend"]
```

## 🎯 Conclusion

The Pessoa script upload system provides a robust, secure, and intelligent pipeline for transforming traditional `.docx` theater scripts into modern, collaborative documents. Through careful integration of AI analysis, structured data processing, and real-time collaboration features, the system enables theater professionals to work together seamlessly while preserving the artistic integrity of their scripts.

The multi-stage architecture ensures reliability, security, and performance while providing comprehensive error handling and monitoring capabilities. The result is a production-ready system that scales from individual playwrights to large collaborative theater productions. 