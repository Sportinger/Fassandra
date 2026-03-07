use serde::{Deserialize, Serialize};

/// Configuration for the Anthropic API client
#[derive(Debug, Clone)]
pub struct AnthropicConfig {
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
    pub rate_limit_delay_ms: u64,
}

/// Request body for the Messages API
#[derive(Debug, Serialize)]
pub struct MessageRequest {
    pub model: String,
    pub max_tokens: u32,
    pub messages: Vec<Message>,
}

/// A message in the conversation
#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// Response from the Messages API
#[derive(Debug, Deserialize)]
pub struct MessageResponse {
    pub id: String,
    pub content: Vec<ContentBlock>,
    pub usage: Usage,
}

/// A content block in the response
#[derive(Debug, Deserialize)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub r#type: String,
    pub text: String,
}

/// Token usage information
#[derive(Debug, Deserialize, Clone)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// Parsed response containing JSON content and usage info
#[derive(Debug)]
pub struct ParsedResponse {
    pub json_content: serde_json::Value,
    pub usage: Usage,
}

/// Response from chunk parsing with continuation info
#[derive(Debug)]
pub struct ChunkResponse {
    pub content: Vec<serde_json::Value>,
    pub last_scene_number: usize,
    pub last_speaker: Option<String>,
    pub usage: Usage,
}
