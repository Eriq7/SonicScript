# src/shared — Shared Contracts

Types and constants that are imported by **both** the main process and the renderer.
Nothing in this directory may import from `src/main` or `src/renderer`.

## IPC channel registry

All channel names are defined as string literal constants in the `IPC` object in
`types.ts`. Using this object (instead of raw strings) ensures:

- TypeScript narrows channel names to their exact literal types
- Renaming a channel is a single-file change
- Accidental typos produce compile-time errors

```typescript
export const IPC = {
  HOTKEY_DOUBLE_TAP:    'hotkey-double-tap',
  START_RECORDING:      'start-recording',
  STOP_RECORDING:       'stop-recording',
  PARTIAL_TRANSCRIPT:   'partial-transcript',
  TRANSCRIPTION_RESULT: 'transcription-result',
  TRANSCRIPTION_ERROR:  'transcription-error',
  GET_SETTINGS:         'get-settings',
  SET_SETTINGS:         'set-settings',
  CHECK_ACCESSIBILITY:  'check-accessibility',
  REQUEST_ACCESSIBILITY:'request-accessibility',
  SHOW_SETTINGS:        'show-settings',
  HIDE_FLOATING:        'hide-floating',
  UPDATE_HOTKEY:        'update-hotkey',
  GET_HISTORY:          'get-history',
  DELETE_HISTORY_ITEM:  'delete-history-item',
  GET_SNIPPETS:         'get-snippets',
  ADD_SNIPPET:          'add-snippet',
  DELETE_SNIPPET:       'delete-snippet',
  COPY_SNIPPET:         'copy-snippet',
} as const;
```

## AppSettings schema

```typescript
AppSettings {
  hotkey:  HotkeySettings  — { key: string }
  speech:  { language: string }   — "zh" | "en"
  llm:     LLMSettings
  general: GeneralSettings
}
```

See `src/main/config/README.md` for the full schema with defaults.

## Key type definitions

| Type | Purpose |
|------|---------|
| `RecordingState` | Union for FloatingWidget state machine |
| `AppSettings` | Full settings object (main ↔ renderer) |
| `LLMSettings` | Smart Edit configuration |
| `HistoryEntry` | Single transcription history record |
| `Snippet` | User-saved text snippet |
| `TranscriptionResult` | Final transcript payload (unused directly; text/durationMs) |
