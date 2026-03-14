# src/main/output — Text Injection

Injects the final transcribed (and optionally LLM-processed) text into whatever
application the user was focused on before starting the recording.

## Strategy: clipboard + paste simulation

Direct keystroke injection is not reliably possible across arbitrary macOS apps.
Instead, `injectText()` uses a two-step approach:

1. **Write to clipboard** — `clipboard.writeText(text)` via Electron's native API
2. **Simulate Cmd+V** — platform-specific paste keystroke via a subprocess

This approach works in virtually every app that accepts text input.

## Platform implementations

| Platform | Method |
|----------|--------|
| macOS | `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'` |
| Windows | `PowerShell Add-Type -AssemblyName System.Windows.Forms; SendKeys ^v` |
| Linux | `xdotool key ctrl+v` (fallback: `xclip | xdotool type`) |

## 80ms delay rationale

A deliberate 80ms delay is inserted between the clipboard write and the paste
simulation. Without it, intermittent failures occur where the paste keystroke fires
before the clipboard contents are fully committed. This value was determined
empirically and is the minimum safe delay.

## macOS Accessibility requirement

`osascript` requires **Accessibility** permission (`System Settings → Privacy & Security →
Accessibility`). If the permission is not granted, paste simulation fails silently —
the text is already in the clipboard so the user can paste manually with Cmd+V.

`ipc-handlers.ts` checks and requests this permission via
`systemPreferences.isTrustedAccessibilityClient()`.

## Clipboard is not restored

After injection, the clipboard retains the transcribed text. This is intentional —
the user may want to paste it again in another location.
