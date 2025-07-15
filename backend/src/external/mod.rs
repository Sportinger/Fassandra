//! External service integrations for the Pessoa theater collaboration platform.
//!
//! This module contains integrations with external services and APIs:
//! - Google Gemini API for script analysis with structured output
//! - PDF file upload handling for direct Gemini processing
//! - AI-powered script structure recognition with JSON schema enforcement
//! - Secure API key management and request handling
//!
//! # Features
//! - Direct PDF upload to Gemini Files API
//! - Structured JSON output with enforced schema
//! - Comprehensive theater script analysis with page numbers
//! - Real-time file processing status monitoring
//! - Secure error handling and sanitization

pub mod gemini_api;

// Re-export the main external service functions
pub use gemini_api::{
    GeminiApiError,
    analyze_pdf_script,
    upload_pdf_to_gemini,
};