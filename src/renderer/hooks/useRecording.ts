/**
 * useRecording.ts
 * Manages microphone capture with Web Audio API + AudioWorklet.
 * Buffers PCM locally (no IPC until done), then sends the full buffer.
 */
import { useRef, useCallback } from 'react';
import { AUDIO_SAMPLE_RATE } from '../../shared/constants';

// AudioWorklet processor code — inlined as blob to avoid URL resolution issues
const WORKLET_CODE = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunks = [];
    this._active = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') {
        this._active = false;
        const total = this._chunks.reduce((n, c) => n + c.length, 0);
        const out = new Float32Array(total);
        let off = 0;
        for (const c of this._chunks) { out.set(c, off); off += c.length; }
        this.port.postMessage({ type: 'done', buffer: out.buffer }, [out.buffer]);
        this._chunks = [];
      }
    };
  }
  process(inputs) {
    if (!this._active) return false;
    const ch = inputs[0]?.[0];
    if (ch) this._chunks.push(ch.slice());
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

export function useRecording() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resolverRef = useRef<((buf: ArrayBuffer) => void) | null>(null);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      audioCtxRef.current = ctx;

      // Load worklet from blob URL
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'audio-processor');
      workletNodeRef.current = worklet;

      source.connect(worklet);
      worklet.connect(ctx.destination);
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
      throw err;
    }
  }, []);

  const stopRecording = useCallback((): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const worklet = workletNodeRef.current;
      if (!worklet) {
        reject(new Error('No active recording'));
        return;
      }

      resolverRef.current = resolve;

      worklet.port.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'done') {
          resolve(e.data.buffer as ArrayBuffer);

          // Cleanup
          streamRef.current?.getTracks().forEach(t => t.stop());
          audioCtxRef.current?.close();
          workletNodeRef.current = null;
          audioCtxRef.current = null;
          streamRef.current = null;
        }
      };

      worklet.port.postMessage('stop');
    });
  }, []);

  return { startRecording, stopRecording };
}
