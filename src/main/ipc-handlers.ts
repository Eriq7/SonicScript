import { ipcMain, systemPreferences } from 'electron';
import { IPC } from '../shared/types';
import type { AppSettings, WhisperModelName } from '../shared/types';
import { getSettings, setSettings } from './config/store';
import { processPCMBuffer } from './audio/audio-recorder';
import { WhisperEngine } from './whisper/whisper-engine';
import { downloadModel } from './whisper/model-downloader';
import { getDownloadedModels, deleteModel } from './whisper/model-manager';
import { injectText } from './output/text-output';
import { processWithLLM } from './llm/llm-processor';
import { getFloatingWindow, getSettingsWindow } from './windows';
import { HotkeyManager } from './hotkey/hotkey-manager';

let hotkeyManagerRef: HotkeyManager | null = null;

export function setHotkeyManagerRef(hm: HotkeyManager): void {
  hotkeyManagerRef = hm;
}

export function registerIpcHandlers(): void {
  // ─── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings());

  ipcMain.handle(IPC.SET_SETTINGS, (_e, partial: Partial<AppSettings>) => {
    setSettings(partial);
  });

  ipcMain.handle(IPC.UPDATE_HOTKEY, (_e, key: string) => {
    setSettings({ hotkey: { key } });
    hotkeyManagerRef?.updateKey(key);
  });

  // ─── Audio transcription ──────────────────────────────────────────────────
  ipcMain.handle(IPC.AUDIO_DATA, async (_e, arrayBuffer: ArrayBuffer) => {
    const floatingWin = getFloatingWindow();
    const settingsWin = getSettingsWindow();

    const silentDismiss = () => floatingWin?.webContents.send(IPC.HIDE_FLOATING);

    try {
      console.log(`[IPC] AUDIO_DATA received, bytes=${arrayBuffer.byteLength}`);
      const pcm = processPCMBuffer(arrayBuffer);
      console.log(`[IPC] Duration=${pcm.durationMs}ms, samples=${pcm.samples.length}`);

      // Guard 1: minimum duration < 0.8s → skip (prevents hallucinations on taps)
      if (pcm.durationMs < 800) {
        console.log(`[IPC] SKIP: too short (${pcm.durationMs}ms)`);
        silentDismiss();
        return;
      }

      // Guard 2: silence detection — RMS energy below threshold
      const rms = Math.sqrt(
        pcm.samples.reduce((sum, s) => sum + s * s, 0) / pcm.samples.length,
      );
      console.log(`[IPC] RMS=${rms.toFixed(5)}`);
      if (rms < 0.005) {
        console.log(`[IPC] SKIP: too quiet (RMS=${rms.toFixed(5)})`);
        silentDismiss();
        return;
      }

      const settings = getSettings();
      const engine = WhisperEngine.getInstance();
      console.log(`[IPC] Sending to Whisper model=${settings.whisper.model}, lang=${settings.whisper.language}`);

      const { text, durationMs } = await engine.transcribe(
        pcm.samples,
        settings.whisper.model,
        settings.whisper.language,
      );
      console.log(`[IPC] Whisper result: "${text}" (took ${durationMs}ms)`);

      // Guard 3: hallucination filter
      if (isHallucination(text)) {
        console.log(`[IPC] SKIP: hallucination filtered: "${text}"`);
        silentDismiss();
        return;
      }

      const finalText = await processWithLLM(text, settings.llm);
      console.log(`[IPC] Injecting text: "${finalText}"`);

      await injectText(finalText);

      floatingWin?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, durationMs);
      settingsWin?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, durationMs);
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      console.error('[IPC] Transcription error:', msg);
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, msg);
      settingsWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, msg);
    }
  });

  ipcMain.handle(IPC.CANCEL_TRANSCRIPTION, () => {
    WhisperEngine.getInstance().cancel();
  });

  // ─── Model management ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_MODEL_STATUS, () => getDownloadedModels());

  ipcMain.handle(IPC.DOWNLOAD_MODEL, async (_e, model: WhisperModelName) => {
    const win = getSettingsWindow() ?? getFloatingWindow();
    await downloadModel(model, win);
  });

  ipcMain.handle(IPC.DELETE_MODEL, (_e, model: WhisperModelName) => {
    deleteModel(model);
  });

  // ─── Permissions ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHECK_ACCESSIBILITY, () => {
    if (process.platform === 'darwin') {
      return systemPreferences.isTrustedAccessibilityClient(false);
    }
    return true;
  });

  ipcMain.handle(IPC.REQUEST_ACCESSIBILITY, () => {
    if (process.platform === 'darwin') {
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  });
}

// ─── Hallucination filter ─────────────────────────────────────────────────────
// Whisper hallucinates these phrases on silence or very short audio.
const HALLUCINATION_PATTERNS = [
  /^thank(s| you)( for watching| for listening)?[.!]?$/i,
  /^(bye|goodbye|see you)[.!]?$/i,
  /^(please )?(like|subscribe|share)/i,
  /^\[.*\]$/,            // [BLANK_AUDIO], [silence], [Music], etc.
  /^[\s.。…]+$/,         // only whitespace or dots
  /^you\.?$/i,
  /^(the )?end\.?$/i,
  /^subtitles by/i,
  /^(www\.|http)/i,
];

function isHallucination(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return HALLUCINATION_PATTERNS.some(re => re.test(t));
}
