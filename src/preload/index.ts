import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type { AppSettings } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

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

  // ─── Model management (single model, no model parameter) ───
  getModelStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.GET_MODEL_STATUS),
  downloadModel: (): Promise<void> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_MODEL),
  deleteModel: (): Promise<void> =>
    ipcRenderer.invoke(IPC.DELETE_MODEL),
  onModelProgress: (cb: (progress: number, status: string) => void) => {
    ipcRenderer.on(IPC.MODEL_PROGRESS, (_e, progress, status) => cb(progress, status));
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_PROGRESS);
  },
  onModelReady: (cb: () => void) => {
    ipcRenderer.on(IPC.MODEL_READY, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_READY);
  },
  onModelError: (cb: (error: string) => void) => {
    ipcRenderer.on(IPC.MODEL_ERROR, (_e, error) => cb(error));
    return () => ipcRenderer.removeAllListeners(IPC.MODEL_ERROR);
  },

  // ─── Window events ───
  onShowSettings: (cb: () => void) => {
    ipcRenderer.on(IPC.SHOW_SETTINGS, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.SHOW_SETTINGS);
  },
  onHideFloating: (cb: () => void) => {
    ipcRenderer.on(IPC.HIDE_FLOATING, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.HIDE_FLOATING);
  },
});

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
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
      getModelStatus: () => Promise<boolean>;
      downloadModel: () => Promise<void>;
      deleteModel: () => Promise<void>;
      onModelProgress: (cb: (progress: number, status: string) => void) => () => void;
      onModelReady: (cb: () => void) => () => void;
      onModelError: (cb: (error: string) => void) => () => void;
      onShowSettings: (cb: () => void) => () => void;
      onHideFloating: (cb: () => void) => () => void;
    };
  }
}
