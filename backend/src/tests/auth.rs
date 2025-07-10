use crate::{
    models::user::{User, UserRole},
    tests::common::{setup_test_app, TestApp},
    error::AppError,
};
use axum::http::StatusCode;
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use chrono::Utc;
use std::env;
use sqlx::PgPool;

#[tokio::test]
async fn test_login() -> Result<(), AppError> {
    let TestApp { app, db } = setup_test_app().await;
    let client = reqwest::Client::new();

    // Create test user
    let user = User {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        role: UserRole::User,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    db.lock().unwrap().push(user.clone());

    // Test successful login
    let response = client
        .post(&format!("{}/login", app.address))
        .json(&json!({
            "email": "test@example.com",
            "password": "password123"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body: serde_json::Value = response.json().await?;
    assert!(body.get("token").is_some());

    // Test invalid credentials
    let response = client
        .post(&format!("{}/login", app.address))
        .json(&json!({
            "email": "test@example.com",
            "password": "wrong_password"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[tokio::test]
async fn test_register() -> Result<(), AppError> {
    let TestApp { app, db } = setup_test_app().await;
    let client = reqwest::Client::new();

    // Test successful registration
    let response = client
        .post(&format!("{}/register", app.address))
        .json(&json!({
            "email": "new@example.com",
            "password": "password123"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);
    let body: serde_json::Value = response.json().await?;
    assert!(body.get("token").is_some());

    // Test duplicate email
    let response = client
        .post(&format!("{}/register", app.address))
        .json(&json!({
            "email": "new@example.com",
            "password": "password123"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::CONFLICT);
    Ok(())
}

#[tokio::test]
async fn test_register_and_login() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up users table
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    let email = format!("testuser{}@example.com", Utc::now().timestamp_nanos());
    let username = format!("testuser{}", Utc::now().timestamp_nanos());
    let password_hash = "password123".to_string();
    let role = "user".to_string();
    let created_at = Utc::now();
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