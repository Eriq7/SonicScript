/**
 * LLMSettings.tsx — Smart Edit configuration: toggle, API key input, and save.
 *
 * Main exports:
 *   - LLMSettings(): React.ReactElement
 *
 * Execution flow:
 *   1. On mount: load LLM settings section from main process
 *   2. Render Smart Edit toggle (enabled/disabled)
 *   3. When enabled: show API key input (password field with show/hide toggle) and
 *      cost-per-day hint; privacy notice explaining local-only key storage
 *   4. Save button: setSettings({ llm: config }) → 2s "Saved" feedback state
 *
 * Design notes:
 *   - Imports Toggle from SettingsWindow to avoid duplicating the toggle component
 *   - API key is stored in plaintext in the electron-store settings file (local only)
 *   - baseURL and model fields are not exposed in the UI; they default to OpenAI's
 *     endpoint and gpt-4.1-nano; power users can edit via the settings JSON file directly
 */
import React, { useState, useEffect } from 'react';
import type { LLMSettings as LLMConfig } from '../../shared/types';
import { Toggle } from './SettingsWindow';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-hw-muted whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-groove" />
    </div>
  );
}

const insetInputClass = `
  w-full font-mono text-sm text-hw-text placeholder-hw-dim
  bg-surface border border-groove rounded-hw px-3 py-2
  focus:outline-none transition-all duration-200
`;

export function LLMSettings(): React.ReactElement {
  const [config, setConfig] = useState<LLMConfig>({
    enabled: false,
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4.1-nano',
    mode: 'smart-edit',
  });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.electronAPI?.getSettings().then(s => setConfig(s.llm));
  }, []);

  const save = async () => {
    await window.electronAPI?.setSettings({ llm: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
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
          <p className="font-mono text-sm text-hw-text">Smart Edit</p>
          <p className="text-xs text-hw-muted mt-0.5">
            Use an LLM to clean up transcriptions before inserting
          </p>
        </div>
        <Toggle
          checked={config.enabled}
          onChange={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-hw-muted leading-relaxed px-1">
        Smart Edit uses GPT-4.1 Nano to automatically clean up grammar, remove filler words, and adjust tone based on the app you're typing in. If you speak 60 minutes a day, it costs about $0.01/day.
      </p>

      {config.enabled && (
        <div
          className="p-4 space-y-4"
          style={{
            background: '#2A3F3E',
            border: '1px solid #344A49',
            borderRadius: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {/* API Key */}
          <div>
            <SectionLabel>API Key</SectionLabel>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                placeholder="sk-..."
                className={insetInputClass}
                style={{ paddingRight: '2rem' }}
                onFocus={e => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#7ECEB3';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(126,206,179,0.15)';
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#344A49';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-hw-dim hover:text-hw-muted transition-colors duration-200"
              >
                {showKey ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3.28 2.22a.75.75 0 00-1.06 1.06L6.5 7.54A9.52 9.52 0 001.5 10c1.06 2.63 3.84 5 8.5 5a9.5 9.5 0 004.38-1.06l3.34 3.34a.75.75 0 001.06-1.06l-15.5-15.5zM10 13a3 3 0 01-2.83-4l1.1 1.1A1.5 1.5 0 0010 11.5l1.1 1.1A3 3 0 0110 13z" />
                    <path d="M18.5 10c-.83 2.06-2.7 3.93-5.18 4.68L11.2 12.55A3 3 0 008.45 9.8L6.32 7.67A9.5 9.5 0 0110 7c4.66 0 7.44 2.37 8.5 3z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* API key purchase hint */}
          <p className="text-[11px] text-hw-dim leading-relaxed -mt-1">
            Need an API key?{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#7ECEB3', textDecoration: 'underline' }}
            >
              Get one from OpenAI
            </a>
            {' '}— pay only for what you use.
          </p>

          {/* Privacy notice */}
          <div className="flex items-start gap-2 pt-1">
            <svg className="h-3.5 w-3.5 mt-0.5 shrink-0 text-hw-muted" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <p className="text-[11px] text-hw-dim leading-relaxed">
              Your API key is stored locally on your device only. SonicScript has no servers, no database, and no way to access your key.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={save}
        className="w-full py-2.5 font-mono text-[11px] uppercase tracking-wider font-medium transition-all duration-200"
        style={{
          background: saved ? '#233635' : '#7ECEB3',
          color: saved ? '#8A9E97' : '#1C2B2A',
          borderRadius: '4px',
          border: saved ? '1px solid #344A49' : 'none',
          boxShadow: saved ? 'none' : '0 1px 3px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={e => {
          if (!saved) (e.currentTarget as HTMLButtonElement).style.background = '#6BBD9F';
        }}
        onMouseLeave={e => {
          if (!saved) (e.currentTarget as HTMLButtonElement).style.background = '#7ECEB3';
        }}
      >
        {saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
