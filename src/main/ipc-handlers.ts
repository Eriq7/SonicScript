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
      const pcm = processPCMBuffer(arrayBuffer);

      // Guard 1: minimum duration < 0.8s → skip (prevents hallucinations on taps)
      if (pcm.durationMs < 800) {
        console.log(`[IPC] Too short (${pcm.durationMs}ms), skipping`);
        silentDismiss();
        return;
      }

      // Guard 2: silence detection — RMS energy below threshold
      const rms = Math.sqrt(
        pcm.samples.reduce((sum, s) => sum + s * s, 0) / pcm.samples.length,
      );
      if (rms < 0.01) {
        console.log(`[IPC] Too quiet (RMS=${rms.toFixed(4)}), skipping`);
        silentDismiss();
        return;
      }

      const settings = getSettings();
      const engine = WhisperEngine.getInstance();

      const { text, durationMs } = await engine.transcribe(
        pcm.samples,
        settings.whisper.model,
        settings.whisper.language,
      );

      // Guard 3: hallucination filter
      if (isHallucination(text)) {
        console.log(`[IPC] Hallucination filtered: "${text}"`);
        silentDismiss();
        return;
      }

      const finalText = await processWithLLM(text, settings.llm);

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
