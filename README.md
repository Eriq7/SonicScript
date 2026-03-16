# SonicScript

> Free, privacy-first speech-to-text for macOS — dictate anywhere, instantly.

- **On-device transcription** via Apple SFSpeechRecognizer — no audio leaves your machine
- **AI Smart Edit** cleans up filler words and adapts tone to the active app
- **Translation mode** converts Chinese speech to English text in one long-press
- **Free and open source** — no subscription, no cloud dependency

![macOS 13+](https://img.shields.io/badge/macOS-13%2B-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848f)
![Swift](https://img.shields.io/badge/Swift-5.9-fa7343)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| Feature | Description |
|---------|-------------|
| Double-tap hotkey | Double-tap Right Alt to start/stop recording system-wide |
| Long-press hotkey | Long-press Right Alt to record in translation mode (zh → en) |
| Live preview | Partial transcript streamed to floating widget while speaking |
| Auto-paste | Transcribed text injected at cursor via clipboard + Cmd+V simulation |
| Smart Edit | AI post-processing removes filler words, adapts tone to active app |
| App-aware tone | Casual in Slack/Discord, professional in Mail/Outlook, technical in VS Code |
| Translation mode | Speak Chinese, get English output |
| History | Last 50 transcripts saved and browsable in Settings |
| Snippets | Save and reuse frequently dictated phrases |
| Tray app | Lives in the menu bar, zero friction |

---

## Smart Edit Examples

Smart Edit uses the active app name to pick the right tone — then strips filler words and reformats.

**Slack / Discord — Casual**
```
You said:  "hey um so like I was thinking maybe we could uh grab dinner tonight
            if you're free no wait actually tomorrow works better"

Output:    "hey I was thinking we could grab dinner tomorrow if you're free"
```

**Mail / Outlook — Professional**
```
You said:  "hi um I wanted to follow up on the uh proposal we discussed
            last week I think we should move forward with option B"

Output:    "Hi, I wanted to follow up on the proposal we discussed last week.
            I think we should move forward with Option B."
```

**Translation mode (long-press)**
```
You said:  "我觉得这个方案不太好 我们需要重新考虑一下架构设计"

Output:    "I don't think this approach is ideal. We need to reconsider the architecture design."
```

---

## Architecture

### Process model

```
Electron Main Process
├── HotkeyManager (node-global-key-listener)
│     Double-tap → record / Long-press → translate
├── SpeechEngine (EventEmitter singleton)
│     └── SonicScriptHelper.app (Swift subprocess)
│           AVAudioEngine + SFSpeechRecognizer
│           JSON lines over stdin/stdout
├── LLM Processor (OpenAI-compatible, optional)
│     ├── Smart Edit: app-aware tone
│     └── Translation: zh → en
├── Text Output
│     clipboard + osascript Cmd+V
└── BrowserWindows
      ├── FloatingWidget (transparent overlay)
      └── SettingsWindow (6 tabs)
```

### Recording flow

1. User double-taps Right Alt → `HotkeyManager` fires
2. Main sends `hotkey-double-tap` IPC → FloatingWidget calls `startRecording()`
3. Main captures active app name (before audio ends — avoids capturing SonicScript itself)
4. Main registers session-scoped `onPartial` / `onFinal` listeners on `SpeechEngine`
5. Main sends `{"action":"start","language":"zh-CN"}` to Swift helper via stdin
6. Swift streams `{"type":"partial","text":"..."}` → forwarded to FloatingWidget as live preview
7. User double-taps again → `stopRecording()` IPC → main sends `{"action":"stop"}` to Swift
8. Swift fires `{"type":"final","text":"..."}` → main runs optional LLM post-processing
9. Transcribed (and optionally edited) text → clipboard → osascript Cmd+V → saved to history

### Tech stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Electron + electron-vite | Main / renderer / preload processes |
| Frontend | React 18 + TypeScript + Tailwind | Settings UI + floating widget |
| Speech | Apple SFSpeechRecognizer (Swift) | On-device transcription |
| IPC | JSON lines over stdin/stdout | Electron ↔ Swift subprocess |
| Hotkey | node-global-key-listener | System-wide hotkey listener |
| Text inject | clipboard + osascript | Paste at cursor in any app |
| AI | OpenAI SDK (any compatible endpoint) | Smart Edit + Translation |
| Storage | electron-store | Settings, history, snippets |
| Build | electron-builder | DMG (arm64 + x64) |

### App context mapping

| App | Tone applied by Smart Edit |
|-----|---------------------------|
| Slack, Discord, Teams | Casual — conversational, no formality |
| Mail, Outlook, Gmail | Professional — proper punctuation, capitalization |
| VS Code, Xcode, Vim | Preserve technical terms verbatim |
| Notion, Obsidian, Bear | Notes — clean sentences, no markdown injection |
| Word, Pages, Google Docs | Formal — structured prose |

---

## Download & Install

1. Download the latest `.dmg` from [GitHub Releases](../../releases/latest)
2. Open the `.dmg` and drag **SonicScript** to your Applications folder
3. Launch SonicScript — the icon appears in your menu bar

**Required permissions** (macOS will prompt on first use):

| Permission | Why |
|-----------|-----|
| Microphone | Capture audio for transcription |
| Speech Recognition | Required by SFSpeechRecognizer |
| Accessibility | Simulate Cmd+V to paste at cursor |

> **Gatekeeper note**: If macOS blocks the app ("unidentified developer"), right-click the app icon → **Open** → click **Open** in the dialog.

---

## Development

### Prerequisites

- macOS 13 or later
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 20+

### Setup

```bash
git clone https://github.com/your-username/SonicScript.git
cd SonicScript
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Compile Swift helper + start Electron dev server |
| `npm run build:swift` | Compile Swift helper only |
| `npm run build` | Compile Swift + electron-vite build (no packaging) |
| `npx electron-builder --mac` | Package into DMG |
| `npx tsc --noEmit` | TypeScript type check |

> **First run**: After `npm run dev`, go to **System Settings → Privacy & Security → Speech Recognition** and grant access to Electron.app.

---

## Requirements

- macOS 13 Ventura or later (SFSpeechRecognizer on-device recognition requires macOS 13+)
- Apple Silicon or Intel Mac
- Microphone

---

## License

MIT
