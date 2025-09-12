# Auto-Follow (Mitlesen) — MVP Plan

Goal: From the browser mic, stream audio to an ASR (speech-to-text), align the recognized words with the script, and live-highlight the current position in the editor with low latency.

This document describes a minimal, incremental plan to get a working baseline first, then iterate for quality.

## Scope (MVP)

- Frontend captures mic audio and streams it to the backend via WebSocket.
- Backend forwards audio to an ASR engine (local sidecar or cloud) and receives partial transcripts with word timestamps.
- A simple corridor-based aligner maps partial ASR words to the script text and estimates the current document position.
- Frontend receives periodic position updates and moves the rehearsal line / highlights the active bubbles.

Out of scope for MVP: diarization, phonetic alignment, robust re-sync heuristics, database indexing, long-term storage of audio, and advanced confidence models.

## Architecture (MVP)

```
Browser (mic)
  └── WebSocket (audio frames: PCM16/Opus)
      └── Backend (Axum WS)
          ├── ASR Adapter (local sidecar or cloud API)
          ├── Aligner (in-memory, corridor-based)
          └── Progress Stream (WS → frontend)
```

Notes:
- Keep the aligner and ASR adapter behind simple traits so we can swap engines later.
- The script is loaded once (latest version) into the aligner and normalized into tokens with a token→docPos map for precise highlighting.

## Data Contracts

### Audio WS (client → backend)

- URL: `/ws/audio` (authenticated like the editor)
- Binary preferred (raw PCM16LE @ 16kHz or 48kHz). If needed, JSON envelopes are allowed.

Binary framing (recommended):
- 20–40 ms frames (e.g., 320–640 samples @ 16kHz) to balance latency and overhead.

JSON framing (fallback):
```json
{ "type": "audio", "seq": 1234, "sampleRate": 16000, "data": "<base64 PCM16LE>" }
```

Control messages (optional):
```json
{ "type": "start", "sampleRate": 16000 }
{ "type": "stop" }
```

### Progress WS (backend → frontend)

Endpoint options:
- Reuse `/ws/audio` bidirectional channel for both ASR transcripts and progress, or
- Expose `/ws/progress` from the backend and subscribe from the editor (cleaner separation).

Message (periodic, ~4–8 per second):
```json
{
  "type": "progress",
  "docPos": 12345,         // ProseMirror-compatible char position (or mapped node+offset)
  "wordRect": {"left": 120, "top": 540, "width": 80, "height": 20}, // optional
  "confidence": 0.78,
  "asr": {
    "text": "ich bin in einer merkwürdigen gemütsverfassung",
    "words": [
      {"w": "ich", "start": 12.30, "end": 12.45, "conf": 0.86},
      {"w": "bin", "start": 12.45, "end": 12.60, "conf": 0.92}
    ]
  }
}
```

## Backend — Minimal Tasks

1) WebSocket endpoint (`/ws/audio`)
- Accept auth (reuse existing session/jwt).
- Accept 16 kHz PCM16LE frames (binary). Buffer ~0.2–0.5 s for ASR batching.

2) ASR Adapter
- Strategy  (cloud): call a streaming API (deepgram). api key: c786e8440e493e15ace20ad13c8c21d0b95d84c8
- Output: partial results with word timestamps every 300–500 ms.

3) Script Loader (in-memory)
- Fetch current script content for the session and keep it in memory (string).
- Normalize to tokens: lowercase, strip punctuation, collapse whitespace.
- Build `tokens[]` and `offsets[]` (token index → original doc position) for precise mapping.

4) Corridor Aligner (baseline)
- Maintain a pointer `p` (current token index).
- For every partial ASR buffer (last N words):
  - Normalize tokens; compare to a corridor `[p - backtrack, p + lookahead]` (e.g., backtrack 25 tokens, lookahead 250 tokens).
  - Score candidates with token-level Levenshtein/WER.
  - Pick best; update `p` if score > threshold or stable for K frames.
  - Map token index → `docPos` using `offsets[]` and send progress.

5) Progress Stream
- Send `progress` messages to the frontend via WS (same channel or `/ws/progress`).
- Include a simple `confidence` field (0–1). Hold position if confidence falls below min.

## Frontend — Minimal Tasks

1) Mic capture
- Request mic permission via `getUserMedia({audio:true})`.
- Use `AudioWorklet` (preferred) or `MediaRecorder` to create 16 kHz PCM frames.

2) WebSocket client
- Open WS to `/ws/audio`.
- Send frames continuously while recording is on; show status indicator.

3) Apply progress
- Subscribe to `progress` messages.
- Move rehearsal line and highlight the active bubbles when `confidence >= threshold`.
- Provide a “Lock” toggle to pause auto-follow without stopping capture.

4) UI affordances
- Start/Stop button, connection indicator, confidence meter.
- Small toast when we fall back to “searching…” due to low confidence.

## Acceptance Criteria (MVP)

- Starting capture moves the highlight within ~1–2 seconds from speech.
- Progress updates arrive at least 3× per second.
- Highlight never jumps backward unless a manual resync is triggered.
- Turning off capture stops audio and closes WS cleanly.

## Nice-to-Haves (Phase 2+)

- N-gram shortlist for faster/robust matching on long scripts.
- Better smoothing: hysteresis + small Viterbi over a few seconds.
- Simple diarization (who is speaking) to bias matching within blocks.
- Phoneme-aware matching for noisy stages.
- Operator tools: “Jump to here”, “Re-sync”, latency knob.

## Security & Privacy

- Respect project auth on both WS endpoints.
- Make ASR engine configurable: local-only vs. cloud. If cloud is used, clearly mark in the UI, and avoid storing audio.
- No persistent audio storage in MVP.

## Implementation Checklist

- [ ] FE: Mic capture + WS framing (16k PCM)
- [ ] BE: `/ws/audio` endpoint in Axum
- [ ] BE: ASR adapter (choose local sidecar or cloud)
- [ ] BE: Normalize + tokenize script (in-memory) and create token→docPos map
- [ ] BE: Corridor aligner (WER/Levenshtein)
- [ ] BE: Progress messages with confidence
- [ ] FE: Apply progress to rehearsal line + bubble highlight
- [ ] FE: Start/Stop + indicators

## Configuration

Environment variables (proposal):

```
ASR_PROVIDER=local|gcp|aws|azure
ASR_WS_URL=ws://localhost:4001/asr         # for local sidecar
ASR_LANGUAGE=de-DE
ASR_SAMPLE_RATE=16000
ALIGN_LOOKAHEAD=250
ALIGN_BACKTRACK=25
ALIGN_CONF_THRESHOLD=0.6
ALIGN_STABLE_FRAMES=3
deepgramAPI=c786e8440e493e15ace20ad13c8c21d0b95d84c8
```

## Dev Notes

- Start with the simplest path: local sidecar with `faster-whisper` small/int8; keep code paths abstracted.
- Corridor width is a practical knob: wider = more robust to skips, narrower = lower CPU.
- If scripts change while tracking, refresh tokens on next idle window (stop audio or after a pause) — not needed for MVP.

