//! External service integrations for the Pessoa theater collaboration platform.
//!
//! This module contains integrations with external services and APIs:
//! - Google Gemini API for script analysis and parsing
//! - File upload handling for DOCX documents
//! - AI-powered text extraction and structure recognition
//! - Secure API key management and request handling
//!
//! # Security Features
//! - API key protection with environment variable management
//! - Request/response sanitization to prevent data leakage
//! - Timeout handling for external service calls
//! - Error message sanitization for external API errors
//! - Secure file upload handling with validation

pub mod gemini_api;

// Re-export the main external service functions
pub use gemini_api::{
    GeminiApiError,
    call_gemini_for_parsing, call_gemini_for_docx_parsing,
    upload_docx_to_gemini
};