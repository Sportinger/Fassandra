//! tests/e2e_persistence.rs

use tokio::time::{self, Duration};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::SinkExt;
use yrs::{Doc, Text, Transact, WriteTxn};
use uuid::Uuid;
use url::Url;

// Helper to create a Yjs update that adds a paragraph with text
fn create_test_update() -> Vec<u8> {
    let doc = Doc::new();
    let mut txn = doc.transact_mut();
    let text = txn.get_or_insert_text("default");
    text.insert(&mut txn, 0, "Hello, persistence test!");
    txn.encode_update_v1()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("--- Starting E2E Persistence Test ---");

    let script_id = Uuid::parse_str("8b3deca1-866d-441e-9c9a-cbb7f647b409")?;
    // This is the default JWT token for the dev user from the migration
    let auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZGV2LXVzZXItZmFrZS1pZCIsImVtYWlsIjoiZGV2QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJleHAiOjI1MzQwMjMwMDgwMH0.6s5wE6f_2mG-jJ0G8g4s0E8B_tA5hC9c8F3f8D6a3E0";
    let url_str = format!("ws://127.0.0.1:3001/api/scripts/{}/ws?token={}", script_id, auth_token);
    let url = Url::parse(&url_str)?;

    println!("Connecting to: {}", url);

    let (mut ws_stream, response) = connect_async(url_str).await?;

    println!("WebSocket handshake successful!");
    println!("Response: {:?}", response.status());

    let update_payload = create_test_update();
    println!("Created Yjs update payload ({} bytes)", update_payload.len());
    
    // Yjs messages need to be wrapped in the sync protocol format.
    // Message type 0 indicates a sync message.
    let mut yjs_sync_message = vec![0]; 
    yjs_sync_message.extend(update_payload);

    println!("Sending binary message over WebSocket...");
    ws_stream.send(Message::Binary(yjs_sync_message)).await?;
    println!("Message sent successfully.");
    
    // Close the connection gracefully
    ws_stream.close(None).await?;
    println!("Connection closed.");

    println!("\n--- Test Action Complete ---");
    println!("Waiting 5 seconds for snapshotting service to run...");
    time::sleep(Duration::from_secs(5)).await;

    println!("Test finished. Now, check the backend logs for results.");

    Ok(())
} 