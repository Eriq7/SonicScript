/**
 * hotkey-manager.ts — Global hotkey listener with double-tap detection.
 *
 * Main exports:
 *   - HotkeyManager (class)
 *       start(onDoubleTap): void  — begin listening; fires callback on double-tap
 *       stop(): void              — kill the native listener
 *       updateKey(key): void      — hot-swap the target key without restarting
 *
 * Execution flow:
 *   1. Attach GlobalKeyboardListener (node-global-key-listener)
 *   2. On KEY_DOWN: if not held, record timestamp; if within 350ms of last KEY_UP → fire
 *      onDoubleTap callback; reset lastKeyUpTime to prevent triple-tap triggering twice
 *   3. On KEY_UP: clear isHeld, record lastKeyUpTime
 *
 * Design notes:
 *   - 350ms window is tuned for natural double-tap speed without false positives
 *   - matchesKey() normalises aliases: RIGHT ALT matches ALTGR, RIGHT_OPTION, RALT, etc.
 *   - updateKey() resets internal state so stale timestamps do not carry over
 */
import { GlobalKeyboardListener } from 'node-global-key-listener';

type HotkeyCallback = () => void;

export class HotkeyManager {
  private listener: GlobalKeyboardListener | null = null;
  private currentKey: string;
  private isHeld = false;
  private lastKeyUpTime = 0;

  private onDoubleTapCb: HotkeyCallback | null = null;

  constructor(key: string) {
    this.currentKey = key;
  }

  start(onDoubleTap: HotkeyCallback): void {
    this.onDoubleTapCb = onDoubleTap;

    this.listener = new GlobalKeyboardListener();

    this.listener.addListener((e, down) => {
      const keyName = e.name?.toUpperCase();
      const targetKey = this.currentKey.toUpperCase();

      if (keyName === targetKey || this.matchesKey(e, targetKey)) {
        if (e.state === 'DOWN' && !this.isHeld) {
          this.isHeld = true;
          const now = Date.now();
          if (this.lastKeyUpTime > 0 && now - this.lastKeyUpTime < 350) {
            this.onDoubleTapCb?.();
            this.lastKeyUpTime = 0; // prevent triple-tap
          }
        } else if (e.state === 'UP') {
          this.isHeld = false;
          this.lastKeyUpTime = Date.now();
        }
      }
    });
  }

  /** Update the hotkey while running — no need to restart */
  updateKey(key: string): void {
    this.currentKey = key;
    this.isHeld = false;
    this.lastKeyUpTime = 0;
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
