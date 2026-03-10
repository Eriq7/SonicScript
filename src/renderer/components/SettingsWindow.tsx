import React, { useState } from 'react';
import { ModelManager } from './ModelManager';
import { HotkeyConfig } from './HotkeyConfig';
import { LLMSettings } from './LLMSettings';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

type Tab = 'general' | 'hotkey' | 'model' | 'llm' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'hotkey', label: 'Hotkey' },
  { id: 'model', label: 'Model' },
  { id: 'llm', label: 'Smart Edit' },
  { id: 'about', label: 'About' },
];

export function SettingsWindow(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('hotkey');

  return (
    <div className="flex h-screen bg-chassis text-hw-text">
      {/* Sidebar */}
      <aside
        className="w-44 bg-panel flex flex-col py-5 shrink-0"
        style={{ borderRight: '1px solid #344A49' }}
      >
        {/* Logo */}
        <div className="px-5 mb-7">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse"
              style={{ boxShadow: '0 0 6px rgba(126,206,179,0.5), 0 0 2px rgba(126,206,179,0.8)' }}
            />
            <span
              className="font-bold text-hw-text tracking-tight text-sm"
              style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
            >
              SonicScript
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-5 py-2.5 text-xs transition-all duration-200 text-left border-b border-groove ${
                activeTab === tab.id
                  ? 'text-accent border-l-2 border-l-accent pl-[18px]'
                  : 'text-hw-muted hover:text-hw-text'
              }`}
              style={{ fontFamily: 'Syne, system-ui, sans-serif', fontWeight: activeTab === tab.id ? 600 : 400 }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Version */}
        <div className="px-5 pt-4 border-t border-groove">
          <p className="text-[10px] font-mono tracking-widest text-hw-dim uppercase">v1.0.0</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8 transition-opacity duration-150">
        {/* Section label with ruled line */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-hw-muted whitespace-nowrap"
          >
            {TABS.find(t => t.id === activeTab)?.label}
          </span>
          <div className="flex-1 h-px bg-groove" />
        </div>

        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'hotkey' && <HotkeyConfig />}
        {activeTab === 'model' && <ModelManager />}
        {activeTab === 'llm' && <LLMSettings />}
        {activeTab === 'about' && <AboutTab />}
      </main>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative inline-flex items-center transition-all duration-200 shrink-0"
      style={{
        height: '22px',
        width: '40px',
        borderRadius: '4px',
        background: checked ? '#7ECEB3' : '#2A3F3E',
        border: '1px solid',
        borderColor: checked ? '#6BBD9F' : '#344A49',
        boxShadow: checked
          ? '0 0 4px rgba(126,206,179,0.3)'
          : 'inset 0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      <span
        className="absolute transition-transform duration-150"
        style={{
          height: '16px',
          width: '16px',
          borderRadius: '3px',
          background: '#E8E4D9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-hw-muted whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-groove" />
    </div>
  );
}

function GeneralSettings(): React.ReactElement {
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [language, setLanguage] = useState('zh');

  React.useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      setLaunchAtStartup(s.general.launchAtStartup);
      setLanguage(s.whisper.language);
    });
  }, []);

  const toggleStartup = async () => {
    const next = !launchAtStartup;
    setLaunchAtStartup(next);
    await window.electronAPI?.setSettings({ general: { launchAtStartup: next, showNotifications: true } });
  };

  const handleLanguageChange = async (code: string) => {
    setLanguage(code);
    await window.electronAPI?.setSettings({ whisper: { language: code } });
  };

  return (
    <div className="space-y-5">
      {/* Launch at startup */}
      <div
        className="flex items-center justify-between p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <div>
          <p className="font-mono text-sm text-hw-text">Launch at Startup</p>
          <p className="text-xs text-hw-muted mt-0.5">Start automatically on login</p>
        </div>
        <Toggle checked={launchAtStartup} onChange={toggleStartup} />
      </div>

      {/* Language */}
      <div
        className="p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <SectionLabel>Transcription Language</SectionLabel>
        <div className="space-y-1">
          {SUPPORTED_LANGUAGES.map(lang => (
            <label
              key={lang.code}
              className="flex items-center gap-3 p-3 cursor-pointer transition-all duration-200"
              style={{ borderRadius: '4px' }}
            >
              {/* LED indicator */}
              <div
                className="w-3 h-3 rounded-full border shrink-0 flex items-center justify-center transition-all duration-200"
                style={{
                  borderColor: language === lang.code ? '#7ECEB3' : '#3F5857',
                  boxShadow: language === lang.code ? '0 0 6px rgba(126,206,179,0.5), 0 0 2px rgba(126,206,179,0.8)' : 'none',
                }}
              >
                {language === lang.code && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#7ECEB3' }}
                  />
                )}
              </div>
              <input
                type="radio"
                name="language"
                value={lang.code}
                checked={language === lang.code}
                onChange={() => handleLanguageChange(lang.code)}
                className="sr-only"
              />
              <div>
                <p className="text-sm font-mono text-hw-text">{lang.label}</p>
                <p className="text-xs text-hw-muted">{lang.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutTab(): React.ReactElement {
  return (
    <div className="space-y-5">
      {/* App identity */}
      <div
        className="flex items-center gap-4 p-5"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {/* Accent dot in recessed square */}
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0"
          style={{
            background: '#233635',
            border: '1px solid #344A49',
            borderRadius: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full block"
            style={{
              background: '#7ECEB3',
              boxShadow: '0 0 8px rgba(126,206,179,0.5), 0 0 3px rgba(126,206,179,0.8)',
            }}
          />
        </div>
        <div>
          <h3
            className="text-base font-bold text-hw-text tracking-tight"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            SonicScript
          </h3>
          <p className="text-hw-muted text-xs mt-0.5">Free, local, privacy-first speech-to-text</p>
          <p className="text-hw-dim text-[10px] font-mono mt-1 tracking-widest uppercase">SN: 1.0.0</p>
        </div>
      </div>

      {/* Features */}
      <div
        className="p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <SectionLabel>Features</SectionLabel>
        <div className="space-y-3">
          {[
            { label: '100% local', detail: 'No data leaves your device' },
            { label: 'No account', detail: 'No sign-up required' },
            { label: 'Powered by Whisper', detail: "OpenAI's open-source ASR model" },
            { label: 'Free forever', detail: 'Open source' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <span
                className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{
                  background: '#5CB893',
                  boxShadow: '0 0 6px rgba(92,184,147,0.5), 0 0 2px rgba(92,184,147,0.8)',
                }}
              />
              <p className="text-xs font-mono text-hw-muted">
                <span className="text-hw-text">{item.label}</span>
                {' — '}{item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div
        className="p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <SectionLabel>Usage</SectionLabel>
        <p className="text-xs font-mono text-hw-muted leading-relaxed">
          Hold <span className="text-hw-text">Right Alt</span> (Windows) or{' '}
          <span className="text-hw-text">Right Option</span> (macOS) while speaking.
          Release to transcribe. Text will be pasted at your cursor.
        </p>
      </div>
    </div>
  );
}
