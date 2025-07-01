use std::env;
use sqlx::PgPool;
use uuid::Uuid;
use tokio_tungstenite::connect_async;
use url::Url;
use backend::auth::generate_token;
use backend::models::user::User;
use chrono::Utc;

#[tokio::test]
async fn test_ws_auth_and_connect() {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await.expect("connect db");
    // Clean up users and scripts
    sqlx::query!("DELETE FROM users").execute(&pool).await.expect("clean users");
    sqlx::query!("DELETE FROM scripts").execute(&pool).await.expect("clean scripts");
    // Create user and script
    let user_id = Uuid::new_v4();
    let email = format!("wsuser{}@example.com", Utc::now().timestamp_nanos());
    let username = format!("wsuser{}", Utc::now().timestamp_nanos());
    let password_hash = "dummyhash".to_string();
    let role = "user".to_string();
    let created_at = Utc::now();
    sqlx::query!("INSERT INTO users (id, email, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)", user_id, &email, &username, &password_hash, &role, created_at)
        .execute(&pool).await.expect("insert user");
    let script_id = Uuid::new_v4();
    let title = "WS Test Script".to_string();
    sqlx::query!("INSERT INTO scripts (id, title, created_by, created_at) VALUES ($1, $2, $3, $4)", script_id, &title, Some(user_id), Some(Utc::now()))
        .execute(&pool).await.expect("insert script");
    // Generate JWT
    let token = generate_token(user_id, &email, &username, &role).expect("generate token");
    // Connect to WebSocket endpoint
    let ws_url = format!("ws://localhost:3001/api/collab/{}?token={}", script_id, token);
    let url = Url::parse(&ws_url).unwrap();
    let (ws_stream, _response) = connect_async(url).await.expect("connect ws");
    let (_write, _read) = ws_stream.split();
    // If we reach here, connection and auth succeeded
}

#[tokio::test]
async fn test_ws_invalid_token() {
    let script_id = Uuid::new_v4();
    let ws_url = format!("ws://localhost:3001/api/collab/{}?token=invalidtoken", script_id);
    let url = Url::parse(&ws_url).unwrap();
    let result = connect_async(url).await;
    assert!(result.is_err() || result.as_ref().unwrap().1.status() == 401);
} 