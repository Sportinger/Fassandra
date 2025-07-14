//! Pessoa Theater Collaboration Platform - Backend Library
//!
//! This is the main library crate for the Pessoa theater collaboration platform backend.
//! It provides a clean, service-oriented architecture for managing theater scripts,
//! real-time collaboration, and user management.
//!
//! # Architecture Overview
//!
//! The backend is organized into several logical modules:
//! - **auth**: Authentication and authorization functionality
//! - **error**: Comprehensive error handling and reporting
//! - **external**: External service integrations (Gemini AI, etc.)
//! - **networking**: WebSocket and real-time communication
//! - **infrastructure**: Configuration and middleware
//! - **services**: Business logic and background services
//! - **utils**: Utility functions and helpers
//! - **core**: Core application components (server, service manager, etc.)
//!
//! Plus the existing domain-specific modules:
//! - **application**: Application services (Clean Architecture)
//! - **domain**: Domain services and business logic
//! - **handlers**: HTTP request handlers
//! - **models**: Data models and entities
//! - **repositories**: Data access layer
//! - **analysis**: Script analysis and parsing
//! - **prompts**: AI prompt templates
//! - **tests**: Test utilities and fixtures

// Core modules
pub mod auth;
pub mod error;
pub mod external;
pub mod networking;
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
pub mod prompts;
// Tests removed - using embedded unit tests and external E2E tests instead

// Re-export the main types and functions from core/lib.rs
pub use core::lib::*;