use super::errors::AnthropicError;
use super::types::*;
use std::time::Duration;

/// Client for interacting with the Anthropic API
pub struct AnthropicClient {
    http_client: reqwest::Client,
    api_key: String,
    model: String,
    max_tokens: u32,
    rate_limit_delay_ms: u64,
}

impl AnthropicClient {
    /// Create a new Anthropic API client
    pub fn new(config: AnthropicConfig) -> Result<Self, AnthropicError> {
        if config.api_key.is_empty() {
            return Err(AnthropicError::ConfigError("API key is empty".into()));
        }

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(180)) // 3 minutes for long processing
            .build()?;

        Ok(Self {
            http_client,
            api_key: config.api_key,
            model: config.model,
            max_tokens: config.max_tokens,
            rate_limit_delay_ms: config.rate_limit_delay_ms,
        })
    }

    /// Parse a full script text into JSON format
    pub async fn parse_text(
        &self,
        prompt: &str,
        text: &str,
    ) -> Result<ParsedResponse, AnthropicError> {
        let full_prompt = format!(
            "{}\n\n---\n\nHere is the script text to parse:\n\n```\n{}\n```\n\nParse this script and return ONLY the JSON object, no explanations or markdown code blocks.",
            prompt, text
        );

        let response = self.send_message(&full_prompt).await?;
        let json_content = self.extract_json(&response)?;

        Ok(ParsedResponse {
            json_content,
            usage: response.usage,
        })
    }

    /// Parse a chunk of script text with context from previous chunks
    pub async fn parse_chunk(
        &self,
        chunk_text: &str,
        prompt_template: &str,
        context: Option<&str>,
        previous_scene_number: usize,
        previous_speaker: Option<&str>,
    ) -> Result<ChunkResponse, AnthropicError> {
        // Build prompt with template substitution
        let has_context = context.is_some();
        let context_str = context.unwrap_or("");
        let mut prompt = prompt_template.to_string();

        // Handle conditional sections
        prompt = prompt.replace("{{#if has_context}}", if has_context { "" } else { "<!--" });
        prompt = prompt.replace("{{/if}}", if has_context { "" } else { "-->" });

        // Substitute variables
        prompt = prompt.replace("{{context}}", context_str);
        prompt = prompt.replace("{{previous_scene_number}}", &previous_scene_number.to_string());
        prompt = prompt.replace("{{previous_speaker}}", previous_speaker.unwrap_or("UNKNOWN"));
        prompt = prompt.replace("{{next_scene_number}}", &(previous_scene_number + 1).to_string());
        prompt = prompt.replace("{{text}}", chunk_text);

        let response = self.send_message(&prompt).await?;
        let json_content = self.extract_json(&response)?;

        // Extract content array and chunk_info
        let content = json_content["content"]
            .as_array()
            .ok_or_else(|| AnthropicError::MissingField("content".into()))?
            .clone();

        let chunk_info = &json_content["chunk_info"];
        let last_scene_number = chunk_info["last_scene_number"]
            .as_u64()
            .unwrap_or(previous_scene_number as u64) as usize;
        let last_speaker = chunk_info["last_speaker"]
            .as_str()
            .map(|s| s.to_string());

        Ok(ChunkResponse {
            content,
            last_scene_number,
            last_speaker,
            usage: response.usage,
        })
    }

    /// Send a message to the Anthropic API
    async fn send_message(&self, prompt: &str) -> Result<MessageResponse, AnthropicError> {
        let request = MessageRequest {
            model: self.model.clone(),
            max_tokens: self.max_tokens,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = self
            .http_client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
            .send()
            .await?;

        let status = response.status();

        // Handle rate limiting
        if status == 429 {
            let retry_after_ms = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .map(|s| s * 1000)
                .unwrap_or(5000);

            return Err(AnthropicError::RateLimitExceeded { retry_after_ms });
        }

        // Handle other errors
        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".into());
            return Err(AnthropicError::ApiError {
                status: status.as_u16(),
                message: error_body,
            });
        }

        let message_response: MessageResponse = response.json().await?;
        Ok(message_response)
    }

    /// Extract JSON from API response text (handles markdown code blocks)
    fn extract_json(&self, response: &MessageResponse) -> Result<serde_json::Value, AnthropicError> {
        let text = response
            .content
            .first()
            .ok_or_else(|| AnthropicError::MissingField("content[0]".into()))?
            .text
            .as_str();

        // Try to extract JSON from markdown code blocks or raw JSON
        extract_json_from_response(text)
    }

    /// Apply rate limiting delay between requests
    pub async fn apply_rate_limit(&self) {
        if self.rate_limit_delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(self.rate_limit_delay_ms)).await;
        }
    }
}

/// Extract JSON from Claude's response text
/// Handles markdown code blocks and raw JSON
fn extract_json_from_response(text: &str) -> Result<serde_json::Value, AnthropicError> {
    let trimmed = text.trim();

    // If it starts with {, it's already JSON
    if trimmed.starts_with('{') {
        return Ok(serde_json::from_str(trimmed)?);
    }

    // Try to extract from markdown code block
    if let Some(start) = trimmed.find("```json") {
        let after_marker = &trimmed[start + 7..];
        if let Some(end) = after_marker.find("```") {
            let json_str = after_marker[..end].trim();
            return Ok(serde_json::from_str(json_str)?);
        }
    }

    // Try generic code block
    if let Some(start) = trimmed.find("```") {
        let after_marker = &trimmed[start + 3..];
        // Skip language identifier if present
        let content_start = after_marker.find('\n').unwrap_or(0) + 1;
        let content = &after_marker[content_start..];
        if let Some(end) = content.find("```") {
            let json_str = content[..end].trim();
            return Ok(serde_json::from_str(json_str)?);
        }
    }

    // Try to find JSON object in the response
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            let json_str = &trimmed[start..=end];
            return Ok(serde_json::from_str(json_str)?);
        }
    }

    Err(AnthropicError::MissingField(
        "Could not extract JSON from response".into()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let config = AnthropicConfig {
            api_key: "".to_string(),
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            rate_limit_delay_ms: 2000,
        };

        assert!(AnthropicClient::new(config).is_err());
    }

    #[test]
    fn test_extract_json_from_markdown() {
        let text = "```json\n{\"test\": \"value\"}\n```";
        let result = extract_json_from_response(text).unwrap();
        assert_eq!(result["test"], "value");
    }

    #[test]
    fn test_extract_json_raw() {
        let text = "{\"test\": \"value\"}";
        let result = extract_json_from_response(text).unwrap();
        assert_eq!(result["test"], "value");
    }
}
