# SonicScript 实施方案 (v2.1)

## 项目概述

构建一个免费、本地、跨平台的语音转文字桌面工具，对标 Wispr Flow。完全本地运行、无后端、无数据库。

## 核心用户体验

1. 按住快捷键（macOS: **右 Option**，Windows: **右 Alt**）→ 屏幕底部中央弹出小录音框
2. 说话 → 松开按键 → 语音通过 Whisper 本地转文字
3. 文字**自动插入到光标位置** + **永久保留在剪贴板**（不恢复旧内容，方便随时再次粘贴）
4. 录音浮窗不抢焦点（`setIgnoreMouseEvents(true)`）

## 关键设计决策

1. **文字注入 = clipboard + 模拟粘贴**（Wispr Flow 同方案，CJK 兼容最佳）
2. **录音数据不实时传输**，渲染进程本地缓存 → 录音结束一次性发送
3. **Whisper 模型启动时预加载**，避免首次录音冷启动
4. **已移除 `keyboard-auto-type`**，clipboard+paste 用 Electron 内置 API 即可

---

## 技术栈

| 模块 | 方案 | 说明 |
|------|------|------|
| 桌面框架 | Electron + electron-vite | Vite 构建，自带 main/renderer/preload 分离 |
| 前端 | React 18 + TypeScript + Tailwind CSS | |
| Whisper 引擎 | `@fugood/whisper.node` | whisper.cpp Node 绑定，支持 GPU 加速和取消 |
| 全局快捷键 | `node-global-key-listener` | 支持 key-down/key-up，默认: macOS 右 Option / Windows 右 Alt |
| 文字注入 | `electron.clipboard` + 模拟粘贴 | Wispr Flow 同款方案，CJK 兼容性最佳 |
| 活跃窗口检测 | `active-win` | 检测前台应用名，用于 LLM 语气调整 |
| 录音 | Web Audio API + AudioWorklet | 内置于 Chromium，无需额外依赖 |
| 配置存储 | `electron-store` | JSON 配置，支持加密存储 API key |
| LLM 集成 | `openai` npm 包 | 兼容 OpenAI/兼容 API |
| 打包 | `electron-builder` | 生成 DMG (macOS) 和 NSIS (Windows) |

> **已移除**: `keyboard-auto-type`（被 clipboard+paste 取代）

---

## 项目结构

```
SonicScript/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── resources/                     # 图标资源
│   ├── icon.icns
│   ├── icon.ico
│   ├── icon.png
│   └── entitlements.mac.plist
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── index.ts               # 入口、应用生命周期
│   │   ├── tray.ts                # 系统托盘
│   │   ├── windows.ts             # 窗口管理
│   │   ├── ipc-handlers.ts        # IPC 通信注册
│   │   ├── hotkey/
│   │   │   └── hotkey-manager.ts  # 全局快捷键监听
│   │   ├── audio/
│   │   │   └── audio-recorder.ts  # 录音数据收集（接收渲染进程的完整 PCM）
│   │   ├── whisper/
│   │   │   ├── whisper-engine.ts  # Whisper 转录（单例，启动时预加载模型）
│   │   │   ├── model-manager.ts   # 模型管理
│   │   │   └── model-downloader.ts # 模型下载（带进度）
│   │   ├── output/
│   │   │   └── text-output.ts     # clipboard 写入 + 模拟 Cmd+V/Ctrl+V
│   │   ├── llm/
│   │   │   ├── llm-processor.ts   # LLM API 调用
│   │   │   ├── active-app.ts      # 前台应用检测
│   │   │   └── prompts.ts         # 提示词模板
│   │   └── config/
│   │       └── store.ts           # 配置管理
│   ├── renderer/                  # React UI
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── assets/
│   │       ├── components/
│   │       │   ├── FloatingWidget.tsx  # 录音浮窗（setIgnoreMouseEvents，屏幕底部中央）
│   │       │   ├── SettingsWindow.tsx  # 设置界面（5个Tab）
│   │       │   ├── ModelManager.tsx
│   │       │   ├── HotkeyConfig.tsx
│   │       │   └── LLMSettings.tsx
│   │       └── hooks/
│   │           ├── useRecording.ts
│   │           └── useConfig.ts
│   ├── preload/
│   │   └── index.ts               # contextBridge API
│   └── shared/
│       ├── types.ts               # 共享类型定义
│       └── constants.ts           # 常量（模型列表、默认配置等）
└── .github/
    └── workflows/
        └── release.yml            # CI/CD 自动构建发布
```

**vs v1 的变化**：
- `output/` 目录从 2 个文件（`text-injector.ts` + `clipboard-output.ts`）合并为 1 个 `text-output.ts`（clipboard+paste 逻辑统一）
- `whisper-engine.ts` 标注单例 + 预加载
- `FloatingWidget.tsx` 标注 `setIgnoreMouseEvents`

---

## 数据流

```
快捷键按下
  → 渲染进程开始录音 (Web Audio API, 16kHz mono PCM)
  → PCM 数据在渲染进程 AudioWorklet 中本地缓存（不实时传输）

快捷键松开
  → 停止录音
  → 完整 PCM buffer 一次性通过 IPC 发送到主进程
  → whisper.node 转录（模型已预加载，无冷启动延迟）
  → [可选] LLM 智能编辑（检测当前 app 调整语气）
  → 保存旧剪贴板 → 写入转录文字到剪贴板 → 模拟 Cmd+V → 恢复旧剪贴板（~500ms 延迟）
```

**vs v1 的变化**：PCM 不再实时流式传 IPC，改为渲染进程本地缓存后一次性发送。

---

## 进程分工

| 进程 | 职责 |
|------|------|
| **主进程** | 全局快捷键、Whisper 引擎（单例预加载）、文字注入（clipboard+paste）、模型管理、配置存储、LLM 调用、系统托盘 |
| **渲染进程** | 录音 (Web Audio + AudioWorklet 本地缓存 PCM)、UI 界面、设置表单、进度显示 |
| **Preload** | contextBridge 安全暴露 IPC API 给渲染进程 |

---

## UI 设计

### 系统托盘
- 主要入口，右键显示菜单
- 菜单项：状态显示 / 打开设置 / 退出

### 录音浮窗（FloatingWidget）
- 透明、置顶、**`setIgnoreMouseEvents(true)` 不抢焦点**，固定在屏幕底部中央（160×60px）
- 录音时：脉动红点 + 录音时长
- 转录时：loading 动画
- 完成时：短暂显示结果预览后淡出

### 设置窗口（5 个 Tab）
1. **通用** — 开机启动、Dock 图标、语言
2. **语音引擎** — 模型选择、语言设置、模型下载管理
3. **LLM 设置** — 开关、API Key、模型、系统提示词
4. **输出** — 注入模式（注入/剪贴板/两者）、换行设置
5. **关于** — 版本、开源链接

---

## 文字注入方案详解（v2 新增）

### 为什么选择 clipboard+paste 而非按键模拟

| 维度 | keyboard-auto-type (按键模拟) | clipboard+paste |
|------|------|------|
| CJK 支持 | CGEvent 每次限 20 字符，不走 IME | 完美支持任何语言 |
| 速度 | 逐字符注入，长文本慢 | 瞬间粘贴 |
| 兼容性 | 沙盒 App 可能拦截 | 几乎所有 App 都支持粘贴 |
| 行业实践 | 无主流产品使用 | Wispr Flow、Superwhisper 均采用 |

### 实现步骤

1. `clipboard.readText()` 保存当前剪贴板
2. `clipboard.writeText(transcription)` 写入转录结果
3. 用 `node-global-key-listener` 或原生 API 模拟 Cmd+V (mac) / Ctrl+V (win)
4. `setTimeout(() => clipboard.writeText(original), 500)` 恢复剪贴板

### 权限要求

- macOS: 需要 **Accessibility** 权限（模拟按键需要）
- 检测: `systemPreferences.isTrustedAccessibilityClient(true)` — 传 `true` 会弹出系统授权对话框
- 分发: **不能通过 Mac App Store**（沙盒限制），需 Developer ID 签名直接分发

---

## 实施阶段

### Phase 1：项目骨架 + 录音管线

- 用 `electron-vite` 初始化项目
- 系统托盘 + 基本窗口管理
- `node-global-key-listener` 实现长按录音触发
- Web Audio API 录音（16kHz mono），AudioWorklet **本地缓存** PCM
- 录音结束时完整 PCM buffer **一次性 IPC** 发送到主进程

**验证**：按住快捷键说话，松开后保存 WAV 文件能正常播放

---

### Phase 2：Whisper 集成

- 集成 `@fugood/whisper.node`
- 模型下载流程（首次启动下载 base 模型，142MB）
- 下载进度 UI
- **单例 whisper engine，应用启动后后台预加载模型**
- 连接录音管线到 Whisper 转录

**验证**：说话后在控制台看到转录文字，第二次录音无加载延迟

---

### Phase 3：文字输出

- **clipboard + 模拟粘贴方案**（非按键模拟）
- 转录文字写入剪贴板（覆盖，不恢复旧内容）
- macOS 辅助功能权限检测与引导（`systemPreferences.isTrustedAccessibilityClient`）

**验证**：说话后文字出现在任意应用的光标位置，中英文均正常

---

### Phase 4：UI 完善

- 录音浮窗指示器（`setIgnoreMouseEvents(true)`，屏幕底部中央，含动画）
- 完整设置界面（5 个 Tab）
- 快捷键自定义 UI
- 模型管理 UI（下载/删除/切换）
- `electron-store` 配置持久化

---

### Phase 5：LLM 智能编辑

- OpenAI API 集成（支持自定义 base URL）
- `active-win` 前台应用检测
- 根据应用上下文调整提示词（邮件/代码/聊天等）
- API key 设置 UI + 安全存储

---

### Phase 6：平台适配 + 打包发布

- macOS / Windows 测试
- 权限提示处理（macOS Accessibility、麦克风）
- electron-builder 配置 DMG + NSIS
- GitHub Actions CI 自动构建（mac/win）
- GitHub Releases 发布

> **vs v1**：原 Phase 6（平台适配）和 Phase 7（打包发布）合并为一个阶段

---

## 关键技术挑战

### 1. 模拟粘贴的可靠性

模拟 Cmd+V 需要 Accessibility 权限。在极少数应用（如某些终端模拟器）中可能需要特殊处理。降级方案：用户手动 Cmd+V。

### 2. macOS Accessibility 权限

首次使用必须引导用户授权。用 `systemPreferences.isTrustedAccessibilityClient(true)` 触发系统弹窗，授权后需要重启应用。

### 3. 原生模块打包

electron-builder + electron-rebuild 自动处理 `whisper.node` 二进制文件，需在 CI 各平台分别构建。

### 4. 首次启动体验

首次启动需引导用户下载模型（142MB）。下载完成前禁用录音，显示进度条。

---

## 依赖版本参考

```json
{
  "dependencies": {
    "@fugood/whisper.node": "^0.0.5",
    "active-win": "^8.1.0",
    "electron-store": "^8.1.0",
    "node-global-key-listener": "^0.3.0",
    "openai": "^4.47.1"
  },
  "devDependencies": {
    "electron": "^31.0.2",
    "electron-builder": "^24.13.3",
    "electron-vite": "^2.3.0",
    "react": "^18.3.1",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.2"
  }
}
```

> **已移除**: `keyboard-auto-type`

---

## 最终验证标准

在 macOS/Windows 干净机器上：

1. 安装应用
2. 首次启动 → 引导下载模型（142MB，显示进度）
3. 下载完成 → 按快捷键说话
4. 松开 → 文字出现在光标位置（中英文均可）

---

## Whisper → SFSpeechRecognizer 重构（9 阶段）

- [x] Phase 1: 移除 whisper.node，添加 Swift helper 骨架
- [x] Phase 2: Swift helper 实现 AVAudioEngine + SFSpeechRecognizer
- [x] Phase 3: JSON 协议（stdin/stdout）连接 Electron ↔ Swift
- [x] Phase 4: SpeechEngine 单例替换 WhisperEngine
- [x] Phase 5: IPC handlers 适配新 SpeechEngine 接口
- [x] Phase 6: FloatingWidget 适配（partial 实时预览）
- [x] Phase 7: 设置页适配（language 字段迁移）
- [x] Phase 8: build-swift.sh 编译/打包/签名/patch Electron
- [x] Phase 9: 修复双击触发、.app bundle 格式、requestAuthorization crash

---

## Bug Fix: LLM 误处理空文本 [x]

**根因**：SFSpeechRecognizer 在 endAudio() 后有时输出空 final，空文本传入 LLM 导致 LLM 返回道歉信息被注入光标。

**修复**：
- [x] `src/main/ipc-handlers.ts`：追踪 `lastPartialText`，onFinal 用 `text.trim() || lastPartialText.trim()` 作为 effectiveText
- [x] `src/main/llm/llm-processor.ts`：`processWithLLM` 开头加 `if (!rawText.trim()) return rawText` 防御性 guard

---

## Bug Fix: 长语音截断 + Settings 空白（根因修复）[x]

**根因 1（Settings 空白）**：`index.html` 中 Google Fonts 阻塞式 `<link rel="stylesheet">` 在 Electron 中可能导致页面永久挂起。
**根因 2（长语音截断）**：长语音下存在两类不稳定行为：一是 SFSpeechRecognizer 会在长会话中内部分段；二是 partial 结果可能在同一 task 内突然变短并丢掉前文。此前实现只覆盖了 `isFinal` 分段，且没有隔离旧 task 的迟到回调，导致前段文本仍可能被覆盖或丢失。

**修复**：
- [x] `src/renderer/index.html`：删除 Google Fonts 三行 `<link>` 标签
- [x] `src/main/speech/SonicScriptHelper.swift`：新增 `stoppingByRequest` + `accumulatedText` + `lastRawPartial` + `activeTaskGeneration`；同时处理 `isFinal` 分段和 partial 突然重置；用重叠去重合并跨段文本；忽略旧 task 的迟到回调；`stop()` 只 `endAudio()`，等最终结果返回后再停音频引擎
- [x] `src/main/ipc-handlers.ts`：移除 50% 启发式死代码，恢复简洁 `lastPartialText` 方案
- [x] `npm run build:swift`：重新编译 Swift helper

---

## UI Improvements + Timeout + Smart Edit Fix [x]

- [x] Stage 1: Hide Language Selection UI — removed radio buttons from GeneralSettings (backend intact)
- [x] Stage 2: General Tab Redesign — added PenroseLogo SVG component + branding card + stats card (recordings, chars, top app)
- [x] Stage 3: History Tab — added explicit Copy + Save buttons (always visible), inline toast, removed click-to-copy on text
- [x] Stage 4: Two Independent Timeouts — RECORDING_TIMEOUT_MS (10 min) + POST_PROC_TIMEOUT_MS (50s); module-scoped sessionActive; removeListeners() vs endSession() split; two sessionActive guards in onFinal
- [x] Stage 5: Smart Edit hard language preservation — CRITICAL rule + Chinese/English example in prompts.ts
