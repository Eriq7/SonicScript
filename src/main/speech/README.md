# src/main/speech — Speech Recognition Subsystem

Manages a long-lived Swift subprocess (`SonicScriptHelper.app`) that performs
on-device speech recognition via `AVAudioEngine` + `SFSpeechRecognizer`.

## Electron ↔ Swift JSON-lines protocol

Communication happens over the subprocess's `stdin` / `stdout` as newline-delimited JSON.

### Commands (Electron → Swift, via stdin)

| Command | Description |
|---------|-------------|
| `{"action":"start","language":"zh-CN"}` | Begin a recognition session |
| `{"action":"stop"}` | Gracefully stop; triggers final result |
| `{"action":"cancel"}` | Force-cancel without emitting final |

### Events (Swift → Electron, via stdout)

| Event | Description |
|-------|-------------|
| `{"type":"ready"}` | Helper started; ready to receive commands |
| `{"type":"partial","text":"..."}` | Live transcript update (streaming) |
| `{"type":"final","text":"..."}` | Complete transcript for the session |
| `{"type":"error","message":"..."}` | Recognition error (e.g. code 203 = not authorised) |

## .app bundle requirement

The Swift helper **must** be packaged as a `.app` bundle
(`SonicScriptHelper.app/Contents/MacOS/SonicScriptHelper`), not a plain binary.
macOS TCC (Transparency, Consent, and Control) only grants microphone and speech
recognition permissions to the "responsible process" — a process inside an `.app`
bundle with a valid `Info.plist`. A raw binary will be silently denied.

## TCC / authorisation approach

`SFSpeechRecognizer.requestAuthorization()` is **not called** in the Swift helper
because it crashes when the `.app` is ad-hoc signed (the default in dev). Instead:

- The helper outputs `{"type":"ready"}` immediately on startup.
- If speech recognition is not authorised, the first recognition task returns
  **error code 203** (`kSFSpeechRecognizerErrorNotAuthorized`), which surfaces as
  a `{"type":"error","message":"..."}` event.
- **Development**: grant permission manually in
  *System Settings → Privacy & Security → Speech Recognition*.
- **Production** (signed with a Developer ID): the native system dialog appears
  automatically on first use.

## Segment chaining (>60s recording)

`SFSpeechRecognizer` tasks time out after roughly 60 seconds. To support longer
recordings, the Swift helper uses **segment chaining**:

1. When a task fires `isFinal` due to a natural timeout (not a user stop), the
   completed text is appended to `accumulatedText` and a new request is started
   **without stopping `AVAudioEngine`**.
2. On user stop (`stoppingByRequest = true`), the next `isFinal` merges all
   accumulated segments and emits the full transcript as `{"type":"final"}`.

## mergeTranscript overlap handling

Segment boundaries can produce overlapping text (the new segment repeats the tail
of the previous one). `mergeTranscript(base, next)` deduplicates by finding the
longest suffix of `base` that is a prefix of `next` and concatenating without repetition.
