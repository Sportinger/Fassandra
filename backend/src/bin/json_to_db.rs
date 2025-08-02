//! JSON to Database CLI tool
//!
//! This binary allows Claude Code to insert JSON data into the database.
//! Usage: json_to_db <json_file> <username>

use backend::services::json_to_db_service::{JsonToDbService};
use std::env;
use std::fs;
use std::process;
use tracing::info;
use sqlx::postgres::PgPoolOptions;

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
        eprintln!("Example JSON structure:");
        eprintln!(r#"{{
  "title": "Example Script",
  "subtitle": "Optional Subtitle",
  "adaptation_by": ["Author 1", "Author 2"],
  "sections": [
    {{
      "section_number": "1",
      "title": "Section Title (optional)",
      "participants": ["CHARACTER1", "CHARACTER2"],
      "setting_note": "Setting description (optional)",
      "content": [
        {{
          "type": "scene",
          "page_number": 1,
          "scene_number": "1",
          "scene_title": "Scene Title"
        }},
        {{
          "type": "dialogue",
          "speaker": "CHARACTER_NAME",
          "line": "The dialogue text",
          "page_number": 1
        }},
        {{
          "type": "stage_direction",
          "description": "Stage direction text",
          "page_number": 1
        }}
      ]
    }}
  ]
}}"#);
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
    let service = JsonToDbService::new(db_pool.into());

    // Validate JSON first
    match service.validate_json(&json_content).await {
        Ok(errors) if !errors.is_empty() => {
            eprintln!("Validation errors:");
            for error in errors {
                eprintln!("  - {}", error);
            }
            process::exit(1);
        }
        Err(e) => {
            eprintln!("Error validating JSON: {}", e);
            process::exit(1);
        }
        _ => info!("JSON validation passed"),
    }

    // Insert data
    match service.insert_script_from_json(&json_content, username).await {
        Ok(result) => {
            if result.success {
                println!("Success!");
                println!("Script ID: {}", result.script_id.unwrap());
                println!("Blocks inserted: {}", result.blocks_inserted);
                process::exit(0);
            } else {
                eprintln!("Partial success with errors:");
                if let Some(script_id) = result.script_id {
                    eprintln!("Script ID: {}", script_id);
                }
                eprintln!("Blocks inserted: {}", result.blocks_inserted);
                eprintln!("Errors:");
                for error in result.errors {
                    eprintln!("  - {}", error);
                }
                process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("Error inserting data: {}", e);
            process::exit(1);
        }
    }
}