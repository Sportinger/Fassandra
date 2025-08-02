use anyhow::Result;
use std::env;
use backend::services::claude_code_parser_service::ClaudeCodeParserService;
use sqlx::PgPool;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info,backend=debug")
        .init();

    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <pdf_path> <username>", args[0]);
        eprintln!("Example: {} /app/test.pdf testuser", args[0]);
        std::process::exit(1);
    }

    let pdf_path = &args[1];
    let username = &args[2];

    println!("Testing Claude Code Parser Service");
    println!("==================================");
    println!("PDF Path: {}", pdf_path);
    println!("Username: {}", username);
    println!();

    // Get API key
    let api_key = match env::var("ANTHROPIC_API_KEY") {
        Ok(key) => {
            println!("✓ API key found (length: {})", key.len());
            key
        }
        Err(_) => {
            eprintln!("ERROR: ANTHROPIC_API_KEY not set");
            eprintln!();
            eprintln!("Please set the environment variable:");
            eprintln!("  export ANTHROPIC_API_KEY='your-api-key-here'");
            std::process::exit(1);
        }
    };

    // Get database URL
    let database_url = match env::var("DATABASE_URL") {
        Ok(url) => {
            println!("✓ Database URL found");
            url
        }
        Err(_) => {
            eprintln!("ERROR: DATABASE_URL not set");
            eprintln!();
            eprintln!("Please set the environment variable:");
            eprintln!("  export DATABASE_URL='postgres://user:pass@host/db'");
            std::process::exit(1);
        }
    };

    // Check if PDF exists
    if !std::path::Path::new(pdf_path).exists() {
        eprintln!("ERROR: PDF file not found: {}", pdf_path);
        std::process::exit(1);
    }

    println!("✓ PDF file exists");
    println!();

    // Connect to database
    println!("Connecting to database...");
    let db_pool = Arc::new(PgPool::connect(&database_url).await?);
    println!("✓ Connected to database");
    println!();

    // Create the parser service with database pool
    let parser = ClaudeCodeParserService::new(api_key, db_pool);

    println!("Testing Claude Code parser...");
    println!("This will parse the PDF and generate SQL to insert into the database");
    println!();

    // Test the parser with SQL execution
    match parser.parse_pdf_with_sql_execution(pdf_path, username).await {
        Ok(script_id) => {
            println!("✅ Success!");
            println!("Script ID: {}", script_id);
            println!();
            println!("The script has been successfully parsed and inserted into the database.");
            println!("View at: http://localhost:3000/script/{}", script_id);
        }
        Err(e) => {
            eprintln!("❌ Error: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
} 