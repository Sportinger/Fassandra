use std::env;
use std::fs;
use std::path::Path;
use reqwest::Client;
use serde_json::Value;
use dotenvy::dotenv;
use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    
    println!("🧪 Gemini Prompt Testing Tool");
    println!("============================");
    
    // Check for test document
    let test_doc_path = "../backend/tests/fixtures/FRANKENSTEIN_REGIEBUCH 4.09.2021.docx";
    if !Path::new(test_doc_path).exists() {
        println!("❌ Test document not found at: {}", test_doc_path);
        println!("Please make sure the DOCX file exists in the backend fixtures.");
        return Ok(());
    }
    
    // Extract text from DOCX
    println!("📄 Extracting text from test document...");
    let docx_bytes = fs::read(test_doc_path)?;
    let text = extract_text_from_docx(&docx_bytes)?;
    println!("📊 Full text length: {} characters", text.len());
    
    // Use 1/10 of text (same as backend)
    let text_len = text.len();
    let end_index = text_len / 10;
    let partial_text = match text.get(..end_index) {
        Some(slice) => slice.to_string(),
        None => text.clone(),
    };
    println!("📊 Using 1/10 of text: {} characters", partial_text.len());
    
    // Show first 500 chars of what we're sending to Gemini
    println!("📝 First 500 chars of text being analyzed:");
    println!("{}", &partial_text[..partial_text.len().min(500)]);
    println!("...\n");
    
    // Load prompt template
    let prompt_template = fs::read_to_string("script_analysis.prompt")?;
    let prompt = prompt_template.replace("{}", &partial_text);
    
    // Call Gemini API
    println!("🤖 Calling Gemini API...");
    let response = call_gemini_api(&prompt).await?;
    
    // Save response
    let output_file = "gemini_response.json";
    fs::write(output_file, &response)?;
    println!("💾 Response saved to: {}", output_file);
    
    // Try to parse as JSON
    match serde_json::from_str::<Value>(&response) {
        Ok(json) => {
            println!("✅ Response is valid JSON");
            
            // Check structure
            if let Some(sections) = json.get("sections").and_then(|s| s.as_array()) {
                println!("📋 Found {} sections", sections.len());
                
                for (i, section) in sections.iter().enumerate() {
                    if let Some(content) = section.get("content").and_then(|c| c.as_array()) {
                        println!("  Section {}: {} content elements", i + 1, content.len());
                        
                        // Check for actual dialogue content
                        let dialogue_count = content.iter()
                            .filter(|item| {
                                item.get("type").and_then(|t| t.as_str()) == Some("dialogue") &&
                                item.get("line").and_then(|l| l.as_str()).is_some() &&
                                !item.get("line").and_then(|l| l.as_str()).unwrap_or("").is_empty()
                            })
                            .count();
                        
                        println!("    - {} dialogue elements with actual content", dialogue_count);
                        
                        // Show first few dialogue examples
                        for (j, item) in content.iter().enumerate() {
                            if j >= 3 { break; } // Only show first 3
                            if item.get("type").and_then(|t| t.as_str()) == Some("dialogue") {
                                let speaker = item.get("speaker").and_then(|s| s.as_str()).unwrap_or("Unknown");
                                let line = item.get("line").and_then(|l| l.as_str()).unwrap_or("(empty)");
                                println!("      Example: {} -> {}", speaker, &line[..line.len().min(50)]);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            println!("❌ Response is not valid JSON: {}", e);
            println!("Raw response (first 1000 chars):");
            println!("{}", &response[..response.len().min(1000)]);
        }
    }
    
    Ok(())
}

async fn call_gemini_api(prompt: &str) -> Result<String> {
    let api_key = env::var("GEMINI_API_KEY")?;
    let api_url = env::var("GEMINI_API_URL")?;
    
    let client = Client::new();
    
    let payload = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    });
    
    let response = client
        .post(&api_url)
        .query(&[("key", api_key)])
        .json(&payload)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await?;
        anyhow::bail!("API error {}: {}", status, body);
    }
    
    let response_json: Value = response.json().await?;
    
    let text = response_json
        .get("candidates")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.get(0))
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .and_then(|arr| arr.get(0))
        .and_then(|part| part.get("text"))
        .and_then(|text| text.as_str())
        .ok_or_else(|| anyhow::anyhow!("Could not extract text from response"))?;
    
    // Clean up any markdown formatting
    let cleaned = text
        .strip_prefix("```json")
        .unwrap_or(text)
        .strip_suffix("```")
        .unwrap_or(text)
        .trim();
    
    Ok(cleaned.to_string())
}

fn extract_text_from_docx(docx_bytes: &[u8]) -> Result<String> {
    use docx_rs::{read_docx, DocumentChild, ParagraphChild, RunChild};
    
    let docx_file = read_docx(docx_bytes)?;
    let mut text_content = String::new();
    
    for child in docx_file.document.children {
        if let DocumentChild::Paragraph(p) = child {
            for content in p.children {
                if let ParagraphChild::Run(run) = content {
                    for run_child in run.children {
                        if let RunChild::Text(t) = run_child {
                            text_content.push_str(&t.text);
                        }
                    }
                }
            }
            text_content.push('\n');
        }
    }
    
    Ok(text_content.trim().to_string())
} 