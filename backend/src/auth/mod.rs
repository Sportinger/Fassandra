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

pub mod core;
pub mod helpers;
pub mod websocket_auth;
pub mod cookies;

// Re-export the main authentication types and functions
pub use core::{
    Claims, AuthUser, WsAuthUser, RateLimiter, RegisterPayload, LoginRequest,
    generate_token, verify_token, decode_token, hash_password, verify_password,
    logout, handle_error, rate_limit_middleware
};

pub use helpers::{
    check_script_access, check_script_ownership
};

pub use websocket_auth::WebSocketAuth;

pub use cookies::{
    set_auth_cookie, remove_auth_cookie, get_auth_token_from_cookie,
    generate_csrf_token, set_csrf_cookie, get_csrf_token_from_cookie,
    store_csrf_token, validate_csrf_token, create_csrf_store,
    CsrfTokenStore
};
