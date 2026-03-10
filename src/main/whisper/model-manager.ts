import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { WHISPER_MODEL_FILE } from '../../shared/constants';

export function getModelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getModelPath(): string {
  return path.join(getModelsDir(), WHISPER_MODEL_FILE);
}

export function isModelDownloaded(): boolean {
  return fs.existsSync(getModelPath());
}

export function deleteModel(): void {
  const p = getModelPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
