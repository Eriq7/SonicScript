# src/renderer — Renderer Process (React UI)

The renderer is a standard React + TypeScript single-page app bundled by
`electron-vite`. It runs in a sandboxed Chromium context and communicates with
the main process exclusively through `window.electronAPI` (the preload bridge).

## Hash routing

Both `BrowserWindow` instances load the **same** `index.html` entry point. The
URL hash determines which surface to render:

| Hash | Component | Window type |
|------|-----------|-------------|
| `#floating` | `<FloatingWidget>` | Frameless transparent overlay |
| `#settings` (or anything else) | `<SettingsWindow>` | Normal settings panel |

`main.tsx` assigns a corresponding CSS class (`floating` or `settings`) to
`document.body` before React mounts, enabling surface-specific base styles.

## Two window surfaces

### FloatingWidget
- Transparent, always-on-top, mouse-ignored
- Positioned bottom-center of the primary display
- Visible only during active recording / processing / success / error states
- 5-state machine: `idle → recording → processing → success/error → idle`

### SettingsWindow
- Standard app window (680×520, non-resizable)
- 6-tab sidebar: General, Hotkey, History, Snippets, Smart Edit, About
- Opens from the system tray or on second-instance launch

## Styling approach

- **Tailwind CSS** for utility classes (configured in `tailwind.config.js`)
- **Inline `style` props** for dynamic values (colors, borders, shadows) that
  depend on component state
- Custom Tailwind tokens defined in the config (`hw-text`, `hw-muted`, `accent`,
  `chassis`, `panel`, `surface`, `groove`, etc.) map to the dark hardware aesthetic
- No CSS Modules or styled-components

## Entry point

`main.tsx` → `App.tsx` → hash routing → `FloatingWidget` or `SettingsWindow`
