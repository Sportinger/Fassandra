//! YJS Base State Service
//! 
//! This service handles the initialization of YJS base states for scripts.
//! When a script is created, it needs an initial YJS document state in the database
//! so that when the frontend loads it, there's something to sync with.

use sqlx::PgPool;
use uuid::Uuid;
use yrs::{Doc, Map, Text, Transact, ReadTxn, WriteTxn};
use yrs::updates::encoder::Encode;
use chrono::Utc;
use crate::error::AppError;
use tracing::{info, error};

pub struct YjsBaseStateService {
    pool: PgPool,
}

impl YjsBaseStateService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Initialize a base state for a newly created script
    pub async fn initialize_base_state(&self, script_id: Uuid, title: &str) -> Result<(), AppError> {
        info!("Initializing YJS base state for script: {}", script_id);

        // Create a new YJS document with default options
        let doc = Doc::with_options(yrs::Options::default());
        
        // Create only the required YJS structures that TipTap actually uses
        // Frontend expects content in the 'default' XML fragment
        let metadata = doc.get_or_insert_map("metadata");
        
        // Start a transaction to modify the document
        let mut txn = doc.transact_mut();
        
        // Create the 'default' XML fragment that TipTap uses
        txn.get_or_insert_xml_fragment("default");
        
        // Set metadata
        metadata.insert(&mut txn, "title", title.to_string());
        metadata.insert(&mut txn, "created_at", Utc::now().to_rfc3339());
        metadata.insert(&mut txn, "initialized", true);
        
        // Note: We don't initialize any content here - let the frontend handle it
        // This matches what the frontend expects (empty 'default' fragment)
        
        // Commit the transaction
        drop(txn);
        
        // Get the state vector and encoded state  
        // We need to use transact() for read operations like encoding
        let txn = doc.transact();
        let encoded_state = txn.encode_state_as_update_v1(&yrs::StateVector::default());
        
        // Get state vector (just use empty for now)
        let state_vector: Vec<u8> = Vec::new();
        
        // Store in database
        let result = sqlx::query(
            r#"
            INSERT INTO yjs_base_states (script_id, base_state, state_vector, compacted_at, update_count, document_size)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (script_id) DO NOTHING
            "#
        )
        .bind(script_id)
        .bind(encoded_state.clone())
        .bind(state_vector.clone())
        .bind(Utc::now())
        .bind(0i64)
        .bind(encoded_state.len() as i64)
        .execute(&self.pool)
        .await;

        match result {
            Ok(_) => {
                info!("Successfully initialized YJS base state for script: {}", script_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to initialize YJS base state for script {}: {}", script_id, e);
                Err(AppError::Db(e))
            }
        }
    }

    /// Initialize base state for uploaded script with content
    pub async fn initialize_base_state_with_content(
        &self,
        script_id: Uuid,
        title: &str,
        content: &str,
    ) -> Result<(), AppError> {
        info!("Initializing YJS base state with content for script: {}", script_id);

        // Create a new YJS document with default options
        let doc = Doc::with_options(yrs::Options::default());
        
        // Create only the required YJS structures that TipTap actually uses
        // Frontend expects content in the 'default' XML fragment
        let metadata = doc.get_or_insert_map("metadata");
        
        // Start a transaction to modify the document
        let mut txn = doc.transact_mut();
        
        // Create the 'default' XML fragment that TipTap uses
        txn.get_or_insert_xml_fragment("default");
        
        // Set metadata
        metadata.insert(&mut txn, "title", title.to_string());
        metadata.insert(&mut txn, "created_at", Utc::now().to_rfc3339());
        metadata.insert(&mut txn, "initialized", true);
        metadata.insert(&mut txn, "has_content", true);
        
        // Note: We don't insert content here - let the frontend handle content
        // The 'default' XML fragment is created empty and will be populated by TipTap
        
        // Commit the transaction
        drop(txn);
        
        // Get the state vector and encoded state  
        // We need to use transact() for read operations like encoding
        let txn = doc.transact();
        let encoded_state = txn.encode_state_as_update_v1(&yrs::StateVector::default());
        
        // Get state vector (just use empty for now)
        let state_vector: Vec<u8> = Vec::new();
        
        // Store in database
        let result = sqlx::query(
            r#"
            INSERT INTO yjs_base_states (script_id, base_state, state_vector, compacted_at, update_count, document_size)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (script_id) DO NOTHING
            "#
        )
        .bind(script_id)
        .bind(encoded_state.clone())
        .bind(state_vector.clone())
        .bind(Utc::now())
        .bind(0i64)
        .bind(encoded_state.len() as i64)
        .execute(&self.pool)
        .await;

        match result {
            Ok(_) => {
                info!("Successfully initialized YJS base state with content for script: {}", script_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to initialize YJS base state with content for script {}: {}", script_id, e);
                Err(AppError::Db(e))
            }
        }
    }

    /// Check if a script has a base state
    pub async fn has_base_state(&self, script_id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(SELECT 1 FROM yjs_base_states WHERE script_id = $1)
            "#
        )
        .bind(script_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Db(e))?;

        Ok(result)
    }
}