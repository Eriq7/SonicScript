import { ipcMain, systemPreferences, clipboard } from 'electron';
import { IPC } from '../shared/types';
import type { AppSettings } from '../shared/types';
import { getSettings, setSettings } from './config/store';
import { SpeechEngine } from './speech/speech-engine';
import { getActiveAppName } from './llm/active-app';
import { injectText } from './output/text-output';
import { processWithLLM } from './llm/llm-processor';
import { getFloatingWindow, getSettingsWindow } from './windows';
import { HotkeyManager } from './hotkey/hotkey-manager';
import {
  saveHistory, getHistory, deleteHistory,
  getSnippets, addSnippet, deleteSnippet,
} from './store/data-store';

let hotkeyManagerRef: HotkeyManager | null = null;

export function setHotkeyManagerRef(hm: HotkeyManager): void {
  hotkeyManagerRef = hm;
}

export function registerIpcHandlers(): void {
  // ─── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings());

  ipcMain.handle(IPC.SET_SETTINGS, (_e, partial: Partial<AppSettings>) => {
    setSettings(partial);
  });

  ipcMain.handle(IPC.UPDATE_HOTKEY, (_e, key: string) => {
    setSettings({ hotkey: { key } });
    hotkeyManagerRef?.updateKey(key);
  });

  // ─── Speech recording ─────────────────────────────────────────────────────

  ipcMain.handle(IPC.START_RECORDING, async () => {
    const settings = getSettings();
    const engine = SpeechEngine.getInstance();
    const floatingWin = getFloatingWindow();

    // Capture app name NOW (before recording ends, to avoid focus shift)
    const appName = await getActiveAppName();

    // Track last non-empty partial as fallback for empty final results
    let lastPartialText = '';

    // Session-scoped event handlers — created fresh, cleaned up on every exit path
    const cleanup = (): void => {
      engine.removeListener('partial', onPartial);
      engine.removeListener('final', onFinal);
      engine.removeListener('error', onError);
      engine.removeListener('process-died', onDied);
    };

    const onPartial = ({ text }: { text: string }): void => {
      if (text) lastPartialText = text;
      floatingWin?.webContents.send(IPC.PARTIAL_TRANSCRIPT, text);
    };

    const onFinal = async ({ text }: { text: string }): Promise<void> => {
      cleanup();
      // Swift now accumulates across segments; fall back to lastPartialText if final is empty
      const effectiveText = text.trim() || lastPartialText.trim();
      try {
        const finalText = await processWithLLM(effectiveText, settings.llm);
        if (finalText.trim()) {
          await injectText(finalText);
          saveHistory({ text: finalText, appName });
        }
        floatingWin?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
        getSettingsWindow()?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
      } catch (err: any) {
        floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, err?.message ?? 'Error');
      }
    };

    const onError = ({ message }: { message: string }): void => {
      cleanup();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, message);
    };

    const onDied = (): void => {
      cleanup();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, 'Speech engine crashed');
    };

    engine.on('partial', onPartial);
    engine.once('final', onFinal);
    engine.once('error', onError);
    engine.once('process-died', onDied);

    try {
      await engine.start(settings.speech.language);
    } catch (err: any) {
      cleanup();
      floatingWin?.webContents.send(
        IPC.TRANSCRIPTION_ERROR,
        err?.message ?? 'Speech engine failed to start',
      );
    }
  });

  ipcMain.handle(IPC.STOP_RECORDING, () => {
    // Fire-and-forget. onFinal listener from START_RECORDING handles the result.
    SpeechEngine.getInstance().stop();
  });

  // ─── History & Snippets ───────────────────────────────────────────────────

  ipcMain.handle(IPC.GET_HISTORY, () => getHistory());
  ipcMain.handle(IPC.DELETE_HISTORY_ITEM, (_e, id: string) => deleteHistory(id));
  ipcMain.handle(IPC.GET_SNIPPETS, () => getSnippets());
  ipcMain.handle(IPC.ADD_SNIPPET, (_e, title: string, content: string) => addSnippet(title, content));
  ipcMain.handle(IPC.DELETE_SNIPPET, (_e, id: string) => deleteSnippet(id));
  ipcMain.handle(IPC.COPY_SNIPPET, (_e, content: string) => {
    // Clipboard only — don't inject (Settings window has focus)
    clipboard.writeText(content);
  });

  // ─── Permissions ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHECK_ACCESSIBILITY, () => {
    if (process.platform === 'darwin') {
      return systemPreferences.isTrustedAccessibilityClient(false);
    }
    return true;
  });

  ipcMain.handle(IPC.REQUEST_ACCESSIBILITY, () => {
    if (process.platform === 'darwin') {
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  });
}
