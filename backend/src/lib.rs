//! # Fassandra Theater Collaboration Platform - Backend Library
//!
//! This library provides the core backend functionality for the Fassandra theater
//! collaboration platform, including:
//!
//! - **Authentication**: JWT-based authentication with role-based access control
//! - **Script Management**: CRUD operations for theatrical scripts
//! - **Real-time Collaboration**: Y.js-based collaborative editing with WebSocket support
//! - **Analysis**: Script structure analysis with Claude Code integration
//! - **Database**: PostgreSQL integration with SQLx for type-safe queries
//! - **external**: External service integrations placeholder module

// Core modules
pub mod auth;
pub mod error;
pub mod external;
pub mod networking;
pub mod audio;
pub mod infrastructure;
pub mod services;
pub mod utils;
pub mod core;

// Domain-specific modules
pub mod application;
pub mod domain;
pub mod handlers;
pub mod models;
pub mod repositories;
pub mod analysis;
// pub mod prompts; // Module removed - prompts are now handled directly
// Tests removed - using embedded unit tests and external E2E tests instead

// Re-export the main types and functions from core/lib.rs
pub use core::lib::*;
