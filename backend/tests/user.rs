use backend::models::user::User;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use sqlx::PgPool;
use backend::error::AppError;

#[tokio::test]
async fn test_update_and_delete_user() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up scripts and users table
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    let now = Utc::now();
    let email = format!("user{}@example.com", now.timestamp_nanos_opt().unwrap_or(0));
    let username = format!("user{}", now.timestamp_nanos_opt().unwrap_or(0));
    let password_hash = "password123".to_string();
    let role = "user".to_string();
    let created_at = now;
    // Create user
    let mut user = sqlx::query_as!(
        User,
        "INSERT INTO users (id, email, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        Uuid::new_v4(),
        &email,
        &username,
        &password_hash,
        &role,
        created_at
    )
    .fetch_one(&pool)
    .await?;
    // Update user
    let new_email = format!("updated{}@example.com", Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let new_role = "admin".to_string();
    user = sqlx::query_as!(
        User,
        "UPDATE users SET email = $1, role = $2 WHERE id = $3 RETURNING *",
        &new_email,
        &new_role,
        user.id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(user.email, new_email);
    assert_eq!(user.role, new_role);
    // Delete user
    let rows = sqlx::query!("DELETE FROM users WHERE id = $1", user.id)
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 1);
    // Delete non-existent user
    let rows = sqlx::query!("DELETE FROM users WHERE id = $1", Uuid::new_v4())
        .execute(&pool)
        .await?;
    assert_eq!(rows.rows_affected(), 0);
    Ok(())
} 