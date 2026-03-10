import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { createFloatingWindow, createSettingsWindow, getFloatingWindow } from './windows';
import { createTray } from './tray';
import { HotkeyManager } from './hotkey/hotkey-manager';
import { WhisperEngine } from './whisper/whisper-engine';
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
    // onPressed: key held down → tell renderer to start recording
    () => {
      const win = getFloatingWindow();
      win?.showInactive();
      win?.webContents.send(IPC.HOTKEY_PRESSED);
    },
    // onReleased: key released → tell renderer to stop recording
    () => {
      const win = getFloatingWindow();
      win?.webContents.send(IPC.HOTKEY_RELEASED);
    },
  );

  // Preload Whisper model in background (no-op if model not yet downloaded)
  const whisperEngine = WhisperEngine.getInstance();
  whisperEngine
    .preload()
    .then(() => console.log('[Main] Whisper model ready'))
    .catch(err => console.warn('[Main] Whisper preload skipped:', err.message));

  // Keep app running in background (tray app)
  app.on('before-quit', () => {
    hotkeyManager?.stop();
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
  // On macOS, keep running as tray app
  if (process.platform !== 'darwin') {
    // On Windows/Linux, also keep running as tray app
    // app.quit(); ← NOT called intentionally
  }
});

app.on('second-instance', () => {
  // User tried to open a second instance → show settings
  createSettingsWindow();
});
