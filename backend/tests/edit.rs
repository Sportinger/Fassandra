use backend::models::edit::Edit;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use sqlx::PgPool;
use backend::error::AppError;

#[tokio::test]
async fn test_create_and_get_edit() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up all related tables to start fresh
    sqlx::query!("DELETE FROM edits").execute(&pool).await?;
    sqlx::query!("DELETE FROM blocks").execute(&pool).await?;
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    
    let now = Utc::now();
    let edit_id = Uuid::new_v4();
    let block_id = Uuid::new_v4();
    let script_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let content = format!("Test Edit {}", now.timestamp_nanos_opt().unwrap_or(0));
    let created_at = now;
    
    // Create user first (needed for script FK constraint)
    sqlx::query!(
        "INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)",
        user_id,
        "test@example.com",
        "hash",
        "reader",
        created_at
    )
    .execute(&pool)
    .await?;
    
    // Create script (needed for block FK constraint)
    sqlx::query!(
        "INSERT INTO scripts (id, title, created_by, created_at) VALUES ($1, $2, $3, $4)",
        script_id,
        "Test Script",
        user_id,
        created_at
    )
    .execute(&pool)
    .await?;
    
    // Create block (needed for edit FK constraint)
    sqlx::query!(
        "INSERT INTO blocks (id, script_id, block_type, content, created_at) VALUES ($1, $2, $3, $4, $5)",
        block_id,
        script_id,
        "text",
        "Test Block",
        created_at
    )
    .execute(&pool)
    .await?;
    // Insert edit - use query_as_unchecked! to avoid type checks
    let edit = sqlx::query_as_unchecked!(
        Edit,
        "INSERT INTO edits (id, block_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, block_id, user_id, content, created_at",
        edit_id,
        block_id,
        user_id,
        &content,
        created_at
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(edit.content, content);
    // Fetch edit - use query_as_unchecked! to avoid type checks
    let edit2 = sqlx::query_as_unchecked!(
        Edit,
        "SELECT id, block_id, user_id, content, created_at FROM edits WHERE id = $1",
        edit_id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(edit2.id, edit_id);
    Ok(())
} 