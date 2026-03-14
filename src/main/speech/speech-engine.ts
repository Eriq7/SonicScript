/**
 * speech-engine.ts — SpeechEngine singleton; manages the Swift helper subprocess.
 *
 * Main exports:
 *   - SpeechEngine (class, EventEmitter singleton)
 *       spawn(): Promise<void>    — start the Swift .app bundle; wait for 'ready'
 *       start(language): Promise<void> — begin a recognition session
 *       stop(): void             — fire-and-forget stop (final event follows asynchronously)
 *       cancel(): void           — force-cancel without waiting for final
 *       kill(): Promise<void>    — terminate process (called on app quit)
 *
 * I/O data types:
 *   - Emits 'ready'        — helper started and authorised
 *   - Emits 'partial'      — { text: string } live transcript update
 *   - Emits 'final'        — { text: string } completed transcript
 *   - Emits 'error'        — { message: string } recognition error
 *   - Emits 'process-died' — helper crashed or exited unexpectedly
 *
 * Execution flow:
 *   1. spawn(): fork SonicScriptHelper.app/Contents/MacOS/SonicScriptHelper
 *   2. Buffer stdout line-by-line; parse JSON; emit msg.type with msg payload
 *   3. Wait up to 5s for 'ready' event; reject with timeout error if not received
 *   4. ensureAlive() auto-respawns before start() if the process died
 *   5. sendCommand() writes JSON lines to stdin
 *
 * Design notes:
 *   - Must be launched as a .app bundle (not a raw binary) for macOS TCC to recognise it
 *   - In dev mode, binary path is inside resources/ relative to app root;
 *     in production, binary is at root of process.resourcesPath
 *   - stop() is explicitly fire-and-forget; ipc-handlers.ts owns the onFinal listener
 */
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';

export class SpeechEngine extends EventEmitter {
  private static instance: SpeechEngine;
  private process: ChildProcess | null = null;
  private buffer = '';
  private ready = false;

  static getInstance(): SpeechEngine {
    if (!SpeechEngine.instance) SpeechEngine.instance = new SpeechEngine();
    return SpeechEngine.instance;
  }

  private getHelperPath(): string {
    if (is.dev) {
      // In dev mode: run the binary inside the .app bundle (needed for TCC recognition)
      return path.join(app.getAppPath(), 'resources/SonicScriptHelper.app/Contents/MacOS/SonicScriptHelper');
    }
    // In production: binary is at the root of resources/
    return path.join(process.resourcesPath, 'SonicScriptHelper');
  }

  /** Spawn the Swift helper process. Called once at app startup. */
  async spawn(): Promise<void> {
    if (this.process && this.ready) return; // already running
    await this.killIfExists();

    const helperPath = this.getHelperPath();
    console.log('[SpeechEngine] Spawning helper:', helperPath);
    this.process = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.buffer = '';
    this.ready = false;

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.emit(msg.type, msg);
        } catch { /* ignore malformed JSON */ }
      }
    });

    this.process.stderr?.on('data', (d: Buffer) =>
      console.error('[SpeechEngine stderr]', d.toString().trim())
    );

    // Process crash/exit detection
    this.process.on('exit', (code, signal) => {
      console.warn(`[SpeechEngine] Helper exited: code=${code}, signal=${signal}`);
      this.process = null;
      this.ready = false;
      this.emit('process-died');
    });

    // Wait for 'ready' signal (authorization passed) or error
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Swift helper startup timeout (5s)'));
      }, 5000);

      this.once('ready', () => { clearTimeout(timeout); this.ready = true; resolve(); });
      this.once('error', (msg) => { clearTimeout(timeout); reject(new Error(msg.message)); });
    });

    console.log('[SpeechEngine] Helper ready');
  }

  /** Ensure helper is alive, respawn if crashed */
  private async ensureAlive(): Promise<void> {
    if (this.process && this.ready) return;
    console.log('[SpeechEngine] Helper not alive, respawning...');
    await this.spawn();
  }

  /** Start a new recognition session */
  async start(language: string): Promise<void> {
    await this.ensureAlive();
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    this.sendCommand({ action: 'start', language: locale });
  }

  /** Stop current recognition. Fire-and-forget — does NOT wait for 'final'.
   *  The 'final' event is exclusively consumed by ipc-handlers.ts's onFinal listener. */
  stop(): void {
    if (!this.process?.stdin?.writable || !this.ready) return;
    this.sendCommand({ action: 'stop' });
  }

  /** Force-cancel recognition without waiting for final (e.g., timeout, error) */
  cancel(): void {
    if (!this.process?.stdin?.writable || !this.ready) return;
    this.sendCommand({ action: 'cancel' });
  }

  /** Kill the helper process (called on app quit) */
  async kill(): Promise<void> {
    await this.killIfExists();
  }

  private async killIfExists(): Promise<void> {
    if (this.process) {
      this.process.removeAllListeners();
      this.process.kill('SIGTERM');
      this.process = null;
      this.ready = false;
    }
  }

  private sendCommand(cmd: object): void {
    if (!this.process?.stdin?.writable) return;
    this.process.stdin.write(JSON.stringify(cmd) + '\n');
  }
}
