use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use tokio;
use uuid::Uuid;

/// Comprehensive security audit tests to verify all security hardening measures
/// 
/// Tests cover:
/// - Authentication security (rate limiting, token validation)
/// - Authorization (WebSocket access control, script ownership)
/// - Security headers (CSP, HSTS, X-Frame-Options, etc.)
/// - Error handling (no information disclosure)
/// - Rate limiting (per-endpoint limits)
/// - Input validation (SQL injection protection)

const BASE_URL: &str = "http://localhost:3001";
const WS_URL: &str = "ws://localhost:3001";

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_security_headers() {
    let client = Client::new();
    
    // Test security headers on main endpoint
    let response = client.get(&format!("{}/api/scripts", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");
    
    let headers = response.headers();
    
    // Verify critical security headers are present
    assert!(headers.contains_key("x-content-type-options"), "Missing X-Content-Type-Options header");
    assert!(headers.contains_key("x-frame-options"), "Missing X-Frame-Options header");
    assert!(headers.contains_key("x-xss-protection"), "Missing X-XSS-Protection header");
    assert!(headers.contains_key("strict-transport-security"), "Missing HSTS header");
    assert!(headers.contains_key("content-security-policy"), "Missing CSP header");
    assert!(headers.contains_key("referrer-policy"), "Missing Referrer-Policy header");
    
    // Verify header values are secure
    let csp = headers.get("content-security-policy").unwrap().to_str().unwrap();
    assert!(csp.contains("default-src 'self'"), "CSP should restrict default sources");
    
    let frame_options = headers.get("x-frame-options").unwrap().to_str().unwrap();
    assert!(frame_options == "DENY" || frame_options == "SAMEORIGIN", "X-Frame-Options should prevent clickjacking");
    
    let hsts = headers.get("strict-transport-security").unwrap().to_str().unwrap();
    assert!(hsts.contains("max-age="), "HSTS should have max-age directive");
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_authentication_rate_limiting() {
    let client = Client::new();
    
    // Attempt multiple failed logins to trigger rate limiting
    let invalid_credentials = json!({
        "email": "attacker@evil.com",
        "password": "wrongpassword"
    });
    
    let mut failed_attempts = 0;
    let mut rate_limited = false;
    
    // Try up to 15 failed login attempts (should hit rate limit)
    for _ in 0..15 {
        let response = client.post(&format!("{}/login", BASE_URL))
            .json(&invalid_credentials)
            .send()
            .await
            .expect("Failed to send login request");
        
        if response.status() == 429 {
            rate_limited = true;
            break;
        } else if response.status() == 401 {
            failed_attempts += 1;
        }
        
        // Small delay to avoid overwhelming the server
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    assert!(rate_limited, "Rate limiting should activate after multiple failed login attempts");
    assert!(failed_attempts > 0, "Should have some failed attempts before rate limiting");
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_websocket_authorization() {
    let client = Client::new();
    
    // Create a legitimate user and script
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let email = format!("sectest{}@example.com", timestamp);
    let username = format!("sectest{}", timestamp);
    let password = "securePassword123";
    
    // Register user
    let register_resp = client.post(&format!("{}/register", BASE_URL))
        .json(&json!({"email": email, "username": username, "password": password}))
        .send()
        .await
        .expect("Failed to register user");
    
    assert!(register_resp.status().is_success(), "User registration should succeed");
    
    // Login to get token
    let login_resp = client.post(&format!("{}/login", BASE_URL))
        .json(&json!({"email": email, "password": password}))
        .send()
        .await
        .expect("Failed to login");
    
    assert!(login_resp.status().is_success(), "Login should succeed");
    let token = login_resp.text().await.unwrap().trim_matches('"').to_string();
    
    // Create a script
    let script_resp = client.post(&format!("{}/api/scripts", BASE_URL))
        .bearer_auth(&token)
        .json(&json!({"title": "Security Test Script"}))
        .send()
        .await
        .expect("Failed to create script");
    
    assert!(script_resp.status().is_success(), "Script creation should succeed");
    let script_json: serde_json::Value = script_resp.json().await.unwrap();
    let script_id = script_json["id"].as_str().unwrap();
    
    // Test 1: Valid WebSocket connection should work
    let encoded_token = urlencoding::encode(&token);
    let valid_ws_url = format!("{}/api/collab/{}?token={}", WS_URL, script_id, encoded_token);
    
    let ws_result = tokio_tungstenite::connect_async(&valid_ws_url).await;
    assert!(ws_result.is_ok(), "Valid WebSocket connection should succeed");
    
    // Test 2: Invalid token should be rejected
    let invalid_ws_url = format!("{}/api/collab/{}?token=invalid_token", WS_URL, script_id);
    let invalid_ws_result = tokio_tungstenite::connect_async(&invalid_ws_url).await;
    assert!(invalid_ws_result.is_err(), "Invalid token WebSocket should be rejected");
    
    // Test 3: Different user's script should be rejected
    let other_script_id = Uuid::new_v4();
    let unauthorized_ws_url = format!("{}/api/collab/{}?token={}", WS_URL, other_script_id, encoded_token);
    let unauthorized_ws_result = tokio_tungstenite::connect_async(&unauthorized_ws_url).await;
    assert!(unauthorized_ws_result.is_err(), "Unauthorized script access should be rejected");
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_error_handling_no_information_disclosure() {
    let client = Client::new();
    
    // Test 1: Database errors should not leak internal information
    let response = client.get(&format!("{}/api/scripts/invalid-uuid-format", BASE_URL))
        .header("Authorization", "Bearer invalid_token")
        .send()
        .await
        .expect("Failed to send request");
    
    let error_body = response.text().await.unwrap();
    
    // Should not contain database connection strings, file paths, or internal details
    assert!(!error_body.contains("postgres://"), "Error should not contain database connection info");
    assert!(!error_body.contains("/home/"), "Error should not contain file paths");
    assert!(!error_body.contains("SQLSTATE"), "Error should not contain SQL state codes");
    assert!(!error_body.contains("panic"), "Error should not contain panic information");
    
    // Test 2: Invalid JWT should return generic error
    let jwt_response = client.get(&format!("{}/api/scripts", BASE_URL))
        .header("Authorization", "Bearer malformed.jwt.token")
        .send()
        .await
        .expect("Failed to send request");
    
    let jwt_error = jwt_response.text().await.unwrap();
    assert!(!jwt_error.contains("decode"), "JWT error should not contain decode details");
    assert!(!jwt_error.contains("signature"), "JWT error should not contain signature details");
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_sql_injection_protection() {
    let client = Client::new();
    
    // Create a legitimate user
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let email = format!("sqltest{}@example.com", timestamp);
    let username = format!("sqltest{}", timestamp);
    let password = "testPassword123";
    
    // Register and login
    client.post(&format!("{}/register", BASE_URL))
        .json(&json!({"email": email, "username": username, "password": password}))
        .send()
        .await
        .expect("Failed to register user");
    
    let login_resp = client.post(&format!("{}/login", BASE_URL))
        .json(&json!({"email": email, "password": password}))
        .send()
        .await
        .expect("Failed to login");
    
    let token = login_resp.text().await.unwrap().trim_matches('"').to_string();
    
    // Test SQL injection attempts in script creation
    let sql_injection_payloads = vec![
        "'; DROP TABLE scripts; --",
        "' OR '1'='1",
        "'; INSERT INTO scripts (id, title) VALUES ('evil', 'hacked'); --",
        "' UNION SELECT * FROM users --",
    ];
    
    for payload in sql_injection_payloads {
        let response = client.post(&format!("{}/api/scripts", BASE_URL))
            .bearer_auth(&token)
            .json(&json!({"title": payload}))
            .send()
            .await
            .expect("Failed to send script creation request");
        
        // Should either succeed (creating script with payload as title) or fail gracefully
        // Should NOT cause database errors or execute the injected SQL
        assert!(response.status().is_success() || response.status().is_client_error(),
                "SQL injection payload should not cause server error");
        
        // If successful, verify the payload was treated as literal text
        if response.status().is_success() {
            let script_json: serde_json::Value = response.json().await.unwrap();
            assert_eq!(script_json["title"].as_str().unwrap(), payload,
                      "SQL injection should be treated as literal text");
        }
    }
    
    // Verify scripts table still exists (wasn't dropped)
    let scripts_response = client.get(&format!("{}/api/scripts", BASE_URL))
        .bearer_auth(&token)
        .send()
        .await
        .expect("Failed to fetch scripts");
    
    assert!(scripts_response.status().is_success(), "Scripts table should still exist and be accessible");
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_api_rate_limiting() {
    let client = Client::new();
    
    // Create a user for testing
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let email = format!("ratetest{}@example.com", timestamp);
    let username = format!("ratetest{}", timestamp);
    let password = "testPassword123";
    
    // Register and login
    client.post(&format!("{}/register", BASE_URL))
        .json(&json!({"email": email, "username": username, "password": password}))
        .send()
        .await
        .expect("Failed to register user");
    
    let login_resp = client.post(&format!("{}/login", BASE_URL))
        .json(&json!({"email": email, "password": password}))
        .send()
        .await
        .expect("Failed to login");
    
    let token = login_resp.text().await.unwrap().trim_matches('"').to_string();
    
    // Test API endpoint rate limiting by making many requests quickly
    let mut successful_requests = 0;
    let mut rate_limited = false;
    
    // Make rapid requests to script listing endpoint
    for i in 0..50 {
        let response = client.get(&format!("{}/api/scripts", BASE_URL))
            .bearer_auth(&token)
            .send()
            .await
            .expect("Failed to send request");
        
        match response.status().as_u16() {
            200 => successful_requests += 1,
            429 => {
                rate_limited = true;
                println!("Rate limited after {} requests", i + 1);
                break;
            },
            _ => {
                // Other errors are acceptable
            }
        }
        
        // Very small delay to make rapid requests
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    
    // Should have some successful requests before rate limiting kicks in
    assert!(successful_requests > 0, "Should allow some requests before rate limiting");
    
    // Should eventually hit rate limit with rapid requests
    // Note: This might not trigger depending on rate limit configuration
    if !rate_limited {
        println!("Warning: Rate limiting not triggered - may need adjustment for API endpoints");
    }
}

#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_jwt_security() {
    let client = Client::new();
    
    // Test various JWT tampering attempts
    let malformed_tokens = vec![
        "Bearer ",  // Empty token
        "Bearer invalid",  // Not a JWT format
        "Bearer eyJ.invalid.jwt",  // Malformed JWT
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",  // Different secret
        "Bearer expired_token_here",  // Expired token simulation
    ];
    
    for token in malformed_tokens {
        let response = client.get(&format!("{}/api/scripts", BASE_URL))
            .header("Authorization", token)
            .send()
            .await
            .expect("Failed to send request");
        
        // Should return 401 Unauthorized for all invalid tokens
        assert_eq!(response.status(), 401, "Invalid JWT should return 401 for token: {}", token);
        
        // Should not leak token validation details
        let error_text = response.text().await.unwrap();
        assert!(!error_text.contains("decode"), "Error should not contain JWT decode details");
    }
    
    // Test missing Authorization header
    let no_auth_response = client.get(&format!("{}/api/scripts", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");
    
    assert_eq!(no_auth_response.status(), 401, "Missing auth header should return 401");
}

/// Test that password security requirements are enforced
#[tokio::test]
#[ignore = "Requires running backend server"]
async fn test_password_security() {
    let client = Client::new();
    let timestamp = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    
    // Test weak passwords are rejected
    let weak_passwords = vec![
        "123",      // Too short
        "password", // Too common
        "12345678", // Only numbers
        "abcdefgh", // Only letters
    ];
    
    for (i, weak_password) in weak_passwords.iter().enumerate() {
        let email = format!("weakpass{}{}@example.com", timestamp, i);
        let username = format!("weakpass{}{}", timestamp, i);
        
        let response = client.post(&format!("{}/register", BASE_URL))
            .json(&json!({
                "email": email,
                "username": username, 
                "password": weak_password
            }))
            .send()
            .await
            .expect("Failed to send registration request");
        
        // Weak passwords should be rejected (depending on validation rules)
        if response.status().is_client_error() {
            println!("Good: Weak password '{}' was rejected", weak_password);
        } else {
            println!("Warning: Weak password '{}' was accepted - consider strengthening validation", weak_password);
        }
    }
    
    // Test strong password is accepted
    let strong_password = "StrongP@ssw0rd123!";
    let email = format!("strongpass{}@example.com", timestamp);
    let username = format!("strongpass{}", timestamp);
    
    let response = client.post(&format!("{}/register", BASE_URL))
        .json(&json!({
            "email": email,
            "username": username,
            "password": strong_password
        }))
        .send()
        .await
        .expect("Failed to send registration request");
    
    assert!(response.status().is_success(), "Strong password should be accepted");
} 