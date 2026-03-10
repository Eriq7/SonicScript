export type RecordingState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export type WhisperModelName = 'tiny' | 'base';

export type LLMMode = 'none' | 'smart-edit';

export interface AppSettings {
  hotkey: HotkeySettings;
  whisper: WhisperSettings;
  llm: LLMSettings;
  general: GeneralSettings;
}

export interface HotkeySettings {
  key: string; // e.g. 'RIGHT ALT'
}

export interface WhisperSettings {
  model: WhisperModelName;
  language: string; // 'auto' or ISO code e.g. 'zh', 'en'
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

export interface ModelDownloadProgress {
  model: WhisperModelName;
  status: 'downloading' | 'ready' | 'error';
  progress: number; // 0-100
  error?: string;
}

export interface WhisperModelInfo {
  name: WhisperModelName;
  displayName: string;
  sizeLabel: string;
  isDownloaded: boolean;
  hfModelId: string;
}

// IPC channel names (centralized to avoid typos)
export const IPC = {
  // Hotkey events (main → renderer)
  HOTKEY_PRESSED: 'hotkey-pressed',
  HOTKEY_RELEASED: 'hotkey-released',

  // Audio (renderer → main, invoke)
  AUDIO_DATA: 'audio-data',

  // Transcription (main → renderer)
  TRANSCRIPTION_RESULT: 'transcription-result',
  TRANSCRIPTION_ERROR: 'transcription-error',
  CANCEL_TRANSCRIPTION: 'cancel-transcription',

  // Model management (invoke)
  GET_MODEL_STATUS: 'get-model-status',
  DOWNLOAD_MODEL: 'download-model',
  DELETE_MODEL: 'delete-model',
  MODEL_PROGRESS: 'model-progress',
  MODEL_READY: 'model-ready',
  MODEL_ERROR: 'model-error',

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
} as const;
