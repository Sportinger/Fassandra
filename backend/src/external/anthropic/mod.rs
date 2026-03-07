//! Anthropic API client for Claude integration
//!
//! This module provides a direct HTTP client for the Anthropic Messages API,
//! replacing the previous Claude CLI subprocess approach. It offers better
//! control over rate limiting, token tracking, and error handling.

pub mod client;
pub mod errors;
pub mod types;

pub use client::AnthropicClient;
pub use errors::AnthropicError;
pub use types::{AnthropicConfig, ChunkResponse, ParsedResponse, Usage};
