//! Authentication module for the Fassandra theater collaboration platform.
//!
//! This module provides comprehensive authentication functionality including:
//! - JWT token generation and verification
//! - Password hashing and verification using Argon2
//! - User authentication extractors for HTTP and WebSocket requests
//! - Rate limiting for security
//! - Authorization helpers for resource access control
//!
//! # Security Features
//! - Rate limiting to prevent brute force attacks
//! - Secure password hashing with Argon2
//! - JWT token validation with configurable expiration
//! - IP-based rate limiting with spoofing protection
//! - Comprehensive input validation and sanitization

pub mod cookies;
pub mod core;
pub mod helpers;
pub mod websocket_auth;

// Re-export the main authentication types and functions
pub use core::{
    decode_token, generate_token, handle_error, hash_password, logout, rate_limit_middleware,
    verify_password, verify_token, AuthUser, Claims, LoginRequest, RateLimiter, RegisterPayload,
    WsAuthUser,
};

pub use helpers::{check_script_access, check_script_ownership};

pub use websocket_auth::WebSocketAuth;

pub use cookies::{
    create_csrf_store, generate_csrf_token, get_auth_token_from_cookie, get_csrf_token_from_cookie,
    remove_auth_cookie, set_auth_cookie, set_csrf_cookie, store_csrf_token, validate_csrf_token,
    CsrfTokenStore,
};
