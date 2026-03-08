# SonicScript 实施方案

## 项目概述

构建一个免费、本地、跨平台的语音转文字桌面工具，对标 Wispr Flow。完全本地运行、无后端、无数据库。

---

## 技术栈

| 模块 | 方案 | 说明 |
|------|------|------|
| 桌面框架 | Electron + electron-vite | Vite 构建，自带 main/renderer/preload 分离 |
| 前端 | React 18 + TypeScript + Tailwind CSS | |
| Whisper 引擎 | `@fugood/whisper.node` | 最活跃的 whisper.cpp Node 绑定，支持 GPU 加速和取消 |
| 全局快捷键 | `node-global-key-listener` | 支持 key-down/key-up 事件，适合长按录音 |
| 文字注入 | `keyboard-auto-type` | 跨平台在光标位置模拟输入，KeeWeb 作者开发 |
| 活跃窗口检测 | `active-win` | 检测前台应用名，用于 LLM 语气调整 |
| 录音 | Web Audio API + AudioWorklet | 内置于 Chromium，无需额外依赖 |
| 配置存储 | `electron-store` | JSON 配置，支持加密存储 API key |
| LLM 集成 | `openai` npm 包 | 兼容 OpenAI/兼容 API |
| 打包 | `electron-builder` | 生成 DMG (macOS) 和 NSIS (Windows) |

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
│   │   │   └── audio-recorder.ts  # 录音数据收集
│   │   ├── whisper/
│   │   │   ├── whisper-engine.ts  # Whisper 转录
│   │   │   ├── model-manager.ts   # 模型管理
│   │   │   └── model-downloader.ts # 模型下载（带进度）
│   │   ├── output/
│   │   │   ├── text-injector.ts   # 光标位置文字注入
│   │   │   └── clipboard-output.ts # 剪贴板
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
│   │       │   ├── FloatingWidget.tsx  # 录音浮窗指示器
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

---

## 数据流

```
快捷键按下
  → 渲染进程开始录音 (Web Audio API, 16kHz mono PCM)
  → PCM 数据块通过 IPC 实时发送到主进程缓冲

快捷键松开
  → 停止录音，主进程组装完整 PCM 数据
  → whisper.node 转录 PCM（自动语言检测）
  → [可选] LLM 智能编辑（检测当前 app 调整语气）
  → 文字注入到光标位置 + 复制到剪贴板
  → 浮窗显示转录结果通知
```

---

## 进程分工

| 进程 | 职责 |
|------|------|
| **主进程** | 全局快捷键、Whisper 引擎、文字注入、模型管理、配置存储、LLM 调用、系统托盘 |
| **渲染进程** | 录音 (Web Audio)、UI 界面、设置表单、进度显示 |
| **Preload** | contextBridge 安全暴露 IPC API 给渲染进程 |

---

## UI 设计

### 系统托盘
- 主要入口，右键显示菜单
- 菜单项：状态显示 / 打开设置 / 退出

### 录音浮窗（FloatingWidget）
- 透明、置顶、不可聚焦的小窗口（160×60px）
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

## 实施阶段

### Phase 1：项目骨架 + 录音管线
- 用 `electron-vite` 初始化项目
- 系统托盘 + 基本窗口管理
- `node-global-key-listener` 实现长按录音
- Web Audio API 录音 + IPC 传输 PCM

**验证**：按住快捷键说话，松开后保存 WAV 文件能正常播放

---

### Phase 2：Whisper 集成
- 集成 `@fugood/whisper.node`
- 模型下载流程（首次启动下载 base 模型，142MB）
- 下载进度 UI
- 连接录音管线到 Whisper 转录

**验证**：说话后在控制台看到转录文字

---

### Phase 3：文字输出
- `keyboard-auto-type` 光标位置注入
- `electron.clipboard` 剪贴板复制
- 处理 macOS 辅助功能权限提示

**验证**：说话后文字出现在任意应用的光标位置

---

### Phase 4：UI 完善
- 录音浮窗指示器（含动画）
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

### Phase 6：平台适配
- macOS Fn 键测试（若不可用则降级到 Right Option 键）
- Windows 测试
- 权限提示处理（macOS 辅助功能、麦克风）

---

### Phase 7：打包发布
- electron-builder 配置 DMG + NSIS
- GitHub Actions CI 自动构建（mac/win/linux）
- GitHub Releases 发布

---

## 关键技术挑战

### 1. macOS Fn 键检测
`node-global-key-listener` 通过 CGEventTap 可能检测到 Fn 键标志变化。若不行则降级为 Right Option 键，或构建原生插件。

### 2. 跨平台文字注入
`keyboard-auto-type` 处理大部分场景。CJK 输入法和终端使用剪贴板 + 粘贴的降级方案。

### 3. 原生模块打包
electron-builder + electron-rebuild 自动处理 `.node` 二进制文件，需在 CI 各平台分别构建。

### 4. 首次启动体验
首次启动需引导用户下载模型（142MB）。下载完成前禁用录音，显示进度条和预计时间。

---

## 最终验证标准

在 macOS/Windows 干净机器上：
1. 安装应用
2. 首次启动 → 引导下载模型
3. 下载完成 → 按快捷键说话
4. 松开 → 文字出现在光标位置

---

## 依赖版本参考

```json
{
  "dependencies": {
    "@fugood/whisper.node": "^0.0.5",
    "active-win": "^8.1.0",
    "electron-store": "^8.1.0",
    "keyboard-auto-type": "^0.9.3",
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
