import Store from 'electron-store';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import type { AppSettings } from '../../shared/types';

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
});

export function getSettings(): AppSettings {
  const settings = {
    hotkey: store.get('hotkey', DEFAULT_SETTINGS.hotkey),
    speech: store.get('speech', DEFAULT_SETTINGS.speech),
    llm: store.get('llm', DEFAULT_SETTINGS.llm),
    general: store.get('general', DEFAULT_SETTINGS.general),
  };

  // Migration: read from old 'whisper' key if 'speech' not yet persisted
  if (!store.has('speech') && store.has('whisper' as keyof AppSettings)) {
    const oldLang = (store.get('whisper' as keyof AppSettings) as { language?: string })?.language;
    settings.speech = { language: oldLang ?? 'zh' };
    store.set('speech', settings.speech);
  }

  // Validate language
  if (settings.speech.language !== 'zh' && settings.speech.language !== 'en') {
    settings.speech.language = 'zh';
    store.set('speech', settings.speech);
  }

  // Migrate: upgrade from gpt-4.1-mini to gpt-4.1-nano
  if (settings.llm.model === 'gpt-4.1-mini') {
    settings.llm.model = 'gpt-4.1-nano';
    store.set('llm', settings.llm);
  }

  return settings;
}

export function setSettings(partial: Partial<AppSettings>): void {
  if (partial.hotkey) store.set('hotkey', { ...getSettings().hotkey, ...partial.hotkey });
  if (partial.speech) store.set('speech', { ...getSettings().speech, ...partial.speech });
  if (partial.llm) store.set('llm', { ...getSettings().llm, ...partial.llm });
  if (partial.general) store.set('general', { ...getSettings().general, ...partial.general });
}
