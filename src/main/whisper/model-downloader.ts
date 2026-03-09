/**
 * model-downloader.ts
 * Uses @xenova/transformers to download and cache a whisper model.
 * Emits progress events through the whisper engine.
 */
import { BrowserWindow } from 'electron';
import { IPC } from '../../shared/types';
import type { WhisperModelName } from '../../shared/types';
import { getModelCacheDir, getModelHFId } from './model-manager';

export async function downloadModel(
  model: WhisperModelName,
  win: BrowserWindow | null,
): Promise<void> {
  const { pipeline, env } = await import('@xenova/transformers');
  const cacheDir = getModelCacheDir(model);
  const hfModelId = getModelHFId(model);

  env.cacheDir = cacheDir;

  const notify = (progress: number, status: string) => {
    win?.webContents.send(IPC.MODEL_PROGRESS, model, progress, status);
  };

  notify(0, 'Starting download...');

  try {
    await pipeline('automatic-speech-recognition', hfModelId, {
      progress_callback: (p: { status: string; progress?: number; name?: string }) => {
        if (p.status === 'downloading') {
          notify(Math.round(p.progress ?? 0), `Downloading ${p.name ?? 'model'}...`);
        } else if (p.status === 'loading') {
          notify(95, 'Loading model...');
        } else if (p.status === 'ready') {
          notify(100, 'Ready');
        }
      },
    });

    notify(100, 'Ready');
    win?.webContents.send(IPC.MODEL_READY, model);
  } catch (err: any) {
    win?.webContents.send(IPC.MODEL_ERROR, model, err.message);
    throw err;
  }
}
