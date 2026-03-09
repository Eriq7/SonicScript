/**
 * whisper-worker.ts
 * Runs inside a worker_threads Worker. Loads @xenova/transformers and handles
 * transcription requests without blocking the main Electron process.
 */
import { workerData, parentPort } from 'worker_threads';

const { model, cacheDir, hfModelId } = workerData as {
  model: string;
  cacheDir: string;
  hfModelId: string;
};

let transcriber: any = null;
let cancelFlag = false;

async function init(): Promise<void> {
  // Dynamic import to handle ESM package in CJS context
  const { pipeline, env } = await import('@xenova/transformers');

  // Set model cache directory to our userData/models/<model> folder
  env.cacheDir = cacheDir;
  // Disable remote model fetching for security; caller must pre-download
  // env.allowRemoteModels = false; // Enable this after model is downloaded

  parentPort!.postMessage({ type: 'progress', model, progress: 0, status: 'Loading model...' });

  transcriber = await pipeline('automatic-speech-recognition', hfModelId, {
    progress_callback: (progress: { status: string; progress?: number }) => {
      if (progress.status === 'downloading') {
        parentPort!.postMessage({
          type: 'progress',
          model,
          progress: Math.round(progress.progress ?? 0),
          status: 'Downloading model...',
        });
      } else if (progress.status === 'loading') {
        parentPort!.postMessage({ type: 'progress', model, progress: 95, status: 'Loading model...' });
      }
    },
  });

  parentPort!.postMessage({ type: 'progress', model, progress: 100, status: 'Ready' });
  parentPort!.postMessage({ type: 'ready' });
}

parentPort!.on('message', async (msg: { type: string; id?: string; pcmBuffer?: ArrayBuffer; language?: string }) => {
  if (msg.type === 'cancel') {
    cancelFlag = true;
    parentPort!.postMessage({ type: 'cancelled' });
    return;
  }

  if (msg.type === 'transcribe' && transcriber) {
    cancelFlag = false;
    const { id, pcmBuffer, language } = msg;

    try {
      const floatArray = new Float32Array(pcmBuffer!);
      const start = Date.now();

      const output = await transcriber(floatArray, {
        language: language === 'auto' ? null : language,
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      if (cancelFlag) {
        parentPort!.postMessage({ type: 'cancelled' });
        return;
      }

      const text = (output?.text ?? '').trim();
      const durationMs = Date.now() - start;

      parentPort!.postMessage({ type: 'result', id, text, durationMs });
    } catch (err: any) {
      parentPort!.postMessage({ type: 'error', id, error: err.message });
    }
  }
});

// Start initialization
init().catch((err) => {
  parentPort!.postMessage({ type: 'error', id: undefined, error: `Worker init failed: ${err.message}` });
});
