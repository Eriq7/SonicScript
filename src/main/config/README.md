# src/main/config — Settings Persistence

Wraps `electron-store` to provide typed read/write access to app settings.

## electron-store schema

Store file name: **`settings`** (located in the OS app-data directory).

```typescript
AppSettings {
  hotkey:  { key: string }           // e.g. "RIGHT ALT"
  speech:  { language: string }      // "zh" | "en"
  llm:     {
    enabled: boolean
    apiKey:  string
    baseURL: string                  // default: https://api.openai.com/v1
    model:   string                  // default: "gpt-4.1-nano"
    mode:    "none" | "smart-edit"
  }
  general: {
    launchAtStartup:   boolean
    showNotifications: boolean
  }
}
```

Default values are defined in `src/shared/constants.ts` (`DEFAULT_SETTINGS`).

## Migration strategy

`getSettings()` applies migrations on every read:

| Migration | Condition | Action |
|-----------|-----------|--------|
| `whisper` → `speech` | `speech` key absent, `whisper` present | Copy `whisper.language` → `speech.language`, persist |
| `gpt-4.1-mini` → `gpt-4.1-nano` | `llm.model === 'gpt-4.1-mini'` | Upgrade model name, persist |

Language is also validated and reset to `'zh'` if it holds an unrecognised value.

## API

```typescript
getSettings(): AppSettings
setSettings(partial: Partial<AppSettings>): void
```

`setSettings` performs per-section shallow merge: only the section keys provided
in `partial` are written; other sections are untouched.
