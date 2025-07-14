//! Infrastructure module for the Pessoa theater collaboration platform.
//!
//! This module provides core infrastructure functionality including:
//! - Application configuration management from environment variables
//! - Security middleware for HTTP headers and protection
//! - Database connection configuration and pooling
//! - Admin user management and password initialization
//! - Environment-specific settings and deployment configuration
//!
//! # Security Features
//! - Configurable security headers (CSP, HSTS, X-Frame-Options, etc.)
//! - Environment variable validation and secure defaults
//! - Admin user password management with secure hashing
//! - Database connection limits and timeout configuration
//! - Production-ready security policy enforcement

pub mod config;
pub mod middleware;

// Re-export the main infrastructure components
pub use config::{Config, update_admin_user_password};
pub use middleware::create_security_headers_middleware;