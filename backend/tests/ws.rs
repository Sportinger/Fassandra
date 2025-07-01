use futures_util::{StreamExt, SinkExt};
use reqwest::Client;
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::Message;

#[tokio::test]
#[ignore = "Requires running backend server on port 3001"]
async fn test_ws_auth_and_echo() {
    let client = Client::new();
    let base_url = "http://localhost:3001";
    
    // Generate unique email/username to avoid conflicts
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let email = format!("wsuser{}@example.com", timestamp);
    let username = format!("wsuser{}", timestamp);
    let password = "password123";

    // 1. Register user
    let register_resp = client.post(&format!("{}/register", base_url))
        .json(&json!({ "email": email, "username": username, "password": password }))
        .send().await.expect("Failed to send registration request");
    
    assert!(register_resp.status().is_success(), 
            "Registration failed with status: {}", register_resp.status());
    
    // 2. Login to get JWT token
    let login_resp = client.post(&format!("{}/login", base_url))
        .json(&json!({ "email": email, "password": password }))
        .send().await.expect("Failed to send login request");
    
    assert!(login_resp.status().is_success(), 
            "Login failed with status: {}", login_resp.status());
    
    // Extract token - backend returns raw JWT string
    let jwt = login_resp.text().await.expect("Failed to read login response")
                .trim_matches('"').to_string();
    
    // 3. Create script - using the correct endpoint from main.rs
    let script_resp = client.post(&format!("{}/api/scripts", base_url))
        .bearer_auth(&jwt)
        .json(&json!({ "title": "WS Test Script" }))
        .send().await.expect("Failed to send script creation request");
    
    assert!(script_resp.status().is_success(), 
            "Script creation failed with status: {}", script_resp.status());
    
    let script_json: Value = script_resp.json().await.expect("Failed to parse script JSON");
    let script_id = script_json["id"].as_str().expect("Failed to extract script ID");
    
    // 4. Connect to WebSocket using the correct path from main.rs
    let encoded_jwt = urlencoding::encode(&jwt);
    let ws_url = format!("ws://localhost:3001/api/collab/{}?token={}", script_id, encoded_jwt);
    
    let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
        .await.expect("Failed to connect to WebSocket");
    
    let (mut write, mut read) = ws_stream.split();
    
    // 5. Send a test message
    let test_msg = Message::Text(json!({
        "type": "test",
        "content": "hello"
    }).to_string());
    
    write.send(test_msg).await.expect("Failed to send WebSocket message");
    
    // 6. Verify response
    let response = read.next().await
        .expect("No WebSocket response received")
        .expect("WebSocket response error");
    
    let response_text = response.to_text().expect("Response was not text");
    assert!(response_text.contains("hello"), 
            "Response did not contain 'hello': {}", response_text);
} 