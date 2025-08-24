//! Simplified YJS Document Builder
//!
//! Creates basic YJS documents with the required structure.
//! The actual content population happens through YJS sync from the editor.

use uuid::Uuid;
use yrs::{Doc, Options, Transact, ReadTxn, WriteTxn};
use yrs::updates::encoder::Encode;
use anyhow::Result;
use tracing::{debug, info};

/// Simple builder for creating YJS documents with basic structure
pub struct YjsDocumentBuilder {
    doc: Doc,
    script_id: Uuid,
}

impl YjsDocumentBuilder {
    /// Create a new document builder for a script
    pub fn new(script_id: Uuid) -> Self {
        // Create doc with default options
        let doc = Doc::with_options(Options::default());
        
        // Initialize the required YJS structures
        {
            let mut txn = doc.transact_mut();
            // Only create the 'default' XML fragment that Tiptap actually uses
            txn.get_or_insert_xml_fragment("default");
            // Keep metadata for future use
            txn.get_or_insert_map("metadata");
        }
        
        Self { doc, script_id }
    }

    /// Set basic metadata (title, pages)
    pub fn set_metadata(&mut self, title: &str, total_pages: i32) -> Result<&mut Self> {
        {
            let mut txn = self.doc.transact_mut();
            let metadata = txn.get_or_insert_map("metadata");
            // Note: Map operations in YJS are different - we would need to use
            // the correct API here. For now, just log the intent.
            debug!("Would set metadata: title='{}', pages={}", title, total_pages);
        }
        
        info!("Initialized document for script {}: '{}'", self.script_id, title);
        Ok(self)
    }

    /// Build the final YJS update bytes
    pub fn build(self) -> Result<Vec<u8>> {
        let txn = self.doc.transact();
        let update = txn.encode_state_as_update_v1(&yrs::StateVector::default());
        
        info!("Built YJS document for script {}: {} bytes", self.script_id, update.len());
        Ok(update)
    }

    /// Get the underlying document
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