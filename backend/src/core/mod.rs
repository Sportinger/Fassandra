//! Core module for the Fassandra theater collaboration platform.
//!
//! This module contains the core application components including:
//! - Server setup and routing configuration
//! - Service manager for dependency injection
//! - Application library exports and composition root
//! - Main application entry point
//!
//! # Core Architecture
//! - Clean separation of concerns with proper dependency injection
//! - Service-oriented architecture with clear boundaries
//! - Centralized service composition and configuration
//! - Proper error handling and logging throughout
//! - Scalable and maintainable application structure

pub mod lib;
pub mod server;
pub mod service_manager;

// Re-export core components
pub use lib::*;
pub use server::*;
pub use service_manager::*;
