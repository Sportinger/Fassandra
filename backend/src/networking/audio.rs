use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::get,
    Router,
};
use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::audio::{
    aligner::CorridorAligner,
    deepgram::DeepgramConfig,
    types::{AsrPartial, ProgressMsg, ScriptInit, TokenMap},
    DeepgramAdapter,
};
use crate::auth::WebSocketAuth as WsAuth;
use crate::infrastructure::Config;

pub fn audio_routes(config: Arc<Config>) -> Router {
    let cfg_for_ws = config.clone();
    let cfg_for_api_ws = config.clone();

    Router::new()
        .route(
            "/ws/audio",
            get(move |ws: WebSocketUpgrade, auth: WsAuth| {
                let cfg = cfg_for_ws.clone();
                async move { ws.on_upgrade(move |socket| handle_audio_socket(socket, auth, cfg)) }
            }),
        )
        .route(
            "/api/ws/audio",
            get(move |ws: WebSocketUpgrade, auth: WsAuth| {
                let cfg = cfg_for_api_ws.clone();
                async move { ws.on_upgrade(move |socket| handle_audio_socket(socket, auth, cfg)) }
            }),
        )
}

async fn handle_audio_socket(mut socket: WebSocket, _auth: WsAuth, config: Arc<Config>) {
    tracing::info!(
        "[audio] client connected; ASR provider={}, lang={}, rate={}",
        config.asr_provider,
        config.asr_language,
        config.asr_sample_rate
    );
    // Expect an initial JSON message with tokens/offsets
    let mut token_map: Option<TokenMap> = None;
    let mut aligner: Option<CorridorAligner> = None;

    // Prepare Deepgram if configured
    let mut dg_adapter: Option<DeepgramAdapter> = None;
    let (asr_tx, mut asr_rx) = mpsc::channel::<AsrPartial>(64);

    if config.asr_provider == "deepgram" {
        if let Some(key) = &config.deepgram_api_key {
            let cfg = DeepgramConfig {
                api_key: key.clone(),
                language: config.asr_language.clone(),
                sample_rate: config.asr_sample_rate,
            };
            tracing::info!("[audio] connecting Deepgram stream...");
            match DeepgramAdapter::connect(cfg, asr_tx.clone()).await {
                Ok(adapter) => {
                    dg_adapter = Some(adapter);
                }
                Err(e) => {
                    let _ = socket
                        .send(Message::Text(format!(
                            "{{\"type\":\"error\",\"message\":\"deepgram_connect_failed: {}\"}}",
                            e
                        )))
                        .await;
                }
            }
        } else {
            let _ = socket
                .send(Message::Text(
                    "{\"type\":\"error\",\"message\":\"missing_deepgram_api_key\"}".into(),
                ))
                .await;
        }
    }

    // Main loop: multiplex WS messages and ASR results
    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.next() => { match msg {
            Message::Text(txt) => {
                // Try script init
                if let Ok(init) = serde_json::from_str::<ScriptInit>(&txt) {
                    if init.r#type == "script" && init.tokens.len() == init.offsets.len() {
                        tracing::info!("[audio] received script init: tokens={} ", init.tokens.len());
                        let tokens_norm = init.tokens.iter().map(|t| CorridorAligner::normalize_token(t)).collect();
                        token_map = Some(TokenMap { tokens: tokens_norm, offsets: init.offsets.clone() });
                        aligner = Some(CorridorAligner::new(token_map.as_ref().unwrap().clone(), 40, 400, 2));
                        let _ = socket.send(Message::Text("{\"type\":\"ready\"}".into())).await;
                    }
                } else if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
                    // Optional: progress echo for testing
                    let _ = socket.send(Message::Text(serde_json::to_string(&v).unwrap_or_default())).await;
                }
            }
            Message::Binary(data) => {
                // Audio frame from client
                tracing::debug!("[audio] rx binary frame: {} bytes", data.len());
                if let Some(adapter) = &dg_adapter {
                    let _ = adapter.send_audio(data).await; // ignore errors (handled by read task)
                }
            }
            Message::Close(_) => break,
            Message::Ping(p) => { let _ = socket.send(Message::Pong(p)).await; }
            Message::Pong(_) => {}
        } },
            Some(partial) = asr_rx.recv() => {
                // Send raw ASR for debugging
                if let Some(first) = partial.words.first() { tracing::debug!("[audio] asr partial: text='{}' first='{}'", partial.text, first.w); } else { tracing::debug!("[audio] asr partial: text='{}'", partial.text); }
                let _ = socket.send(Message::Text(
                    serde_json::to_string(&ProgressMsg{ r#type:"asr".into(), docPos: None, wordDocPos: None, wordRect: None, confidence: 0.0, asr: Some(partial.clone())}).unwrap_or_default()
                )).await;
                // Try align
                if let Some(al) = aligner.as_mut() {
                    if let Some(doc_pos) = al.update_with_asr(&partial) {
                        let trail = al.take_last_word_doc_positions();
                        let _ = socket.send(Message::Text(
                            serde_json::to_string(&ProgressMsg{ r#type:"progress".into(), docPos: Some(doc_pos), wordDocPos: if trail.is_empty() { None } else { Some(trail) }, wordRect: None, confidence: 0.7, asr: Some(partial) }).unwrap_or_default()
                        )).await;
                    }
                }
            },
            else => { break; }
        }
    }
}
