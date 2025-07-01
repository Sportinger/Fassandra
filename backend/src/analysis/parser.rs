use docx_rs::{read_docx, DocumentChild, ParagraphChild, RunChild, ReaderError};

use super::errors::AnalysisError;
// Remove imports related to old parser structs
// use super::structs::{Script, Section, SectionElement, DialogueLine, Speaker, StageDirection, CharacterAssignment};
// use uuid::Uuid;

/// Extracts plain text content from DOCX bytes using docx-rs v0.4.x API.
///
/// Attempts to read the DOCX file from the provided byte slice and returns
/// the concatenated text content of all paragraphs.
///
/// # Arguments
///
/// * `docx_bytes` - A byte slice (`&[u8]`) containing the DOCX file content.
///
/// # Returns
///
/// * `Ok(String)` containing the extracted text on success.
/// * `Err(AnalysisError)` if reading or parsing fails.
pub fn extract_text_from_docx(docx_bytes: &[u8]) -> Result<String, AnalysisError> {
    // Read the DOCX file content directly from bytes
    let docx_file = read_docx(docx_bytes).map_err(|e: ReaderError| {
        // Provide more context if possible, e.g., e.to_string()
        AnalysisError::DocxParsing(format!("Failed to read docx structure: {}", e))
    })?;

    let mut text_content = String::new();
    for child in docx_file.document.children {
        if let DocumentChild::Paragraph(p) = child {
            for content in p.children {
                if let ParagraphChild::Run(run) = content {
                    for run_child in run.children {
                        if let RunChild::Text(t) = run_child {
                            text_content.push_str(&t.text);
                        }
                        // Add spaces for tabs or other elements if needed for readability
                        // if let RunChild::Tab(_) = r_child { text_content.push(' '); }
                    }
                }
            }
            // Add a newline after each paragraph to maintain some structure
            text_content.push('\n');
        }
        // TODO: Handle other DocumentChild types if needed (e.g., tables)
    }

    Ok(text_content.trim().to_string()) // Trim whitespace
}

// --- REMOVE OLD PARSER FUNCTION AND TESTS ---
/*
pub fn parse_script_structure(plain_text: &str, filename: Option<&str>) -> Result<Script, AnalysisError> {
    // ... implementation of the old parser ...
}

#[cfg(test)]
mod tests {
    // ... tests for the old parser ...
    #[test]
    fn test_extract_frankenstein_docx() {
        // ... old test ...
    }

    #[test]
    fn test_extract_pessoa_docx() {
        // ... old test ... 
    }

     #[test]
    fn test_parse_frankenstein_structure() {
         // ... old test ... 
     }
}
*/
// --- END REMOVAL ---

// --- Optional: Example Usage or Unit Test ---
// #[cfg(test)]
// mod tests {
//     use super::*;
//     use std::fs;
//
//     #[test]
//     fn test_extract_simple_docx() {
//         // Note: You'd need a simple sample.docx file for this test
//         let bytes = fs::read("path/to/your/sample.docx").expect("Failed to read sample docx");
//         let text = extract_text_from_docx(&bytes).expect("Text extraction failed");
//         println!("Extracted Text:\n{}", text);
//         // Add assertions here based on your sample.docx content
//         assert!(text.contains("Expected text"));
//     }
// } 