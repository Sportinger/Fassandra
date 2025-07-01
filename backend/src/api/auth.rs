use sqlx::PgPool; // Removed unused import: Row
use crate::models::user::User;
use crate::error::AppError;
use chrono::Utc;
use uuid::Uuid;

pub async fn register(pool: &PgPool, email: &str, password: &str) -> Result<User, AppError> {
    let user = User {
        id: Uuid::new_v4(),
        email: email.to_string(),
        username: email.split('@').next().unwrap_or("user").to_string(),
        password_hash: password.to_string(), // In production, hash the password
        role: "user".to_string(),
        created_at: Some(Utc::now()),
    };

    sqlx::query(
        "INSERT INTO users (id, email, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(user.id)
    .bind(&user.email)
    .bind(&user.username)
    .bind(&user.password_hash)
    .bind(&user.role)
    .bind(user.created_at)
    .execute(pool)
    .await?;

    Ok(user)
}

pub async fn login(pool: &PgPool, email: &str, password: &str) -> Result<User, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1 AND password_hash = $2"
    )
    .bind(email)
    .bind(password)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn logout(_pool: &PgPool, _user_id: Uuid) -> Result<(), AppError> {
    // In a real application, you might want to invalidate the user's session/token
    Ok(())
} 