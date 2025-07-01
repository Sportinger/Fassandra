 // Use the actual struct name
use backend::gemini_api::{call_gemini_for_parsing, GeminiApiError}; // Import error too
use std::fs;
use std::path::Path;
use tokio;
use reqwest::Client; // Need client for the test
use std::time::Duration; // For client timeout
use dotenvy::dotenv; // To load .env

// Helper function to get fixture path (copied from original location)
// Note: This assumes the test is run from the 'backend' directory.
fn get_fixture_path(fixture_filename: &str) -> std::path::PathBuf {
    // Use CARGO_MANIFEST_DIR to get the path to the crate root (backend)
    let crate_root = Path::new(env!("CARGO_MANIFEST_DIR"));
    crate_root.join("tests").join("fixtures").join(fixture_filename)
}


#[tokio::test]
#[ignore] // Keep ignored as it requires network/API key
async fn test_gemini_parsing_integration() {
    dotenv().ok(); // Load .env file from current or parent directories

    // Use a dedicated client for the test
    let client = Client::builder()
        .timeout(Duration::from_secs(300)) // Increased timeout to 5 minutes
        .build()
        .expect("Failed to build Reqwest client for test");

    // --- Load Fixture Data ---
    // Use the correct filename found in the directory listing
    let fixture_filename = "FRANKENSTEIN_REGIEBUCH 4.09.2021.docx";
    let fixture_path = get_fixture_path(fixture_filename);
    println!("Attempting to load fixture from: {:?}", fixture_path); // Debug print
    let docx_bytes = match fs::read(&fixture_path) {
        Ok(bytes) => bytes,
        Err(e) => {
            // Keep the alternative path check just in case, but use the correct filename
             let alt_path = Path::new("backend/tests/fixtures/").join(fixture_filename); 
             println!("Attempting to load fixture from alternative path: {:?}", alt_path);
             match fs::read(&alt_path) {
                 Ok(bytes) => bytes,
                 Err(e2) => panic!(
                     "Failed to load fixture from {:?} ({}) or {:?} ({})", 
                     fixture_path, e, alt_path, e2
                 ),
             }
        }
    };

    // --- Extract Text ---
    // Assuming extract_text_from_docx is available (might need to make it pub or move it)
    // For now, let's use a placeholder or ensure backend::analysis::parser is pub
    // We need the parser function here! Let's add it temporarily if needed,
    // or better, ensure it's callable.
    // *** TEMPORARY: Using a large chunk of placeholder text to avoid parser dependency ***
    // let script_text = "SCENE I. WALTON'S CABIN ..."; // Replace with actual extraction if possible
    // --- Re-enable actual text extraction ---
    let script_text = match backend::analysis::parser::extract_text_from_docx(&docx_bytes) {
         Ok(text) => text,
         Err(e) => panic!("Failed to extract text from DOCX for test: {}", e),
    };


    // Limit text length for faster testing (approx first 10%)
    let text_len = script_text.chars().count();
    let partial_text: String = script_text.chars().take(text_len / 10).collect();
     println!("Using partial text ({} chars):
{}", partial_text.len(), &partial_text[0..std::cmp::min(partial_text.len(), 100)]); // Print start of partial text


    // --- Call Gemini API ---
    let result = call_gemini_for_parsing(&client, &partial_text).await;

    // --- Process Result ---
    match result {
        Ok(parsed_script) => {
            println!("Successfully parsed script: {:?}", parsed_script);

             // --- Save the successful response ---
            let output_dir = Path::new("target/test_outputs");
            fs::create_dir_all(output_dir).expect("Failed to create test output directory");
            let output_path = output_dir.join("gemini_response_partial_frankenstein.json");

            let json_output = serde_json::to_string_pretty(&parsed_script)
                .expect("Failed to serialize parsed script to JSON");

            fs::write(&output_path, json_output)
                .expect("Failed to write Gemini response to file");
            println!("Successfully saved Gemini response to {:?}", output_path);


            // Basic assertions (adapt as needed based on expected partial output)
            assert!(parsed_script.title.is_some() || parsed_script.sections.iter().any(|s| s.title.is_some()), "Expected some title (script or section)");
            assert!(!parsed_script.sections.is_empty(), "Expected at least one section");
             let first_section = &parsed_script.sections[0];
             assert!(!first_section.content.is_empty(), "Expected content in the first section");

            // Add more specific assertions based on expected structure of the partial script
             println!("Partial Frankenstein script parsed and saved successfully.");

        }
        Err(e) => {
            match e {
                GeminiApiError::ApiError { status, body } => {
                    eprintln!("Gemini API Error: Status Code: {}", status);
                    eprintln!("Response Body: {}", body);
                    // Attempt to parse body as JSON for better error display
                    if let Ok(json_body) = serde_json::from_str::<serde_json::Value>(&body) {
                         eprintln!("Parsed Error Body:
{}", serde_json::to_string_pretty(&json_body).unwrap_or_else(|_| body.clone()));
                    }
                    panic!("Gemini API returned an error (Status: {})", status);
                }
                GeminiApiError::StructureParsing(parse_err) => {
                     eprintln!("Failed to parse the structure returned by Gemini:");
                     eprintln!("{}", parse_err); // The error now contains the raw text
                     panic!("Failed to parse structure from Gemini response.");
                }
                _ => {
                     eprintln!("An unexpected Gemini API error occurred: {}", e);
                     panic!("Gemini API call failed: {}", e);
                }
            }
        }
    }
} 