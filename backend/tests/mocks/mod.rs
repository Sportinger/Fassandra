pub mod db;

use sqlx::PgPool;
use backend::models::{user::User, script::Script, block::Block};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct MockData {
    pub users: Vec<User>,
    pub scripts: Vec<Script>,
    pub blocks: Vec<Block>,
}

impl MockData {
    pub fn new() -> Self {
        let now = Utc::now();
        let user_id = Uuid::new_v4();
        
        Self {
            users: vec![User {
                id: user_id,
                email: "test@example.com".to_string(),
                username: "testuser".to_string(),
                password_hash: "$2b$12$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu".to_string(), // hash of "password"
                role: "user".to_string(),
                created_at: now,
            }],
            scripts: vec![Script {
                id: Uuid::new_v4(),
                title: "Test Script".to_string(),
                created_by: Some(user_id),
                created_at: now,
            }],
            blocks: vec![Block {
                id: Uuid::new_v4(),
                script_id: Uuid::new_v4(),
                block_type: "text".to_string(),
                content: "Test content".to_string(),
                created_at: now,
            }],
        }
    }
} 