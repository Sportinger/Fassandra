use axum::{
    extract::{State, Path},
    response::Json,
};
use uuid::Uuid;
use crate::error::AppError;
use crate::auth::AuthUser;
use crate::services::claude_session_service::ClaudeSessionService;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct SessionStatusResponse {
    pub id: Uuid,
    pub status: String,
    pub progress: u8,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub username: String,
    pub pdf_filename: String,
    pub script_id: Option<Uuid>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct SessionLogsResponse {
    pub logs: Vec<String>,
    pub total_lines: usize,
}

#[derive(Deserialize)]
pub struct LogsQuery {
    #[serde(default = "default_since_line")]
    pub since_line: usize,
}

fn default_since_line() -> usize {
    0
}

pub async fn get_session_status(
    Path(session_id): Path<Uuid>,
    State(claude_service): State<Arc<ClaudeSessionService>>,
    _auth_user: AuthUser,
) -> Result<Json<SessionStatusResponse>, AppError> {
    let session_info = claude_service.get_session(session_id).await
        .ok_or_else(|| AppError::NotFound(format!("Session {} not found", session_id)))?;

    Ok(Json(SessionStatusResponse {
        id: session_info.id,
        status: format!("{:?}", session_info.status),
        progress: session_info.progress,
        started_at: session_info.started_at.to_rfc3339(),
        completed_at: session_info.completed_at.map(|dt| dt.to_rfc3339()),
        username: session_info.username,
        pdf_filename: session_info.pdf_filename,
        script_id: session_info.script_id,
        error: session_info.error,
    }))
}

pub async fn get_session_logs(
    Path(session_id): Path<Uuid>,
    axum::extract::Query(query): axum::extract::Query<LogsQuery>,
    State(claude_service): State<Arc<ClaudeSessionService>>,
    _auth_user: AuthUser,
) -> Result<Json<SessionLogsResponse>, AppError> {
    let logs = claude_service.get_session_logs(session_id, query.since_line).await
        .ok_or_else(|| AppError::NotFound(format!("Session {} not found", session_id)))?;

    let total_lines = logs.len() + query.since_line;
    
    Ok(Json(SessionLogsResponse {
        logs,
        total_lines,
    }))
}

#[derive(Serialize)]
pub struct CancelSessionResponse {
    pub success: bool,
    pub message: String,
}

pub async fn cancel_session(
    Path(session_id): Path<Uuid>,
    State(claude_service): State<Arc<ClaudeSessionService>>,
    _auth_user: AuthUser,
) -> Result<Json<CancelSessionResponse>, AppError> {
    claude_service.cancel_session(session_id).await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    Ok(Json(CancelSessionResponse {
        success: true,
        message: format!("Session {} cancelled", session_id),
    }))
}