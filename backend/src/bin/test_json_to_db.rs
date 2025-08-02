use backend::services::json_to_db_service::JsonToDbService;
use std::sync::Arc;
use sqlx::postgres::PgPoolOptions;
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db".to_string());
    
    let db_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let service = JsonToDbService::new(Arc::new(db_pool));

    // Test validation
    let test_json = r#"{
        "title": "Test Script",
        "sections": [{
            "section_number": "1",
            "content": [{
                "type": "dialogue",
                "speaker": "TEST",
                "line": "This is a test",
                "page_number": 1
            }]
        }]
    }"#;

    println!("Testing JSON validation...");
    let validation_errors = service.validate_json(test_json).await?;
    if validation_errors.is_empty() {
        println!("✓ JSON is valid");
    } else {
        println!("✗ Validation errors:");
        for error in &validation_errors {
            println!("  - {}", error);
        }
    }

    // Test insertion with the test file
    if let Ok(json_content) = std::fs::read_to_string("test_multipage.json") {
        println!("\nTesting JSON insertion from test_multipage.json...");
        
        // First validate
        let validation_errors = service.validate_json(&json_content).await?;
        if !validation_errors.is_empty() {
            println!("✗ Validation errors:");
            for error in &validation_errors {
                println!("  - {}", error);
            }
            return Ok(());
        }

        // Then insert
        let result = service.insert_script_from_json(&json_content, "abc").await?;
        
        if result.success {
            println!("✓ Successfully inserted script!");
            println!("  Script ID: {:?}", result.script_id);
            println!("  Blocks inserted: {}", result.blocks_inserted);
        } else {
            println!("✗ Failed to insert script");
            println!("  Blocks inserted: {}", result.blocks_inserted);
            for error in &result.errors {
                println!("  - {}", error);
            }
        }
    } else {
        println!("\ntest_multipage.json not found");
    }

    Ok(())
} 