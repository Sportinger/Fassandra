use backend::models::script::Script;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use sqlx::PgPool;
use backend::error::AppError;

#[tokio::test]
async fn test_create_and_get_script() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up all related tables to start fresh
    sqlx::query!("DELETE FROM edits").execute(&pool).await?;
    sqlx::query!("DELETE FROM blocks").execute(&pool).await?;
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    
    let now = Utc::now();
    let script_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let title = format!("Test Script {}", now.timestamp_nanos_opt().unwrap_or(0));
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
    
    // Insert script, linking to the created user
    let script = sqlx::query_as_unchecked!(
        Script,
        "INSERT INTO scripts (id, title, created_by, created_at, is_public, thumbnail) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, created_by, created_at, is_public, thumbnail",
        script_id,
        &title,
        user_id,
        created_at,
        false, // is_public
        None::<String> // thumbnail
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(script.title, title);
    // Fetch script
    let script2 = sqlx::query_as_unchecked!(
        Script,
        "SELECT id, title, created_by, created_at, is_public, thumbnail FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(script2.id, script_id);
    Ok(())
} 