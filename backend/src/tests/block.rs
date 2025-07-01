use std::env;
use sqlx::{PgPool, Executor};
use uuid::Uuid;
use chrono::Utc;
use chrono::Utc;
use backend::models::block::Block;
use backend::error::AppError;

#[tokio::test]
async fn test_create_and_get_block() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up blocks table
    sqlx::query!("DELETE FROM blocks").execute(&pool).await?;
    let script_id = Uuid::new_v4();
    let block_type = "text".to_string();
    let content = format!("Test Block {}", Utc::now().timestamp_nanos());
    let block = sqlx::query_as!(
        Block,
        "INSERT INTO blocks (id, script_id, block_type, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        Uuid::new_v4(),
        script_id,
        block_type,
        content,
        Some(Utc::now())
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(block.content, content);
    // Fetch blocks for script
    let blocks: Vec<Block> = sqlx::query_as!(
        Block,
        "SELECT * FROM blocks WHERE script_id = $1",
        script_id
    )
    .fetch_all(&pool)
    .await?;
    assert!(!blocks.is_empty());
    Ok(())
}

#[tokio::test]
async fn test_update_and_delete_block() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up blocks table
    sqlx::query!("DELETE FROM blocks").execute(&pool).await?;
    let script_id = Uuid::new_v4();
    let block_type = "text".to_string();
    let content = format!("Block to Update {}", Utc::now().timestamp_nanos());
    let mut block = sqlx::query_as!(
        Block,
        "INSERT INTO blocks (id, script_id, block_type, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        Uuid::new_v4(),
        script_id,
        block_type,
        content,
        Some(Utc::now())
    )
    .fetch_one(&pool)
    .await?;
    // Update content
    let new_content = format!("Updated Content {}", Utc::now().timestamp_nanos());
    block = sqlx::query_as!(
        Block,
        "UPDATE blocks SET content = $1 WHERE id = $2 RETURNING *",
        new_content,
        block.id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(block.content, new_content);
    // Delete block
    let rows = sqlx::query!("DELETE FROM blocks WHERE id = $1", block.id)
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 1);
    Ok(())
}

#[tokio::test]
async fn test_block_edge_cases() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Try to update non-existent block
    let result = sqlx::query_as!(
        Block,
        "UPDATE blocks SET content = $1 WHERE id = $2 RETURNING *",
        "Nope",
        Uuid::new_v4()
    )
    .fetch_optional(&pool)
    .await?;
    assert!(result.is_none());
    // Try to delete non-existent block
    let rows = sqlx::query!("DELETE FROM blocks WHERE id = $1", Uuid::new_v4())
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 0);
    Ok(())
} 