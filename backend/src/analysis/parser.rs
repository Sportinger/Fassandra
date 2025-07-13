use docx_rs::{read_docx, DocumentChild, ParagraphChild, RunChild, ReaderError};

use super::errors::AnalysisError;
// Remove imports related to old parser structs
// use super::structs::{Script, Section, SectionElement, DialogueLine, Speaker, StageDirection, CharacterAssignment};
// use uuid::Uuid;

/// Represents a text content element with its page number
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TextWithPage {
    pub text: String,
    pub page_number: i32,
}

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

/// Extracts text content with page information from DOCX bytes.
///
/// This function attempts to detect page breaks in the DOCX file and assign
/// page numbers to text content accordingly.
///
/// # Arguments
///
/// * `docx_bytes` - A byte slice (`&[u8]`) containing the DOCX file content.
///
/// # Returns
///
/// * `Ok(Vec<TextWithPage>)` containing text elements with page numbers on success.
/// * `Err(AnalysisError)` if reading or parsing fails.
pub fn extract_text_with_pages_from_docx(docx_bytes: &[u8]) -> Result<Vec<TextWithPage>, AnalysisError> {
    // Read the DOCX file content directly from bytes
    let docx_file = read_docx(docx_bytes).map_err(|e: ReaderError| {
        AnalysisError::DocxParsing(format!("Failed to read docx structure: {}", e))
    })?;

    let mut text_elements = Vec::new();
    let mut current_page = 1;
    let mut paragraph_text = String::new();

    for child in docx_file.document.children {
        if let DocumentChild::Paragraph(p) = child {
            paragraph_text.clear();
            
            for content in p.children {
                if let ParagraphChild::Run(run) = content {
                    for run_child in run.children {
                        match run_child {
                            RunChild::Text(t) => {
                                paragraph_text.push_str(&t.text);
                            }
                            RunChild::Break(br) => {
                                // Check if this is a page break
                                // Note: docx-rs might not expose all break types directly
                                // We'll detect potential page breaks by checking for specific patterns
                                // or use a heuristic approach
                                
                                // For now, we'll assume manual page breaks increment the page number
                                // This is a simplified approach - real DOCX files may have more complex page break logic
                                current_page += 1;
                                
                                // If we have text accumulated, save it before the page break
                                if !paragraph_text.trim().is_empty() {
                                    text_elements.push(TextWithPage {
                                        text: paragraph_text.trim().to_string(),
                                        page_number: current_page - 1, // Text was on previous page
                                    });
                                    paragraph_text.clear();
                                }
                            }
                            RunChild::Tab(_) => {
                                paragraph_text.push(' ');
                            }
                            _ => {
                                // Handle other run child types if needed
                            }
                        }
                    }
                }
            }
            
            // Add paragraph text if not empty
            if !paragraph_text.trim().is_empty() {
                text_elements.push(TextWithPage {
                    text: paragraph_text.trim().to_string(),
                    page_number: current_page,
                });
            }
        }
        // TODO: Handle other DocumentChild types if needed (e.g., tables)
    }

    // If no text elements were found, return at least one element with page 1
    if text_elements.is_empty() {
        text_elements.push(TextWithPage {
            text: String::new(),
            page_number: 1,
        });
    }

    Ok(text_elements)
}

/// Converts text elements with page information to a plain text string.
///
/// This function takes the output from `extract_text_with_pages_from_docx` and
/// converts it back to a plain text string, preserving the original structure.
///
/// # Arguments
///
/// * `text_elements` - Vector of text elements with page information.
///
/// # Returns
///
/// * `String` containing the concatenated text content.
pub fn text_with_pages_to_string(text_elements: &[TextWithPage]) -> String {
    text_elements
        .iter()
        .map(|element| element.text.as_str())
        .collect::<Vec<&str>>()
        .join("\n")
}

/// Converts text elements with page information to a string with page markers.
///
/// This function enhances the text with clear page markers to help Gemini
/// understand page boundaries and assign accurate page numbers to content.
///
/// # Arguments
///
/// * `text_elements` - Vector of text elements with page information.
///
/// # Returns
///
/// * `String` containing the text with page markers for better AI processing.
pub fn text_with_pages_to_string_with_page_markers(text_elements: &[TextWithPage]) -> String {
    let mut result = String::new();
    let mut current_page = 0;
    
    for element in text_elements {
        // Add page marker when we encounter a new page
        if element.page_number != current_page {
            if current_page > 0 {
                result.push_str("\n--- END OF PAGE ---\n");
            }
            result.push_str(&format!("--- PAGE {} ---\n", element.page_number));
            current_page = element.page_number;
        }
        
        // Add the text content
        if !element.text.trim().is_empty() {
            result.push_str(&element.text);
            result.push('\n');
        }
    }
    
    // Add final page marker
    if current_page > 0 {
        result.push_str("--- END OF PAGE ---\n");
    }
    
    result
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