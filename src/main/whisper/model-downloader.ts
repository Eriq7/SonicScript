/**
 * model-downloader.ts
 * Downloads the single whisper.cpp GGML model file from HuggingFace.
 * Streams the download and reports progress via IPC.
 */
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { IPC } from '../../shared/types';
import { getModelsDir, getModelPath } from './model-manager';
import { WHISPER_MODEL_URL, WHISPER_MODEL_FILE } from '../../shared/constants';

export async function downloadModel(win: BrowserWindow | null): Promise<void> {
  const modelPath = getModelPath();

  const notify = (progress: number, status: string) => {
    win?.webContents.send(IPC.MODEL_PROGRESS, progress, status);
  };

  notify(0, 'Starting download...');

  await new Promise<void>((resolve, reject) => {
    function doRequest(url: string): void {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        // Follow redirects (HuggingFace → CDN)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let downloaded = 0;
        const tmpPath = modelPath + '.part';
        const out = fs.createWriteStream(tmpPath);

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (total > 0) {
            notify(Math.round((downloaded / total) * 95), `Downloading ${WHISPER_MODEL_FILE}...`);
          }
        });

        res.pipe(out);

        out.on('finish', () => {
          fs.renameSync(tmpPath, modelPath);
          notify(100, 'Ready');
          win?.webContents.send(IPC.MODEL_READY);
          resolve();
        });

        out.on('error', (err) => {
          fs.unlink(tmpPath, () => {});
          reject(err);
        });

        res.on('error', (err) => {
          fs.unlink(tmpPath, () => {});
          reject(err);
        });
      }).on('error', reject);
    }

    // Ensure models directory exists
    getModelsDir();
    doRequest(WHISPER_MODEL_URL);
  }).catch((err) => {
    win?.webContents.send(IPC.MODEL_ERROR, err.message);
    throw err;
  });
}
