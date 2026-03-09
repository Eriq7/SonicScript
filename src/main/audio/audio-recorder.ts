/**
 * audio-recorder.ts
 * Main-process side: receives a complete Float32Array PCM buffer from the
 * renderer via IPC and converts it to a format whisper can consume.
 * No real-time streaming — the renderer buffers locally and sends once.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AUDIO_SAMPLE_RATE } from '../../shared/constants';

export interface PCMData {
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
}

/**
 * Accept raw PCM ArrayBuffer from renderer IPC and wrap it.
 */
export function processPCMBuffer(arrayBuffer: ArrayBuffer): PCMData {
  const samples = new Float32Array(arrayBuffer);
  const durationMs = Math.round((samples.length / AUDIO_SAMPLE_RATE) * 1000);
  return { samples, sampleRate: AUDIO_SAMPLE_RATE, durationMs };
}

/**
 * Write PCM to a temporary WAV file (for debugging or external tooling).
 * Returns the path to the temp file.
 */
export function writeTempWav(pcm: PCMData): string {
  const tmpPath = path.join(os.tmpdir(), `sonicscript-${Date.now()}.wav`);
  const buffer = pcmToWav(pcm.samples, pcm.sampleRate);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

/** Delete temp WAV file after use */
export function deleteTempWav(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Ignore errors
  }
}

function pcmToWav(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLength = samples.length * 2; // 16-bit PCM

  const buffer = Buffer.alloc(44 + dataLength);
  let offset = 0;

  // WAV header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataLength, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // PCM chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataLength, offset); offset += 4;

  // Convert Float32 [-1, 1] → Int16
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }

  return buffer;
}
