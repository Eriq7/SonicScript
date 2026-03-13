# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (compiles Swift helper, starts Electron dev server)
npm run dev

# Compile Swift helper only (needed after editing SonicScriptHelper.swift)
npm run build:swift

# Production build
npm run build

# TypeScript type check (no emit)
npx tsc --noEmit
```

There are no automated tests in this project.

## Architecture

SonicScript is a macOS-only tray app built with Electron + React. It captures speech via a long-lived Swift subprocess and injects transcribed text at the cursor using clipboard + simulated Cmd+V.

### Process model

```
Electron main process
  ├── HotkeyManager (node-global-key-listener) — detects double-tap of RIGHT ALT
  ├── SpeechEngine — manages a long-lived SonicScriptHelper.app child process
  │     └── SonicScriptHelper.app (Swift) — AVAudioEngine + SFSpeechRecognizer
  │           communicates via JSON lines on stdin/stdout
  └── Two BrowserWindows:
        ├── FloatingWidget — transparent, always-on-top, shown during recording
        └── SettingsWindow — 6-tab settings UI (routed via URL hash)
```

### Recording flow

1. User double-taps Right Alt → `HotkeyManager` fires → main sends `IPC.HOTKEY_DOUBLE_TAP` to FloatingWidget
2. FloatingWidget calls `window.electronAPI.startRecording()` → IPC to main
3. `ipc-handlers.ts` captures the active app name immediately (before audio ends), registers session-scoped listeners on `SpeechEngine`, then sends `{"action":"start"}` to Swift
4. Swift streams `{"type":"partial","text":"..."}` → forwarded to FloatingWidget as live preview
5. User double-taps again → `stopRecording()` IPC → main sends `{"action":"stop"}` to Swift
6. Swift calls `endAudio()` → fires `{"type":"final","text":"..."}` → main runs optional LLM post-processing → clipboard + osascript paste → saves to history

**Critical**: The active app name is captured at `START_RECORDING` time (not end) to avoid capturing focus of the SonicScript window after the user stops speaking.

**Critical**: `STOP_RECORDING` is fire-and-forget. The `onFinal` listener registered during `START_RECORDING` is the sole consumer of the final transcript — no second `once('final')` should be registered.

### Swift helper

- Source: `src/main/speech/SonicScriptHelper.swift`
- Built as an `.app` bundle: `resources/SonicScriptHelper.app/` — **must be a bundle** (not a raw binary) for macOS TCC to recognize it for speech/microphone permissions
- **Does NOT call `SFSpeechRecognizer.requestAuthorization()`** — that call crashes on ad-hoc signed apps. The helper outputs `{"type":"ready"}` immediately. Auth errors surface as error events when recording starts (error code 203 = not authorized)
- For first-run in dev: manually grant in **System Settings → Privacy & Security → Speech Recognition**
- `scripts/build-swift.sh` also patches `node_modules/electron/dist/Electron.app/Contents/Info.plist` with microphone/speech usage descriptions and re-signs Electron — required so macOS TCC accepts permission requests
- Uses `MacOSX15.5.sdk` explicitly because system SDK may be macOS 26.x beta (incompatible with Swift 6.1.x compiler from Command Line Tools)

### IPC conventions

All channel names are in `src/shared/types.ts` as the `IPC` const. Never use raw strings.

- **renderer → main**: `ipcRenderer.invoke()` / `ipcMain.handle()`
- **main → renderer**: `webContents.send()` / `ipcRenderer.on()`
- Listener functions in `src/preload/index.ts` return a cleanup function (`() => removeAllListeners(channel)`)

### Settings & storage

- **App settings** (`src/main/config/store.ts`): `electron-store` file named `settings`. Key shape: `{ hotkey, speech, llm, general }`. Note: `speech` was previously `whisper` — migration code exists in `getSettings()`.
- **History + snippets** (`src/main/store/data-store.ts`): separate `electron-store` file named `sonicscript-data`. History is capped at 50 entries.

### Renderer routing

Both UI surfaces load the same `src/renderer/index.html` entry point. `src/renderer/App.tsx` reads `window.location.hash` to render either `<FloatingWidget>` or `<SettingsWindow>`.

### Key files

| File | Role |
|------|------|
| `src/main/index.ts` | App bootstrap: init store, register IPC, create windows, start hotkey, spawn Swift |
| `src/main/ipc-handlers.ts` | All IPC handler registrations; session-scoped recording listeners |
| `src/main/speech/speech-engine.ts` | `SpeechEngine` singleton: spawns/restarts Swift helper, routes events |
| `src/main/speech/SonicScriptHelper.swift` | Swift CLI: mic capture + streaming speech recognition |
| `src/main/llm/llm-processor.ts` | Optional OpenAI post-processing (smart edit mode) |
| `src/main/output/text-output.ts` | Clipboard write + osascript paste simulation |
| `src/main/windows.ts` | Creates/manages the two `BrowserWindow` instances |
| `src/preload/index.ts` | `contextBridge` API exposed as `window.electronAPI` |
| `src/shared/types.ts` | All TypeScript types + `IPC` channel constants |
| `scripts/build-swift.sh` | Compile Swift, bundle as `.app`, sign, patch Electron Info.plist |
| `resources/helper-info.plist` | Info.plist embedded in `SonicScriptHelper.app` (includes usage descriptions) |
| `resources/entitlements.mac.plist` | macOS entitlements for the main Electron app |
| `resources/entitlements.helper.plist` | Entitlements for the Swift helper bundle |

## Git branches

- `main` — stable branch, production-ready code lives here
- `switch-to-sf-model` — current working branch, replacing Whisper with Apple SFSpeechRecognizer

**Workflow**: all new work happens on `switch-to-sf-model`. When the refactor is complete and stable, merge back into `main`. Never commit directly to `main`.

## Plan management rules

Whenever a new plan is generated (e.g. via Claude Opus), always write it to `.claude/PLAN.md`. After each batch of tasks is completed, update `.claude/PLAN.md` to mark the finished stages as done (e.g. add `[x]`). This keeps the plan current across sessions.
