//! Prompts module for the Pessoa theater collaboration platform.
//!
//! This module contains AI prompt templates for various operations:
//! - Script analysis prompts for Gemini AI
//! - Content extraction prompts
//! - Document parsing instruction templates
//!
//! The prompts are stored as text files and loaded at compile time
//! using the include_str! macro for optimal performance.

// Note: Prompt files are accessed directly using include_str! in the modules that use them
// This module exists primarily for organizational purposes