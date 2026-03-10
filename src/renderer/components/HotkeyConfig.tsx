import React, { useState, useEffect } from 'react';

const PRESET_KEYS = [
  { label: 'Right Alt / Right Option', value: 'RIGHT ALT' },
  { label: 'Right Control', value: 'RIGHT CTRL' },
  { label: 'Right Shift', value: 'RIGHT SHIFT' },
  { label: 'Left Alt / Left Option', value: 'LEFT ALT' },
];

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

export function HotkeyConfig(): React.ReactElement {
  const [currentKey, setCurrentKey] = useState('RIGHT ALT');
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
    setTimeout(async () => {
      const accessible = await window.electronAPI?.checkAccessibility();
      setHasAccessibility(accessible);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Accessibility permission banner (macOS only) */}
      {window.electronAPI?.platform === 'darwin' && hasAccessibility === false && (
        <div
          className="flex items-start gap-3 p-4"
          style={{
            background: '#233635',
            borderLeft: '3px solid #7ECEB3',
            borderTop: '1px solid #344A49',
            borderRight: '1px solid #344A49',
            borderBottom: '1px solid #344A49',
            borderRadius: '4px',
          }}
        >
          <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="#7ECEB3">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-xs font-mono text-accent uppercase tracking-wider">Accessibility Required</p>
            <p className="text-xs text-hw-muted mt-1 leading-relaxed">
              SonicScript needs Accessibility access to simulate paste (Cmd+V) into other apps.
            </p>
            <button
              onClick={handleRequestAccessibility}
              className="mt-3 text-xs font-mono px-3 py-1.5 font-medium transition-all duration-200 uppercase tracking-wider"
              style={{
                background: '#7ECEB3',
                color: '#1C2B2A',
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#6BBD9F';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#7ECEB3';
              }}
            >
              Grant Access
            </button>
          </div>
        </div>
      )}

      {/* Current hotkey */}
      <div>
        <SectionLabel>Hold to Record</SectionLabel>
        <div className="flex items-center gap-3">
          {/* Dark 3D Keycap */}
          <kbd
            className="px-3 py-1.5 font-mono text-sm text-accent inline-block"
            style={{
              background: 'linear-gradient(180deg, #344A49 0%, #2A3F3E 100%)',
              borderRadius: '4px',
              border: '1px solid #3F5857',
              borderBottom: '3px solid #1C2B2A',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              fontStyle: 'normal',
            }}
          >
            {currentKey}
          </kbd>
          <span className="text-xs text-hw-dim font-mono">hold to record</span>
        </div>
      </div>

      {/* Preset keys */}
      <div>
        <SectionLabel>Choose Hotkey</SectionLabel>
        <div className="space-y-0">
          {PRESET_KEYS.map((preset, i) => (
            <button
              key={preset.value}
              onClick={() => handlePresetSelect(preset.value)}
              className="w-full flex items-center justify-between px-3 py-3 transition-all duration-200 text-left border-b border-groove"
              style={{
                borderTop: i === 0 ? '1px solid #344A49' : undefined,
              }}
            >
              <span
                className="text-xs font-mono transition-colors duration-200"
                style={{ color: currentKey === preset.value ? '#E8E4D9' : '#8A9E97' }}
              >
                {preset.label}
              </span>
              {/* Mint dot on selected */}
              {currentKey === preset.value && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: '#7ECEB3',
                    boxShadow: '0 0 6px rgba(126,206,179,0.5), 0 0 2px rgba(126,206,179,0.8)',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-hw-dim font-mono">
        Hold key while speaking. Release to transcribe. Text appears at cursor.
      </p>
    </div>
  );
}
