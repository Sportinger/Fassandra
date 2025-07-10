use std::time::Duration;
use anyhow::Context;
use sqlx::{PgPool, Transaction, Postgres};
use tokio::time::timeout;
use uuid::Uuid;

use crate::error::AppError;

/// Standard database timeout for all operations
pub const DB_TIMEOUT: Duration = Duration::from_secs(5);

/// 🚀 ERROR HANDLING STANDARDIZATION
/// This module provides consistent error handling patterns to eliminate the debugging nightmare
/// caused by inconsistent error conversions and information loss.

/// Database operation result type
pub type DbResult<T> = Result<T, AppError>;

/// Executes a database query with timeout and proper error handling
/// 
/// # Arguments
/// * `operation` - The database operation to execute
/// * `context` - Human-readable context for error logging
/// 
/// # Returns
/// * `DbResult<T>` - Result with proper error type preservation
pub async fn with_db_timeout<T, F, Fut>(
    operation: F,
    context: &str,
) -> DbResult<T>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    timeout(DB_TIMEOUT, operation())
        .await
        .map_err(|_| {
            tracing::error!("⏰ Database timeout after {}s: {}", DB_TIMEOUT.as_secs(), context);
            AppError::Internal(anyhow::anyhow!("Database operation timed out: {}", context))
        })?
        .map_err(|e| {
            tracing::error!("💾 Database error in {}: {}", context, e);
            AppError::from(e) // Use the From trait - preserves error type information!
        })
}

/// Executes a transaction with proper error handling and context
/// 
/// # Arguments
/// * `pool` - Database connection pool
/// * `operation` - The transaction operation to execute
/// * `context` - Human-readable context for error logging
/// 
/// # Returns
/// * `DbResult<T>` - Result with proper error type preservation
pub async fn with_transaction<T, F, Fut>(
    pool: &PgPool,
    operation: F,
    context: &str,
) -> DbResult<T>
where
    F: for<'a> FnOnce(&'a mut Transaction<'_, Postgres>) -> Fut,
    Fut: std::future::Future<Output = Result<T, AppError>>,
{
    tracing::debug!("🔄 Starting transaction: {}", context);
    
    let mut tx = pool.begin().await
        .map_err(|e| {
            tracing::error!("❌ Failed to begin transaction for {}: {}", context, e);
            AppError::from(e)
        })?;
    
    let result = operation(&mut tx).await;
    
    match result {
        Ok(value) => {
            // Only commit if the operation succeeded
            if let Err(e) = tx.commit().await {
                tracing::error!("❌ Failed to commit transaction for {}: {}", context, e);
                return Err(AppError::from(e));
            }
            tracing::debug!("✅ Transaction committed successfully: {}", context);
            Ok(value)
        }
        Err(e) => {
            tracing::error!("❌ Transaction failed for {}: {}", context, e);
            // Transaction will be automatically rolled back when dropped
            Err(e)
        }
    }
}

/// Creates a standardized "not found" error with context
/// 
/// # Arguments
/// * `resource_type` - Type of resource (e.g., "script", "block", "user")
/// * `resource_id` - ID of the resource that wasn't found
/// 
/// # Returns
/// * `AppError::NotFound` - Standardized not found error
pub fn not_found_error(resource_type: &str, resource_id: Uuid) -> AppError {
    let message = format!("{} with ID {} not found", resource_type, resource_id);
    tracing::warn!("🔍 Resource not found: {}", message);
    AppError::NotFound(message)
}

/// Creates a standardized "unauthorized" error with context
/// 
/// # Arguments
/// * `operation` - The operation that was attempted
/// * `user_id` - ID of the user attempting the operation (optional)
/// 
/// # Returns
/// * `AppError::Unauthorized` - Standardized unauthorized error
pub fn unauthorized_error(operation: &str, user_id: Option<Uuid>) -> AppError {
    let message = match user_id {
        Some(id) => format!("User {} not authorized for operation: {}", id, operation),
        None => format!("Not authorized for operation: {}", operation),
    };
    tracing::warn!("🚫 Unauthorized access: {}", message);
    AppError::Unauthorized(message)
}

/// Creates a standardized "validation" error with context
/// 
/// # Arguments
/// * `field` - The field that failed validation
/// * `issue` - Description of the validation issue
/// 
/// # Returns
/// * `AppError::BadRequest` - Standardized validation error
pub fn validation_error(field: &str, issue: &str) -> AppError {
    let message = format!("Validation failed for {}: {}", field, issue);
    tracing::warn!("📝 Validation error: {}", message);
    AppError::BadRequest(message)
}

/// Creates a standardized "conflict" error with context
/// 
/// # Arguments
/// * `resource_type` - Type of resource that has a conflict
/// * `conflict_reason` - Reason for the conflict
/// 
/// # Returns
/// * `AppError::Conflict` - Standardized conflict error
pub fn conflict_error(resource_type: &str, conflict_reason: &str) -> AppError {
    let message = format!("{} conflict: {}", resource_type, conflict_reason);
    tracing::warn!("⚡ Resource conflict: {}", message);
    AppError::Conflict(message)
}

/// Creates standardized internal error with context and original error
/// 
/// # Arguments
/// * `operation` - The operation that failed
/// * `original_error` - The original error (will be preserved)
/// 
/// # Returns
/// * `AppError::Internal` - Standardized internal error with context
pub fn internal_error_with_context(operation: &str, original_error: impl Into<anyhow::Error>) -> AppError {
    let error = original_error.into().context(format!("Failed during: {}", operation));
    tracing::error!("💥 Internal error in {}: {}", operation, error);
    AppError::Internal(error)
}

/// Converts a serde JSON error to a standardized app error
/// 
/// # Arguments
/// * `error` - The serde JSON error
/// * `context` - Context about what was being serialized/deserialized
/// 
/// # Returns
/// * `AppError::Internal` - Standardized internal error
pub fn json_error_with_context(error: serde_json::Error, context: &str) -> AppError {
    let message = format!("JSON serialization/deserialization failed during {}: {}", context, error);
    tracing::error!("📄 JSON error: {}", message);
    AppError::Internal(anyhow::anyhow!(message))
}

/// Executes a database query that should return exactly one row
/// 
/// # Arguments
/// * `operation` - The database operation to execute
/// * `context` - Context about what resource should be found
/// * `resource_type` - Type of resource for error messages
/// * `resource_id` - ID of the resource for error messages
/// 
/// # Returns
/// * `DbResult<T>` - The single result or appropriate error
pub async fn fetch_one_with_context<T, F, Fut>(
    operation: F,
    context: &str,
    resource_type: &str,
    resource_id: Uuid,
) -> DbResult<T>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    with_db_timeout(operation, context).await
        .map_err(|e| match e {
            AppError::Db(sqlx::Error::RowNotFound) => not_found_error(resource_type, resource_id),
            other => other,
        })
}

/// Executes a database query that may return zero or one rows
/// 
/// # Arguments
/// * `operation` - The database operation to execute
/// * `context` - Context about what resource might be found
/// 
/// # Returns
/// * `DbResult<Option<T>>` - The optional result or error
pub async fn fetch_optional_with_context<T, F, Fut>(
    operation: F,
    context: &str,
) -> DbResult<Option<T>>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Option<T>, sqlx::Error>>,
{
    with_db_timeout(operation, context).await
}

/// Executes a database query that returns multiple rows
/// 
/// # Arguments
/// * `operation` - The database operation to execute
/// * `context` - Context about what resources are being fetched
/// 
/// # Returns
/// * `DbResult<Vec<T>>` - The results or error
pub async fn fetch_all_with_context<T, F, Fut>(
    operation: F,
    context: &str,
) -> DbResult<Vec<T>>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Vec<T>, sqlx::Error>>,
{
    with_db_timeout(operation, context).await
}

/// Executes a database operation that doesn't return data (INSERT, UPDATE, DELETE)
/// 
/// # Arguments
/// * `operation` - The database operation to execute
/// * `context` - Context about what operation is being performed
/// 
/// # Returns
/// * `DbResult<()>` - Success or error
pub async fn execute_with_context<F, Fut>(
    operation: F,
    context: &str,
) -> DbResult<()>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<sqlx::postgres::PgQueryResult, sqlx::Error>>,
{
    with_db_timeout(operation, context).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_not_found_error() {
        let script_id = Uuid::new_v4();
        let error = not_found_error("script", script_id);
        
        match error {
            AppError::NotFound(msg) => {
                assert!(msg.contains("script"));
                assert!(msg.contains(&script_id.to_string()));
            }
            _ => panic!("Expected NotFound error"),
        }
    }

    #[test]
    fn test_unauthorized_error() {
        let user_id = Uuid::new_v4();
        let error = unauthorized_error("delete script", Some(user_id));
        
        match error {
            AppError::Unauthorized(msg) => {
                assert!(msg.contains("delete script"));
                assert!(msg.contains(&user_id.to_string()));
            }
            _ => panic!("Expected Unauthorized error"),
        }
    }

    #[test]
    fn test_validation_error() {
        let error = validation_error("email", "invalid format");
        
        match error {
            AppError::BadRequest(msg) => {
                assert!(msg.contains("email"));
                assert!(msg.contains("invalid format"));
            }
            _ => panic!("Expected BadRequest error"),
        }
    }
} 