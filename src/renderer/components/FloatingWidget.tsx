/**
 * FloatingWidget.tsx
 * Wispr-Flow-style floating indicator:
 *   recording  → animated waveform pill
 *   processing → spinner + "Transcribing…"
 *   success    → text preview card that stays for 1.5s
 *   error      → brief error message
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRecording } from '../hooks/useRecording';
import type { RecordingState } from '../../shared/types';

export function FloatingWidget(): React.ReactElement {
  const [state, setState] = useState<RecordingState>('idle');
  const [resultText, setResultText] = useState('');
  const [recordingSecs, setRecordingSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { startRecording, stopRecording } = useRecording();

  // Recording duration counter
  useEffect(() => {
    if (state === 'recording') {
      setRecordingSecs(0);
      timerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const handleHotkeyPressed = useCallback(async () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setResultText('');
    setState('recording');
    try {
      await startRecording();
    } catch {
      setState('error');
      hideTimerRef.current = setTimeout(() => setState('idle'), 2500);
    }
  }, [startRecording]);

  const handleHotkeyReleased = useCallback(async () => {
    if (state !== 'recording') return;
    setState('processing');
    try {
      const buffer = await stopRecording();
      await window.electronAPI?.sendAudioData(buffer);
    } catch {
      setState('error');
      hideTimerRef.current = setTimeout(() => setState('idle'), 2500);
    }
  }, [state, stopRecording]);

  // Listen for hotkey events
  useEffect(() => {
    const offPressed = window.electronAPI?.onHotkeyPressed(handleHotkeyPressed);
    const offReleased = window.electronAPI?.onHotkeyReleased(handleHotkeyReleased);
    return () => { offPressed?.(); offReleased?.(); };
  }, [handleHotkeyPressed, handleHotkeyReleased]);

  // Listen for transcription result
  useEffect(() => {
    const off = window.electronAPI?.onTranscriptionResult((text) => {
      setResultText(text);
      setState('success');
      // Stay visible for 1.5 seconds after showing result
      hideTimerRef.current = setTimeout(() => setState('idle'), 1000);
    });
    return () => off?.();
  }, []);

  // Listen for errors
  useEffect(() => {
    const off = window.electronAPI?.onTranscriptionError((err) => {
      setResultText(err ?? 'Transcription failed');
      setState('error');
      hideTimerRef.current = setTimeout(() => setState('idle'), 3000);
    });
    return () => off?.();
  }, []);

  // Listen for silent dismiss (too short / silence / hallucination)
  useEffect(() => {
    const off = window.electronAPI?.onHideFloating(() => setState('idle'));
    return () => off?.();
  }, []);

  if (state === 'idle') return <></>;

  return (
    <div className="flex items-end justify-center w-full h-full pb-2">
      <div
        className={`
          relative max-w-[280px] w-full rounded-2xl shadow-2xl
          border border-white/10 backdrop-blur-xl
          transition-all duration-300
          ${state === 'recording' ? 'bg-black/85' : ''}
          ${state === 'processing' ? 'bg-black/85' : ''}
          ${state === 'success' ? 'bg-[#1a1a2e]/95' : ''}
          ${state === 'error' ? 'bg-red-950/90' : ''}
        `}
      >
        {/* ── Recording state ── */}
        {state === 'recording' && (
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Animated bars */}
            <div className="flex items-center gap-[3px] h-5">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-[3px] bg-red-400 rounded-full"
                  style={{
                    height: `${[60, 90, 75, 100, 65][i]}%`,
                    animation: `barBounce 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span className="text-white text-sm font-medium">Recording</span>
            <span className="text-white/40 text-xs ml-auto tabular-nums">
              {Math.floor(recordingSecs / 60).toString().padStart(2, '0')}:
              {(recordingSecs % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}

        {/* ── Processing state ── */}
        {state === 'processing' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <svg className="animate-spin h-4 w-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-white/80 text-sm">Transcribing…</span>
          </div>
        )}

        {/* ── Success state ── */}
        {state === 'success' && (
          <div className="flex items-center gap-2 px-4 py-3">
            <svg className="h-3.5 w-3.5 text-green-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-green-400 text-sm font-medium">Transcription inserted</span>
          </div>
        )}

        {/* ── Error state ── */}
        {state === 'error' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <svg className="h-4 w-4 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300 text-sm">{resultText || 'Error — try again'}</span>
          </div>
        )}
      </div>

      {/* Inline keyframe animation for recording bars */}
      <style>{`
        @keyframes barBounce {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
