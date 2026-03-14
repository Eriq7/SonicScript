# src/main/store — Data Store (History + Snippets)

Persists transcription history and user-managed snippets using a dedicated
`electron-store` instance, separate from the app settings store.

## Schema

Store file name: **`sonicscript-data`**

```typescript
{
  history:  HistoryEntry[]   // newest first; capped at 50
  snippets: Snippet[]        // newest first; uncapped
}

HistoryEntry {
  id:        string   // auto-incrementing integer as string
  text:      string   // the transcribed (and LLM-processed) text
  appName:   string   // frontmost app at recording start time
  createdAt: number   // Unix timestamp (ms)
}

Snippet {
  id:        string
  title:     string
  content:   string
  createdAt: number
}
```

## Separate file from settings

History and snippets are stored in `sonicscript-data` rather than `settings` so
that clearing or resetting app settings does not wipe the user's transcription
history or snippets.

## Cap policy

- **History**: capped at **50 entries** (FIFO — the oldest entry is dropped when
  a 51st is added via `saveHistory()`).
- **Snippets**: uncapped — the user manages them manually with delete.

## Auto-increment IDs

IDs are stringified integers (`"1"`, `"2"`, ...). On app startup, `initDataStore()`
scans existing entries to seed the next-ID counters, ensuring no ID collisions even
if entries were deleted in a previous session.
