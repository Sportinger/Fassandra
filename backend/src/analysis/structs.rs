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

// --- Raw Content Element Types (with all fields from Gemini) ---
// These are used for parsing Gemini response and extracting metadata

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Dialogue {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Make nullable to handle AI null values
    pub line: Option<String>,
    #[serde(default)] // Handle null values from Gemini
    pub lines: Option<Vec<String>>, // Add lines field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub reading_text: Option<String>, // Add reading_text field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub source: Option<String>, // Add source field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub speakers: Option<Vec<String>>, // Add speakers field for compatibility
    #[serde(default = "default_page_number")]
    pub page_number: i32, // Page number where this dialogue appears
    #[serde(default)] // Handle null values from Gemini  
    pub scene_number: Option<String>, // Scene number (e.g., "1", "PROLOG", "ACT I")
    #[serde(default)] // Handle null values from Gemini
    pub scene_title: Option<String>, // Scene title (e.g., "PROLOG", "DER TOD")
    // Add extra if needed
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct Monologue {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Make nullable to handle AI null values
    pub line: Option<String>, // Add line field for compatibility with Gemini
    #[serde(default)] // Handle null values from Gemini
    pub lines: Option<Vec<String>>, // Make nullable to handle null values
    #[serde(default)] // Handle null values from Gemini
    pub reading_text: Option<String>, // Add reading_text field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub source: Option<String>, // Add source field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub speakers: Option<Vec<String>>, // Add speakers field for compatibility
    #[serde(default = "default_page_number")]
    pub page_number: i32, // Page number where this monologue appears
    #[serde(default)] // Handle null values from Gemini  
    pub scene_number: Option<String>, // Scene number (e.g., "1", "PROLOG", "ACT I")
    #[serde(default)] // Handle null values from Gemini
    pub scene_title: Option<String>, // Scene title (e.g., "PROLOG", "DER TOD")
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct StageDirection {
    #[serde(default)]
    pub id: Option<String>,
    pub description: Option<String>, // Make nullable to handle AI null values
    pub line: Option<String>, // Add line field for compatibility with Gemini
    #[serde(default)] // Handle null values from Gemini
    pub lines: Option<Vec<String>>, // Add lines field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub reading_text: Option<String>, // Add reading_text field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub source: Option<String>, // Add source field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub speaker: Option<String>, // Add speaker field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub speakers: Option<Vec<String>>, // Add speakers field for compatibility
    #[serde(default = "default_page_number")]
    pub page_number: i32, // Page number where this stage direction appears
    #[serde(default)] // Handle null values from Gemini  
    pub scene_number: Option<String>, // Scene number (e.g., "1", "PROLOG", "ACT I")
    #[serde(default)] // Handle null values from Gemini
    pub scene_title: Option<String>, // Scene title (e.g., "PROLOG", "DER TOD")
    // Removed kind and source_location
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct JointDialogue {
    #[serde(default)]
    pub id: Option<String>,
    pub speaker: Option<String>, // Gemini sends speaker as a string with newlines
    #[serde(default)] // Handle null values from Gemini
    pub speakers: Option<Vec<String>>, // Allow both single speaker and speaker array
    pub line: Option<String>,
    #[serde(default)] // Handle null values from Gemini
    pub lines: Option<Vec<String>>, // Add lines field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub reading_text: Option<String>, // Add reading_text field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub source: Option<String>, // Add source field for compatibility
    #[serde(default = "default_page_number")]
    pub page_number: i32, // Page number where this joint dialogue appears
    #[serde(default)] // Handle null values from Gemini  
    pub scene_number: Option<String>, // Scene number (e.g., "1", "PROLOG", "ACT I")
    #[serde(default)] // Handle null values from Gemini
    pub scene_title: Option<String>, // Scene title (e.g., "PROLOG", "DER TOD")
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
    pub description: Option<String>, // Add description field for compatibility
    pub line: Option<String>, // Add line field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub lines: Option<Vec<String>>, // Add lines field for compatibility
    #[serde(default)] // Handle null values from Gemini
    pub speakers: Option<Vec<String>>, // Add speakers field for compatibility
    #[serde(default = "default_page_number")]
    pub page_number: i32, // Page number where this reading appears
    #[serde(default)] // Handle null values from Gemini  
    pub scene_number: Option<String>, // Scene number (e.g., "1", "PROLOG", "ACT I")
    #[serde(default)] // Handle null values from Gemini
    pub scene_title: Option<String>, // Scene title (e.g., "PROLOG", "DER TOD")
}

/// Default page number is 1 if not specified
fn default_page_number() -> i32 {
    1
}

// --- Clean Content Structs (for efficient database storage) ---
// These structs contain only the essential content without metadata fields

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CleanDialogue {
    pub speaker: Option<String>,
    pub line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CleanMonologue {
    pub speaker: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CleanStageDirection {
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CleanJointDialogue {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<String>>,
    pub line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CleanReading {
    pub speaker: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub reading_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speakers: Option<Vec<String>>,
}

// --- Helper methods for extracting metadata and converting to clean content ---

impl ContentElement {
    /// Extracts page number from the content element
    pub fn get_page_number(&self) -> i32 {
        match self {
            ContentElement::Dialogue(d) => d.page_number,
            ContentElement::Monologue(m) => m.page_number,
            ContentElement::StageDirection(sd) => sd.page_number,
            ContentElement::JointDialogue(jd) => jd.page_number,
            ContentElement::Reading(r) => r.page_number,
            ContentElement::Unknown => 1,
        }
    }

    /// Extracts scene number from the content element
    pub fn get_scene_number(&self) -> Option<String> {
        match self {
            ContentElement::Dialogue(d) => d.scene_number.clone(),
            ContentElement::Monologue(m) => m.scene_number.clone(),
            ContentElement::StageDirection(sd) => sd.scene_number.clone(),
            ContentElement::JointDialogue(jd) => jd.scene_number.clone(),
            ContentElement::Reading(r) => r.scene_number.clone(),
            ContentElement::Unknown => None,
        }
    }

    /// Extracts scene title from the content element
    pub fn get_scene_title(&self) -> Option<String> {
        match self {
            ContentElement::Dialogue(d) => d.scene_title.clone(),
            ContentElement::Monologue(m) => m.scene_title.clone(),
            ContentElement::StageDirection(sd) => sd.scene_title.clone(),
            ContentElement::JointDialogue(jd) => jd.scene_title.clone(),
            ContentElement::Reading(r) => r.scene_title.clone(),
            ContentElement::Unknown => None,
        }
    }

    /// Converts to clean content JSON string (without metadata)
    pub fn to_clean_content_json(&self) -> Result<String, serde_json::Error> {
        match self {
            ContentElement::Dialogue(d) => {
                let clean = CleanDialogue {
                    speaker: d.speaker.clone(),
                    line: d.line.clone(),
                    lines: d.lines.clone(),
                    reading_text: d.reading_text.clone(),
                    source: d.source.clone(),
                    speakers: d.speakers.clone(),
                };
                serde_json::to_string(&clean)
            },
            ContentElement::Monologue(m) => {
                let clean = CleanMonologue {
                    speaker: m.speaker.clone(),
                    line: m.line.clone(),
                    lines: m.lines.clone(),
                    reading_text: m.reading_text.clone(),
                    source: m.source.clone(),
                    speakers: m.speakers.clone(),
                };
                serde_json::to_string(&clean)
            },
            ContentElement::StageDirection(sd) => {
                let clean = CleanStageDirection {
                    description: sd.description.clone(),
                    line: sd.line.clone(),
                    lines: sd.lines.clone(),
                    reading_text: sd.reading_text.clone(),
                    source: sd.source.clone(),
                    speaker: sd.speaker.clone(),
                    speakers: sd.speakers.clone(),
                };
                serde_json::to_string(&clean)
            },
            ContentElement::JointDialogue(jd) => {
                let clean = CleanJointDialogue {
                    speaker: jd.speaker.clone(),
                    speakers: jd.speakers.clone(),
                    line: jd.line.clone(),
                    lines: jd.lines.clone(),
                    reading_text: jd.reading_text.clone(),
                    source: jd.source.clone(),
                };
                serde_json::to_string(&clean)
            },
            ContentElement::Reading(r) => {
                let clean = CleanReading {
                    speaker: r.speaker.clone(),
                    source: r.source.clone(),
                    language: r.language.clone(),
                    reading_text: r.reading_text.clone(),
                    description: r.description.clone(),
                    line: r.line.clone(),
                    lines: r.lines.clone(),
                    speakers: r.speakers.clone(),
                };
                serde_json::to_string(&clean)
            },
            ContentElement::Unknown => {
                Ok("{}".to_string())
            },
        }
    }
}

// Note: We removed the old Speaker, DialogueLine structs as they are replaced by the new structure.
// We also removed CharacterAssignment as it's replaced by 'participants'. 