/**
 * index.ts — App entry point and bootstrap orchestrator.
 *
 * Main exports:
 *   (none — side-effect module; all logic runs via app lifecycle hooks)
 *
 * Execution flow:
 *   1. Acquire single-instance lock; quit if another instance is running
 *   2. app.whenReady → bootstrap():
 *      a. initDataStore()       — initialize history/snippets electron-store
 *      b. registerIpcHandlers() — wire all ipcMain.handle() routes
 *      c. createFloatingWindow() — always-on-top transparent overlay
 *      d. createSettingsWindow() in dev mode only
 *      e. createTray()          — system tray icon + menu
 *      f. HotkeyManager.start() — begin listening for double-tap hotkey
 *      g. SpeechEngine.spawn()  — start Swift helper subprocess in background
 *   3. before-quit: stop hotkey listener, kill Swift subprocess
 *   4. second-instance: show settings window instead of launching duplicate
 *
 * Design notes:
 *   - App intentionally never quits on window-all-closed (runs as tray app)
 *   - SpeechEngine spawn failure is non-fatal (logged as warning)
 */
import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { createFloatingWindow, createSettingsWindow, getFloatingWindow } from './windows';
import { createTray } from './tray';
import { HotkeyManager } from './hotkey/hotkey-manager';
import { SpeechEngine } from './speech/speech-engine';
import { initDataStore } from './store/data-store';
import { registerIpcHandlers, setHotkeyManagerRef } from './ipc-handlers';
import { getSettings } from './config/store';
import { IPC } from '../shared/types';

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let hotkeyManager: HotkeyManager | null = null;

async function bootstrap(): Promise<void> {
  // Initialize data store (history + snippets)
  initDataStore();

  // Register all IPC handlers first
  registerIpcHandlers();

  // Create windows
  createFloatingWindow();
  // In dev mode, open settings window automatically for easy testing
  if (is.dev) {
    createSettingsWindow();
  }

  // Create system tray
  createTray();

  // Set up hotkey listener
  const settings = getSettings();
  hotkeyManager = new HotkeyManager(settings.hotkey.key);
  setHotkeyManagerRef(hotkeyManager);

  hotkeyManager.start(
    () => {
      const win = getFloatingWindow();
      win?.showInactive();
      win?.webContents.send(IPC.HOTKEY_DOUBLE_TAP);
    },
    () => {
      const win = getFloatingWindow();
      win?.showInactive();
      win?.webContents.send(IPC.HOTKEY_LONG_PRESS);
    },
  );

  // Spawn Swift speech helper in background
  SpeechEngine.getInstance()
    .spawn()
    .then(() => console.log('[Main] Speech engine ready'))
    .catch(err => console.warn('[Main] Speech engine spawn failed:', err.message));

  // Keep app running in background (tray app)
  app.on('before-quit', () => {
    hotkeyManager?.stop();
    SpeechEngine.getInstance().kill().catch(() => {});
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sonicscript.app');

  // Open/close devtools with F12 in dev mode
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  await bootstrap();

  // macOS: prevent quitting when all windows are closed (runs as tray app)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createFloatingWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running as tray app on all platforms
});

app.on('second-instance', () => {
  // User tried to open a second instance → show settings
  createSettingsWindow();
});
