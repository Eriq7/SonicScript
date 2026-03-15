/**
 * ipc-handlers.ts — Central registration of all ipcMain.handle() routes.
 *
 * Main exports:
 *   - registerIpcHandlers(): void    — registers all IPC handlers; called once at bootstrap
 *   - setHotkeyManagerRef(hm): void  — injects HotkeyManager reference for UPDATE_HOTKEY
 *
 * I/O data types:
 *   - AppSettings (partial)  → SET_SETTINGS handler input
 *   - HistoryEntry[]         ← GET_HISTORY response
 *   - Snippet[]              ← GET_SNIPPETS response
 *
 * Execution flow (recording session):
 *   1. START_RECORDING: capture active app name, register session-scoped listeners
 *      (partial/final/error/process-died), set sessionActive=true, start recording timeout
 *   2. Swift streams partial results → forward to FloatingWidget via PARTIAL_TRANSCRIPT
 *   3. STOP_RECORDING: fire-and-forget stop(); arm 50s post-stop watchdog timer
 *   4. onFinal: remove listeners, run LLM post-processing, inject text, save history,
 *      notify FloatingWidget and SettingsWindow, call endSession()
 *   5. onError / onDied: endSession() + send TRANSCRIPTION_ERROR to FloatingWidget
 *
 * Design notes:
 *   - Session state (sessionActive, postStopTimer, recTimeout) is module-scoped
 *   - STOP_RECORDING is fire-and-forget; onFinal (registered during START) is the sole
 *     consumer of the final transcript — no second once('final') is registered
 *   - Recording timeout (10 min) auto-stops; post-stop watchdog (50s) aborts if
 *     the final event never arrives (e.g. Swift crash mid-utterance)
 */
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

// Timeouts
const RECORDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — prevents infinite recording
const POST_PROC_TIMEOUT_MS = 50_000;          // 50 seconds — covers final + LLM + inject window

// Module-scoped session state (one recording at a time)
let sessionActive = false;
let postStopTimer: NodeJS.Timeout | null = null;
let recTimeout: NodeJS.Timeout | null = null;

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

  ipcMain.handle(IPC.START_RECORDING, async (_e, translate: boolean = false) => {
    if (sessionActive) {
      console.warn('[IPC] START_RECORDING rejected: session already active');
      return;
    }
    const settings = getSettings();
    const engine = SpeechEngine.getInstance();
    const floatingWin = getFloatingWindow();

    // Capture app name NOW (before recording ends, to avoid focus shift)
    const appName = await getActiveAppName();

    // Track last non-empty partial as fallback for empty final results
    let lastPartialText = '';

    // removeListeners: removes event listeners + clears recording timeout
    // Does NOT touch postStopTimer or sessionActive — safe to call from onFinal
    const removeListeners = (): void => {
      engine.removeListener('partial', onPartial);
      engine.removeListener('final', onFinal);
      engine.removeListener('error', onError);
      engine.removeListener('process-died', onDied);
      if (recTimeout) { clearTimeout(recTimeout); recTimeout = null; }
    };

    // endSession: full teardown — listeners + postStopTimer + sessionActive flag
    const endSession = (): void => {
      removeListeners();
      if (postStopTimer) { clearTimeout(postStopTimer); postStopTimer = null; }
      sessionActive = false;
    };

    const onPartial = ({ text }: { text: string }): void => {
      if (text) lastPartialText = text;
      floatingWin?.webContents.send(IPC.PARTIAL_TRANSCRIPT, text);
    };

    const onFinal = async ({ text }: { text: string }): Promise<void> => {
      // Guard 1: watchdog may have already ended the session
      if (!sessionActive) return;

      removeListeners(); // clears listeners + recTimeout; postStopTimer still running

      const effectiveText = text.trim() || lastPartialText.trim();
      try {
        const finalText = await processWithLLM(effectiveText, settings.llm, translate);

        // Guard 2: watchdog may have fired while processWithLLM was awaited
        if (!sessionActive) return;

        if (finalText.trim()) {
          await injectText(finalText);
          saveHistory({ text: finalText, appName });
        }
        floatingWin?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
        getSettingsWindow()?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
      } catch (err: any) {
        if (sessionActive) {
          floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, err?.message ?? 'Error');
        }
      } finally {
        endSession();
      }
    };

    const onError = ({ message }: { message: string }): void => {
      endSession();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, message);
    };

    const onDied = (): void => {
      endSession();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, 'Speech engine crashed');
    };

    engine.on('partial', onPartial);
    engine.once('final', onFinal);
    engine.once('error', onError);
    engine.once('process-died', onDied);

    sessionActive = true;

    // Recording timeout: auto-stop after 10 minutes to prevent infinite recording
    recTimeout = setTimeout(() => {
      engine.stop(); // triggers the normal onFinal path
    }, RECORDING_TIMEOUT_MS);

    try {
      await engine.start(settings.speech.language);
    } catch (err: any) {
      endSession();
      floatingWin?.webContents.send(
        IPC.TRANSCRIPTION_ERROR,
        err?.message ?? 'Speech engine failed to start',
      );
    }
  });

  ipcMain.handle(IPC.STOP_RECORDING, () => {
    // Fire-and-forget. onFinal listener from START_RECORDING handles the result.
    SpeechEngine.getInstance().stop();

    // Post-stop watchdog: if final never arrives within 50s, abort the session
    if (sessionActive) {
      if (postStopTimer) clearTimeout(postStopTimer);
      postStopTimer = setTimeout(() => {
        if (sessionActive) {
          // endSession clears listeners and nulls all refs
          const floatingWin = getFloatingWindow();
          // Manually inline teardown to avoid circular ref issues
          sessionActive = false;
          postStopTimer = null;
          if (recTimeout) { clearTimeout(recTimeout); recTimeout = null; }
          const engine = SpeechEngine.getInstance();
          engine.removeAllListeners('partial');
          engine.removeAllListeners('final');
          engine.removeAllListeners('error');
          engine.removeAllListeners('process-died');
          floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, 'Processing timed out');
        }
      }, POST_PROC_TIMEOUT_MS);
    }
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
