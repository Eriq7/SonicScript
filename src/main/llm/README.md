# src/main/llm — LLM Post-processing Pipeline (Smart Edit)

Optionally cleans up raw speech-to-text output using an OpenAI-compatible chat
completion API before the text is injected at the cursor.

## Smart Edit flow

```
raw transcript
      │
      ▼
processWithLLM(rawText, settings)
      │
      ├─ guard: skip if disabled / no API key / mode === 'none'
      │
      ├─ getActiveAppName()         — detect frontmost app
      │
      ├─ buildSmartEditPrompt()     — construct context-aware prompt
      │
      ├─ OpenAI chat completion     — 15s timeout, temp=0.1
      │
      └─ return cleaned text        — or rawText on any error
```

## Prompt design

`buildSmartEditPrompt()` instructs the LLM to:

- Resolve self-corrections (keep only the final corrected version)
- Remove filler words (`um`, `uh`, `嗯`, `那个`, etc.)
- Fix grammar and punctuation
- Preserve technical terms, proper nouns, and specific numbers
- **Never translate between Chinese and English** — every word stays in the language it was spoken

## Active-app context mapping

`getAppContext()` in `prompts.ts` maps the frontmost app name to a tone hint:

| App pattern | Context hint |
|-------------|-------------|
| Slack / Discord / Teams | casual tone is fine |
| Mail / Outlook / Gmail | professional tone preferred |
| VS Code / Xcode / Vim | preserve technical terms exactly |
| Notion / Obsidian / Bear | notes application |
| Word / Pages / Docs | formal tone |
| (default) | general application |

## Graceful degradation

Any error during LLM processing (network failure, auth error, timeout, invalid
response) silently returns the original `rawText`. Transcription always succeeds
even if Smart Edit is broken.

## Configuration

Settings are stored under the `llm` key in the `settings` electron-store:

| Key | Default | Notes |
|-----|---------|-------|
| `enabled` | `false` | Master on/off switch |
| `apiKey` | `""` | OpenAI API key (stored locally) |
| `baseURL` | `https://api.openai.com/v1` | Supports OpenRouter, local models |
| `model` | `gpt-4.1-nano` | Any OpenAI-compatible model name |
| `mode` | `smart-edit` | Only mode currently implemented |
