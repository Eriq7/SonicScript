# src/main — Electron Main Process

The main process is the Node.js backend of SonicScript. It owns all privileged
operations: file I/O, native subprocess management, system tray, global hotkeys,
and IPC routing.

## Bootstrap sequence

```
app.whenReady()
  └─ bootstrap()
       1. initDataStore()        — electron-store: history + snippets
       2. registerIpcHandlers()  — wire all ipcMain.handle() routes
       3. createFloatingWindow() — frameless transparent overlay
       4. createSettingsWindow() — (dev mode only)
       5. createTray()           — system tray icon + context menu
       6. HotkeyManager.start()  — global double-tap hotkey listener
       7. SpeechEngine.spawn()   — start Swift helper subprocess
```

## Process model

```
Electron main process
  ├── HotkeyManager          — node-global-key-listener, 350ms double-tap
  ├── SpeechEngine           — manages SonicScriptHelper.app subprocess
  │     └── SonicScriptHelper.app (Swift)
  │           AVAudioEngine + SFSpeechRecognizer
  │           JSON lines via stdin/stdout
  └── Two BrowserWindows
        ├── FloatingWidget   — transparent, always-on-top, mouse-ignored
        └── SettingsWindow   — 6-tab settings UI (hash-routed)
```

## Module map

| File / Folder       | Responsibility |
|---------------------|----------------|
| `index.ts`          | App entry, lifecycle hooks, bootstrap orchestration |
| `ipc-handlers.ts`   | All `ipcMain.handle()` registrations, recording session logic |
| `windows.ts`        | `BrowserWindow` factory + accessor functions |
| `tray.ts`           | System tray icon + context menu |
| `config/`           | `electron-store` settings persistence + migrations |
| `hotkey/`           | Global hotkey listener (double-tap detection) |
| `speech/`           | `SpeechEngine` singleton + Swift helper source |
| `llm/`              | Optional LLM post-processing (Smart Edit) |
| `output/`           | Clipboard write + simulated paste injection |
| `store/`            | History and snippets persistence (separate store file) |

## IPC architecture

- **renderer → main**: `ipcRenderer.invoke()` / `ipcMain.handle()` (request-response)
- **main → renderer**: `webContents.send()` / `ipcRenderer.on()` (push events)
- All channel names are constants in `src/shared/types.ts` (`IPC` object) — never use raw strings

## Recording session lifecycle

1. `START_RECORDING` → capture active app, register session-scoped listeners, start Swift
2. Swift streams `partial` events → forwarded to FloatingWidget as live preview
3. `STOP_RECORDING` (fire-and-forget) → Swift calls `endAudio()`
4. `final` event → LLM post-process → clipboard inject → save history → notify UI
5. Watchdogs: 10-min recording timeout, 50s post-stop watchdog for hung sessions
