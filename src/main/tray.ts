/**
 * tray.ts — System tray icon, tooltip, and context menu.
 *
 * Main exports:
 *   - createTray(): Tray   — creates and stores the tray instance
 *   - destroyTray(): void  — destroys the tray icon (called on quit)
 *
 * Design notes:
 *   - On macOS, icon is set as a template image so it auto-adapts to light/dark menu bar
 *   - Falls back to an empty 1×1 nativeImage if icon-tray.png is missing
 *   - Context menu: Settings (Cmd+, / Ctrl+,) and Quit (Cmd+Q / Alt+F4)
 *   - macOS single-click opens context menu natively; other platforms use double-click
 *     to open Settings (since right-click is needed for context menu on those platforms)
 */
import { Tray, Menu, app, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { showSettingsWindow } from './windows';

let tray: Tray | null = null;

function getTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(
    app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources'),
    'icon-tray.png',
  );

  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    // macOS tray icons should be template images (16x16 or 18x18)
    if (process.platform === 'darwin') {
      img.setTemplateImage(true);
    }
    return img;
  }

  // Fallback: create a simple placeholder icon (1x1 pixel)
  return nativeImage.createEmpty();
}

export function createTray(): Tray {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('SonicScript — Press Right Alt/Option to record');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'SonicScript',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
      click: () => showSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit SonicScript',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  // On macOS, single click shows menu; on other platforms, double-click opens settings
  if (process.platform !== 'darwin') {
    tray.on('double-click', () => showSettingsWindow());
  }

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
