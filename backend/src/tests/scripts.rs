use std::env;
use sqlx::{PgPool, Executor};
use uuid::Uuid;
use chrono::Utc;
use chrono::Utc;
use backend::models::script::Script;
use backend::error::AppError;

#[tokio::test]
async fn test_create_and_get_script() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up scripts table
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    let user_id = Uuid::new_v4();
    let title = format!("Test Script {}", Utc::now().timestamp_nanos());
    let script = sqlx::query_as!(
        Script,
        "INSERT INTO scripts (id, title, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
        Uuid::new_v4(),
        title,
        Some(user_id),
        Some(Utc::now())
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(script.title, title);
    // Fetch scripts for user
    let scripts: Vec<Script> = sqlx::query_as!(
        Script,
        "SELECT * FROM scripts WHERE created_by = $1",
        Some(user_id)
    )
    .fetch_all(&pool)
    .await?;
    assert!(!scripts.is_empty());
    Ok(())
}

#[tokio::test]
async fn test_update_and_delete_script() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up scripts table
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    let user_id = Uuid::new_v4();
    let title = format!("Script to Update {}", Utc::now().timestamp_nanos());
    let mut script = sqlx::query_as!(
        Script,
        "INSERT INTO scripts (id, title, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
        Uuid::new_v4(),
        title,
        Some(user_id),
        Some(Utc::now())
    )
    .fetch_one(&pool)
    .await?;
    // Update title
    let new_title = format!("Updated Title {}", Utc::now().timestamp_nanos());
    script = sqlx::query_as!(
        Script,
        "UPDATE scripts SET title = $1 WHERE id = $2 RETURNING *",
        new_title,
        script.id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(script.title, new_title);
    // Delete script
    let rows = sqlx::query!("DELETE FROM scripts WHERE id = $1", script.id)
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 1);
    Ok(())
}

#[tokio::test]
async fn test_script_edge_cases() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Try to update non-existent script
    let result = sqlx::query_as!(
        Script,
        "UPDATE scripts SET title = $1 WHERE id = $2 RETURNING *",
        "Nope",
        Uuid::new_v4()
    )
    .fetch_optional(&pool)
    .await?;
    assert!(result.is_none());
    // Try to delete non-existent script
    let rows = sqlx::query!("DELETE FROM scripts WHERE id = $1", Uuid::new_v4())
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 0);
    Ok(())
} 