/**
 * text-output.ts — Writes transcribed text to clipboard and simulates a paste keystroke.
 *
 * Main exports:
 *   - injectText(text): Promise<void> — clipboard write + 80ms delay + simulated Cmd+V
 *
 * Execution flow:
 *   1. clipboard.writeText(text) — Electron native clipboard API
 *   2. 80ms delay — ensures clipboard contents are flushed before the paste event
 *   3. simulatePaste():
 *        macOS:   osascript keystroke "v" using {command down}
 *        Windows: PowerShell SendKeys ^v
 *        Linux:   xdotool key ctrl+v (fallback: xclip + xdotool type)
 *
 * Design notes:
 *   - Requires macOS Accessibility permission; paste failure is caught and logged —
 *     text remains in clipboard so the user can paste manually with Cmd+V
 *   - The 80ms delay is empirically tuned; shorter values cause intermittent failures
 *     where the paste fires before the clipboard contents are ready
 *   - Clipboard is NOT restored after injection
 */
import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Write text to clipboard and simulate paste into the active (previously focused) app.
 * The clipboard content is NOT restored — it stays as the transcribed text.
 */
export async function injectText(text: string): Promise<void> {
  if (!text.trim()) return;

  // 1. Write to clipboard
  clipboard.writeText(text);

  // 2. Small delay to ensure clipboard is ready before paste
  await new Promise(r => setTimeout(r, 80));

  // 3. Simulate paste
  await simulatePaste();
}

async function simulatePaste(): Promise<void> {
  try {
    switch (process.platform) {
      case 'darwin':
        await execAsync(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
        );
        break;

      case 'win32':
        await execAsync(
          `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
        );
        break;

      case 'linux':
        await execAsync('xdotool key ctrl+v').catch(() =>
          execAsync('xclip -selection clipboard -o | xdotool type --clearmodifiers --'),
        );
        break;
    }
  } catch (err) {
    console.error('[TextOutput] Paste simulation failed:', err);
    // Graceful degradation: text is already in clipboard, user can paste manually
  }
}
