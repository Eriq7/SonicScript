"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const fs = require("fs");
const nodeGlobalKeyListener = require("node-global-key-listener");
const child_process = require("child_process");
const events = require("events");
const Store = require("electron-store");
const util = require("util");
const OpenAI = require("openai");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const DEFAULT_HOTKEY = "RIGHT ALT";
const DEFAULT_SETTINGS = {
  hotkey: {
    key: DEFAULT_HOTKEY
  },
  speech: {
    language: "zh"
  },
  llm: {
    enabled: false,
    apiKey: "",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4.1-nano",
    mode: "smart-edit"
  },
  general: {
    launchAtStartup: false,
    showNotifications: true
  }
};
const FLOATING_WIDGET = {
  width: 320,
  height: 140,
  bottomOffset: 80
};
let floatingWindow = null;
let settingsWindow = null;
function getPreloadPath() {
  return path__namespace.join(__dirname, "../preload/index.js");
}
function createFloatingWindow() {
  const { width: screenW, height: screenH } = electron.screen.getPrimaryDisplay().workAreaSize;
  floatingWindow = new electron.BrowserWindow({
    width: FLOATING_WIDGET.width,
    height: FLOATING_WIDGET.height,
    x: Math.floor((screenW - FLOATING_WIDGET.width) / 2),
    y: screenH - FLOATING_WIDGET.bottomOffset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    // Fully transparent
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  floatingWindow.setIgnoreMouseEvents(true);
  if (process.platform === "darwin") {
    floatingWindow.setAlwaysOnTop(true, "screen-saver");
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    floatingWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#floating`);
  } else {
    floatingWindow.loadFile(path__namespace.join(__dirname, "../renderer/index.html"), { hash: "floating" });
  }
  floatingWindow.on("closed", () => {
    floatingWindow = null;
  });
  return floatingWindow;
}
function getFloatingWindow() {
  return floatingWindow;
}
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }
  settingsWindow = new electron.BrowserWindow({
    width: 680,
    height: 520,
    title: "SonicScript Settings",
    resizable: false,
    center: true,
    show: false,
    backgroundColor: "#0f0f1a",
    // Match the app's dark background — prevents white flash
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    settingsWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#settings`);
  } else {
    settingsWindow.loadFile(path__namespace.join(__dirname, "../renderer/index.html"), { hash: "settings" });
  }
  settingsWindow.on("ready-to-show", () => {
    settingsWindow?.show();
  });
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  return settingsWindow;
}
function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
  } else {
    createSettingsWindow();
  }
}
function getSettingsWindow() {
  return settingsWindow;
}
let tray = null;
function getTrayIcon() {
  const iconPath = path__namespace.join(
    electron.app.isPackaged ? process.resourcesPath : path__namespace.join(__dirname, "../../resources"),
    "icon-tray.png"
  );
  if (fs__namespace.existsSync(iconPath)) {
    const img = electron.nativeImage.createFromPath(iconPath);
    if (process.platform === "darwin") {
      img.setTemplateImage(true);
    }
    return img;
  }
  return electron.nativeImage.createEmpty();
}
function createTray() {
  tray = new electron.Tray(getTrayIcon());
  tray.setToolTip("SonicScript — Press Right Alt/Option to record");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "SonicScript",
      enabled: false
    },
    { type: "separator" },
    {
      label: "Settings...",
      accelerator: process.platform === "darwin" ? "Cmd+," : "Ctrl+,",
      click: () => showSettingsWindow()
    },
    { type: "separator" },
    {
      label: "Quit SonicScript",
      accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
      click: () => electron.app.quit()
    }
  ]);
  tray.setContextMenu(contextMenu);
  if (process.platform !== "darwin") {
    tray.on("double-click", () => showSettingsWindow());
  }
  return tray;
}
class HotkeyManager {
  listener = null;
  currentKey;
  isHeld = false;
  lastKeyUpTime = 0;
  longPressTimer = null;
  longPressFired = false;
  onDoubleTapCb = null;
  onLongPressCb = null;
  constructor(key) {
    this.currentKey = key;
  }
  start(onDoubleTap, onLongPress) {
    this.onDoubleTapCb = onDoubleTap;
    this.onLongPressCb = onLongPress ?? null;
    this.listener = new nodeGlobalKeyListener.GlobalKeyboardListener();
    this.listener.addListener((e, down) => {
      const keyName = e.name?.toUpperCase();
      const targetKey = this.currentKey.toUpperCase();
      if (keyName === targetKey || this.matchesKey(e, targetKey)) {
        if (e.state === "DOWN" && !this.isHeld) {
          this.isHeld = true;
          const now = Date.now();
          if (this.lastKeyUpTime > 0 && now - this.lastKeyUpTime < 350) {
            this.onDoubleTapCb?.();
            this.lastKeyUpTime = 0;
            return;
          }
          this.longPressTimer = setTimeout(() => {
            this.longPressFired = true;
            this.onLongPressCb?.();
          }, 1e3);
        } else if (e.state === "UP") {
          this.isHeld = false;
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
          }
          if (this.longPressFired) {
            this.longPressFired = false;
          } else {
            this.lastKeyUpTime = Date.now();
          }
        }
      }
    });
  }
  /** Update the hotkey while running — no need to restart */
  updateKey(key) {
    this.currentKey = key;
    this.isHeld = false;
    this.lastKeyUpTime = 0;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressFired = false;
  }
  stop() {
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
  matchesKey(e, target) {
    const raw = e.rawKey?.standardKey?.toUpperCase();
    if (raw === target) return true;
    const aliases = {
      "RIGHT ALT": ["ALTGR", "RIGHT_ALT", "RALT", "RIGHT_OPTION", "RIGHT OPTION"],
      "LEFT ALT": ["LEFT_ALT", "LALT"]
    };
    const alts = aliases[target] ?? [];
    return alts.some((a) => e.name?.toUpperCase() === a || raw === a);
  }
}
class SpeechEngine extends events.EventEmitter {
  static instance;
  process = null;
  buffer = "";
  ready = false;
  static getInstance() {
    if (!SpeechEngine.instance) SpeechEngine.instance = new SpeechEngine();
    return SpeechEngine.instance;
  }
  getHelperPath() {
    if (utils.is.dev) {
      return path.join(electron.app.getAppPath(), "resources/SonicScriptHelper.app/Contents/MacOS/SonicScriptHelper");
    }
    return path.join(process.resourcesPath, "SonicScriptHelper");
  }
  /** Spawn the Swift helper process. Called once at app startup. */
  async spawn() {
    if (this.process && this.ready) return;
    await this.killIfExists();
    const helperPath = this.getHelperPath();
    console.log("[SpeechEngine] Spawning helper:", helperPath);
    this.process = child_process.spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.buffer = "";
    this.ready = false;
    this.process.stdout?.on("data", (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          this.emit(msg.type, msg);
        } catch {
        }
      }
    });
    this.process.stderr?.on(
      "data",
      (d) => console.error("[SpeechEngine stderr]", d.toString().trim())
    );
    this.process.on("exit", (code, signal) => {
      console.warn(`[SpeechEngine] Helper exited: code=${code}, signal=${signal}`);
      this.process = null;
      this.ready = false;
      this.emit("process-died");
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Swift helper startup timeout (5s)"));
      }, 5e3);
      this.once("ready", () => {
        clearTimeout(timeout);
        this.ready = true;
        resolve();
      });
      this.once("error", (msg) => {
        clearTimeout(timeout);
        reject(new Error(msg.message));
      });
    });
    console.log("[SpeechEngine] Helper ready");
  }
  /** Ensure helper is alive, respawn if crashed */
  async ensureAlive() {
    if (this.process && this.ready) return;
    console.log("[SpeechEngine] Helper not alive, respawning...");
    await this.spawn();
  }
  /** Start a new recognition session */
  async start(language) {
    await this.ensureAlive();
    const locale = language === "zh" ? "zh-CN" : "en-US";
    this.sendCommand({ action: "start", language: locale });
  }
  /** Stop current recognition. Fire-and-forget — does NOT wait for 'final'.
   *  The 'final' event is exclusively consumed by ipc-handlers.ts's onFinal listener. */
  stop() {
    if (!this.process?.stdin?.writable || !this.ready) return;
    this.sendCommand({ action: "stop" });
  }
  /** Force-cancel recognition without waiting for final (e.g., timeout, error) */
  cancel() {
    if (!this.process?.stdin?.writable || !this.ready) return;
    this.sendCommand({ action: "cancel" });
  }
  /** Kill the helper process (called on app quit) */
  async kill() {
    await this.killIfExists();
  }
  async killIfExists() {
    if (this.process) {
      this.process.removeAllListeners();
      this.process.kill("SIGTERM");
      this.process = null;
      this.ready = false;
    }
  }
  sendCommand(cmd) {
    if (!this.process?.stdin?.writable) return;
    this.process.stdin.write(JSON.stringify(cmd) + "\n");
  }
}
const dataStore = new Store({
  name: "sonicscript-data",
  defaults: {
    history: [],
    snippets: []
  }
});
let nextHistoryId = 1;
let nextSnippetId = 1;
function initDataStore() {
  const history = dataStore.get("history", []);
  const snippets = dataStore.get("snippets", []);
  nextHistoryId = history.reduce((max, h) => Math.max(max, Number(h.id) + 1), 1);
  nextSnippetId = snippets.reduce((max, s) => Math.max(max, Number(s.id) + 1), 1);
}
function saveHistory(entry) {
  const history = dataStore.get("history", []);
  history.unshift({
    id: String(nextHistoryId++),
    text: entry.text,
    appName: entry.appName,
    createdAt: Date.now()
  });
  dataStore.set("history", history.slice(0, 50));
}
function getHistory() {
  return dataStore.get("history", []);
}
function deleteHistory(id) {
  const history = dataStore.get("history", []).filter((h) => h.id !== id);
  dataStore.set("history", history);
}
function getSnippets() {
  return dataStore.get("snippets", []);
}
function addSnippet(title, content) {
  const snippets = dataStore.get("snippets", []);
  snippets.unshift({
    id: String(nextSnippetId++),
    title,
    content,
    createdAt: Date.now()
  });
  dataStore.set("snippets", snippets);
}
function deleteSnippet(id) {
  const snippets = dataStore.get("snippets", []).filter((s) => s.id !== id);
  dataStore.set("snippets", snippets);
}
const IPC = {
  // Hotkey events (main → renderer)
  HOTKEY_DOUBLE_TAP: "hotkey-double-tap",
  HOTKEY_LONG_PRESS: "hotkey-long-press",
  // Speech recording (renderer → main, invoke)
  START_RECORDING: "start-recording",
  STOP_RECORDING: "stop-recording",
  // Transcription (main → renderer)
  PARTIAL_TRANSCRIPT: "partial-transcript",
  TRANSCRIPTION_RESULT: "transcription-result",
  TRANSCRIPTION_ERROR: "transcription-error",
  // Settings (invoke)
  GET_SETTINGS: "get-settings",
  SET_SETTINGS: "set-settings",
  // Permissions (invoke)
  CHECK_ACCESSIBILITY: "check-accessibility",
  REQUEST_ACCESSIBILITY: "request-accessibility",
  // Window events
  SHOW_SETTINGS: "show-settings",
  HIDE_FLOATING: "hide-floating",
  // Update hotkey config (invoke)
  UPDATE_HOTKEY: "update-hotkey",
  // History & Snippets (invoke)
  GET_HISTORY: "get-history",
  DELETE_HISTORY_ITEM: "delete-history-item",
  GET_SNIPPETS: "get-snippets",
  ADD_SNIPPET: "add-snippet",
  DELETE_SNIPPET: "delete-snippet",
  COPY_SNIPPET: "copy-snippet"
};
const store = new Store({
  name: "settings",
  defaults: DEFAULT_SETTINGS
});
function getSettings() {
  const settings = {
    hotkey: store.get("hotkey", DEFAULT_SETTINGS.hotkey),
    speech: store.get("speech", DEFAULT_SETTINGS.speech),
    llm: store.get("llm", DEFAULT_SETTINGS.llm),
    general: store.get("general", DEFAULT_SETTINGS.general)
  };
  if (!store.has("speech") && store.has("whisper")) {
    const oldLang = store.get("whisper")?.language;
    settings.speech = { language: oldLang ?? "zh" };
    store.set("speech", settings.speech);
  }
  if (settings.speech.language !== "zh" && settings.speech.language !== "en") {
    settings.speech.language = "zh";
    store.set("speech", settings.speech);
  }
  if (settings.llm.model === "gpt-4.1-mini") {
    settings.llm.model = "gpt-4.1-nano";
    store.set("llm", settings.llm);
  }
  return settings;
}
function setSettings(partial) {
  if (partial.hotkey) store.set("hotkey", { ...getSettings().hotkey, ...partial.hotkey });
  if (partial.speech) store.set("speech", { ...getSettings().speech, ...partial.speech });
  if (partial.llm) store.set("llm", { ...getSettings().llm, ...partial.llm });
  if (partial.general) store.set("general", { ...getSettings().general, ...partial.general });
}
const execAsync$1 = util.promisify(child_process.exec);
async function getActiveAppName() {
  try {
    switch (process.platform) {
      case "darwin":
        return await getMacActiveApp();
      case "win32":
        return await getWinActiveApp();
      default:
        return "Unknown";
    }
  } catch {
    return "Unknown";
  }
}
async function getMacActiveApp() {
  const { stdout } = await execAsync$1(
    `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
  );
  return stdout.trim();
}
async function getWinActiveApp() {
  const { stdout } = await execAsync$1(
    `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne ''} | Select-Object -First 1 -ExpandProperty Name"`
  );
  return stdout.trim();
}
const execAsync = util.promisify(child_process.exec);
async function injectText(text) {
  if (!text.trim()) return;
  electron.clipboard.writeText(text);
  await new Promise((r) => setTimeout(r, 80));
  await simulatePaste();
}
async function simulatePaste() {
  try {
    switch (process.platform) {
      case "darwin":
        await execAsync(
          `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`
        );
        break;
      case "win32":
        await execAsync(
          `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`
        );
        break;
      case "linux":
        await execAsync("xdotool key ctrl+v").catch(
          () => execAsync("xclip -selection clipboard -o | xdotool type --clearmodifiers --")
        );
        break;
    }
  } catch (err) {
    console.error("[TextOutput] Paste simulation failed:", err);
  }
}
function buildSmartEditPrompt(rawText, activeApp) {
  const appContext = getAppContext(activeApp);
  return `You are a speech-to-text post-processor. Transform the following voice transcription into clean, well-structured text for use in ${appContext}.

Rules:
- Resolve self-corrections: when the speaker corrects themselves (e.g., "no wait", "actually", "I mean", "不对", "其实是"), keep ONLY the final corrected version
- Remove filler words and verbal tics (e.g., "um", "uh", "like", "you know", "嗯", "那个", "就是说", "然后")
- Remove false starts and repeated phrases
- Restructure rambling speech into clear, concise sentences
- Fix grammar and punctuation
- Preserve the speaker's intended meaning, tone, and all factual content
- Do not add information that wasn't said or implied
- Preserve technical terms, proper nouns, and specific numbers/data exactly
- CRITICAL: Do NOT translate between Chinese and English under any circumstance.
  Every word must stay in the language it was spoken. If the speaker said an
  English word, it stays English. If the speaker said a Chinese word, it stays
  Chinese. Example: "我觉得这个 API design 需要再改一下" must output with
  "API" and "design" in English — never translate them to "接口" or "设计".
- Return ONLY the processed text, no explanations or commentary

App context: ${activeApp}

Raw transcription:
${rawText}

Processed text:`;
}
function getAppContext(appName) {
  const lower = appName.toLowerCase();
  if (lower.includes("slack") || lower.includes("discord") || lower.includes("teams")) {
    return "a chat application (casual tone is fine)";
  }
  if (lower.includes("mail") || lower.includes("outlook") || lower.includes("gmail")) {
    return "an email application (professional tone preferred)";
  }
  if (lower.includes("code") || lower.includes("xcode") || lower.includes("vim") || lower.includes("emacs")) {
    return "a code editor (preserve technical terms exactly)";
  }
  if (lower.includes("notion") || lower.includes("obsidian") || lower.includes("bear")) {
    return "a notes application";
  }
  if (lower.includes("word") || lower.includes("pages") || lower.includes("docs")) {
    return "a word processor (formal tone)";
  }
  return "a general application";
}
function buildTranslationPrompt(text, activeApp) {
  const appContext = getAppContext(activeApp);
  return `You are a speech-to-text post-processor. The user spoke in Chinese and wants the output in English for use in ${appContext}.

Tasks (combined into one pass for speed):
1. Translate the text from Chinese to English
2. Remove filler words and verbal tics (e.g., "嗯", "那个", "就是说", "然后", "um", "uh")
3. Resolve self-corrections — keep only the final corrected version
4. Fix grammar and punctuation
5. Preserve technical terms, proper nouns, and specific numbers/data exactly
6. Return ONLY the final English text, no explanations or commentary

App context: ${appContext}

Chinese input:
${text}

English output:`;
}
async function callLLM(prompt, settings, fallbackText) {
  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    timeout: 15e3
  });
  try {
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1e3,
      temperature: 0.1
    });
    return response.choices[0]?.message?.content?.trim() ?? fallbackText;
  } catch (err) {
    console.error("[LLMProcessor] LLM call failed:", err);
    return fallbackText;
  }
}
async function processWithLLM(rawText, settings, translate = false) {
  if (!rawText.trim()) return rawText;
  if (translate) {
    if (!settings.enabled || !settings.apiKey) {
      throw new Error("Translation requires AI Features to be enabled with an API key");
    }
    const activeApp2 = await getActiveAppName();
    return callLLM(
      buildTranslationPrompt(rawText, activeApp2),
      settings,
      rawText
    );
  }
  if (!settings.enabled || !settings.apiKey || settings.mode === "none") {
    return rawText;
  }
  const activeApp = await getActiveAppName();
  return callLLM(
    buildSmartEditPrompt(rawText, activeApp),
    settings,
    rawText
  );
}
const RECORDING_TIMEOUT_MS = 10 * 60 * 1e3;
const POST_PROC_TIMEOUT_MS = 5e4;
let sessionActive = false;
let postStopTimer = null;
let recTimeout = null;
let hotkeyManagerRef = null;
function setHotkeyManagerRef(hm) {
  hotkeyManagerRef = hm;
}
function registerIpcHandlers() {
  electron.ipcMain.handle(IPC.GET_SETTINGS, () => getSettings());
  electron.ipcMain.handle(IPC.SET_SETTINGS, (_e, partial) => {
    setSettings(partial);
  });
  electron.ipcMain.handle(IPC.UPDATE_HOTKEY, (_e, key) => {
    setSettings({ hotkey: { key } });
    hotkeyManagerRef?.updateKey(key);
  });
  electron.ipcMain.handle(IPC.START_RECORDING, async (_e, translate = false) => {
    if (sessionActive) {
      console.warn("[IPC] START_RECORDING rejected: session already active");
      return;
    }
    const settings = getSettings();
    const engine = SpeechEngine.getInstance();
    const floatingWin = getFloatingWindow();
    const appName = await getActiveAppName();
    let lastPartialText = "";
    const removeListeners = () => {
      engine.removeListener("partial", onPartial);
      engine.removeListener("final", onFinal);
      engine.removeListener("error", onError);
      engine.removeListener("process-died", onDied);
      if (recTimeout) {
        clearTimeout(recTimeout);
        recTimeout = null;
      }
    };
    const endSession = () => {
      removeListeners();
      if (postStopTimer) {
        clearTimeout(postStopTimer);
        postStopTimer = null;
      }
      sessionActive = false;
    };
    const onPartial = ({ text }) => {
      if (text) lastPartialText = text;
      floatingWin?.webContents.send(IPC.PARTIAL_TRANSCRIPT, text);
    };
    const onFinal = async ({ text }) => {
      if (!sessionActive) return;
      removeListeners();
      const effectiveText = text.trim() || lastPartialText.trim();
      try {
        const finalText = await processWithLLM(effectiveText, settings.llm, translate);
        if (!sessionActive) return;
        if (finalText.trim()) {
          await injectText(finalText);
          saveHistory({ text: finalText, appName });
        }
        floatingWin?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
        getSettingsWindow()?.webContents.send(IPC.TRANSCRIPTION_RESULT, finalText, 0);
      } catch (err) {
        if (sessionActive) {
          floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, err?.message ?? "Error");
        }
      } finally {
        endSession();
      }
    };
    const onError = ({ message }) => {
      endSession();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, message);
    };
    const onDied = () => {
      endSession();
      floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, "Speech engine crashed");
    };
    engine.on("partial", onPartial);
    engine.once("final", onFinal);
    engine.once("error", onError);
    engine.once("process-died", onDied);
    sessionActive = true;
    recTimeout = setTimeout(() => {
      engine.stop();
    }, RECORDING_TIMEOUT_MS);
    try {
      await engine.start(settings.speech.language);
    } catch (err) {
      endSession();
      floatingWin?.webContents.send(
        IPC.TRANSCRIPTION_ERROR,
        err?.message ?? "Speech engine failed to start"
      );
    }
  });
  electron.ipcMain.handle(IPC.STOP_RECORDING, () => {
    SpeechEngine.getInstance().stop();
    if (sessionActive) {
      if (postStopTimer) clearTimeout(postStopTimer);
      postStopTimer = setTimeout(() => {
        if (sessionActive) {
          const floatingWin = getFloatingWindow();
          sessionActive = false;
          postStopTimer = null;
          if (recTimeout) {
            clearTimeout(recTimeout);
            recTimeout = null;
          }
          const engine = SpeechEngine.getInstance();
          engine.removeAllListeners("partial");
          engine.removeAllListeners("final");
          engine.removeAllListeners("error");
          engine.removeAllListeners("process-died");
          floatingWin?.webContents.send(IPC.TRANSCRIPTION_ERROR, "Processing timed out");
        }
      }, POST_PROC_TIMEOUT_MS);
    }
  });
  electron.ipcMain.handle(IPC.GET_HISTORY, () => getHistory());
  electron.ipcMain.handle(IPC.DELETE_HISTORY_ITEM, (_e, id) => deleteHistory(id));
  electron.ipcMain.handle(IPC.GET_SNIPPETS, () => getSnippets());
  electron.ipcMain.handle(IPC.ADD_SNIPPET, (_e, title, content) => addSnippet(title, content));
  electron.ipcMain.handle(IPC.DELETE_SNIPPET, (_e, id) => deleteSnippet(id));
  electron.ipcMain.handle(IPC.COPY_SNIPPET, (_e, content) => {
    electron.clipboard.writeText(content);
  });
  electron.ipcMain.handle(IPC.CHECK_ACCESSIBILITY, () => {
    if (process.platform === "darwin") {
      return electron.systemPreferences.isTrustedAccessibilityClient(false);
    }
    return true;
  });
  electron.ipcMain.handle(IPC.REQUEST_ACCESSIBILITY, () => {
    if (process.platform === "darwin") {
      electron.systemPreferences.isTrustedAccessibilityClient(true);
    }
  });
}
const gotLock = electron.app.requestSingleInstanceLock();
if (!gotLock) {
  electron.app.quit();
  process.exit(0);
}
let hotkeyManager = null;
async function bootstrap() {
  initDataStore();
  registerIpcHandlers();
  createFloatingWindow();
  if (utils.is.dev) {
    createSettingsWindow();
  }
  createTray();
  const settings = getSettings();
  hotkeyManager = new HotkeyManager(settings.hotkey.key);
  setHotkeyManagerRef(hotkeyManager);
  hotkeyManager.start(
    () => {
      const win = getFloatingWindow();
      win?.showInactive();
      win?.webContents.send(IPC.HOTKEY_DOUBLE_TAP);
    },
    () => {
      const win = getFloatingWindow();
      win?.showInactive();
      win?.webContents.send(IPC.HOTKEY_LONG_PRESS);
    }
  );
  SpeechEngine.getInstance().spawn().then(() => console.log("[Main] Speech engine ready")).catch((err) => console.warn("[Main] Speech engine spawn failed:", err.message));
  electron.app.on("before-quit", () => {
    hotkeyManager?.stop();
    SpeechEngine.getInstance().kill().catch(() => {
    });
  });
}
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.sonicscript.app");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  await bootstrap();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createFloatingWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
});
electron.app.on("second-instance", () => {
  createSettingsWindow();
});
