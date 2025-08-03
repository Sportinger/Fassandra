use axum::{
    async_trait,
    extract::{FromRequestParts, Query},
    http::request::Parts,
};
use serde::Deserialize;
use crate::auth::{decode_token, AuthUser};
use crate::error::AppError;

#[derive(Debug, Deserialize)]
pub struct WebSocketAuthQuery {
    pub token: Option<String>,
}

/// Special auth extractor for WebSocket connections that reads token from query params
pub struct WebSocketAuth(pub AuthUser);

#[async_trait]
impl<S> FromRequestParts<S> for WebSocketAuth
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // First try regular AuthUser extraction (for regular HTTP requests)
        if let Ok(auth_user) = AuthUser::from_request_parts(parts, state).await {
            return Ok(WebSocketAuth(auth_user));
        }

        // For WebSocket, try to get token from query params
        let Query(query) = Query::<WebSocketAuthQuery>::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::Unauthorized("Missing token parameter".to_string()))?;

        let token = query.token
            .ok_or_else(|| AppError::Unauthorized("Missing token parameter".to_string()))?;

        // Decode and validate the token
        let claims = decode_token(&token)?;
        
        Ok(WebSocketAuth(AuthUser { 
            user_id: claims.sub
        }))
    }
}