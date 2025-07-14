use regex::Regex;
use std::sync::LazyLock;
use tokio::time::{timeout, Duration};
use tracing::{debug, warn, error};
use uuid::Uuid;
use std::sync::Arc;
use sqlx::PgPool;
use html_escape;

// 🔒 SECURITY: ReDoS-resistant regex patterns for HTML parsing
static PARAGRAPH_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<p([^>]{0,500})>(.*?)</p>").expect("Invalid paragraph regex")
});

static DIV_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"<div([^>]{0,500})data-type="([^"]{1,50})"([^>]{0,500})>(.*?)</div>"#).expect("Invalid div regex")
});

pub struct HtmlParserService {
    pool: Arc<PgPool>,
}

impl HtmlParserService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Fetches content snapshot from database
    pub async fn fetch_content_snapshot(&self, script_id: Uuid) -> Result<Option<(String, Option<String>)>, anyhow::Error> {
        debug!("Fetching content snapshot for script_id: {}", script_id);
        
        let snapshot_result = sqlx::query!(
            "SELECT content_snapshot, snapshot_format FROM script_snapshots_meta WHERE script_id = $1 AND content_snapshot IS NOT NULL",
            script_id
        )
        .fetch_optional(self.pool.as_ref())
        .await;

        match snapshot_result {
            Ok(Some(snapshot)) => {
                if let Some(content) = snapshot.content_snapshot {
                    if !content.trim().is_empty() {
                        debug!("Found content snapshot for script_id: {} ({} chars)", script_id, content.len());
                        return Ok(Some((content, snapshot.snapshot_format)));
                    }
                }
                debug!("Content snapshot is empty for script_id: {}", script_id);
                Ok(None)
            }
            Ok(None) => {
                debug!("No content snapshot available for script_id: {}", script_id);
                Ok(None)
            }
            Err(e) => {
                error!("Failed to fetch content snapshot for script_id {}: {}", script_id, e);
                Err(anyhow::anyhow!("Failed to fetch content snapshot: {}", e))
            }
        }
    }

    /// Parses HTML content into structured blocks with page numbers
    pub async fn parse_html_to_blocks(&self, html_content: &str, script_id: Uuid) -> Result<Vec<(String, String, i32)>, anyhow::Error> {
        // 🔒 SECURITY: Prevent ReDoS by limiting input size
        const MAX_HTML_SIZE: usize = 1_000_000; // 1MB limit
        if html_content.len() > MAX_HTML_SIZE {
            return Err(anyhow::Error::msg("HTML content too large - potential ReDoS attack"));
        }

        debug!("Parsing HTML content for script_id: {} ({} chars)", script_id, html_content.len());
        
        // 🔒 SECURITY: Timeout wrapper for regex operations
        let parsing_result = timeout(Duration::from_secs(10), async {
            self.parse_html_to_blocks_internal(html_content, script_id).await
        }).await;

        match parsing_result {
            Ok(result) => result,
            Err(_) => Err(anyhow::Error::msg("HTML parsing timed out - potential ReDoS attack")),
        }
    }

    /// Internal HTML parsing implementation
    async fn parse_html_to_blocks_internal(&self, html_content: &str, script_id: Uuid) -> Result<Vec<(String, String, i32)>, anyhow::Error> {
        let mut blocks = Vec::new();
        let mut current_page = 1;
        
        // First, look for structured Pessoa blocks (dialogue, stage directions, etc.)
        for cap in DIV_REGEX.captures_iter(html_content) {
            let attributes = cap.get(1).map_or("", |m| m.as_str());
            let block_type = cap.get(2).map_or("paragraph", |m| m.as_str());
            let content_html = cap.get(4).map_or("", |m| m.as_str());
            
            // Extract page number from data-page attribute
            let page_number = self.extract_attribute_value(attributes, "data-page")
                .and_then(|p| p.parse::<i32>().ok())
                .unwrap_or(current_page);
            
            // Clean HTML content
            let clean_content = self.remove_html_tags_simple(content_html);
            
            if !clean_content.trim().is_empty() {
                // Create structured content based on block type
                let structured_content = self.create_structured_content(block_type, attributes, &clean_content)?;
                blocks.push((block_type.to_string(), structured_content, page_number));
                current_page = page_number; // Update current page for subsequent blocks
            }
        }
        
        // Then process regular paragraphs that aren't structured Pessoa blocks
        for cap in PARAGRAPH_REGEX.captures_iter(html_content) {
            let attributes = cap.get(1).map_or("", |m| m.as_str());
            let content_html = cap.get(2).map_or("", |m| m.as_str());
            
            // Skip if this paragraph is already processed as a structured block
            if content_html.contains("data-type=") {
                continue;
            }
            
            // Extract page number from data-page attribute
            let page_number = self.extract_attribute_value(attributes, "data-page")
                .and_then(|p| p.parse::<i32>().ok())
                .unwrap_or(current_page);
            
            let clean_content = self.remove_html_tags_simple(content_html);
            
            if !clean_content.trim().is_empty() {
                // Detect content type heuristically
                let (block_type, final_content) = self.detect_content_type(&clean_content)?;
                blocks.push((block_type, final_content, page_number));
                current_page = page_number; // Update current page for subsequent blocks
            }
        }
        
        // If no blocks were parsed, create a default paragraph
        if blocks.is_empty() {
            let clean_content = self.remove_html_tags_simple(html_content);
            if !clean_content.trim().is_empty() {
                let content_json = serde_json::json!(clean_content.trim()).to_string();
                blocks.push(("paragraph".to_string(), content_json, 1));
            }
        }
        
        debug!("Parsed {} blocks from HTML for script_id: {}", blocks.len(), script_id);
        Ok(blocks)
    }

    /// Creates structured content based on block type
    fn create_structured_content(&self, block_type: &str, attributes: &str, clean_content: &str) -> Result<String, anyhow::Error> {
        let structured_content = match block_type {
            "dialogue-block" | "dialogue" => {
                // Try to extract speaker from attributes
                let speaker = self.extract_attribute_value(attributes, "data-speaker")
                    .unwrap_or_else(|| "Unknown Speaker".to_string());
                serde_json::json!({
                    "speaker": speaker,
                    "line": clean_content.trim()
                }).to_string()
            },
            "stage_direction" => {
                serde_json::json!({
                    "description": clean_content.trim()
                }).to_string()
            },
            _ => {
                serde_json::json!(clean_content.trim()).to_string()
            }
        };
        
        Ok(structured_content)
    }

    /// Detects content type heuristically for paragraphs
    fn detect_content_type(&self, clean_content: &str) -> Result<(String, String), anyhow::Error> {
        let trimmed = clean_content.trim();
        
        if trimmed.starts_with('(') && trimmed.ends_with(')') {
            // Likely a stage direction
            let description = trimmed.trim_start_matches('(').trim_end_matches(')');
            let content = serde_json::json!({
                "description": description
            }).to_string();
            Ok(("stage_direction".to_string(), content))
        } else if trimmed.contains(':') && trimmed.split(':').count() == 2 {
            // Likely dialogue (Speaker: Line)
            let parts: Vec<&str> = trimmed.split(':').collect();
            let speaker = parts[0].trim();
            let line = parts[1].trim();
            let content = serde_json::json!({
                "speaker": speaker,
                "line": line
            }).to_string();
            Ok(("dialogue".to_string(), content))
        } else {
            // Default to paragraph
            let content = serde_json::json!(trimmed).to_string();
            Ok(("paragraph".to_string(), content))
        }
    }

    /// 🔒 SECURITY: Safe HTML sanitization function
    fn remove_html_tags_simple(&self, html: &str) -> String {
        // Remove HTML tags safely
        let tag_regex = Regex::new(r"<[^>]*>").unwrap();
        let without_tags = tag_regex.replace_all(html, "");
        
        // 🔒 SECURITY: Use proper HTML entity decoding
        let decoded = html_escape::decode_html_entities(&without_tags);
        
        // Clean up whitespace and normalize
        decoded
            .replace("&nbsp;", " ")
            .trim()
            .to_string()
    }

    /// 🔒 SECURITY: Safe attribute value extraction
    fn extract_attribute_value(&self, attributes: &str, attr_name: &str) -> Option<String> {
        // 🔒 SECURITY: Validate attribute name
        if !attr_name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return None;
        }
        
        // Simple string parsing to avoid regex issues
        let search_pattern = format!("{}=\"", attr_name);
        if let Some(start) = attributes.find(&search_pattern) {
            let start_pos = start + search_pattern.len();
            if let Some(end) = attributes[start_pos..].find('"') {
                let value = &attributes[start_pos..start_pos + end];
                
                // 🔒 SECURITY: Sanitize the extracted value
                let sanitized = html_escape::encode_text(value);
                
                return Some(sanitized.to_string());
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_html_parsing_basic() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let service = HtmlParserService::new(pool);
        
        let html = r#"<p>This is a paragraph</p><div data-type="dialogue" data-speaker="John">Hello world</div>"#;
        let result = service.parse_html_to_blocks(html, uuid::Uuid::new_v4()).await.unwrap();
        
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].0, "paragraph");
        assert_eq!(result[1].0, "dialogue");
    }

    #[tokio::test]
    async fn test_security_html_size_limit() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let service = HtmlParserService::new(pool);
        
        let large_html = "x".repeat(2_000_000); // 2MB
        let result = service.parse_html_to_blocks(&large_html, uuid::Uuid::new_v4()).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too large"));
    }
} 