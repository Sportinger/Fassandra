use backend::models::block::Block;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use sqlx::PgPool;
use backend::error::AppError;

#[tokio::test]
async fn test_create_and_get_block() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up blocks, scripts, and users tables
    sqlx::query!("DELETE FROM blocks").execute(&pool).await?;
    sqlx::query!("DELETE FROM edits").execute(&pool).await?;
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    
    let now = Utc::now();
    let block_id = Uuid::new_v4();
    let script_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let block_type = "text".to_string();
    let content = format!("Test Block {}", now.timestamp_nanos_opt().unwrap_or(0));
    let created_at = now;
    
    // First create a user to satisfy the foreign key constraint
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
    
    // Then create a script, linking to the user
    sqlx::query!(
        "INSERT INTO scripts (id, title, created_by, created_at) VALUES ($1, $2, $3, $4)",
        script_id,
        "Test Script",
        user_id,
        created_at
    )
    .execute(&pool)
    .await?;
    
    // Insert block
    let block = sqlx::query_as_unchecked!(
        Block,
        "INSERT INTO blocks (id, script_id, block_type, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, script_id, block_type, content, created_at",
        block_id,
        script_id,
        &block_type,
        &content,
        created_at
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(block.content, content);
    // Fetch block
    let block2 = sqlx::query_as_unchecked!(
        Block,
        "SELECT id, script_id, block_type, content, created_at FROM blocks WHERE id = $1",
        block_id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(block2.id, block_id);
    Ok(())
} 