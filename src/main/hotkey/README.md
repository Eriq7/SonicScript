# src/main/hotkey — Global Hotkey Subsystem

Listens for global key events (even when the app is in the background) and fires
a callback when the configured key is double-tapped.

## Double-tap algorithm

```
KEY_DOWN (not held)
  └─ if now - lastKeyUpTime < 350ms → fire onDoubleTap(); reset lastKeyUpTime
  └─ else record nothing (first tap)
KEY_UP
  └─ record lastKeyUpTime = Date.now()
```

The 350ms window is tuned for natural double-tap speed. The `lastKeyUpTime` reset
after firing prevents a third tap within the window from triggering a second callback
(triple-tap prevention).

## Key aliases

`matchesKey()` normalises common name variations from the underlying library:

| Canonical name | Accepted aliases |
|----------------|-----------------|
| `RIGHT ALT`    | `ALTGR`, `RIGHT_ALT`, `RALT`, `RIGHT_OPTION`, `RIGHT OPTION` |
| `LEFT ALT`     | `LEFT_ALT`, `LALT` |

## Hot-swap

Calling `updateKey(newKey)` replaces the target key without restarting the native
listener. Internal state (`isHeld`, `lastKeyUpTime`) is reset to avoid stale timestamps
carrying over to the new key.

## Dependency

Uses [`node-global-key-listener`](https://github.com/LaunchMenu/node-global-key-listener)
(`^0.3.0`). On macOS this requires Accessibility permission to receive global key events.
