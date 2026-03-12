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
    whisper: store.get('whisper', DEFAULT_SETTINGS.whisper),
    llm: store.get('llm', DEFAULT_SETTINGS.llm),
    general: store.get('general', DEFAULT_SETTINGS.general),
  };

  // Migrate: ensure language is 'zh' or 'en' (remove legacy 'auto')
  if (settings.whisper.language !== 'zh' && settings.whisper.language !== 'en') {
    settings.whisper.language = 'zh';
    store.set('whisper', settings.whisper);
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
  if (partial.whisper) store.set('whisper', { ...getSettings().whisper, ...partial.whisper });
  if (partial.llm) store.set('llm', { ...getSettings().llm, ...partial.llm });
  if (partial.general) store.set('general', { ...getSettings().general, ...partial.general });
}
