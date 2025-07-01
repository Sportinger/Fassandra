use crate::{
    models::user::{User, UserRole},
    tests::common::{setup_test_app, TestApp},
    error::AppError,
};
use axum::http::StatusCode;
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use std::env;
use sqlx::PgPool;

#[tokio::test]
async fn test_update_and_delete_user() -> Result<(), AppError> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;
    // Clean up users table
    sqlx::query!("DELETE FROM users").execute(&pool).await?;
    let email = format!("user{}@example.com", Utc::now().timestamp_nanos());
    let username = format!("user{}", Utc::now().timestamp_nanos());
    let password_hash = "password123".to_string();
    let role = "user".to_string();
    let created_at = Utc::now();
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
    let new_email = format!("updated{}@example.com", Utc::now().timestamp_nanos());
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

#[tokio::test]
async fn test_update_user() -> Result<(), AppError> {
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

    // Test successful update
    let response = client
        .put(&format!("{}/users/{}", app.address, user.id))
        .json(&json!({
            "email": "updated@example.com",
            "role": "Admin"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body: serde_json::Value = response.json().await?;
    assert_eq!(body["email"], "updated@example.com");
    assert_eq!(body["role"], "Admin");

    // Test non-existent user
    let response = client
        .put(&format!("{}/users/{}", app.address, Uuid::new_v4()))
        .json(&json!({
            "email": "updated@example.com",
            "role": "Admin"
        }))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    Ok(())
}

#[tokio::test]
async fn test_delete_user() -> Result<(), AppError> {
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

    // Test successful deletion
    let response = client
        .delete(&format!("{}/users/{}", app.address, user.id))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Test non-existent user
    let response = client
        .delete(&format!("{}/users/{}", app.address, Uuid::new_v4()))
        .send()
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    Ok(())
} 