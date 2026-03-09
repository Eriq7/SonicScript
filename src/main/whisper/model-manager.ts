import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { WhisperModelName } from '../../shared/types';
import { WHISPER_MODELS } from '../../shared/constants';

export function getModelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getModelCacheDir(model: WhisperModelName): string {
  const dir = path.join(getModelsDir(), model);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isModelDownloaded(model: WhisperModelName): boolean {
  const dir = getModelCacheDir(model);
  // @xenova/transformers caches onnx model files here
  const modelFile = path.join(dir, 'onnx', 'encoder_model_quantized.onnx');
  return fs.existsSync(modelFile);
}

export function getDownloadedModels(): Record<WhisperModelName, boolean> {
  return {
    tiny: isModelDownloaded('tiny'),
    base: isModelDownloaded('base'),
    small: isModelDownloaded('small'),
    medium: isModelDownloaded('medium'),
  };
}

export function getModelHFId(model: WhisperModelName): string {
  return WHISPER_MODELS[model].hfModelId;
}

export function deleteModel(model: WhisperModelName): void {
  const dir = getModelCacheDir(model);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
