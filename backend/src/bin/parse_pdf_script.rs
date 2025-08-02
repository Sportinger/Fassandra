//! PDF Script Parser Binary
//!
//! A standalone binary for parsing PDF scripts using Claude Code and inserting them into the PostgreSQL database.
//! This binary uses the integrated PDF parsing and database insertion service with Claude Code agents.

use std::env;
use std::sync::Arc;
use sqlx::PgPool;
use tracing::{info, error};

use backend::services::PDFScriptParserService;
use backend::repositories::user_repository::PostgresUserRepository;
use backend::repositories::script_repository::PostgresScriptRepository;
use backend::repositories::block_repository::PostgresBlockRepository;
use backend::application::ScriptApplicationService;
use backend::domain::script_service::ScriptService;
use backend::error::AppError;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info,backend=debug")
        .init();

    // Get command line arguments
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        error!("Usage: {} <pdf_path> <user_email>", args[0]);
        error!("Example: {} /path/to/script.pdf user@example.com", args[0]);
        std::process::exit(1);
    }

    let pdf_path = &args[1];
    let user_email = &args[2];

    info!("Starting PDF script parser");
    info!("PDF Path: {}", pdf_path);
    info!("User Email: {}", user_email);

    // Check environment variables
    let api_key = env::var("ANTHROPIC_API_KEY")
        .expect("ANTHROPIC_API_KEY environment variable must be set");
    
    info!("Claude Code API key configured (length: {})", api_key.len());

    // Connect to database
    let database_url = env::var("DATABASE_URL")?;
    let db_pool = Arc::new(PgPool::connect(&database_url).await?);

    info!("Connected to database");

    // Create repositories
    let user_repository = Arc::new(PostgresUserRepository::new(db_pool.clone()));
    let script_repository = Arc::new(PostgresScriptRepository::new(db_pool.clone()));
    let block_repository = Arc::new(PostgresBlockRepository::new(db_pool.clone()));

    // Create services
    let script_service = Arc::new(ScriptService::new(
        script_repository.clone(),
        user_repository.clone(),
        block_repository.clone(),
    ));

    let script_app_service = Arc::new(ScriptApplicationService::new(
        script_service.clone(),
        db_pool.clone(),
    ));

    // Create the PDF parser service with database pool
    let parser_service = PDFScriptParserService::new(
        user_repository.clone(),
        script_app_service.clone(),
        db_pool.clone(),
    );

    // Parse the PDF and insert into database
    match parser_service.parse_pdf_for_user(pdf_path, user_email, &api_key).await {
        Ok(script_id) => {
            info!("Successfully parsed PDF and created script with ID: {}", script_id);
            
            // Verify the script was created
            let script_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM blocks WHERE script_id = $1"
            )
            .bind(script_id)
            .fetch_one(&*db_pool)
            .await?;
            
            info!("Script contains {} blocks", script_count);
            
            println!("\n✅ Success!");
            println!("Script ID: {}", script_id);
            println!("Total blocks: {}", script_count);
            println!("View at: http://localhost:3000/script/{}", script_id);
        }
        Err(e) => {
            error!("Failed to parse PDF: {}", e);
            match e {
                AppError::NotFound(msg) => {
                    println!("\n❌ User not found: {}", msg);
                    
                    // List available users
                    let users: Vec<(String, String)> = sqlx::query_as(
                        "SELECT username, email FROM users ORDER BY email"
                    )
                    .fetch_all(&*db_pool)
                    .await?;
                    
                    println!("\nAvailable users:");
                    for (username, email) in users {
                        println!("  {} - {}", username, email);
                    }
                }
                AppError::BadRequest(msg) => {
                    println!("\n❌ Bad request: {}", msg);
                }
                _ => {
                    println!("\n❌ Error: {}", e);
                }
            }
            std::process::exit(1);
        }
    }

    Ok(())
}