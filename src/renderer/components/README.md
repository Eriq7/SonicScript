# src/renderer/components — Component Catalogue

## Live components

| Component | File | Description |
|-----------|------|-------------|
| `FloatingWidget` | `FloatingWidget.tsx` | Always-on-top recording indicator; 5-state machine |
| `SettingsWindow` | `SettingsWindow.tsx` | Root settings panel with 6-tab sidebar |
| `Toggle` | `SettingsWindow.tsx` | Reusable toggle switch (exported from SettingsWindow) |
| `HotkeyConfig` | `HotkeyConfig.tsx` | Hotkey preset picker + Accessibility permission banner |
| `LLMSettings` | `LLMSettings.tsx` | Smart Edit toggle, API key input, and save |

### Internal components (defined in SettingsWindow.tsx, not exported)

| Component | Description |
|-----------|-------------|
| `GeneralSettings` | Launch-at-startup toggle + 3-stat usage dashboard |
| `HistoryTab` | Scrollable list of recent transcriptions with copy/save-to-snippets/delete |
| `SnippetsTab` | Snippet CRUD: add form + list with copy/delete |
| `AboutTab` | App identity card, feature list, usage instructions |

## Legacy / unused code

| File | Status | Notes |
|------|--------|-------|
| `ModelManager.tsx` | **Not used** | Legacy Whisper model download UI; references APIs that no longer exist (`getModelStatus`, `downloadModel`, etc.) after the switch to SFSpeechRecognizer |

## Cross-component dependencies

```
SettingsWindow
  ├─ imports HotkeyConfig
  ├─ imports LLMSettings
  └─ exports Toggle  ←── imported by LLMSettings
```

`Toggle` is exported from `SettingsWindow` (rather than a separate file) because
it was originally only used there. `LLMSettings` imports it to avoid duplication.

## hooks/

| Hook | File | Status |
|------|------|--------|
| `useIPCListener` | `hooks/useIPC.ts` | **Unused** — defined but not imported anywhere; IPC listeners are set up inline with `useEffect` in each component |
