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
            AppError::Db(e) => write!(f, "Database error: {}", e),
            AppError::Unauthorized(e) => write!(f, "Unauthorized: {}", e),
            AppError::Forbidden(e) => write!(f, "Forbidden: {}", e),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::Validation(e) => write!(f, "Validation error: {}", e),
            AppError::Internal(e) => write!(f, "Internal error: {}", e),
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

/// Converts an AppError into an HTTP response for Axum.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message, details) = match self {
            AppError::Db(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error".to_string(),
                Some(vec![e.to_string()]),
            ),
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
            AppError::Validation(e) => (
                StatusCode::BAD_REQUEST,
                "Validation error".to_string(),
                Some(
                    e.field_errors()
                        .values()
                        .flat_map(|errors| errors.iter().map(|e| e.message.clone().unwrap_or_default().to_string()))
                        .collect(),
                ),
            ),
            AppError::Internal(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
                Some(vec![e.to_string()]),
            ),
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