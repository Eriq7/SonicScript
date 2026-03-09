import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type { AppSettings, WhisperModelName } from '../shared/types';

// Detect window type from URL hash (set by main process when creating windows)
const getWindowType = (): 'floating' | 'settings' => {
  // Will be determined at runtime from the URL
  return 'settings'; // default
};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  windowType: getWindowType(),

  // ─── Hotkey events (main → renderer, listen) ───
  onHotkeyPressed: (cb: () => void) => {
    ipcRenderer.on(IPC.HOTKEY_PRESSED, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.HOTKEY_PRESSED);
  },
  onHotkeyReleased: (cb: () => void) => {
    ipcRenderer.on(IPC.HOTKEY_RELEASED, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.HOTKEY_RELEASED);
  },

  // ─── Audio (renderer → main) ───
  sendAudioData: (pcmBuffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke(IPC.AUDIO_DATA, pcmBuffer),

  cancelTranscription: (): Promise<void> =>
    ipcRenderer.invoke(IPC.CANCEL_TRANSCRIPTION),

  // ─── Transcription events (main → renderer, listen) ───
  onTranscriptionResult: (cb: (text: string, durationMs: number) => void) => {
    ipcRenderer.on(IPC.TRANSCRIPTION_RESULT, (_e, text, durationMs) => cb(text, durationMs));
    return () => ipcRenderer.removeAllListeners(IPC.TRANSCRIPTION_RESULT);
  },
  onTranscriptionError: (cb: (error: string) => void) => {
    ipcRenderer.on(IPC.TRANSCRIPTION_ERROR, (_e, error) => cb(error));
    return () => ipcRenderer.removeAllListeners(IPC.TRANSCRIPTION_ERROR);
  },

  // ─── Settings ───
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (settings: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_SETTINGS, settings),
  updateHotkey: (key: string): Promise<void> =>
    ipcRenderer.invoke(IPC.UPDATE_HOTKEY, key),

  // ─── Permissions ───
  checkAccessibility: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.CHECK_ACCESSIBILITY),
  requestAccessibility: (): Promise<void> =>
    ipcRenderer.invoke(IPC.REQUEST_ACCESSIBILITY),

  // ─── Model management ───
  getModelStatus: (): Promise<Record<WhisperModelName, boolean>> =>
    ipcRenderer.invoke(IPC.GET_MODEL_STATUS),
  downloadModel: (model: WhisperModelName): Promise<void> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_MODEL, model),
  deleteModel: (model: WhisperModelName): Promise<void> =>
    ipcRenderer.invoke(IPC.DELETE_MODEL, model),
  onModelProgress: (cb: (model: WhisperModelName, progress: number, status: string) => void) => {
    ipcRenderer.on(IPC.MODEL_PROGRESS, (_e, model, progress, status) => cb(model, progress, status));
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_PROGRESS);
  },
  onModelReady: (cb: (model: WhisperModelName) => void) => {
    ipcRenderer.on(IPC.MODEL_READY, (_e, model) => cb(model));
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_READY);
  },
  onModelError: (cb: (model: WhisperModelName, error: string) => void) => {
    ipcRenderer.on(IPC.MODEL_ERROR, (_e, model, error) => cb(model, error));
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_ERROR);
  },

  // ─── Window events ───
  onShowSettings: (cb: () => void) => {
    ipcRenderer.on(IPC.SHOW_SETTINGS, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.SHOW_SETTINGS);
  },
});

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      windowType: 'floating' | 'settings';
      onHotkeyPressed: (cb: () => void) => () => void;
      onHotkeyReleased: (cb: () => void) => () => void;
      sendAudioData: (pcmBuffer: ArrayBuffer) => Promise<void>;
      cancelTranscription: () => Promise<void>;
      onTranscriptionResult: (cb: (text: string, durationMs: number) => void) => () => void;
      onTranscriptionError: (cb: (error: string) => void) => () => void;
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<void>;
      updateHotkey: (key: string) => Promise<void>;
      checkAccessibility: () => Promise<boolean>;
      requestAccessibility: () => Promise<void>;
      getModelStatus: () => Promise<Record<WhisperModelName, boolean>>;
      downloadModel: (model: WhisperModelName) => Promise<void>;
      deleteModel: (model: WhisperModelName) => Promise<void>;
      onModelProgress: (cb: (model: WhisperModelName, progress: number, status: string) => void) => () => void;
      onModelReady: (cb: (model: WhisperModelName) => void) => () => void;
      onModelError: (cb: (model: WhisperModelName, error: string) => void) => () => void;
      onShowSettings: (cb: () => void) => () => void;
    };
  }
}
