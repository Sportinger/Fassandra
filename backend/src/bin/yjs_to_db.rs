//! YJS to Database CLI tool
//!
//! This binary allows Claude Code to insert parsed script data into the database
//! using the YJS format instead of the old blocks format.
//! Usage: yjs_to_db <json_file> <username>

use backend::services::yjs_script_builder_service::YjsScriptBuilderService;
use std::env;
use std::fs;
use std::process;
use tracing::info;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_target(false)
        .init();

    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    
    if args.len() != 3 {
        eprintln!("Error: Invalid number of arguments");
        eprintln!("Usage: {} <json_file> <username>", args[0]);
        eprintln!("");
        eprintln!("Expected JSON (always 5-page chunked):");
        eprintln!(r#"{{
  \"mode\": \"chunked\",
  \"chunk\": {{
    \"number\": 1,
    \"total\": 10,
    \"pages_start\": 1,
    \"pages_end\": 5
  }},
  \"metadata\": {{
    \"title\": \"Script Title\",
    \"author\": \"Author Name\",
    \"total_pages\": 50
  }},
  \"content\": [
    {{ \"type\": \"scene\", \"content\": \"INT. OFFICE - DAY\", \"page\": 1, \"scene_number\": \"1\" }},
    {{ \"type\": \"dialogue\", \"speaker\": \"CHARACTER\", \"content\": \"Hello\", \"page\": 1 }}
  ]
}}"#);
        eprintln!("\nNote: Provide metadata only in the first chunk; subsequent chunks omit metadata and include context.");
        process::exit(1);
    }

    let json_file = &args[1];
    let username = &args[2];

    // Read JSON file
    let json_content = match fs::read_to_string(json_file) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error reading JSON file {}: {}", json_file, e);
            process::exit(1);
        }
    };

    // Connect to database
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://pessoa_user:dev_password_123@db:5432/pessoa_db".to_string());
    
    let db_pool = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("Error connecting to database: {}", e);
            process::exit(1);
        }
    };

    // Create service
    let service = YjsScriptBuilderService::new(db_pool.into());

    // Process the JSON
    match service.build_script_from_json(&json_content, None, username).await {
        Ok(result) => {
            if result.success {
                println!("Success: Script inserted as YJS document");
                if let Some(script_id) = result.script_id {
                    println!("Script ID: {}", script_id);
                }
                println!("Items processed: {}", result.items_processed);
                if let Some(chunk_num) = result.chunk_number {
                    println!("Chunk {}/{} processed", chunk_num, result.total_chunks.unwrap_or(0));
                }
                process::exit(0);
            } else {
                eprintln!("Error: Failed to insert script");
                for error in result.errors {
                    eprintln!("  - {}", error);
                }
                process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
    }
}
