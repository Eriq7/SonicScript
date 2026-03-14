/**
 * constants.ts — App-wide compile-time constants and default configuration.
 *
 * Main exports:
 *   - SUPPORTED_LANGUAGES — array of { code, label, hint } for zh and en
 *   - DEFAULT_HOTKEY      — 'RIGHT ALT'
 *   - DEFAULT_SETTINGS    — full AppSettings object used as electron-store defaults
 *   - FLOATING_WIDGET     — { width: 320, height: 140, bottomOffset: 80 } (pixels)
 */
import type { AppSettings } from './types';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh', label: '中文', hint: 'Primarily Chinese, can mix in English words' },
  { code: 'en', label: 'English', hint: 'Primarily English, occasional Chinese words OK' },
] as const;

export const DEFAULT_HOTKEY = 'RIGHT ALT';

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: {
    key: DEFAULT_HOTKEY,
  },
  speech: {
    language: 'zh',
  },
  llm: {
    enabled: false,
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4.1-nano',
    mode: 'smart-edit',
  },
  general: {
    launchAtStartup: false,
    showNotifications: true,
  },
};

// Floating widget window dimensions
export const FLOATING_WIDGET = {
  width: 320,
  height: 140,
  bottomOffset: 80,
};
