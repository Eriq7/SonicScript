import { BrowserWindow, screen, app, shell } from 'electron';
import * as path from 'path';
import { is } from '@electron-toolkit/utils';
import { FLOATING_WIDGET } from '../shared/constants';

let floatingWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/index.js');
}

// ─── Floating Widget Window ───────────────────────────────────────────────────

export function createFloatingWindow(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  floatingWindow = new BrowserWindow({
    width: FLOATING_WIDGET.width,
    height: FLOATING_WIDGET.height,
    x: Math.floor((screenW - FLOATING_WIDGET.width) / 2),
    y: screenH - FLOATING_WIDGET.bottomOffset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000', // Fully transparent
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Never steal focus
  floatingWindow.setIgnoreMouseEvents(true);

  if (process.platform === 'darwin') {
    floatingWindow.setAlwaysOnTop(true, 'screen-saver');
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#floating`);
  } else {
    floatingWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'floating' });
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });

  return floatingWindow;
}

export function showFloatingWindow(): void {
  floatingWindow?.showInactive();
}

export function hideFloatingWindow(): void {
  floatingWindow?.hide();
}

export function getFloatingWindow(): BrowserWindow | null {
  return floatingWindow;
}

// ─── Settings Window ──────────────────────────────────────────────────────────

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 520,
    title: 'SonicScript Settings',
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#0f0f1a', // Match the app's dark background — prevents white flash
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#settings`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'settings' });
  }

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show();
  });

  // Open external links (e.g. API key page) in the system browser, not inside the app
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function showSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
  } else {
    createSettingsWindow();
  }
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

export function getAllWindows(): BrowserWindow[] {
  return [floatingWindow, settingsWindow].filter(Boolean) as BrowserWindow[];
}
