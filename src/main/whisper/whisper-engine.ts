/**
 * WhisperEngine: Singleton that manages a worker thread running @xenova/transformers.
 * The model is preloaded at startup to eliminate cold-start delay on first recording.
 */
import { Worker } from 'worker_threads';
import * as path from 'path';
import { EventEmitter } from 'events';
import { getModelCacheDir, getModelHFId } from './model-manager';
import type { WhisperModelName } from '../../shared/types';

interface TranscribeRequest {
  id: string;
  pcmBuffer: Float32Array;
  language: string;
  model: WhisperModelName;
}

interface WorkerMessage {
  type: 'ready' | 'result' | 'error' | 'progress' | 'cancelled';
  id?: string;
  text?: string;
  durationMs?: number;
  error?: string;
  progress?: number;
  status?: string;
  model?: WhisperModelName;
}

export class WhisperEngine extends EventEmitter {
  private static instance: WhisperEngine;
  private worker: Worker | null = null;
  private currentModel: WhisperModelName | null = null;
  private pendingResolvers = new Map<string, { resolve: (text: string) => void; reject: (e: Error) => void }>();
  private workerReady = false;

  private constructor() {
    super();
  }

  static getInstance(): WhisperEngine {
    if (!WhisperEngine.instance) {
      WhisperEngine.instance = new WhisperEngine();
    }
    return WhisperEngine.instance;
  }

  /** Preload model at startup. Should be called once from main process init. */
  async preload(model: WhisperModelName): Promise<void> {
    if (this.currentModel === model && this.workerReady) return;

    await this.spawnWorker(model);
  }

  /** Transcribe raw 16kHz mono Float32Array PCM data. */
  async transcribe(
    pcmData: Float32Array,
    model: WhisperModelName,
    language: string,
  ): Promise<{ text: string; durationMs: number }> {
    if (!this.workerReady || this.currentModel !== model) {
      await this.spawnWorker(model);
    }

    const id = Date.now().toString();
    const req: TranscribeRequest = { id, pcmBuffer: pcmData, language, model };

    return new Promise((resolve, reject) => {
      this.pendingResolvers.set(id, {
        resolve: (text: string) => resolve({ text, durationMs: 0 }),
        reject,
      });

      this.worker!.postMessage({ type: 'transcribe', ...req }, [pcmData.buffer]);
    });
  }

  cancel(): void {
    this.worker?.postMessage({ type: 'cancel' });
  }

  private spawnWorker(model: WhisperModelName): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up existing worker
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
        this.workerReady = false;
        this.currentModel = null;
      }

      const workerPath = path.join(__dirname, 'whisper', 'whisper-worker.js');
      const cacheDir = getModelCacheDir(model);
      const hfModelId = getModelHFId(model);

      this.worker = new Worker(workerPath, {
        workerData: { model, cacheDir, hfModelId },
      });

      const onMessage = (msg: WorkerMessage) => {
        switch (msg.type) {
          case 'ready':
            this.workerReady = true;
            this.currentModel = model;
            resolve();
            break;

          case 'result': {
            const resolver = this.pendingResolvers.get(msg.id!);
            if (resolver) {
              this.pendingResolvers.delete(msg.id!);
              resolver.resolve(msg.text ?? '');
            }
            break;
          }

          case 'error': {
            const resolver = this.pendingResolvers.get(msg.id!);
            if (resolver) {
              this.pendingResolvers.delete(msg.id!);
              resolver.reject(new Error(msg.error));
            } else {
              reject(new Error(msg.error));
            }
            break;
          }

          case 'progress':
            this.emit('model-progress', msg.model, msg.progress, msg.status);
            break;

          case 'cancelled':
            this.pendingResolvers.forEach(r => r.reject(new Error('Cancelled')));
            this.pendingResolvers.clear();
            break;
        }
      };

      this.worker.on('message', onMessage);
      this.worker.on('error', (err) => {
        this.workerReady = false;
        reject(err);
      });
      this.worker.on('exit', () => {
        this.workerReady = false;
      });
    });
  }

  async switchModel(model: WhisperModelName): Promise<void> {
    if (this.currentModel === model && this.workerReady) return;
    await this.spawnWorker(model);
  }
}
