//! Utility module for the Pessoa theater collaboration platform.
//!
//! This module contains utility functions and helper tools including:
//! - Y.js testing utilities for document synchronization
//! - Development and debugging helpers
//! - Common utility functions shared across modules
//! - Test fixtures and mock data generators
//!
//! # Utility Categories
//! - Testing utilities for Y.js document operations
//! - Debug helpers for development workflow
//! - Common data transformation functions
//! - Validation and formatting utilities

pub mod test_yjs;

// Re-export utility functions
pub use test_yjs::*;