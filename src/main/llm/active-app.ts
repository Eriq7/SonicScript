/**
 * active-app.ts — Detects the frontmost application on the user's desktop.
 *
 * Main exports:
 *   - getActiveAppName(): Promise<string> — returns app name, or "Unknown" on failure
 *
 * Execution flow:
 *   - macOS:   osascript → System Events → name of frontmost process
 *   - Windows: PowerShell Get-Process → first process with a non-empty window title
 *   - Other:   returns "Unknown"
 *
 * Design notes:
 *   - Called at START_RECORDING time (before audio ends) so the result reflects
 *     where the user was typing, not the SonicScript window that gains focus after stop
 *   - Any exec error returns "Unknown" — this is non-fatal; the app name is only
 *     used for LLM prompt context and history labelling
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getActiveAppName(): Promise<string> {
  try {
    switch (process.platform) {
      case 'darwin':
        return await getMacActiveApp();
      case 'win32':
        return await getWinActiveApp();
      default:
        return 'Unknown';
    }
  } catch {
    return 'Unknown';
  }
}

async function getMacActiveApp(): Promise<string> {
  const { stdout } = await execAsync(
    `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
  );
  return stdout.trim();
}

async function getWinActiveApp(): Promise<string> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne ''} | Select-Object -First 1 -ExpandProperty Name"`,
  );
  return stdout.trim();
}
