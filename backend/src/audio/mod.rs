pub mod aligner;
pub mod deepgram;
pub mod types;

// Simple facade to choose ASR provider in future
pub use deepgram::DeepgramAdapter;
