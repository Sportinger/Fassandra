// Services module for the snapshot processing pipeline
// 
// This module contains the services extracted from the monolithic snapshotting_service.rs
// Each service has a single responsibility and can be tested independently.

pub mod yjs_processor_service;
pub mod content_extractor_service;
pub mod html_parser_service;
pub mod snapshot_coordinator_service;

pub use yjs_processor_service::YjsProcessorService;
pub use content_extractor_service::ContentExtractorService;
pub use html_parser_service::HtmlParserService;
pub use snapshot_coordinator_service::SnapshotCoordinatorService; 