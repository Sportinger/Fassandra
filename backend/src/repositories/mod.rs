//! Repository pattern implementation for data access abstraction.
//!
//! This module provides clean abstractions for database operations, following the
//! Repository pattern to separate business logic from data access concerns.

pub mod script_repository;
pub mod block_repository;
pub mod user_repository;
pub mod snapshot_repository;
pub mod yjs_update_repository;

// Re-export traits for easier importing
pub use script_repository::ScriptRepository;
pub use block_repository::BlockRepository;
pub use user_repository::UserRepository;
pub use snapshot_repository::SnapshotRepository;
pub use yjs_update_repository::YjsUpdateRepository; 