//! Handlers for page break management API endpoints.
//! NOTE: This functionality is deprecated - we now use YJS for script management

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, put},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::auth::AuthUser;

/// Request payload for updating page breaks
#[derive(Debug, Deserialize)]
pub struct UpdatePageBreaksRequest {
    /// List of blocks with their updated page numbers
    pub blocks: Vec<BlockPageUpdate>,
}

/// Individual block page number update
#[derive(Debug, Deserialize)]
pub struct BlockPageUpdate {
    /// Block ID
    pub block_id: Uuid,
    /// New page number for the block
    pub page_number: i32,
}

/// Response for getting page breaks
#[derive(Debug, Serialize)]
pub struct PageBreaksResponse {
    /// Script ID
    pub script_id: Uuid,
    /// List of blocks with their page numbers
    pub blocks: Vec<BlockPageInfo>,
}

/// Block page information
#[derive(Debug, Serialize)]
pub struct BlockPageInfo {
    /// Block ID
    pub block_id: Uuid,
    /// Block type
    pub block_type: String,
    /// Current page number
    pub page_number: i32,
    /// Block order within the page
    pub block_order: i32,
}

/// Creates router for page break management endpoints
pub fn create_page_break_router() -> Router<Arc<PgPool>> {
    Router::new()
        .route("/scripts/:script_id/page-breaks", get(get_page_breaks))
        .route("/scripts/:script_id/page-breaks", put(update_page_breaks))
}

/// Handler for getting page breaks
async fn get_page_breaks(
    State(_pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    _auth_user: AuthUser,
) -> impl IntoResponse {
    // Deprecated - return empty response
    info!(
        "Page breaks requested for script {} - returning empty (deprecated)",
        script_id
    );

    let response = PageBreaksResponse {
        script_id,
        blocks: vec![],
    };

    (StatusCode::OK, Json(response))
}

/// Handler for updating page breaks
async fn update_page_breaks(
    State(_pool): State<Arc<PgPool>>,
    Path(script_id): Path<Uuid>,
    _auth_user: AuthUser,
    Json(_request): Json<UpdatePageBreaksRequest>,
) -> impl IntoResponse {
    // Deprecated - return success
    info!(
        "Page breaks update requested for script {} - returning success (deprecated)",
        script_id
    );

    (
        StatusCode::OK,
        Json(json!({
            "message": "Page breaks functionality is deprecated - use YJS sync instead",
            "script_id": script_id
        })),
    )
}
