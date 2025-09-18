use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

// Import the service module
#[path = "../services/claude_session_service.rs"]
mod claude_session_service;

use claude_session_service::{ClaudeSessionService, SessionUpdate};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Claude Session Service Test");

    // Create service instance
    let service = Arc::new(ClaudeSessionService::new());

    // Test parameters
    let pdf_path = "/home/admins/Downloads/test_removed.pdf".to_string();
    let username = "test@example.com".to_string();

    println!("📄 PDF Path: {}", pdf_path);
    println!("👤 Username: {}", username);

    // Create a shared counter for output lines
    let output_count = Arc::new(Mutex::new(0));
    let output_count_clone = output_count.clone();

    // Start session with callback
    let session_id = service
        .start_session(
            pdf_path.clone(),
            username.clone(),
            move |_session_id: Uuid, update: SessionUpdate| {
                let output_count = output_count_clone.clone();
                tokio::spawn(async move {
                    match update {
                        SessionUpdate::Status { status, progress } => {
                            println!("📊 Status Update: {:?} - {}%", status, progress);
                        }
                        SessionUpdate::Output { line } => {
                            let mut count = output_count.lock().await;
                            *count += 1;
                            println!("📝 [{}] {}", *count, line);
                        }
                        SessionUpdate::PageProgress {
                            current_page,
                            total_pages,
                        } => {
                            println!("📄 Page Progress: {}/{}", current_page, total_pages);
                        }
                        SessionUpdate::Complete { script_id } => {
                            println!("✅ Session Complete! Script ID: {}", script_id);
                        }
                        SessionUpdate::Failed { error } => {
                            println!("❌ Session Failed: {}", error);
                        }
                        SessionUpdate::ChunkInfo {
                            total_pages,
                            total_chunks,
                        } => {
                            println!(
                                "📊 Chunk Info: {} pages, {} chunks",
                                total_pages, total_chunks
                            );
                        }
                        SessionUpdate::ChunkProgress {
                            current_chunk,
                            total_chunks,
                            pages_start,
                            pages_end,
                        } => {
                            println!(
                                "📦 Chunk Progress: {}/{} chunks, pages {}-{}",
                                current_chunk, total_chunks, pages_start, pages_end
                            );
                        }
                    }
                });
            },
        )
        .await?;

    println!("🎯 Session started with ID: {}", session_id);

    // Monitor session status
    let mut last_status = None;
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        if let Some(session_info) = service.get_session(session_id).await {
            if Some(&session_info.status) != last_status.as_ref() {
                println!(
                    "🔄 Current Status: {:?} ({}%)",
                    session_info.status, session_info.progress
                );
                last_status = Some(session_info.status.clone());
            }

            match session_info.status {
                claude_session_service::SessionStatus::Complete => {
                    println!("🎉 Session completed successfully!");
                    println!("📚 Script ID: {:?}", session_info.script_id);
                    println!(
                        "⏱️  Duration: {:?}",
                        session_info.completed_at.unwrap() - session_info.started_at
                    );
                    break;
                }
                claude_session_service::SessionStatus::Failed => {
                    println!("💥 Session failed!");
                    println!("❌ Error: {:?}", session_info.error);
                    break;
                }
                _ => continue,
            }
        } else {
            println!("⚠️  Session not found!");
            break;
        }
    }

    // Get final logs
    println!("\n📋 Final Session Logs:");
    if let Some(logs) = service.get_session_logs(session_id, 0).await {
        println!("Total output lines: {}", logs.len());

        // Show last 10 lines
        println!("\nLast 10 lines:");
        for (i, line) in logs.iter().rev().take(10).rev().enumerate() {
            println!("[{}] {}", logs.len() - 10 + i, line);
        }
    }

    Ok(())
}
