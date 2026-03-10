/**
 * WhisperEngine: Singleton wrapping @fugood/whisper.node (whisper.cpp native binding).
 * Uses Metal GPU on macOS Apple Silicon, CPU on others.
 * Model is preloaded at startup to eliminate cold-start delay.
 */
import { EventEmitter } from 'events';
import type { WhisperContext } from '@fugood/whisper.node';
import { getModelPath, isModelDownloaded } from './model-manager';
import { CHINESE_INITIAL_PROMPT } from '../../shared/constants';

export class WhisperEngine extends EventEmitter {
  private static instance: WhisperEngine;
  private context: WhisperContext | null = null;
  private stopFn: (() => Promise<void>) | null = null;

  private constructor() {
    super();
  }

  static getInstance(): WhisperEngine {
    if (!WhisperEngine.instance) {
      WhisperEngine.instance = new WhisperEngine();
    }
    return WhisperEngine.instance;
  }

  /** Preload model at startup. Safe to call multiple times. */
  async preload(): Promise<void> {
    if (this.context) return;
    if (!isModelDownloaded()) {
      throw new Error('Whisper model not downloaded. Please download it from Settings → Model.');
    }

    const { initWhisper } = await import('@fugood/whisper.node');
    this.context = await initWhisper({ filePath: getModelPath(), useGpu: true });
    console.log('[WhisperEngine] Model loaded, GPU enabled if available');
  }

  /** Transcribe raw 16kHz mono Float32Array PCM data. */
  async transcribe(
    pcmFloat32: Float32Array,
    language: string,
  ): Promise<{ text: string; durationMs: number }> {
    if (!this.context) {
      await this.preload();
    }

    // Convert Float32 [-1,1] → Int16 (what whisper.cpp expects)
    const int16 = float32ToInt16(pcmFloat32);
    const startMs = Date.now();

    const prompt = language === 'zh' ? CHINESE_INITIAL_PROMPT : undefined;

    const { stop, promise } = this.context!.transcribeData(int16.buffer, {
      language,
      prompt,
      temperature: 0.0,
    });
    this.stopFn = stop;

    try {
      const result = await promise;
      return { text: result.result.trim(), durationMs: Date.now() - startMs };
    } finally {
      this.stopFn = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.stopFn) {
      await this.stopFn();
      this.stopFn = null;
    }
  }

  /** Release the model context (called on app quit). */
  async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
  }
}

/** Convert Float32 PCM [-1, 1] to Int16 PCM for whisper.cpp */
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = Math.round(s * 32767);
  }
  return int16;
}
