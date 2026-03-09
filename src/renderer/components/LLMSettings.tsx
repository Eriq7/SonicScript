import React, { useState, useEffect } from 'react';
import type { LLMSettings as LLMConfig } from '../../shared/types';

export function LLMSettings(): React.ReactElement {
  const [config, setConfig] = useState<LLMConfig>({
    enabled: false,
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
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
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
        <div>
          <p className="font-medium text-white">Smart Edit</p>
          <p className="text-sm text-slate-400 mt-0.5">
            Use an LLM to clean up transcriptions before inserting
          </p>
        </div>
        <button
          onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-violet-600' : 'bg-white/20'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-slate-500 pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Base URL
              <span className="text-slate-500 font-normal ml-2">(OpenAI-compatible)</span>
            </label>
            <input
              type="text"
              value={config.baseURL}
              onChange={e => setConfig(c => ({ ...c, baseURL: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-slate-500"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
            <input
              type="text"
              value={config.model}
              onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
              placeholder="gpt-4o-mini"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-slate-500"
            />
          </div>
        </>
      )}

      <button
        onClick={save}
        className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-violet-600 hover:bg-violet-500 text-white'
        }`}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
