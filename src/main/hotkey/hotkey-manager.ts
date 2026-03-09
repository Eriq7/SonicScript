/**
 * hotkey-manager.ts
 * Uses node-global-key-listener to detect global key press/release events.
 * Fires callbacks when the configured hotkey (default: Right Alt/Option) is held.
 */
import { GlobalKeyboardListener } from 'node-global-key-listener';

type HotkeyCallback = () => void;

export class HotkeyManager {
  private listener: GlobalKeyboardListener | null = null;
  private currentKey: string;
  private isHeld = false;

  private onPressedCb: HotkeyCallback | null = null;
  private onReleasedCb: HotkeyCallback | null = null;

  constructor(key: string) {
    this.currentKey = key;
  }

  start(onPressed: HotkeyCallback, onReleased: HotkeyCallback): void {
    this.onPressedCb = onPressed;
    this.onReleasedCb = onReleased;

    this.listener = new GlobalKeyboardListener();

    this.listener.addListener((e, down) => {
      const keyName = e.name?.toUpperCase();
      const targetKey = this.currentKey.toUpperCase();

      if (keyName === targetKey || this.matchesKey(e, targetKey)) {
        if (e.state === 'DOWN' && !this.isHeld) {
          this.isHeld = true;
          this.onPressedCb?.();
        } else if (e.state === 'UP' && this.isHeld) {
          this.isHeld = false;
          this.onReleasedCb?.();
        }
      }
    });
  }

  /** Update the hotkey while running — no need to restart */
  updateKey(key: string): void {
    this.currentKey = key;
    this.isHeld = false;
  }

  stop(): void {
    if (this.listener) {
      this.listener.kill();
      this.listener = null;
    }
    this.isHeld = false;
  }

  /** Normalize key name variations */
  private matchesKey(e: { name?: string; rawKey?: { standardKey?: string } }, target: string): boolean {
    const raw = e.rawKey?.standardKey?.toUpperCase();
    if (raw === target) return true;

    // Map common aliases
    const aliases: Record<string, string[]> = {
      'RIGHT ALT': ['ALTGR', 'RIGHT_ALT', 'RALT', 'RIGHT_OPTION', 'RIGHT OPTION'],
      'LEFT ALT': ['LEFT_ALT', 'LALT'],
    };
    const alts = aliases[target] ?? [];
    return alts.some(a => e.name?.toUpperCase() === a || raw === a);
  }
}
