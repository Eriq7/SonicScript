/**
 * hotkey-manager.ts — Global hotkey listener with double-tap and long-press detection.
 *
 * Main exports:
 *   - HotkeyManager (class)
 *       start(onDoubleTap, onLongPress): void  — begin listening; fires callbacks on gesture
 *       stop(): void                           — kill the native listener
 *       updateKey(key): void                   — hot-swap the target key without restarting
 *
 * Gesture state machine (strictly mutually exclusive):
 *   Double-tap: fires on second DOWN if within 350ms of last KEY_UP. Immediately skips
 *     long-press timer setup — double-tap wins if it triggers first.
 *   Long-press: fires after holding DOWN for 1000ms without releasing. On UP, does NOT
 *     record lastKeyUpTime — prevents contributing to a future double-tap.
 *   Single tap: press < 1s, release — records lastKeyUpTime only; no gesture fires.
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
  private longPressTimer: NodeJS.Timeout | null = null;
  private longPressFired = false;

  private onDoubleTapCb: HotkeyCallback | null = null;
  private onLongPressCb: HotkeyCallback | null = null;

  constructor(key: string) {
    this.currentKey = key;
  }

  start(onDoubleTap: HotkeyCallback, onLongPress?: HotkeyCallback): void {
    this.onDoubleTapCb = onDoubleTap;
    this.onLongPressCb = onLongPress ?? null;

    this.listener = new GlobalKeyboardListener();

    this.listener.addListener((e, down) => {
      const keyName = e.name?.toUpperCase();
      const targetKey = this.currentKey.toUpperCase();

      if (keyName === targetKey || this.matchesKey(e, targetKey)) {
        if (e.state === 'DOWN' && !this.isHeld) {
          this.isHeld = true;
          const now = Date.now();

          // Check double-tap first: if within 350ms of last key-up, double-tap wins
          if (this.lastKeyUpTime > 0 && now - this.lastKeyUpTime < 350) {
            this.onDoubleTapCb?.();
            this.lastKeyUpTime = 0; // prevent triple-tap
            // Do NOT start long-press timer — double-tap has fired, long-press disqualified
            return;
          }

          // Start long-press timer (1s threshold)
          this.longPressTimer = setTimeout(() => {
            this.longPressFired = true;
            this.onLongPressCb?.();
          }, 1000);

        } else if (e.state === 'UP') {
          this.isHeld = false;

          // Cancel pending long-press timer (user released before 1s)
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
          }

          if (this.longPressFired) {
            // Long-press already fired — reset flag but do NOT record lastKeyUpTime
            // (prevents this UP from contributing to a future double-tap)
            this.longPressFired = false;
          } else {
            // Normal tap — record time for double-tap detection
            this.lastKeyUpTime = Date.now();
          }
        }
      }
    });
  }

  /** Update the hotkey while running — no need to restart */
  updateKey(key: string): void {
    this.currentKey = key;
    this.isHeld = false;
    this.lastKeyUpTime = 0;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressFired = false;
  }

  stop(): void {
    if (this.listener) {
      this.listener.kill();
      this.listener = null;
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.isHeld = false;
    this.longPressFired = false;
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
