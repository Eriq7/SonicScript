import Store from 'electron-store';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import type { AppSettings } from '../../shared/types';

const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS,
});

export function getSettings(): AppSettings {
  return {
    hotkey: store.get('hotkey', DEFAULT_SETTINGS.hotkey),
    whisper: store.get('whisper', DEFAULT_SETTINGS.whisper),
    llm: store.get('llm', DEFAULT_SETTINGS.llm),
    general: store.get('general', DEFAULT_SETTINGS.general),
  };
}

export function setSettings(partial: Partial<AppSettings>): void {
  if (partial.hotkey) store.set('hotkey', { ...getSettings().hotkey, ...partial.hotkey });
  if (partial.whisper) store.set('whisper', { ...getSettings().whisper, ...partial.whisper });
  if (partial.llm) store.set('llm', { ...getSettings().llm, ...partial.llm });
  if (partial.general) store.set('general', { ...getSettings().general, ...partial.general });
}
