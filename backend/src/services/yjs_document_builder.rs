use serde::{Deserialize, Serialize};
use uuid::Uuid;
use yrs::{Doc, Map, Options, Text, Transact, ReadTxn, WriteTxn, XmlElementPrelim, XmlFragment, XmlTextPrelim, StateVector};
use yrs::updates::encoder::Encode;
use anyhow::Result;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptMetadata {
    pub title: String,
    pub author: Option<String>,
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptChunk {
    pub mode: String, // "chunked" or "full"
    pub chunk: Option<ChunkInfo>,
    pub metadata: Option<ScriptMetadata>,
    pub content: Vec<ContentItem>,
    pub context: Option<ChunkContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkInfo {
    pub number: i32,
    pub total: i32,
    pub pages_start: i32,
    pub pages_end: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkContext {
    pub last_scene: Option<String>,
    pub last_speaker: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentItem {
    #[serde(rename = "type")]
    pub content_type: String,
    pub content: String,
    pub page: Option<i32>,
    pub scene_number: Option<String>,
    pub speaker: Option<String>,
}

/// Builder for creating YJS documents from parsed script data
pub struct YjsDocumentBuilder {
    doc: Doc,
    script_id: Uuid,
}

impl YjsDocumentBuilder {
    /// Create a new document builder for a script
    pub fn new(script_id: Uuid) -> Self {
        let doc = Doc::with_options(Options {
            guid: script_id.to_string(),
            ..Default::default()
        });
        
        Self { doc, script_id }
    }

    /// Set script metadata
    pub fn set_metadata(&mut self, metadata: &ScriptMetadata) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        
        // Get or create metadata map
        let metadata_map = txn.get_or_insert_map("metadata");
        
        // Set metadata fields
        metadata_map.insert(&mut txn, "title", metadata.title.clone());
        if let Some(author) = &metadata.author {
            metadata_map.insert(&mut txn, "author", author.clone());
        }
        metadata_map.insert(&mut txn, "totalPages", metadata.total_pages);
        metadata_map.insert(&mut txn, "scriptId", self.script_id.to_string());
        
        info!("Set metadata for script {}: title='{}', pages={}", 
              self.script_id, metadata.title, metadata.total_pages);
        
        Ok(self)
    }

    /// Add a scene heading to the document
    pub fn add_scene(&mut self, number: Option<String>, heading: String, page: Option<i32>) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
        
        // Create scene element
        let scene_elem = XmlElementPrelim::empty("scene");
        let scene_ref = xml_fragment.push_back(&mut txn, scene_elem);
        
        // Add scene attributes
        if let Some(num) = number {
            scene_ref.insert_attribute(&mut txn, "number", num);
        }
        if let Some(p) = page {
            scene_ref.insert_attribute(&mut txn, "page", p.to_string());
        }
        
        // Add scene heading text
        let heading_elem = XmlElementPrelim::empty("heading");
        let heading_ref = scene_ref.push_back(&mut txn, heading_elem);
        heading_ref.push_back(&mut txn, XmlTextPrelim::new(heading));
        
        debug!("Added scene: '{}' on page {:?}", heading, page);
        Ok(self)
    }

    /// Add dialogue to the document
    pub fn add_dialogue(&mut self, speaker: String, text: String, page: Option<i32>) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
        
        // Create dialogue element
        let dialogue_elem = XmlElementPrelim::empty("dialogue");
        let dialogue_ref = xml_fragment.push_back(&mut txn, dialogue_elem);
        
        // Add attributes
        dialogue_ref.insert_attribute(&mut txn, "speaker", speaker.clone());
        if let Some(p) = page {
            dialogue_ref.insert_attribute(&mut txn, "page", p.to_string());
        }
        
        // Add dialogue text
        dialogue_ref.push_back(&mut txn, XmlTextPrelim::new(text.clone()));
        
        debug!("Added dialogue: {} says '{}...'", speaker, text.chars().take(50).collect::<String>());
        Ok(self)
    }

    /// Add stage direction/action to the document
    pub fn add_stage_direction(&mut self, text: String, page: Option<i32>) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
        
        // Create action element
        let action_elem = XmlElementPrelim::empty("action");
        let action_ref = xml_fragment.push_back(&mut txn, action_elem);
        
        // Add page attribute if present
        if let Some(p) = page {
            action_ref.insert_attribute(&mut txn, "page", p.to_string());
        }
        
        // Add action text
        action_ref.push_back(&mut txn, XmlTextPrelim::new(text.clone()));
        
        debug!("Added stage direction: '{}...'", text.chars().take(50).collect::<String>());
        Ok(self)
    }

    /// Add a transition (like "CUT TO:", "FADE IN:")
    pub fn add_transition(&mut self, text: String, page: Option<i32>) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
        
        // Create transition element
        let trans_elem = XmlElementPrelim::empty("transition");
        let trans_ref = xml_fragment.push_back(&mut txn, trans_elem);
        
        // Add page attribute if present
        if let Some(p) = page {
            trans_ref.insert_attribute(&mut txn, "page", p.to_string());
        }
        
        // Add transition text
        trans_ref.push_back(&mut txn, XmlTextPrelim::new(text));
        
        debug!("Added transition: '{}'", text);
        Ok(self)
    }

    /// Add a parenthetical (character direction)
    pub fn add_parenthetical(&mut self, text: String, page: Option<i32>) -> Result<&mut Self> {
        let mut txn = self.doc.transact_mut();
        let xml_fragment = txn.get_or_insert_xml_fragment("xmlFragment");
        
        // Create parenthetical element
        let paren_elem = XmlElementPrelim::empty("parenthetical");
        let paren_ref = xml_fragment.push_back(&mut txn, paren_elem);
        
        // Add page attribute if present
        if let Some(p) = page {
            paren_ref.insert_attribute(&mut txn, "page", p.to_string());
        }
        
        // Add text
        paren_ref.push_back(&mut txn, XmlTextPrelim::new(text));
        
        debug!("Added parenthetical: '{}'", text);
        Ok(self)
    }

    /// Process a chunk of parsed script content
    pub fn add_chunk(&mut self, chunk: &ScriptChunk) -> Result<&mut Self> {
        info!("Processing chunk: mode={}, items={}", chunk.mode, chunk.content.len());
        
        // If this is the first chunk, set metadata
        if let Some(metadata) = &chunk.metadata {
            self.set_metadata(metadata)?;
        }
        
        // Process each content item
        for item in &chunk.content {
            match item.content_type.as_str() {
                "scene" | "scene_heading" => {
                    self.add_scene(
                        item.scene_number.clone(),
                        item.content.clone(),
                        item.page
                    )?;
                }
                "dialogue" => {
                    if let Some(speaker) = &item.speaker {
                        self.add_dialogue(
                            speaker.clone(),
                            item.content.clone(),
                            item.page
                        )?;
                    }
                }
                "action" | "stage_direction" => {
                    self.add_stage_direction(item.content.clone(), item.page)?;
                }
                "transition" => {
                    self.add_transition(item.content.clone(), item.page)?;
                }
                "parenthetical" => {
                    self.add_parenthetical(item.content.clone(), item.page)?;
                }
                "character" => {
                    // Character names are typically handled as part of dialogue
                    // Skip standalone character entries
                    debug!("Skipping standalone character entry: {}", item.content);
                }
                _ => {
                    debug!("Unknown content type: {}", item.content_type);
                }
            }
        }
        
        // Store context for next chunk if present
        if let Some(context) = &chunk.context {
            let mut txn = self.doc.transact_mut();
            let context_map = txn.get_or_insert_map("chunkContext");
            
            if let Some(scene) = &context.last_scene {
                context_map.insert(&mut txn, "lastScene", scene.clone());
            }
            if let Some(speaker) = &context.last_speaker {
                context_map.insert(&mut txn, "lastSpeaker", speaker.clone());
            }
        }
        
        Ok(self)
    }

    /// Build the final YJS update bytes
    pub fn build(self) -> Result<Vec<u8>> {
        let txn = self.doc.transact();
        let update = txn.encode_state_as_update_v1(&yrs::StateVector::default());
        
        info!("Built YJS document for script {}: {} bytes", self.script_id, update.len());
        Ok(update)
    }

    /// Get the underlying document (for testing or advanced operations)
    pub fn get_doc(&self) -> &Doc {
        &self.doc
    }

    /// Get a YJS update from the current state
    pub fn get_update(&self) -> Result<Vec<u8>> {
        let txn = self.doc.transact();
        let update = txn.encode_state_as_update_v1(&yrs::StateVector::default());
        Ok(update)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_builder() {
        let script_id = Uuid::new_v4();
        let mut builder = YjsDocumentBuilder::new(script_id);
        
        let metadata = ScriptMetadata {
            title: "Test Script".to_string(),
            author: Some("Test Author".to_string()),
            total_pages: 10,
        };
        
        builder.set_metadata(&metadata).unwrap();
        builder.add_scene(Some("1".to_string()), "INT. HOUSE - DAY".to_string(), Some(1)).unwrap();
        builder.add_dialogue("JOHN".to_string(), "Hello, world!".to_string(), Some(1)).unwrap();
        
        let update = builder.build().unwrap();
        assert!(!update.is_empty());
    }
}