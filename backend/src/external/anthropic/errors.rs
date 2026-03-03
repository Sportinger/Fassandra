use thiserror::Error;
use crate::error::AppError;
use anyhow::anyhow;

/// Errors that can occur when interacting with the Anthropic API
#[derive(Error, Debug)]
pub enum AnthropicError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("API error (status {status}): {message}")]
    ApiError { status: u16, message: String },

    #[error("Rate limit exceeded (retry after {retry_after_ms}ms)")]
    RateLimitExceeded { retry_after_ms: u64 },

    #[error("Invalid JSON response: {0}")]
    JsonParseError(#[from] serde_json::Error),

    #[error("Missing expected field: {0}")]
    MissingField(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

/// Convert AnthropicError to AppError for HTTP responses
impl From<AnthropicError> for AppError {
    fn from(err: AnthropicError) -> Self {
        match err {
            AnthropicError::RateLimitExceeded { retry_after_ms } => {
                AppError::TooManyRequests(format!(
                    "Rate limit exceeded, retry after {}ms",
                    retry_after_ms
                ))
            }
            AnthropicError::ApiError { status: 401, .. } => {
                AppError::Internal(anyhow!("Anthropic API authentication failed"))
            }
            AnthropicError::ApiError { status, message } => {
                AppError::Internal(anyhow!(
                    "Anthropic API error (status {}): {}",
                    status,
                    message
                ))
            }
            _ => AppError::Internal(anyhow!("Anthropic API error: {}", err)),
        }
    }
}
