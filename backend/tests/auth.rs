use backend::models::user::User;
use backend::error::AppError;
use chrono::Utc;
use uuid::Uuid;
use std::env;
use sqlx::PgPool;

#[tokio::test]
async fn test_register_and_login() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up scripts and users table
    sqlx::query!("DELETE FROM scripts").execute(&pool).await?;
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    let now = Utc::now();
    let email = format!("testuser{}@example.com", now.timestamp_nanos_opt().unwrap_or(0));
    let username = format!("testuser{}", now.timestamp_nanos_opt().unwrap_or(0));
    let password_hash = "password123".to_string();
    let role = "user".to_string();
    let created_at = now;
    // Register user
    let user = sqlx::query_as!(
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
    assert_eq!(user.email, email);
    // Login with correct password
    let user2 = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE email = $1 AND password_hash = $2",
        &email,
        &password_hash
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(user2.email, email);
    // Login with wrong password
    let result = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE email = $1 AND password_hash = $2",
        &email,
        "wrongpassword"
    )
    .fetch_optional(&pool)
    .await?;
    assert!(result.is_none());
    // Register duplicate email
    let result = sqlx::query_as!(
        User,
        "INSERT INTO users (id, email, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        Uuid::new_v4(),
        &email,
        &username,
        &password_hash,
        &role,
        Utc::now()
    )
    .fetch_optional(&pool)
    .await;
    assert!(result.is_err());
    Ok(())
} 