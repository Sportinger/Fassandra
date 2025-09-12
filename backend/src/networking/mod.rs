//! Networking module for the Fassandra theater collaboration platform.
//!
//! This module handles real-time networking functionality including:
//! - WebSocket connections for real-time collaboration
//! - Y.js document synchronization and conflict resolution
//! - Session management for multiple users per script
//! - Message broadcasting and routing
//! - Connection lifecycle management with proper cleanup
//!
//! # Security Features
//! - Authentication-based WebSocket access control
//! - Script-level authorization before connection upgrade
//! - Session isolation and user-specific message filtering
//! - Automatic cleanup of inactive sessions
//! - Rate limiting and connection timeout protection

pub mod websocket;
pub mod yjs_protocol;
pub mod audio;

// Re-export the main networking functions
pub use websocket::{
    ws_routes, cleanup_inactive_sessions,
    CLIENT_TIMEOUT, HEARTBEAT_INTERVAL, SESSIONS, GLOBAL_BROADCAST
};
