use axum::http::HeaderMap;
use axum::{extract::State, Json};
use serde::Serialize;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::auth::{remove_auth_cookie, AuthUser};
use crate::error::AppError;
use yrs::{ReadTxn, Transact};

#[derive(Serialize)]
pub struct AccountExport {
    pub user: ExportedUser,
    pub owned_scripts: Vec<ExportedScript>,
    pub shares_received: Vec<ShareEntry>,
    pub shares_granted: Vec<ShareEntry>,
}

#[derive(Serialize)]
pub struct ExportedScript {
    pub id: Uuid,
    pub title: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_public: Option<bool>,
    pub thumbnail: Option<String>,
    pub yjs_state_base64: Option<String>,
}

#[derive(Serialize)]
pub struct ExportedUser {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub role: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Serialize)]
pub struct ShareEntry {
    pub script_id: Uuid,
    pub user_id: Uuid,
    pub permission: String,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_by: Option<Uuid>,
}

/// Export all personal data related to the authenticated user (GDPR Art. 15/20)
pub async fn export_account_data(
    State(pool): State<Arc<PgPool>>,
    auth: AuthUser,
) -> Result<Json<AccountExport>, AppError> {
    // Load user
    let user: crate::models::user::User = sqlx::query_as(
        "SELECT id, email, username, password_hash, role, created_at FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_one(pool.as_ref())
    .await
    .map_err(AppError::Db)?;

    // Load scripts owned by user (runtime-checked query to avoid SQLX_OFFLINE prepare)
    let owned_rows = sqlx::query(
        r#"SELECT id, title, created_at, is_public, thumbnail
           FROM scripts
           WHERE created_by = $1
           ORDER BY created_at DESC"#,
    )
    .bind(auth.user_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(AppError::Db)?;

    // For each script, include compacted Yjs state if present
    let mut exported_scripts: Vec<ExportedScript> = Vec::with_capacity(owned_rows.len());
    for row in owned_rows {
        let sid: Uuid = row.try_get("id").map_err(AppError::Db)?;
        let title: String = row.try_get("title").map_err(AppError::Db)?;
        let created_at: Option<chrono::DateTime<chrono::Utc>> =
            row.try_get("created_at").map_err(AppError::Db)?;
        let is_public: Option<bool> = row.try_get("is_public").map_err(AppError::Db)?;
        let thumbnail: Option<String> = row.try_get("thumbnail").map_err(AppError::Db)?;
        let yjs_state_base64 = match crate::services::yjs_compaction_service::load_document(
            pool.as_ref(),
            sid,
        )
        .await
        {
            Ok(doc) => {
                use base64::Engine as _;
                let update = doc
                    .transact()
                    .encode_state_as_update_v1(&yrs::StateVector::default());
                Some(base64::engine::general_purpose::STANDARD.encode(&update))
            }
            Err(_) => None, // Don't fail export if Yjs load fails; continue best-effort
        };

        exported_scripts.push(ExportedScript {
            id: sid,
            title,
            created_at,
            is_public,
            thumbnail,
            yjs_state_base64,
        });
    }

    // Shares where the user is the recipient
    let shares_received_rows = sqlx::query(
        r#"SELECT script_id, shared_with_user_id as user_id, permission, created_at, created_by
           FROM script_shares
           WHERE shared_with_user_id = $1
           ORDER BY created_at DESC NULLS LAST"#,
    )
    .bind(auth.user_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(AppError::Db)?;

    let shares_received = shares_received_rows
        .into_iter()
        .map(|row| ShareEntry {
            script_id: row.try_get("script_id").unwrap_or_default(),
            user_id: row.try_get("user_id").unwrap_or_default(),
            permission: row
                .try_get::<Option<String>, _>("permission")
                .unwrap_or(None)
                .unwrap_or_else(|| "read".to_string()),
            created_at: row.try_get("created_at").ok(),
            created_by: row.try_get("created_by").ok(),
        })
        .collect();

    // Shares granted by the user (on their scripts)
    let shares_granted_rows = sqlx::query(
        r#"SELECT s.script_id, s.shared_with_user_id as user_id, s.permission, s.created_at, s.created_by
           FROM script_shares s
           JOIN scripts sc ON sc.id = s.script_id
           WHERE sc.created_by = $1
           ORDER BY s.created_at DESC NULLS LAST"#
    )
    .bind(auth.user_id)
    .fetch_all(pool.as_ref())
    .await
    .map_err(AppError::Db)?;

    let shares_granted = shares_granted_rows
        .into_iter()
        .map(|row| ShareEntry {
            script_id: row.try_get("script_id").unwrap_or_default(),
            user_id: row.try_get("user_id").unwrap_or_default(),
            permission: row
                .try_get::<Option<String>, _>("permission")
                .unwrap_or(None)
                .unwrap_or_else(|| "read".to_string()),
            created_at: row.try_get("created_at").ok(),
            created_by: row.try_get("created_by").ok(),
        })
        .collect();

    let exported_user = ExportedUser {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
    };

    Ok(Json(AccountExport {
        user: exported_user,
        owned_scripts: exported_scripts,
        shares_received,
        shares_granted,
    }))
}

/// Delete the authenticated user's account and associated data (GDPR Art. 17)
pub async fn delete_account(
    State(pool): State<Arc<PgPool>>,
    cookies: Cookies,
    headers: HeaderMap,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    // CSRF validation (double-submit cookie): compare header token to cookie value
    let header_token = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let cookie_token = crate::auth::get_csrf_token_from_cookie(&cookies).unwrap_or_default();
    if header_token.is_empty() || cookie_token.is_empty() || header_token != cookie_token {
        return Err(AppError::Unauthorized(
            "Invalid or missing CSRF token".to_string(),
        ));
    }
    let mut tx = pool.begin().await.map_err(AppError::Db)?;

    // 1) Remove shares where the user is recipient (to other users' scripts)
    sqlx::query("DELETE FROM script_shares WHERE shared_with_user_id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;

    // 2) Delete scripts owned by the user (cascades to blocks, shares, yjs, layouts, snapshots)
    sqlx::query("DELETE FROM scripts WHERE created_by = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;

    // 3) Finally, delete the user (updates in yjs_document_updates will set user_id = NULL)
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(auth.user_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Db)?;

    tx.commit().await.map_err(AppError::Db)?;

    // Remove auth cookie to end the session
    remove_auth_cookie(&cookies);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Account and associated content deleted"
    })))
}
