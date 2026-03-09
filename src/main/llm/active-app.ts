/**
 * active-app.ts
 * Detects the currently active (frontmost) application.
 * Uses platform-specific approaches.
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
