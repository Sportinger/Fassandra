//! Services module for the Fassandra theater collaboration platform.
//!
//! This module contains various service implementations including:
//! - Thumbnail generation for script previews
//! - Asynchronous database operations and batch processing
//! - Y.js document persistence and event handling
//! - YJS compaction service for efficient storage
//! - Background task processing and coordination
//! - Claude Code integration for PDF script parsing
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
pub mod yjs_compaction_service;
pub mod yjs_script_builder_service;
// pub mod yjs_base_state_service; // Temporarily disabled
pub mod claude_session_service;

// Re-export key service components
pub use thumbnail::*;
pub use async_db_writer::*;
pub use persistence_event::*;
pub use yjs_compaction_service::*;
pub use yjs_script_builder_service::*;
// pub use yjs_base_state_service::*; // Temporarily disabled  
pub use claude_session_service::*;
