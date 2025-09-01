use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use sqlx::Error as SqlxError;
use validator::ValidationErrors;
use std::fmt;
use anyhow::Error as AnyhowError;
use axum::Error as AxumError;
use serde_json::Error as SerdeJsonError;

/// Application error type for backend operations.
///
/// Variants:
/// - `Db`: Database error (wraps sqlx::Error)
/// - `Unauthorized`: Unauthorized access
/// - `Forbidden`: Forbidden access (user authenticated but lacks permission)
/// - `Conflict`: Conflict error with a message
/// - `Validation`: Validation error (wraps validator::ValidationErrors)
/// - `Internal`: Internal server error with a message
/// - `BadRequest`: Bad request error with a message
/// - `NotFound`: Not found error with a message
/// - `TooManyRequests`: Too many requests error with a message
#[derive(Debug)]
pub enum AppError {
    Db(SqlxError),
    Unauthorized(String),
    Forbidden(String),
    Conflict(String),
    Validation(ValidationErrors),
    Internal(AnyhowError),
    BadRequest(String),
    NotFound(String),
    TooManyRequests(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Db(_) => {
                // 🔒 SECURITY: Never expose database error details in display
                // The actual error is logged separately in IntoResponse
                write!(f, "Database error")
            },
            AppError::Unauthorized(e) => write!(f, "Unauthorized: {}", e),
            AppError::Forbidden(e) => write!(f, "Forbidden: {}", e),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::Validation(_) => {
                // 🔒 SECURITY: Never expose validation details in display
                // The actual validation errors are handled separately in IntoResponse
                write!(f, "Validation error")
            },
            AppError::Internal(_) => {
                // 🔒 SECURITY: Never expose internal error details in display
                // The actual error is logged separately in IntoResponse
                write!(f, "Internal error")
            },
            AppError::BadRequest(e) => write!(f, "Bad request: {}", e),
            AppError::NotFound(e) => write!(f, "Not found: {}", e),
            AppError::TooManyRequests(msg) => write!(f, "Too many requests: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

/// Standard error response structure for API responses.
///
/// Fields:
/// - `error`: Error message string.
/// - `details`: Optional list of detailed error messages.
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    details: Option<Vec<String>>,
}

/// Extract user-friendly validation messages while filtering out internal details
fn extract_safe_validation_messages(errors: &ValidationErrors) -> Vec<String> {
    let mut messages = Vec::new();
    
    for (field, field_errors) in errors.field_errors() {
        for error in field_errors {
            if let Some(message) = &error.message {
                let message_str = message.to_string();
                
                // 🔒 SECURITY: Only return predefined safe messages, filter out internal details
                match field {
                    "password" => {
                        // For password field, provide helpful requirements message
                        if message_str.contains("Password must contain") {
                            messages.push(message_str);
                        } else if message_str.contains("Password must be at least") {
                            messages.push(message_str);
                        } else {
                            // Generic password message for any other password validation failures
                            messages.push("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)".to_string());
                        }
                    },
                    "email" => {
                        // For email field, provide helpful message
                        if message_str.contains("Invalid email") {
                            messages.push("Please enter a valid email address".to_string());
                        } else {
                            messages.push("Please enter a valid email address".to_string());
                        }
                    },
                    "username" => {
                        // For username field, provide helpful message
                        if message_str.contains("Username must be between") {
                            messages.push(message_str);
                        } else if message_str.contains("Username can only contain") {
                            messages.push("Username can only contain letters, numbers, and underscores".to_string());
                        } else {
                            messages.push("Username must be between 3 and 30 characters and contain only letters, numbers, and underscores".to_string());
                        }
                    },
                    _ => {
                        // 🔒 SECURITY: For any other fields, don't expose field names or internal details
                        messages.push("Please check your input and try again".to_string());
                    }
                }
            }
        }
    }
    
    // If no specific messages were extracted, provide generic feedback
    if messages.is_empty() {
        messages.push("Please check your input and try again".to_string());
    }
    
    // Remove duplicates
    messages.sort();
    messages.dedup();
    
    messages
}

/// 🔒 SECURITY: Sanitize error messages to prevent information leakage
fn sanitize_error_message(message: &str, error_type: &str) -> String {
    // List of safe messages that can be returned to users
    let safe_patterns = [
        "Invalid email format",
        "Invalid token format", 
        "Invalid credentials",
        // OAuth/Google-specific safe messages
        "Google client mismatch",
        "Invalid Google token",
        "Google account has no email",
        "Google email not verified",
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)",
        "Password must be at least 8 characters long",
        "Access denied",
        "Resource not found",
        "Email already exists",
        "Username already exists",
        "Session expired",
        "Too many requests",
        "File not found",
        "Invalid file format",
        "File too large",
        "Unauthorized access",
        "Permission denied",
        "Script not found",
        "User not found"
    ];
    
    // Check if the message contains only safe patterns
    for safe_pattern in &safe_patterns {
        if message.to_lowercase().contains(&safe_pattern.to_lowercase()) {
            return safe_pattern.to_string();
        }
    }
    
    // 🔒 SECURITY: Return generic message for any unsafe content
    // Log the actual message server-side for debugging
    tracing::warn!("Sanitized {} error message: {}", error_type, message);
    
    match error_type {
        "BadRequest" => "Invalid request format".to_string(),
        "NotFound" => "Resource not found".to_string(),
        "Unauthorized" => "Authentication required".to_string(),
        "Forbidden" => "Access denied".to_string(),
        "Conflict" => "Resource conflict".to_string(),
        "TooManyRequests" => "Too many requests. Please try again later".to_string(),
        _ => "Request could not be processed".to_string(),
    }
}

/// Converts an AppError into an HTTP response for Axum.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message, details) = match self {
            AppError::Db(e) => {
                // Log the actual error for debugging (server-side only)
                tracing::error!("Database error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                    None, // Never expose database details to users
                )
            },
            AppError::Unauthorized(e) => {
                let sanitized_message = sanitize_error_message(&e, "Unauthorized");
                tracing::warn!("Unauthorized access attempt: {}", e);
                (
                    StatusCode::UNAUTHORIZED,
                    "Unauthorized".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
            AppError::Forbidden(e) => {
                let sanitized_message = sanitize_error_message(&e, "Forbidden");
                tracing::warn!("Forbidden access attempt: {}", e);
                (
                    StatusCode::FORBIDDEN,
                    "Forbidden".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
            AppError::Conflict(msg) => {
                let sanitized_message = sanitize_error_message(&msg, "Conflict");
                tracing::warn!("Resource conflict: {}", msg);
                (
                    StatusCode::CONFLICT,
                    "Conflict".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
            AppError::Validation(e) => {
                // 🔒 SECURITY: Log detailed validation errors server-side but return helpful user messages
                tracing::warn!("Validation error: {:?}", e);
                
                // Extract user-friendly validation messages while filtering out internal details
                let user_messages = extract_safe_validation_messages(&e);
                
                (
                    StatusCode::BAD_REQUEST,
                    "Validation error".to_string(),
                    Some(user_messages),
                )
            },
            AppError::Internal(e) => {
                // Log the actual error for debugging (server-side only)
                tracing::error!("Internal server error: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                    None, // Never expose internal details to users
                )
            },
            AppError::BadRequest(e) => {
                let sanitized_message = sanitize_error_message(&e, "BadRequest");
                tracing::warn!("Bad request: {}", e);
                (
                    StatusCode::BAD_REQUEST,
                    "Bad request".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
            AppError::NotFound(e) => {
                let sanitized_message = sanitize_error_message(&e, "NotFound");
                tracing::debug!("Resource not found: {}", e);
                (
                    StatusCode::NOT_FOUND,
                    "Not found".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
            AppError::TooManyRequests(msg) => {
                let sanitized_message = sanitize_error_message(&msg, "TooManyRequests");
                tracing::warn!("Rate limit exceeded: {}", msg);
                (
                    StatusCode::TOO_MANY_REQUESTS,
                    "Too many requests".to_string(),
                    Some(vec![sanitized_message]),
                )
            },
        };

        let body = ErrorResponse {
            error: error_message,
            details,
        };

        (status, axum::Json(body)).into_response()
    }
}

/// Converts a sqlx::Error into an AppError::Db variant.
impl From<SqlxError> for AppError {
    fn from(err: SqlxError) -> Self {
        AppError::Db(err)
    }
}

/// Converts a validator::ValidationErrors into an AppError::Validation variant.
impl From<ValidationErrors> for AppError {
    fn from(err: ValidationErrors) -> Self {
        AppError::Validation(err)
    }
}

/// Converts an anyhow::Error into an AppError::Internal variant.
impl From<AnyhowError> for AppError {
    fn from(err: AnyhowError) -> Self {
        AppError::Internal(err)
    }
}

/// Converts an axum::Error into an AppError::Internal variant.
impl From<AxumError> for AppError {
    fn from(err: AxumError) -> Self {
        AppError::Internal(AnyhowError::new(err))
    }
}

/// Converts a serde_json::Error into an AppError::Internal variant.
impl From<SerdeJsonError> for AppError {
    fn from(err: SerdeJsonError) -> Self {
        AppError::Internal(AnyhowError::new(err))
    }
} 
