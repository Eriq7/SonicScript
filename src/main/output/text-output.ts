/**
 * text-output.ts
 * Writes transcription text to clipboard and simulates Cmd+V / Ctrl+V
 * to paste it into whatever app the user was previously focused on.
 *
 * Strategy: clipboard write + simulated paste keystroke.
 * macOS: osascript
 * Windows: PowerShell SendKeys
 * Linux: xdotool
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
