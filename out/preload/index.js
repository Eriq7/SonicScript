"use strict";
const electron = require("electron");
const IPC = {
  // Hotkey events (main → renderer)
  HOTKEY_DOUBLE_TAP: "hotkey-double-tap",
  HOTKEY_LONG_PRESS: "hotkey-long-press",
  // Speech recording (renderer → main, invoke)
  START_RECORDING: "start-recording",
  STOP_RECORDING: "stop-recording",
  // Transcription (main → renderer)
  PARTIAL_TRANSCRIPT: "partial-transcript",
  TRANSCRIPTION_RESULT: "transcription-result",
  TRANSCRIPTION_ERROR: "transcription-error",
  // Settings (invoke)
  GET_SETTINGS: "get-settings",
  SET_SETTINGS: "set-settings",
  // Permissions (invoke)
  CHECK_ACCESSIBILITY: "check-accessibility",
  REQUEST_ACCESSIBILITY: "request-accessibility",
  // Window events
  SHOW_SETTINGS: "show-settings",
  HIDE_FLOATING: "hide-floating",
  // Update hotkey config (invoke)
  UPDATE_HOTKEY: "update-hotkey",
  // History & Snippets (invoke)
  GET_HISTORY: "get-history",
  DELETE_HISTORY_ITEM: "delete-history-item",
  GET_SNIPPETS: "get-snippets",
  ADD_SNIPPET: "add-snippet",
  DELETE_SNIPPET: "delete-snippet",
  COPY_SNIPPET: "copy-snippet"
};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  // ─── Hotkey events (main → renderer, listen) ───
  onHotkeyDoubleTap: (cb) => {
    electron.ipcRenderer.on(IPC.HOTKEY_DOUBLE_TAP, () => cb());
    return () => electron.ipcRenderer.removeAllListeners(IPC.HOTKEY_DOUBLE_TAP);
  },
  onHotkeyLongPress: (cb) => {
    electron.ipcRenderer.on(IPC.HOTKEY_LONG_PRESS, () => cb());
    return () => electron.ipcRenderer.removeAllListeners(IPC.HOTKEY_LONG_PRESS);
  },
  // ─── Speech recording (renderer → main, invoke) ───
  startRecording: (translate) => electron.ipcRenderer.invoke(IPC.START_RECORDING, translate ?? false),
  stopRecording: () => electron.ipcRenderer.invoke(IPC.STOP_RECORDING),
  // ─── Transcription events (main → renderer, listen) ───
  onPartialTranscript: (cb) => {
    electron.ipcRenderer.on(IPC.PARTIAL_TRANSCRIPT, (_e, text) => cb(text));
    return () => electron.ipcRenderer.removeAllListeners(IPC.PARTIAL_TRANSCRIPT);
  },
  onTranscriptionResult: (cb) => {
    electron.ipcRenderer.on(IPC.TRANSCRIPTION_RESULT, (_e, text, durationMs) => cb(text, durationMs));
    return () => electron.ipcRenderer.removeAllListeners(IPC.TRANSCRIPTION_RESULT);
  },
  onTranscriptionError: (cb) => {
    electron.ipcRenderer.on(IPC.TRANSCRIPTION_ERROR, (_e, error) => cb(error));
    return () => electron.ipcRenderer.removeAllListeners(IPC.TRANSCRIPTION_ERROR);
  },
  // ─── Settings ───
  getSettings: () => electron.ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (settings) => electron.ipcRenderer.invoke(IPC.SET_SETTINGS, settings),
  updateHotkey: (key) => electron.ipcRenderer.invoke(IPC.UPDATE_HOTKEY, key),
  // ─── Permissions ───
  checkAccessibility: () => electron.ipcRenderer.invoke(IPC.CHECK_ACCESSIBILITY),
  requestAccessibility: () => electron.ipcRenderer.invoke(IPC.REQUEST_ACCESSIBILITY),
  // ─── History ───
  getHistory: () => electron.ipcRenderer.invoke(IPC.GET_HISTORY),
  deleteHistoryItem: (id) => electron.ipcRenderer.invoke(IPC.DELETE_HISTORY_ITEM, id),
  // ─── Snippets ───
  getSnippets: () => electron.ipcRenderer.invoke(IPC.GET_SNIPPETS),
  addSnippet: (title, content) => electron.ipcRenderer.invoke(IPC.ADD_SNIPPET, title, content),
  deleteSnippet: (id) => electron.ipcRenderer.invoke(IPC.DELETE_SNIPPET, id),
  copySnippet: (content) => electron.ipcRenderer.invoke(IPC.COPY_SNIPPET, content),
  // ─── Window events ───
  onShowSettings: (cb) => {
    electron.ipcRenderer.on(IPC.SHOW_SETTINGS, () => cb());
    return () => electron.ipcRenderer.removeAllListeners(IPC.SHOW_SETTINGS);
  },
  onHideFloating: (cb) => {
    electron.ipcRenderer.on(IPC.HIDE_FLOATING, () => cb());
    return () => electron.ipcRenderer.removeAllListeners(IPC.HIDE_FLOATING);
  }
});
