import type { Editor as TiptapEditor } from '@tiptap/react';

export type ProgressMsg = {
  type: 'progress' | 'asr' | 'ready' | 'error';
  docPos?: number;
  wordDocPos?: number[];
  confidence?: number;
  asr?: {
    text: string;
    words: Array<{ w: string; start: number; end: number; conf?: number }>;
  };
};

export class AutoFollowService {
  private editor: TiptapEditor;
  private scriptId: string;
  private token: string;
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private frameBuffer: Int16Array[] = [];
  private sampleRate = 48000; // use system sample rate; backend configured accordingly
  private sendInterval: number | null = null;
  private onProgress: (msg: ProgressMsg) => void;

  constructor(editor: TiptapEditor, scriptId: string, token: string, onProgress: (msg: ProgressMsg) => void) {
    this.editor = editor;
    this.scriptId = scriptId;
    this.token = token;
    this.onProgress = onProgress;
  }

  async start(): Promise<void> {
    // connect WS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Use /api/ws/audio so it is proxied by Caddy to backend
    const wsUrl = `${protocol}//${host}/api/ws/audio?token=${encodeURIComponent(this.token)}&script_id=${encodeURIComponent(this.scriptId)}`;
    console.debug('[AutoFollow] Connecting WS:', wsUrl);
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      console.debug('[AutoFollow] WS open');
    };
    this.ws.onmessage = (e) => {
      try {
        const msg: ProgressMsg = JSON.parse(e.data);
        console.debug('[AutoFollow] WS message:', msg.type, msg);
        this.onProgress(msg);
      } catch {}
    };
    this.ws.onerror = (ev) => {
      console.error('[AutoFollow] WS error', ev);
    };
    this.ws.onclose = (ev) => {
      console.debug('[AutoFollow] WS close:', ev.code, ev.reason);
    };

    await this.initAudio();
    await this.sendScriptTokens();
    this.startSending();
  }

  async stop(): Promise<void> {
    if (this.sendInterval) { window.clearInterval(this.sendInterval); this.sendInterval = null; }
    if (this.processor) { this.processor.disconnect(); this.processor.onaudioprocess = null; this.processor = null; }
    if (this.audioCtx) { try { await this.audioCtx.close(); } catch {} this.audioCtx = null; }
    if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => t.stop()); this.mediaStream = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }

  private async initAudio(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.debug('[AutoFollow] getUserMedia granted, tracks:', this.mediaStream.getAudioTracks().map(t => ({ label: t.label, settings: t.getSettings?.() })));
    this.audioCtx = new AudioContext();
    this.sampleRate = this.audioCtx.sampleRate | 0;
    console.debug('[AutoFollow] AudioContext sampleRate:', this.sampleRate);
    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    const bufferSize = 2048; // small for low latency
    this.processor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.frameBuffer.push(pcm);
    };
  }

  private startSending(): void {
    // send frames ~30fps (every ~33ms)
    this.sendInterval = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (this.frameBuffer.length === 0) return;
      // concatenate buffered frames
      let total = 0;
      for (const f of this.frameBuffer) total += f.length;
      const merged = new Int16Array(total);
      let off = 0;
      for (const f of this.frameBuffer) { merged.set(f, off); off += f.length; }
      this.frameBuffer = [];
      console.debug('[AutoFollow] Sending audio frame bytes:', merged.byteLength);
      this.ws.send(merged.buffer);
    }, 40);
  }

  private async sendScriptTokens(): Promise<void> {
    if (!this.ws) return;
    // Extract tokens and doc offsets from ProseMirror doc
    const state = this.editor.state as any;
    const tokens: string[] = [];
    const offsets: number[] = [];
    const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);

    state.doc.descendants((node: any, pos: number) => {
      if (node.isText && node.text) {
        let i = 0;
        while (i < node.text.length) {
          while (i < node.text.length && !isWordChar(node.text[i])) i++;
          if (i >= node.text.length) break;
          const start = i;
          while (i < node.text.length && isWordChar(node.text[i])) i++;
          const word = node.text.slice(start, i);
          tokens.push(word);
          offsets.push(pos + start);
        }
      }
      return true;
    });

    const msg = { type: 'script', tokens, offsets };
    this.ws.addEventListener('open', () => {
      console.debug('[AutoFollow] Sending script init:', { tokenCount: tokens.length });
      this.ws?.send(JSON.stringify(msg));
    }, { once: true });
    if (this.ws.readyState === WebSocket.OPEN) {
      console.debug('[AutoFollow] WS already open; sending script init');
      this.ws.send(JSON.stringify(msg));
    }
  }
}
