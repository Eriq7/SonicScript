import type { AppSettings } from './types';

// Single model: large-v3-turbo quantized (best accuracy + reasonable speed)
export const WHISPER_MODEL_FILE = 'ggml-large-v3-turbo-q5_0.bin';
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin';
export const WHISPER_MODEL_DISPLAY_NAME = 'Large V3 Turbo';
export const WHISPER_MODEL_SIZE_LABEL = '~574 MB';

// Guide Whisper to output Simplified Chinese
export const CHINESE_INITIAL_PROMPT = '以下是普通话的句子。';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh', label: '中文', hint: '中文为主，可夹杂英文单词' },
  { code: 'en', label: 'English', hint: '英文为主，偶尔说中文词' },
] as const;

export const DEFAULT_HOTKEY = 'RIGHT ALT';

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: {
    key: DEFAULT_HOTKEY,
  },
  whisper: {
    language: 'zh',
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
  height: 140,
  bottomOffset: 80,
};
