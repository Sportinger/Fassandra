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
            AppError::Unauthorized(e) => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized".to_string(),
                Some(vec![e]),
            ),
            AppError::Forbidden(e) => (
                StatusCode::FORBIDDEN,
                "Forbidden".to_string(),
                Some(vec![e]),
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                "Conflict".to_string(),
                Some(vec![msg]),
            ),
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
            AppError::BadRequest(e) => (
                StatusCode::BAD_REQUEST,
                "Bad request".to_string(),
                Some(vec![e]),
            ),
            AppError::NotFound(e) => (
                StatusCode::NOT_FOUND,
                "Not found".to_string(),
                Some(vec![e]),
            ),
            AppError::TooManyRequests(msg) => (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many requests".to_string(),
                Some(vec![msg]),
            ),
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