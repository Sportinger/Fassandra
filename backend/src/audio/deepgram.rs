use anyhow::{anyhow, Result};
use futures_util::{StreamExt, SinkExt};
use serde_json::Value;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::{protocol::Message, client::IntoClientRequest, http::HeaderValue}};

use crate::audio::types::{AsrPartial, ProgressWord};

#[derive(Clone, Debug)]
pub struct DeepgramConfig {
    pub api_key: String,
    pub language: String,
    pub sample_rate: u32,
}

pub struct DeepgramAdapter {
    audio_tx: mpsc::Sender<Vec<u8>>, // raw PCM16 frames
}

impl DeepgramAdapter {
    pub async fn connect(cfg: DeepgramConfig, mut result_tx: mpsc::Sender<AsrPartial>) -> Result<Self> {
        let url = format!(
            "wss://api.deepgram.com/v1/listen?model=nova-2&language={}&encoding=linear16&sample_rate={}&punctuate=true&interim_results=true",
            cfg.language, cfg.sample_rate
        );

        // Build a client request from URL so tungstenite fills required WS headers
        let mut req = url.into_client_request().map_err(|e| anyhow!(e))?;
        let auth_val = HeaderValue::from_str(&format!("Token {}", cfg.api_key))?;
        req.headers_mut().insert("Authorization", auth_val);
        let (ws, _resp) = connect_async(req).await?;
        tracing::info!("[deepgram] connected to streaming endpoint");
        let (mut ws_tx, mut ws_rx) = ws.split();

        // Channel for audio from caller
        let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<u8>>(64);

        // Task: forward audio
        tokio::spawn(async move {
            while let Some(frame) = audio_rx.recv().await {
                if ws_tx.send(Message::Binary(frame)).await.is_err() {
                    break;
                }
            }
            let _ = ws_tx.send(Message::Close(None)).await;
        });

        // Task: read results
        tokio::spawn(async move {
            while let Some(msg) = ws_rx.next().await {
                match msg {
                    Ok(Message::Text(txt)) => {
                        if let Ok(v) = serde_json::from_str::<Value>(&txt) {
                            if let Some(_is_final) = v.get("is_final").and_then(|b| b.as_bool()) {
                                // We accept interim and final partials
                                if let Some(alts) = v.pointer("/channel/alternatives").and_then(|a| a.as_array()) {
                                    if let Some(first) = alts.first() {
                                        let text = first.get("transcript").and_then(|t| t.as_str()).unwrap_or("").to_string();
                                        if !text.is_empty() { tracing::debug!("[deepgram] transcript: {}", text); }
                                        let mut words_vec: Vec<ProgressWord> = Vec::new();
                                        if let Some(words) = first.get("words").and_then(|w| w.as_array()) {
                                            for w in words {
                                                let wtxt = w.get("word").and_then(|t| t.as_str()).unwrap_or("").to_string();
                                                let start = w.get("start").and_then(|n| n.as_f64()).unwrap_or(0.0) as f32;
                                                let end = w.get("end").and_then(|n| n.as_f64()).unwrap_or(0.0) as f32;
                                                let conf = w.get("confidence").and_then(|n| n.as_f64()).map(|f| f as f32);
                                                words_vec.push(ProgressWord { w: wtxt, start, end, conf });
                                            }
                                        }
                                        let _ = result_tx.send(AsrPartial { text, words: words_vec }).await;
                                    }
                                }
                            }
                        }
                    }
                    Ok(Message::Ping(_)) => { /* ignored */ }
                    Ok(Message::Close(_)) => break,
                    _ => {}
                }
            }
        });

        Ok(Self { audio_tx })
    }

    pub async fn send_audio(&self, pcm16: Vec<u8>) -> Result<()> {
        self.audio_tx.send(pcm16).await.map_err(|e| anyhow!(e))
    }
}
