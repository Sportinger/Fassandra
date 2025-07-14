//! Services module for the Pessoa theater collaboration platform.
//!
//! This module contains various service implementations including:
//! - Thumbnail generation for script previews
//! - Asynchronous database operations and batch processing
//! - Y.js document persistence and event handling
//! - Snapshotting service for document state management
//! - Background task processing and coordination
//!
//! # Service Architecture
//! - Stateless service design for scalability
//! - Asynchronous processing for performance
//! - Event-driven architecture for real-time updates
//! - Proper error handling and recovery mechanisms
//! - Database transaction management for consistency

pub mod thumbnail;
pub mod async_db_writer;
pub mod persistence_event;
pub mod snapshotting_service_v2;

// Re-export key service components
pub use thumbnail::*;
pub use async_db_writer::*;
pub use persistence_event::*;
pub use snapshotting_service_v2::*;