//! Defines the data structures for representing analyzed script content,
//! adapted to match the structure typically returned by the Gemini API call.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Using serde_json::Value for flexibility where AI output might vary slightly
use serde_json::Value; 

/// Represents the entire analyzed script document based on AI output.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)] // Added Clone, Default
pub struct Script {
    #[serde(default)] // Keep default for Option
    pub id: Option<String>,
    pub source_filename: Option<String>, // Keep this for our context
    
    // Fields observed from AI JSON output:
    pub title: Option<String>,
    pub subtitle: Option<String>,
    #[serde(default)] // Use default empty vec if missing
    pub adaptation_by: Vec<String>, // Renamed from 'authors'
    #[serde(default)]
    pub sections: Vec<Section>,
    
    // Allow catching unexpected fields from AI
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// Represents a major section based on AI output.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Default)]
pub struct Section {
    #[serde(default)]
    pub id: Option<String>,
    
    // Fields observed from AI JSON output:
    pub section_number: Option<Value>, // AI might return string or number
    pub title: Option<String>,
    #[serde(default)]
    pub participants: Vec<String>, // Replaces character_assignments
    pub setting_note: Option<String>, // New field observed
    #[serde(default)]
    pub content: Vec<ContentElement>, // Replaces 'elements'

    // Allow catching unexpected fields
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// Represents different types of content elements within a section, based on AI output.
/// Uses struct variants for clarity based on AI's 'type' field.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(tag = "type", rename_all = "snake_case")] // Match AI's 'type' field
pub enum ContentElement {
    Dialogue(Dialogue),
    Monologue(Monologue),
    StageDirection(StageDirection),
    JointDialogue(JointDialogue),
    Reading(Reading),
    // Add other types here if observed in future AI outputs
    #[serde(other)] // Catch-all for unknown types
    Unknown, // Or potentially store as serde_json::Value
}

// --- Structs for Specific Content Element Types ---

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Dialogue {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Make nullable to handle AI null values
    pub line: Option<String>,
    // Add extra if needed
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Monologue {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Make nullable to handle AI null values
    #[serde(default)]
    pub lines: Vec<String>, 
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct StageDirection {
    #[serde(default)]
    pub id: Option<String>,
    pub description: Option<String>, // Make nullable to handle AI null values
    // Removed kind and source_location
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct JointDialogue {
    #[serde(default)]
    pub id: Option<String>,
    pub speakers: Vec<String>,
    pub line: Option<String>,
    // Add extra if needed
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Reading {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Make nullable to handle AI null values
    pub source: Option<String>,
    pub language: Option<String>,
    pub reading_text: Option<String>, // Make nullable to handle AI null values
}

// Note: We removed the old Speaker, DialogueLine structs as they are replaced by the new structure.
// We also removed CharacterAssignment as it's replaced by 'participants'.

// REMOVED manual default implementation as #[derive(Default)] is used now. 