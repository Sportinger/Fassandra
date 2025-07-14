//! Error handling module for the Pessoa theater collaboration platform.
//!
//! This module provides comprehensive error handling functionality including:
//! - Custom application error types with proper HTTP status mapping
//! - Database error handling with timeout protection
//! - Validation error processing with user-friendly messages
//! - Security-focused error sanitization to prevent information leakage
//! - Standardized error patterns for consistency across the application
//!
//! # Security Features
//! - Error message sanitization to prevent sensitive data exposure
//! - Consistent error responses that don't reveal internal structure
//! - Proper logging of detailed errors for debugging while returning safe messages
//! - Database timeout protection to prevent resource exhaustion
//! - Transaction management with proper rollback handling

pub mod types;
pub mod helpers;

// Re-export the main error types and functions
pub use types::AppError;

pub use helpers::{
    DbResult, DB_TIMEOUT,
    with_db_timeout, with_transaction, 
    fetch_one_with_context, fetch_optional_with_context, 
    fetch_all_with_context, execute_with_context,
    not_found_error, unauthorized_error, validation_error, 
    conflict_error, internal_error_with_context, json_error_with_context
};