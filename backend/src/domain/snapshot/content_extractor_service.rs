use yrs::{
    Doc, ReadTxn, Transact, WriteTxn,
    types::xml::{TreeWalker, XmlFragmentRef, XmlOut},
    GetString,
    XmlFragment,
    Xml,
};
use tracing::{debug, warn, error, info};
use uuid::Uuid;
use std::collections::HashMap;
use crate::analysis::structs::{ContentElement, Dialogue, StageDirection, Monologue, JointDialogue, Reading};

#[derive(Debug, Clone)]
pub struct ContentBlock {
    pub block_type: String,
    pub content: Option<String>,
    pub block_order: i32,
    pub page_number: i32,
    pub metadata: Option<serde_json::Value>,
}

pub struct ContentExtractorService;

impl ContentExtractorService {
    pub fn new() -> Self {
        Self
    }

    /// Extracts content blocks from a YJS document
    pub fn extract_content_blocks(&self, doc: &Doc, script_id: Uuid) -> Result<Vec<ContentBlock>, anyhow::Error> {
        debug!("Starting content extraction for script_id: {}", script_id);
        
        let mut txn_ro = doc.transact();
        
        // Check YJS document structure
        let root_refs: Vec<String> = txn_ro.root_refs().map(|(key, _)| key.to_string()).collect();
        debug!("YJS document root refs: {:?}", root_refs);
        
        // Find the best fragment to use
        let fragment_ref = self.find_best_fragment(doc, &mut txn_ro, script_id)?;
        
        // Extract blocks from the fragment
        let mut blocks = self.extract_blocks_from_fragment(&fragment_ref, &txn_ro, script_id)?;
        
        // If no blocks found, try fallback methods
        if blocks.is_empty() {
            blocks = self.try_fallback_extraction(&txn_ro, script_id)?;
        }
        
        debug!("Extracted {} content blocks for script_id: {}", blocks.len(), script_id);
        Ok(blocks)
    }
    
    /// Finds the best XML fragment to use for content extraction
    fn find_best_fragment(&self, doc: &Doc, txn: &mut yrs::Transaction, script_id: Uuid) -> Result<XmlFragmentRef, anyhow::Error> {
        let fragment_candidates = ["default", "content", "prosemirror"];
        
        // First, try to find a fragment that exists AND has content
        for &candidate in &fragment_candidates {
            if let Some(fragment) = txn.get_xml_fragment(candidate) {
                let len = fragment.len(txn);
                debug!("Examining fragment '{}' – len = {}", candidate, len);
                if len > 0 {
                    debug!("✅ Using fragment '{}' for script_id: {}", candidate, script_id);
                    return Ok(fragment);
                }
            }
        }
        
        // If none had content, fall back to the first that exists
        for &candidate in &fragment_candidates {
            if let Some(fragment) = txn.get_xml_fragment(candidate) {
                debug!("✅ Using empty fragment '{}' for script_id: {}", candidate, script_id);
                return Ok(fragment);
            }
        }
        
        // If no fragment exists, create one
        warn!("No XmlFragment found for script {}. Creating default fragment.", script_id);
        drop(txn); // Drop the read-only transaction
        
        // Create the fragment in a mutable transaction
        {
            let mut txn_mut = doc.transact_mut();
            txn_mut.get_or_insert_xml_fragment("default");
        }
        
        // Re-establish the read-only transaction
        let new_txn = doc.transact();
        
        new_txn.get_xml_fragment("default")
            .ok_or_else(|| anyhow::anyhow!("Failed to create default fragment for script {}", script_id))
    }
    
    /// Extracts blocks from an XML fragment
    fn extract_blocks_from_fragment(
        &self,
        fragment: &XmlFragmentRef,
        txn: &yrs::Transaction,
        script_id: Uuid,
    ) -> Result<Vec<ContentBlock>, anyhow::Error> {
        let mut blocks = Vec::new();
        let mut current_order = 0;
        
        // Walk through the XML tree
        for top_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(fragment.as_ref(), txn) {
            match top_item_out {
                XmlOut::Element(elem_ref) => {
                    if let Some(block) = self.process_element(&elem_ref, txn, script_id, current_order)? {
                        blocks.push(block);
                        current_order += 1;
                    }
                }
                XmlOut::Text(text_ref) => {
                    if let Some(block) = self.process_loose_text(&text_ref, txn, script_id, current_order, &blocks)? {
                        blocks.push(block);
                        current_order += 1;
                    }
                }
                XmlOut::Fragment(_) => {
                    // Skip fragments - they are handled via TreeWalker recursion
                }
            }
        }
        
        Ok(blocks)
    }
    
    /// Processes an XML element and returns a content block if applicable
    fn process_element(
        &self,
        elem_ref: &yrs::types::xml::XmlElementRef,
        txn: &yrs::Transaction,
        script_id: Uuid,
        current_order: i32,
    ) -> Result<Option<ContentBlock>, anyhow::Error> {
        let attributes_map: HashMap<String, String> = elem_ref
            .attributes(txn)
            .map(|(k, v_str)| (k.to_string(), v_str.to_string(txn)))
            .collect();
        
        let tag_name = elem_ref.tag().to_string();
        
        // Extract text content from direct children
        let mut current_element_text_content = String::new();
        for child_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(elem_ref.as_ref(), txn) {
            if let XmlOut::Text(text_ref) = child_item_out {
                current_element_text_content.push_str(&text_ref.get_string(txn));
            }
        }
        current_element_text_content = current_element_text_content.trim().to_string();
        
        // Try to process as structured Pessoa block first
        if let Some(p_block_type) = attributes_map.get("data-type") {
            if let Some(block) = self.process_pessoa_block(p_block_type, &attributes_map, &current_element_text_content, elem_ref, txn, script_id, current_order)? {
                return Ok(Some(block));
            }
        }
        
        // Process as generic block
        self.process_generic_block(&tag_name, &attributes_map, &current_element_text_content, script_id, current_order)
    }
    
    /// Processes a structured Pessoa block (dialogue, stage direction, etc.)
    fn process_pessoa_block(
        &self,
        block_type: &str,
        attributes_map: &HashMap<String, String>,
        text_content: &str,
        elem_ref: &yrs::types::xml::XmlElementRef,
        txn: &yrs::Transaction,
        _script_id: Uuid,
        current_order: i32,
    ) -> Result<Option<ContentBlock>, anyhow::Error> {
        let content_element_result = match block_type {
            "dialogue-block" => {
                // Extract speaker and dialogue text from nested structure
                let (speaker, dialogue_text) = self.extract_dialogue_components(elem_ref, txn, text_content);
                
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::Dialogue(Dialogue {
                    id: attributes_map.get("data-id").cloned(),
                    speaker: Some(speaker),
                    line: Some(dialogue_text),
                    lines: None,
                    reading_text: None,
                    source: None,
                    speakers: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned(),
                    extra: HashMap::new(),
                }))
            }
            "dialogue" => {
                let speaker = attributes_map.get("data-speaker").cloned().unwrap_or_else(|| "Unknown Speaker".to_string());
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::Dialogue(Dialogue {
                    id: attributes_map.get("data-id").cloned(),
                    speaker: Some(speaker),
                    line: Some(text_content.to_string()),
                    lines: None,
                    reading_text: None,
                    source: None,
                    speakers: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned(),
                    extra: HashMap::new(),
                }))
            }
            "stage_direction" => {
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::StageDirection(StageDirection {
                    id: attributes_map.get("data-id").cloned(),
                    description: Some(text_content.to_string()),
                    line: None,
                    lines: None,
                    reading_text: None,
                    source: None,
                    speaker: None,
                    speakers: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned()
                }))
            }
            "monologue" => {
                let speaker = attributes_map.get("data-speaker").cloned().unwrap_or_else(|| "Unknown Speaker".to_string());
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::Monologue(Monologue {
                    id: attributes_map.get("data-id").cloned(),
                    speaker: Some(speaker),
                    line: None,
                    lines: Some(vec![text_content.to_string()]),
                    reading_text: None,
                    source: None,
                    speakers: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned()
                }))
            }
            "joint_dialogue" => {
                let speakers_str = attributes_map.get("data-speakers").cloned().unwrap_or_default();
                let speakers: Vec<String> = speakers_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::JointDialogue(JointDialogue {
                    id: attributes_map.get("data-id").cloned(),
                    speaker: Some(speakers_str),
                    speakers: Some(speakers),
                    line: Some(text_content.to_string()),
                    lines: None,
                    reading_text: None,
                    source: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned(),
                    extra: HashMap::new(),
                }))
            }
            "reading" => {
                let speaker = attributes_map.get("data-speaker").cloned().unwrap_or_else(|| "Unknown Speaker".to_string());
                let source = attributes_map.get("data-source").cloned();
                let language = attributes_map.get("data-language").cloned();
                let page_number = self.extract_page_number(&attributes_map);
                Ok(ContentElement::Reading(Reading {
                    id: attributes_map.get("data-id").cloned(),
                    speaker: Some(speaker),
                    source,
                    language,
                    reading_text: Some(text_content.to_string()),
                    description: None,
                    line: None,
                    lines: None,
                    speakers: None,
                    page_number,
                    scene_number: attributes_map.get("data-scene-number").cloned(),
                    scene_title: attributes_map.get("data-scene-name")
                        .or_else(|| attributes_map.get("data-scene-title"))
                        .cloned()
                }))
            }
            _ => Err(format!("Unknown Pessoa block type: {}", block_type)),
        };
        
        match content_element_result {
            Ok(content_element) => {
                match serde_json::to_string(&content_element) {
                    Ok(json_content) => {
                        let metadata = self.create_metadata(&attributes_map, block_type);
                        let page_number = self.extract_page_number(&attributes_map);
                        
                        Ok(Some(ContentBlock {
                            block_type: block_type.to_string(),
                            content: Some(json_content),
                            block_order: current_order,
                            page_number,
                            metadata,
                        }))
                    }
                    Err(e) => {
                        error!("Failed to serialize ContentElement for type {}: {}", block_type, e);
                        Ok(None)
                    }
                }
            }
            Err(msg) => {
                debug!("Did not process as known Pessoa type '{}': {}", block_type, msg);
                Ok(None)
            }
        }
    }
    
    /// Extracts speaker and dialogue text from nested dialogue-block structure
    fn extract_dialogue_components(
        &self,
        elem_ref: &yrs::types::xml::XmlElementRef,
        txn: &yrs::Transaction,
        fallback_text: &str,
    ) -> (String, String) {
        let mut speaker = "Unknown Speaker".to_string();
        let mut dialogue_text = String::new();
        
        // Walk through child elements to find speaker and dialogue-text
        for child_item_out in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(elem_ref.as_ref(), txn) {
            if let XmlOut::Element(child_elem_ref) = child_item_out {
                let child_attributes: HashMap<String, String> = child_elem_ref
                    .attributes(txn)
                    .map(|(k, v_str)| (k.to_string(), v_str.to_string(txn)))
                    .collect();
                
                if let Some(child_type) = child_attributes.get("data-type") {
                    match child_type.as_str() {
                        "speaker" => {
                            for speaker_child in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(child_elem_ref.as_ref(), txn) {
                                if let XmlOut::Text(speaker_text_ref) = speaker_child {
                                    speaker = speaker_text_ref.get_string(txn).trim().to_string();
                                }
                            }
                        }
                        "dialogue-text" => {
                            for dialogue_child in TreeWalker::<&yrs::Transaction<'_>, yrs::Transaction<'_>>::new(child_elem_ref.as_ref(), txn) {
                                if let XmlOut::Text(dialogue_text_ref) = dialogue_child {
                                    dialogue_text.push_str(&dialogue_text_ref.get_string(txn));
                                    dialogue_text.push(' ');
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        
        dialogue_text = dialogue_text.trim().to_string();
        if dialogue_text.is_empty() {
            dialogue_text = fallback_text.to_string();
        }
        
        (speaker, dialogue_text)
    }
    
    /// Processes a generic block (paragraph, heading, etc.)
    fn process_generic_block(
        &self,
        tag_name: &str,
        attributes_map: &HashMap<String, String>,
        text_content: &str,
        script_id: Uuid,
        current_order: i32,
    ) -> Result<Option<ContentBlock>, anyhow::Error> {
        let allowed_generic_types = [
            "paragraph", "heading", "blockquote", "code_block", "list_item", 
            "image", "table", "table_row", "table_cell", "horizontal_rule", "text"
        ];
        
        if !allowed_generic_types.contains(&tag_name) {
            warn!("Skipping unknown generic block type '{}' for script_id: {}", tag_name, script_id);
            return Ok(None);
        }
        
        if text_content.is_empty() {
            return Ok(None);
        }
        
        info!("Creating generic block: type='{}', order={}, content='{}...', script_id: {}", 
              tag_name, current_order, text_content.chars().take(50).collect::<String>(), script_id);
        
        let page_number = self.extract_page_number(&attributes_map);
        let metadata = if attributes_map.is_empty() { 
            None 
        } else { 
            Some(serde_json::to_value(attributes_map.clone()).unwrap_or_default()) 
        };
        
        Ok(Some(ContentBlock {
            block_type: tag_name.to_string(),
            content: Some(serde_json::to_string(text_content).unwrap_or_else(|e| {
                error!("Failed to serialize content for type {}: {}. Using error placeholder.", tag_name, e);
                serde_json::json!({"error": "serialization failed", "original_content": text_content}).to_string()
            })),
            block_order: current_order,
            page_number,
            metadata,
        }))
    }
    
    /// Processes loose text (text not contained within elements)
    fn process_loose_text(
        &self,
        text_ref: &yrs::types::xml::XmlTextRef,
        txn: &yrs::Transaction,
        script_id: Uuid,
        current_order: i32,
        existing_blocks: &[ContentBlock],
    ) -> Result<Option<ContentBlock>, anyhow::Error> {
        let loose_text_original = text_ref.get_string(txn);
        let loose_text_trimmed = loose_text_original.trim().to_string();
        
        if loose_text_trimmed.is_empty() {
            return Ok(None);
        }
        
        // Check if the loose text is pre-formatted (frontend error)
        if loose_text_trimmed.starts_with("(paragraph:") {
            warn!("Found pre-formatted loose text in XmlFragment for script_id {}: '{}'. Skipping.", script_id, loose_text_trimmed);
            return Ok(None);
        }
        
        // Check for duplication with the last block
        if let Some(last_block) = existing_blocks.last() {
            if last_block.block_type == "paragraph" {
                if let Some(ref last_content_json_str) = last_block.content {
                    if let Ok(last_block_actual_text) = serde_json::from_str::<String>(last_content_json_str) {
                        if last_block_actual_text == loose_text_trimmed {
                            warn!("Skipping duplicate loose text '{}' for script_id {}", loose_text_trimmed, script_id);
                            return Ok(None);
                        }
                    }
                }
            }
        }
        
        info!("Found loose uncontained text for script_id {}: '{}'. Wrapping in paragraph.", script_id, loose_text_trimmed);
        
        Ok(Some(ContentBlock {
            block_type: "paragraph".to_string(),
            content: Some(serde_json::to_string(&loose_text_trimmed).unwrap_or_else(|e| {
                error!("Failed to serialize loose text: {}. Using error placeholder.", e);
                serde_json::json!({"error": "serialization failed", "original_content": loose_text_trimmed}).to_string()
            })),
            block_order: current_order,
            page_number: 1, // Default page for loose text
            metadata: None,
        }))
    }
    
    /// Fallback extraction methods when no blocks are found from XML fragments
    fn try_fallback_extraction(
        &self,
        txn: &yrs::Transaction,
        script_id: Uuid,
    ) -> Result<Vec<ContentBlock>, anyhow::Error> {
        debug!("Fallback: No blocks extracted, checking for YText content...");
        
        let ytext_fields = ["default", "prosemirror", "content"];
        
        for field_name in &ytext_fields {
            if let Some(ytext) = txn.get_text(*field_name) {
                let raw_text = ytext.get_string(txn);
                debug!("Fallback: Found '{}' YText with {} chars: '{}'", field_name, raw_text.len(), raw_text);
                
                if !raw_text.trim().is_empty() {
                    info!("Fallback: found plain YText '{}' with {} chars for script {} – creating single paragraph block.", 
                          field_name, raw_text.len(), script_id);
                    
                    return Ok(vec![ContentBlock {
                        block_type: "paragraph".to_string(),
                        content: Some(raw_text),
                        block_order: 0,
                        page_number: 1,
                        metadata: None,
                    }]);
                }
            }
        }
        
        debug!("Fallback: No YText found for any of: {:?}", ytext_fields);
        Ok(vec![])
    }
    
    /// Extracts page number from attributes
    fn extract_page_number(&self, attributes_map: &HashMap<String, String>) -> i32 {
        attributes_map
            .get("data-page")
            .and_then(|p| p.parse::<i32>().ok())
            .unwrap_or(1)
    }
    
    /// Creates metadata from attributes, excluding processed ones
    fn create_metadata(&self, attributes_map: &HashMap<String, String>, block_type: &str) -> Option<serde_json::Value> {
        let mut remaining_attributes = attributes_map.clone();
        
        // Remove attributes that have been processed
        remaining_attributes.remove("data-type");
        remaining_attributes.remove("data-id");
        remaining_attributes.remove("data-page");
        
        // Remove type-specific attributes
        match block_type {
            "dialogue" | "monologue" => { 
                remaining_attributes.remove("data-speaker"); 
            }
            "dialogue-block" => { 
                remaining_attributes.remove("data-layout"); 
            }
            "reading" => {
                remaining_attributes.remove("data-speaker");
                remaining_attributes.remove("data-source");
                remaining_attributes.remove("data-language");
            }
            "joint_dialogue" => { 
                remaining_attributes.remove("data-speakers"); 
            }
            _ => {}
        }
        
        if remaining_attributes.is_empty() {
            None
        } else {
            Some(serde_json::to_value(remaining_attributes).unwrap_or_default())
        }
    }
} 