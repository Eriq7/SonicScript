export type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export type LLMMode = 'none' | 'smart-edit';

export interface AppSettings {
  hotkey: HotkeySettings;
  speech: { language: string };
  llm: LLMSettings;
  general: GeneralSettings;
}

export interface HotkeySettings {
  key: string; // e.g. 'RIGHT ALT'
}

export interface LLMSettings {
  enabled: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  mode: LLMMode;
}

export interface GeneralSettings {
  launchAtStartup: boolean;
  showNotifications: boolean;
}

export interface TranscriptionResult {
  text: string;
  durationMs: number;
  language?: string;
}

export interface HistoryEntry {
  id: string;
  text: string;
  appName: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

// IPC channel names (centralized to avoid typos)
export const IPC = {
  // Hotkey events (main → renderer)
  HOTKEY_DOUBLE_TAP: 'hotkey-double-tap',

  // Speech recording (renderer → main, invoke)
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',

  // Transcription (main → renderer)
  PARTIAL_TRANSCRIPT: 'partial-transcript',
  TRANSCRIPTION_RESULT: 'transcription-result',
  TRANSCRIPTION_ERROR: 'transcription-error',

  // Settings (invoke)
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',

  // Permissions (invoke)
  CHECK_ACCESSIBILITY: 'check-accessibility',
  REQUEST_ACCESSIBILITY: 'request-accessibility',

  // Window events
  SHOW_SETTINGS: 'show-settings',
  HIDE_FLOATING: 'hide-floating',

  // Update hotkey config (invoke)
  UPDATE_HOTKEY: 'update-hotkey',

  // History & Snippets (invoke)
  GET_HISTORY: 'get-history',
  DELETE_HISTORY_ITEM: 'delete-history-item',
  GET_SNIPPETS: 'get-snippets',
  ADD_SNIPPET: 'add-snippet',
  DELETE_SNIPPET: 'delete-snippet',
  COPY_SNIPPET: 'copy-snippet',
} as const;
