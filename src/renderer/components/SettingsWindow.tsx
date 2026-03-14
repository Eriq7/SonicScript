/**
 * SettingsWindow.tsx — 6-tab settings panel; root component for the settings window.
 *
 * Main exports:
 *   - SettingsWindow(): React.ReactElement — tab shell with sidebar navigation
 *   - Toggle({ checked, onChange }): React.ReactElement — reusable toggle switch
 *
 * Internal components (not exported):
 *   - GeneralSettings — launch-at-startup toggle + 3-stat usage dashboard
 *   - HistoryTab       — scrollable list of recent transcriptions with copy/save/delete
 *   - SnippetsTab      — snippet CRUD (add form + list with copy/delete)
 *   - AboutTab         — app identity, feature list, usage instructions
 *
 * Design notes:
 *   - Tab routing is local state; no router library used
 *   - Toggle is exported so LLMSettings.tsx can import it (avoids duplication)
 *   - Toast notifications use a shared showToast pattern in History/Snippets tabs
 *   - GeneralSettings derives usage stats (count, chars, topApp) from history on mount
 */
import React, { useState, useEffect, useRef } from 'react';
import { HotkeyConfig } from './HotkeyConfig';
import { LLMSettings } from './LLMSettings';
import type { HistoryEntry, Snippet } from '../../shared/types';
import logoImg from '../assets/logo.png';

type Tab = 'general' | 'hotkey' | 'history' | 'snippets' | 'llm' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'hotkey', label: 'Hotkey' },
  { id: 'history', label: 'History' },
  { id: 'snippets', label: 'Snippets' },
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
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'snippets' && <SnippetsTab />}
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
  const [stats, setStats] = useState({ count: 0, chars: 0, topApp: '—' });

  React.useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      setLaunchAtStartup(s.general.launchAtStartup);
    });
    window.electronAPI?.getHistory().then(history => {
      if (!history || history.length === 0) return;
      const count = history.length;
      const chars = history.reduce((n, h) => n + h.text.length, 0);
      const freq: Record<string, number> = {};
      history.forEach(h => { freq[h.appName] = (freq[h.appName] ?? 0) + 1; });
      const topApp = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      setStats({ count, chars, topApp });
    });
  }, []);

  const toggleStartup = async () => {
    const next = !launchAtStartup;
    setLaunchAtStartup(next);
    await window.electronAPI?.setSettings({ general: { launchAtStartup: next, showNotifications: true } });
  };

  return (
    <div className="space-y-5">
      {/* Branding card */}
      <div
        className="flex items-center gap-4 p-5"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <img
          src={logoImg}
          alt="SonicScript logo"
          style={{ width: 64, height: 64, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <h3
            className="text-base font-bold text-hw-text tracking-tight"
            style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
          >
            SonicScript
          </h3>
          <p className="text-hw-muted text-xs mt-0.5">Voice to text, instantly.</p>
          <p className="text-hw-dim text-[10px] font-mono mt-1 tracking-widest uppercase">
            Apple SFSpeechRecognizer · On-device
          </p>
        </div>
      </div>

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

      {/* Usage stats */}
      <div
        className="p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <SectionLabel>Usage Stats</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: String(stats.count), label: 'Recent recordings' },
            { value: String(stats.chars), label: 'Characters typed' },
            { value: stats.topApp, label: 'Top app' },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center py-3 px-2"
              style={{
                background: '#1E3130',
                border: '1px solid #344A49',
                borderRadius: '4px',
              }}
            >
              <span
                className="font-mono font-bold text-hw-text truncate max-w-full text-center"
                style={{ fontSize: stat.value.length > 6 ? '10px' : '16px' }}
                title={stat.value}
              >
                {stat.value}
              </span>
              <span className="text-[9px] font-mono text-hw-dim mt-1 text-center leading-tight">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-hw-dim mt-2 text-right">Based on recent 50 recordings</p>
      </div>
    </div>
  );
}

function HistoryTab(): React.ReactElement {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.electronAPI?.getHistory().then(setItems);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2000);
  };

  const handleCopy = async (text: string) => {
    await window.electronAPI?.copySnippet(text);
    showToast('Copied');
  };

  const handleSave = async (text: string) => {
    const title = text.slice(0, 40).trim() + (text.length > 40 ? '…' : '');
    await window.electronAPI?.addSnippet(title, text);
    showToast('Saved to Snippets');
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI?.deleteHistoryItem(id);
    setItems(prev => prev.filter(h => h.id !== id));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-hw-muted text-sm font-mono">No transcriptions yet</p>
        <p className="text-hw-dim text-xs font-mono mt-1">Double-tap Right Option to start recording</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toast */}
      {toast && (
        <div
          className="text-xs font-mono text-center py-2 px-3 rounded"
          style={{ background: '#1E3130', border: '1px solid #7ECEB3', color: '#7ECEB3' }}
        >
          {toast}
        </div>
      )}
      {items.map(item => (
        <div
          key={item.id}
          className="p-3 group"
          style={{
            background: '#2A3F3E',
            border: '1px solid #344A49',
            borderRadius: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-sm font-mono text-hw-text flex-1 leading-relaxed"
              style={{
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {item.text}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleCopy(item.text)}
                className="text-[10px] font-mono px-2 py-1 rounded transition-all duration-200"
                style={{ background: '#1E3130', border: '1px solid #344A49', color: '#7ECEB3' }}
              >
                Copy
              </button>
              <button
                onClick={() => handleSave(item.text)}
                className="text-[10px] font-mono px-2 py-1 rounded transition-all duration-200"
                style={{ background: '#1E3130', border: '1px solid #344A49', color: '#7ECEB3' }}
              >
                Save to Snippets
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-hw-dim hover:text-danger transition-colors text-xs font-mono opacity-0 group-hover:opacity-100 ml-0.5"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: '#1E3130', color: '#7ECEB3', border: '1px solid #344A49' }}
            >
              {item.appName}
            </span>
            <span className="text-[10px] font-mono text-hw-dim">{formatTime(item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnippetsTab(): React.ReactElement {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.electronAPI?.getSnippets().then(setSnippets);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  };

  const handleSave = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return;
    await window.electronAPI?.addSnippet(t, c);
    const updated = await window.electronAPI?.getSnippets();
    if (updated) setSnippets(updated);
    setTitle('');
    setContent('');
  };

  const handleCopy = async (c: string) => {
    await window.electronAPI?.copySnippet(c);
    showToast('已复制 — 切换到目标应用后按 Cmd+V');
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI?.deleteSnippet(id);
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const inputStyle: React.CSSProperties = {
    background: '#1E3130',
    border: '1px solid #344A49',
    borderRadius: '4px',
    color: '#E8E4D9',
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '8px 10px',
    width: '100%',
    outline: 'none',
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className="text-xs font-mono text-center py-2 px-3 rounded"
          style={{ background: '#1E3130', border: '1px solid #7ECEB3', color: '#7ECEB3' }}
        >
          {toast}
        </div>
      )}

      {/* Add snippet form */}
      <div
        className="p-4 space-y-3"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <SectionLabel>New Snippet</SectionLabel>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={inputStyle}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <button
          onClick={handleSave}
          disabled={!title.trim() || !content.trim()}
          className="text-xs font-mono px-4 py-2 rounded transition-all duration-200"
          style={{
            background: title.trim() && content.trim() ? '#7ECEB3' : '#2A3F3E',
            color: title.trim() && content.trim() ? '#1A2F2E' : '#5A6E67',
            border: '1px solid #344A49',
            cursor: title.trim() && content.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save Snippet
        </button>
      </div>

      {/* Snippet list */}
      {snippets.length === 0 ? (
        <p className="text-hw-muted text-sm font-mono text-center py-4">No snippets yet</p>
      ) : (
        <div className="space-y-2">
          {snippets.map(s => (
            <div
              key={s.id}
              className="p-3 group"
              style={{
                background: '#2A3F3E',
                border: '1px solid #344A49',
                borderRadius: '4px',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-hw-text truncate">{s.title}</p>
                  <p
                    className="text-xs font-mono text-hw-muted mt-0.5"
                    style={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    } as React.CSSProperties}
                  >
                    {s.content}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(s.content)}
                    className="text-[10px] font-mono px-2 py-1 rounded transition-all duration-200"
                    style={{
                      background: '#1E3130',
                      border: '1px solid #344A49',
                      color: '#7ECEB3',
                    }}
                  >
                    复制
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-[10px] font-mono text-hw-dim hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
          <p className="text-hw-muted text-xs mt-0.5">Fast, privacy-first speech-to-text for macOS</p>
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
            { label: 'Real-time streaming', detail: 'Words appear as you speak' },
            { label: 'On-device recognition', detail: 'Apple SFSpeechRecognizer, no data leaves device' },
            { label: 'No account', detail: 'No sign-up required' },
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
          Double-tap <span className="text-hw-text">Right Option</span> to start recording.
          Double-tap again to stop. Text will be pasted at your cursor.
        </p>
      </div>
    </div>
  );
}
