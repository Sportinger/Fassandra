pub mod types;
pub mod aligner;
pub mod deepgram;

// Simple facade to choose ASR provider in future
pub use deepgram::DeepgramAdapter;
