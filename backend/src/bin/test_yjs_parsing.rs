//! Test program for the new YJS-based script parsing system

use std::sync::Arc;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("debug")
        .init();

    println!("🧪 Testing YJS Script Parsing System");
    println!("=====================================\n");

    // Connect to database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://pessoa_user:dev_password_123@localhost:5432/pessoa_db".to_string());
    
    println!("📦 Connecting to database...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    let pool = Arc::new(pool);
    println!("✅ Connected to database\n");

    // Test 1: Simple single chunk
    println!("Test 1: Single chunk (small script)");
    println!("------------------------------------");
    test_single_chunk(&pool).await?;
    
    // Test 2: Multiple chunks  
    println!("\nTest 2: Multiple chunks (large script)");
    println!("---------------------------------------");
    test_multiple_chunks(&pool).await?;

    println!("\n✅ All tests completed successfully!");
    Ok(())
}

async fn test_single_chunk(pool: &Arc<sqlx::PgPool>) -> Result<()> {
    let json_data = r#"
    {
        "mode": "full",
        "metadata": {
            "title": "Test Script - Single Chunk",
            "author": "Test Author",
            "total_pages": 5
        },
        "content": [
            {
                "type": "scene",
                "content": "INT. OFFICE - DAY",
                "page": 1,
                "scene_number": "1"
            },
            {
                "type": "dialogue",
                "speaker": "JOHN",
                "content": "This is a test.",
                "page": 1
            },
            {
                "type": "stage_direction",
                "content": "John sits down.",
                "page": 1
            }
        ]
    }
    "#;

    use backend::services::yjs_script_builder_service::YjsScriptBuilderService;
    let service = YjsScriptBuilderService::new(pool.clone());
    
    let result = service.build_script_from_json(json_data, None, "abc").await?;
    
    if result.success {
        println!("✅ Single chunk processed successfully");
        println!("   Script ID: {:?}", result.script_id);
        println!("   Items processed: {}", result.items_processed);
    } else {
        println!("❌ Failed: {:?}", result.errors);
    }
    
    Ok(())
}

async fn test_multiple_chunks(pool: &Arc<sqlx::PgPool>) -> Result<()> {
    let script_id = Uuid::new_v4();
    
    // Chunk 1: Initial metadata and first pages
    let chunk1 = r#"
    {
        "mode": "chunked",
        "chunk": {
            "number": 1,
            "total": 3,
            "pages_start": 1,
            "pages_end": 10
        },
        "metadata": {
            "title": "Test Script - Multi Chunk",
            "author": "Test Author",
            "total_pages": 30
        },
        "content": [
            {
                "type": "scene",
                "content": "INT. THEATER - NIGHT",
                "page": 1,
                "scene_number": "1"
            },
            {
                "type": "dialogue",
                "speaker": "ACTOR",
                "content": "To be or not to be...",
                "page": 2
            }
        ],
        "context": {
            "last_scene": "1",
            "last_speaker": "ACTOR"
        }
    }
    "#;

    use backend::services::yjs_script_builder_service::YjsScriptBuilderService;
    let service = YjsScriptBuilderService::new(pool.clone());
    
    println!("Processing chunk 1/3...");
    let result1 = service.build_script_from_json(chunk1, Some(script_id), "abc").await?;
    if result1.success {
        println!("✅ Chunk 1 processed: {}", result1.message);
    } else {
        println!("❌ Chunk 1 failed: {:?}", result1.errors);
        return Ok(());
    }

    // Chunk 2: Middle pages
    let chunk2 = r#"
    {
        "mode": "chunked",
        "chunk": {
            "number": 2,
            "total": 3,
            "pages_start": 11,
            "pages_end": 20
        },
        "content": [
            {
                "type": "scene",
                "content": "EXT. GARDEN - DAY",
                "page": 11,
                "scene_number": "2"
            },
            {
                "type": "dialogue",
                "speaker": "HAMLET",
                "content": "That is the question.",
                "page": 12
            }
        ],
        "context": {
            "last_scene": "2",
            "last_speaker": "HAMLET"
        }
    }
    "#;

    println!("Processing chunk 2/3...");
    let result2 = service.build_script_from_json(chunk2, Some(script_id), "abc").await?;
    if result2.success {
        println!("✅ Chunk 2 processed: {}", result2.message);
    } else {
        println!("❌ Chunk 2 failed: {:?}", result2.errors);
        return Ok(());
    }

    // Chunk 3: Final pages
    let chunk3 = r#"
    {
        "mode": "chunked",
        "chunk": {
            "number": 3,
            "total": 3,
            "pages_start": 21,
            "pages_end": 30
        },
        "content": [
            {
                "type": "scene",
                "content": "INT. CASTLE - NIGHT",
                "page": 21,
                "scene_number": "3"
            },
            {
                "type": "dialogue",
                "speaker": "OPHELIA",
                "content": "Good night, sweet prince.",
                "page": 25
            },
            {
                "type": "stage_direction",
                "content": "The curtain falls.",
                "page": 30
            }
        ],
        "context": {
            "last_scene": "3",
            "last_speaker": "OPHELIA"
        }
    }
    "#;

    println!("Processing chunk 3/3...");
    let result3 = service.build_script_from_json(chunk3, Some(script_id), "abc").await?;
    if result3.success {
        println!("✅ Chunk 3 processed: {}", result3.message);
        println!("📚 Complete script ID: {:?}", script_id);
    } else {
        println!("❌ Chunk 3 failed: {:?}", result3.errors);
    }

    // Verify the script was created
    println!("\nVerifying script in database...");
    let row = sqlx::query!(
        "SELECT title, created_by FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_optional(&**pool)
    .await?;
    
    if let Some(row) = row {
        println!("✅ Script found in database: '{}'", row.title);
        
        // Check YJS state
        let yjs_state = sqlx::query!(
            "SELECT COUNT(*) as count FROM yjs_recent_updates WHERE script_id = $1",
            script_id
        )
        .fetch_one(&**pool)
        .await?;
        
        println!("✅ YJS updates stored: {} updates", yjs_state.count.unwrap_or(0));
    } else {
        println!("❌ Script not found in database!");
    }

    Ok(())
}