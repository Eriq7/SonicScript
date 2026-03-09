import type { WhisperModelInfo, WhisperModelName, AppSettings } from './types';

export const WHISPER_MODELS: Record<WhisperModelName, WhisperModelInfo> = {
  tiny: {
    name: 'tiny',
    displayName: 'Tiny',
    sizeLabel: '~38 MB',
    isDownloaded: false,
    hfModelId: 'Xenova/whisper-tiny',
  },
  base: {
    name: 'base',
    displayName: 'Base (recommended)',
    sizeLabel: '~95 MB',
    isDownloaded: false,
    hfModelId: 'Xenova/whisper-base',
  },
  small: {
    name: 'small',
    displayName: 'Small',
    sizeLabel: '~244 MB',
    isDownloaded: false,
    hfModelId: 'Xenova/whisper-small',
  },
  medium: {
    name: 'medium',
    displayName: 'Medium',
    sizeLabel: '~1.5 GB',
    isDownloaded: false,
    hfModelId: 'Xenova/whisper-medium',
  },
};

export const DEFAULT_HOTKEY = 'RIGHT ALT';

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: {
    key: DEFAULT_HOTKEY,
  },
  whisper: {
    model: 'base',
    language: 'auto',
  },
  llm: {
    enabled: false,
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    mode: 'smart-edit',
  },
  general: {
    launchAtStartup: false,
    showNotifications: true,
  },
};

export const AUDIO_SAMPLE_RATE = 16000; // 16kHz required by whisper
export const AUDIO_CHANNELS = 1; // mono

// Floating widget window dimensions
export const FLOATING_WIDGET = {
  width: 320,
  height: 140,   // Taller to show text preview
  bottomOffset: 80,
};
