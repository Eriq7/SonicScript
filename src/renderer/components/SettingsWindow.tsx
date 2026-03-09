import React, { useState } from 'react';
import { ModelManager } from './ModelManager';
import { HotkeyConfig } from './HotkeyConfig';
import { LLMSettings } from './LLMSettings';

type Tab = 'general' | 'hotkey' | 'model' | 'llm' | 'about';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'hotkey', label: 'Hotkey', icon: '⌨️' },
  { id: 'model', label: 'Model', icon: '🧠' },
  { id: 'llm', label: 'Smart Edit', icon: '✨' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

export function SettingsWindow(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('hotkey');

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-white">
      {/* Sidebar */}
      <aside className="w-48 bg-[#13131f] border-r border-white/5 flex flex-col py-4 shrink-0">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <span className="font-semibold text-white">SonicScript</span>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 pt-4 border-t border-white/5">
          <p className="text-xs text-slate-500">v1.0.0</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-white mb-5">
          {TABS.find(t => t.id === activeTab)?.label}
        </h2>

        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'hotkey' && <HotkeyConfig />}
        {activeTab === 'model' && <ModelManager />}
        {activeTab === 'llm' && <LLMSettings />}
        {activeTab === 'about' && <AboutTab />}
      </main>
    </div>
  );
}

function GeneralSettings(): React.ReactElement {
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

  React.useEffect(() => {
    window.electronAPI?.getSettings().then(s => setLaunchAtStartup(s.general.launchAtStartup));
  }, []);

  const toggle = async () => {
    const next = !launchAtStartup;
    setLaunchAtStartup(next);
    await window.electronAPI?.setSettings({ general: { launchAtStartup: next, showNotifications: true } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
        <div>
          <p className="font-medium text-white">Launch at Startup</p>
          <p className="text-sm text-slate-400 mt-0.5">Start SonicScript automatically on login</p>
        </div>
        <button
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            launchAtStartup ? 'bg-violet-600' : 'bg-white/20'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              launchAtStartup ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-sm text-slate-300 font-medium mb-1">Transcription Language</p>
        <p className="text-sm text-slate-500">
          Auto-detect is recommended. The model detects language automatically.
        </p>
        <p className="text-xs text-violet-400 mt-2">Language: Auto-detect</p>
      </div>
    </div>
  );
}

function AboutTab(): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-6 rounded-xl bg-white/5 border border-white/10">
        <span className="text-5xl">🎙️</span>
        <div>
          <h3 className="text-xl font-bold text-white">SonicScript</h3>
          <p className="text-slate-400 mt-1">Free, local, privacy-first speech-to-text</p>
          <p className="text-slate-500 text-sm mt-1">Version 1.0.0</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 space-y-2">
        <p>🔒 <strong className="text-white">100% local</strong> — no data leaves your device</p>
        <p>🚫 <strong className="text-white">No account</strong> — no sign-up required</p>
        <p>⚡ <strong className="text-white">Powered by Whisper</strong> — OpenAI's open-source ASR model</p>
        <p>🆓 <strong className="text-white">Free forever</strong> — open source</p>
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-sm text-slate-400">
          <strong className="text-white">Usage:</strong> Hold Right Alt (Windows) or Right Option (macOS) while speaking.
          Release the key to transcribe. The text will be automatically pasted at your cursor position.
        </p>
      </div>
    </div>
  );
}
