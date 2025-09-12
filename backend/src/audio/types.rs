use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptInit {
    pub r#type: String, // "script"
    pub tokens: Vec<String>,
    pub offsets: Vec<u32>, // ProseMirror doc positions for token starts
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressWord {
    pub w: String,
    pub start: f32,
    pub end: f32,
    pub conf: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsrPartial {
    pub text: String,
    pub words: Vec<ProgressWord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressMsg {
    pub r#type: String, // "progress"
    pub docPos: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wordRect: Option<serde_json::Value>,
    pub confidence: f32,
    pub asr: Option<AsrPartial>,
}

#[derive(Debug, Clone)]
pub struct TokenMap {
    pub tokens: Vec<String>,
    pub offsets: Vec<u32>,
}

