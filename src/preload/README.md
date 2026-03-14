# src/preload — Preload Bridge

Runs in a privileged context (Node.js + Electron APIs available) but exposed to
the renderer via `contextBridge`, providing a typed, sandboxed API surface.

## Security model

- `contextIsolation: true` — the renderer's JavaScript context is isolated from
  the preload context; renderer code cannot access Node.js or Electron internals.
- `nodeIntegration: false` — Node.js APIs are completely absent from the renderer.
- The preload script is the only trusted boundary between the two sides.

## Full API surface (`window.electronAPI`)

| Category | Method | Direction |
|----------|--------|-----------|
| **Platform** | `platform` | property |
| **Hotkey** | `onHotkeyDoubleTap(cb)` | main → renderer |
| **Recording** | `startRecording()`, `stopRecording()` | renderer → main |
| **Transcription** | `onPartialTranscript(cb)`, `onTranscriptionResult(cb)`, `onTranscriptionError(cb)` | main → renderer |
| **Settings** | `getSettings()`, `setSettings(partial)`, `updateHotkey(key)` | renderer → main |
| **Permissions** | `checkAccessibility()`, `requestAccessibility()` | renderer → main |
| **History** | `getHistory()`, `deleteHistoryItem(id)` | renderer → main |
| **Snippets** | `getSnippets()`, `addSnippet(title, content)`, `deleteSnippet(id)`, `copySnippet(content)` | renderer → main |
| **Window events** | `onShowSettings(cb)`, `onHideFloating(cb)` | main → renderer |

## Cleanup pattern

All `on*` event listeners return a **cleanup function** `() => removeAllListeners(channel)`.
React components call this in their `useEffect` return, ensuring no listener leaks
on component unmount.

```typescript
useEffect(() => {
  const off = window.electronAPI.onPartialTranscript(text => setText(text));
  return () => off();          // cleanup on unmount
}, []);
```

## TypeScript types

A `declare global { interface Window { electronAPI: ... } }` block at the bottom
of `index.ts` provides full TypeScript inference for `window.electronAPI`
throughout the renderer without any additional imports.
