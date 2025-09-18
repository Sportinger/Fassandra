//! YJS to Database CLI tool
//!
//! This binary allows Claude Code to insert parsed script data into the database
//! using the YJS format instead of the old blocks format.
//! Usage: yjs_to_db <json_file> <username> [script_id]

use backend::services::yjs_script_builder_service::YjsScriptBuilderService;
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::fs;
use std::process;
use tracing::info;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt().with_target(false).init();

    // Parse command line arguments
    let args: Vec<String> = env::args().collect();

    if args.len() < 3 || args.len() > 4 {
        eprintln!("Error: Invalid number of arguments");
        eprintln!("Usage: {} <json_file> <username> [script_id]", args[0]);
        eprintln!("");
        eprintln!("Expected JSON (always 5-page chunked). You can provide:");
        eprintln!("- A single chunk object (mode=chunked)");
        eprintln!("- An array of chunk objects (processed sequentially)");
        eprintln!("- An object with {{\"chunks\": [ ... ]}}");
        eprintln!(
            r#"{{
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
}}"#
        );
        eprintln!("\nNotes:");
        eprintln!("- Provide metadata only in the first chunk; subsequent chunks omit metadata and include context.");
        eprintln!("- Optional third argument \"script_id\" lets you force appending to an existing script.");
        process::exit(1);
    }

    let json_file = &args[1];
    let username = &args[2];
    let script_id_arg = if args.len() == 4 {
        Some(args[3].clone())
    } else {
        None
    };
    let script_id_opt: Option<Uuid> = match script_id_arg {
        Some(s) => match Uuid::parse_str(&s) {
            Ok(id) => Some(id),
            Err(_) => {
                eprintln!("Error: Invalid script_id UUID: {}", s);
                process::exit(1);
            }
        },
        None => None,
    };

    // Read JSON file
    let json_content = match fs::read_to_string(json_file) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error reading JSON file {}: {}", json_file, e);
            process::exit(1);
        }
    };

    // Connect to database
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://fassandra_user:dev_password_123@db:5432/fassandra_db".to_string()
    });

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

    // Process the JSON: accept single chunk, array of chunks, or {chunks: [...]}
    let parsed: Value = match serde_json::from_str(&json_content) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Error: Invalid JSON: {}", e);
            process::exit(1);
        }
    };

    let mut overall_success = true;
    let mut total_items = 0i32;
    let mut final_script_id: Option<Uuid> = script_id_opt;

    match &parsed {
        Value::Array(arr) => {
            for (idx, item) in arr.iter().enumerate() {
                info!("Processing chunk {} of {}", idx + 1, arr.len());
                let json_str = item.to_string();
                match service
                    .build_script_from_json(&json_str, final_script_id, username)
                    .await
                {
                    Ok(res) => {
                        overall_success &= res.success;
                        total_items += res.items_processed;
                        if final_script_id.is_none() {
                            final_script_id = res.script_id;
                        }
                        println!(
                            "Chunk processed{}",
                            match (res.chunk_number, res.total_chunks) {
                                (Some(n), Some(t)) => format!(" ({} of {})", n, t),
                                _ => String::new(),
                            }
                        );
                        if !res.success {
                            break;
                        }
                    }
                    Err(e) => {
                        eprintln!("Error: {}", e);
                        overall_success = false;
                        break;
                    }
                }
            }
        }
        Value::Object(map) if map.get("chunks").is_some() => {
            if let Some(Value::Array(arr)) = map.get("chunks") {
                for (idx, item) in arr.iter().enumerate() {
                    info!("Processing chunk {} of {}", idx + 1, arr.len());
                    let json_str = item.to_string();
                    match service
                        .build_script_from_json(&json_str, final_script_id, username)
                        .await
                    {
                        Ok(res) => {
                            overall_success &= res.success;
                            total_items += res.items_processed;
                            if final_script_id.is_none() {
                                final_script_id = res.script_id;
                            }
                            println!(
                                "Chunk processed{}",
                                match (res.chunk_number, res.total_chunks) {
                                    (Some(n), Some(t)) => format!(" ({} of {})", n, t),
                                    _ => String::new(),
                                }
                            );
                            if !res.success {
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("Error: {}", e);
                            overall_success = false;
                            break;
                        }
                    }
                }
            } else {
                eprintln!("Error: 'chunks' must be an array");
                process::exit(1);
            }
        }
        _ => {
            match service
                .build_script_from_json(&json_content, final_script_id, username)
                .await
            {
                Ok(res) => {
                    overall_success = res.success;
                    total_items = res.items_processed;
                    if final_script_id.is_none() {
                        final_script_id = res.script_id;
                    }
                    if let (Some(n), Some(t)) = (res.chunk_number, res.total_chunks) {
                        println!("Chunk {}/{} processed", n, t);
                    }
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
    }

    if overall_success {
        println!("Success: Script inserted as YJS document");
        if let Some(id) = final_script_id {
            println!("Script ID: {}", id);
        }
        println!("Items processed: {}", total_items);
        process::exit(0);
    } else {
        eprintln!("Error: One or more chunks failed");
        process::exit(1);
    }
}
