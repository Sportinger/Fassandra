use crate::error::AppError;
use crate::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::Response,
};
use chrono::Utc;
// Removed unused imports: use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct WsMessage {
    pub r#type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct WebSocketMessage {
    script_id: Uuid,
    content: String,
}

use axum::http::HeaderMap;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    pool: axum::extract::State<PgPool>,
) -> Response {
    // Get allowed origins from environment
    let allowed_origins: Vec<String> = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| {
            let default_domain = env::var("APP_DOMAIN")
                .unwrap_or_else(|_| "arnodell.hopto.org:8080".to_string());
            format!("http://localhost:8080,http://127.0.0.1:8080,http://{}", default_domain)
        })
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    
    let origin_ok = headers.get("origin")
        .and_then(|val| val.to_str().ok())
        .map(|origin| allowed_origins.contains(&origin.to_string()))
        .unwrap_or(false);
    
    if !origin_ok {
        return Response::builder()
            .status(403)
            .body("WebSocket connections not allowed from this origin".into())
            .unwrap();
    }
    
    ws.on_upgrade(|socket| handle_socket(socket, pool.0))
}

async fn handle_socket(mut socket: WebSocket, pool: PgPool) {
    while let Some(msg) = socket.recv().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    if let Ok(msg) = serde_json::from_str::<WebSocketMessage>(&text) {
                        if let Err(e) = handle_script_update(&pool, msg.script_id, &msg.content).await {
                            let error_msg = serde_json::json!({
                                "error": e.to_string()
                            });
                            if let Err(e) = socket.send(Message::Text(error_msg.to_string())).await {
                                eprintln!("Error sending error message: {}", e);
                                break;
                            }
                            continue;
                        }

                        let response = serde_json::json!({
                            "success": true,
                            "script_id": msg.script_id,
                        });

                        if let Err(e) = socket.send(Message::Text(response.to_string())).await {
                            eprintln!("Error sending response: {}", e);
                            break;
                        }
                    }
                }
                Message::Close(_) => break,
                _ => continue,
            }
        } else {
            break;
        }
    }
}

pub async fn handle_script_update(
    pool: &PgPool,
    script_id: Uuid,
    content: &str,
) -> Result<()> {
    let mut tx: sqlx::Transaction<'_, sqlx::Postgres> = pool.begin().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    // Create a new block for the script
    sqlx::query_unchecked!(
        "INSERT INTO blocks (id, script_id, block_type, content, created_at, block_order) \n         VALUES ($1, $2, $3, $4, $5, $6)",
        Uuid::new_v4(),
        script_id,
        "text",
        content,
        Utc::now(),
        0 // Default block_order for WebSocket-created blocks
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    tx.commit().await
        .map_err(|e| AppError::Internal(anyhow::Error::msg(e.to_string())))?;

    Ok(())
} 