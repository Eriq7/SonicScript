/**
 * index.ts — Electron preload: exposes a secure contextBridge API to the renderer.
 *
 * Main exports:
 *   - window.electronAPI (via contextBridge.exposeInMainWorld)
 *       platform: NodeJS.Platform
 *       onHotkeyDoubleTap, startRecording, stopRecording
 *       onPartialTranscript, onTranscriptionResult, onTranscriptionError
 *       getSettings, setSettings, updateHotkey
 *       checkAccessibility, requestAccessibility
 *       getHistory, deleteHistoryItem
 *       getSnippets, addSnippet, deleteSnippet, copySnippet
 *       onShowSettings, onHideFloating
 *
 * Design notes:
 *   - contextIsolation=true: renderer cannot access Node.js or Electron internals directly
 *   - All event listeners (on*) return a cleanup function () => removeAllListeners(channel)
 *     so React effects can unsubscribe on component unmount
 *   - The global Window interface declaration at the bottom provides TypeScript types
 *     for window.electronAPI throughout the renderer codebase
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type { AppSettings, HistoryEntry, Snippet } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // ─── Hotkey events (main → renderer, listen) ───
  onHotkeyDoubleTap: (cb: () => void) => {
    ipcRenderer.on(IPC.HOTKEY_DOUBLE_TAP, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.HOTKEY_DOUBLE_TAP);
  },
  onHotkeyLongPress: (cb: () => void) => {
    ipcRenderer.on(IPC.HOTKEY_LONG_PRESS, () => cb());
    return () => ipcRenderer.removeAllListeners(IPC.HOTKEY_LONG_PRESS);
  },

  // ─── Speech recording (renderer → main, invoke) ───
  startRecording: (translate?: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.START_RECORDING, translate ?? false),
  stopRecording: (): Promise<void> =>
    ipcRenderer.invoke(IPC.STOP_RECORDING),

  // ─── Transcription events (main → renderer, listen) ───
  onPartialTranscript: (cb: (text: string) => void) => {
    ipcRenderer.on(IPC.PARTIAL_TRANSCRIPT, (_e, text) => cb(text));
    return () => ipcRenderer.removeAllListeners(IPC.PARTIAL_TRANSCRIPT);
  },
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

  // ─── History ───
  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.GET_HISTORY),
  deleteHistoryItem: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.DELETE_HISTORY_ITEM, id),

  // ─── Snippets ───
  getSnippets: (): Promise<Snippet[]> =>
    ipcRenderer.invoke(IPC.GET_SNIPPETS),
  addSnippet: (title: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.ADD_SNIPPET, title, content),
  deleteSnippet: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.DELETE_SNIPPET, id),
  copySnippet: (content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.COPY_SNIPPET, content),

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
      onHotkeyDoubleTap: (cb: () => void) => () => void;
      onHotkeyLongPress: (cb: () => void) => () => void;
      startRecording: (translate?: boolean) => Promise<void>;
      stopRecording: () => Promise<void>;
      onPartialTranscript: (cb: (text: string) => void) => () => void;
      onTranscriptionResult: (cb: (text: string, durationMs: number) => void) => () => void;
      onTranscriptionError: (cb: (error: string) => void) => () => void;
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<void>;
      updateHotkey: (key: string) => Promise<void>;
      checkAccessibility: () => Promise<boolean>;
      requestAccessibility: () => Promise<void>;
      getHistory: () => Promise<HistoryEntry[]>;
      deleteHistoryItem: (id: string) => Promise<void>;
      getSnippets: () => Promise<Snippet[]>;
      addSnippet: (title: string, content: string) => Promise<void>;
      deleteSnippet: (id: string) => Promise<void>;
      copySnippet: (content: string) => Promise<void>;
      onShowSettings: (cb: () => void) => () => void;
      onHideFloating: (cb: () => void) => () => void;
    };
  }
}
