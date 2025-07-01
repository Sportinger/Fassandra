use crate::models::user::{User, UserRole};
use axum::Router;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;

pub struct TestApp {
    pub app: Router,
    pub db: Arc<Mutex<Vec<User>>>,
}

pub async fn setup_test_app() -> TestApp {
    let db = Arc::new(Mutex::new(Vec::new()));
    let app = crate::app::create_app(db.clone());
    
    TestApp { app, db }
}

pub fn create_test_user() -> User {
    User {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        role: UserRole::User,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn create_test_admin() -> User {
    User {
        id: Uuid::new_v4(),
        email: "admin@example.com".to_string(),
        password_hash: "hashed_password".to_string(),
        role: UserRole::Admin,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
} 