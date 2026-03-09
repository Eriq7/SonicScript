import React, { useState, useEffect, useCallback } from 'react';

const PRESET_KEYS = [
  { label: 'Right Alt / Right Option', value: 'RIGHT ALT' },
  { label: 'Right Control', value: 'RIGHT CTRL' },
  { label: 'Right Shift', value: 'RIGHT SHIFT' },
  { label: 'Left Alt / Left Option', value: 'LEFT ALT' },
];

export function HotkeyConfig(): React.ReactElement {
  const [currentKey, setCurrentKey] = useState('RIGHT ALT');
  const [isRecording, setIsRecording] = useState(false);
  const [hasAccessibility, setHasAccessibility] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [settings, accessible] = await Promise.all([
        window.electronAPI?.getSettings(),
        window.electronAPI?.checkAccessibility(),
      ]);
      setCurrentKey(settings.hotkey.key);
      setHasAccessibility(accessible);
    })();
  }, []);

  const handlePresetSelect = async (key: string) => {
    setCurrentKey(key);
    await window.electronAPI?.updateHotkey(key);
  };

  const handleRequestAccessibility = async () => {
    await window.electronAPI?.requestAccessibility();
    // Re-check after a delay
    setTimeout(async () => {
      const accessible = await window.electronAPI?.checkAccessibility();
      setHasAccessibility(accessible);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Accessibility permission banner (macOS only) */}
      {window.electronAPI?.platform === 'darwin' && hasAccessibility === false && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/30 border border-amber-600/40">
          <svg className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">Accessibility Permission Required</p>
            <p className="text-sm text-amber-200/70 mt-1">
              SonicScript needs Accessibility access to simulate paste (Cmd+V) into other apps.
            </p>
            <button
              onClick={handleRequestAccessibility}
              className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              Grant Access…
            </button>
          </div>
        </div>
      )}

      {/* Current hotkey */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Hold to Record
        </label>
        <div className="flex items-center gap-2">
          <kbd className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-sm">
            {currentKey}
          </kbd>
          <span className="text-slate-400 text-sm">hold down to record</span>
        </div>
      </div>

      {/* Preset keys */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Choose Hotkey
        </label>
        <div className="space-y-2">
          {PRESET_KEYS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePresetSelect(preset.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                currentKey === preset.value
                  ? 'border-violet-500 bg-violet-900/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <span className="text-sm">{preset.label}</span>
              {currentKey === preset.value && (
                <svg className="h-4 w-4 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Hold the key while speaking. Release to transcribe. Text will appear at your cursor.
      </p>
    </div>
  );
}
