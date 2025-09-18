use thiserror::Error;

/// Errors that can occur during script analysis.
#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("IO error processing script: {0}")]
    Io(#[from] std::io::Error),
    #[error("Script format error: {0}")]
    Format(String),
}
