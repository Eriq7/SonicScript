/**
 * FloatingWidget.tsx — Always-on-top recording indicator overlay.
 *
 * Main exports:
 *   - FloatingWidget(): React.ReactElement
 *
 * I/O data types:
 *   - RecordingState: 'idle' | 'recording' | 'processing' | 'success' | 'error'
 *
 * Execution flow (state machine):
 *   idle       → double-tap → startRecording() → recording
 *   recording  → double-tap → stopRecording()  → processing
 *   processing → onTranscriptionResult         → success (auto-hides after 1s → idle)
 *   any state  → onTranscriptionError          → error   (auto-hides after 3s → idle)
 *
 * Design notes:
 *   - Returns <></> in idle state; component stays mounted but invisible
 *   - Waveform animation uses 5 bars with CSS keyframe barBounce (inline <style>)
 *   - partialText is displayed during recording as a live 2-line preview
 *   - recordingSecs counter provides a mm:ss elapsed timer while recording
 *   - All IPC listeners are registered in separate useEffect hooks, each returning
 *     their cleanup function — no shared cleanup ref needed
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { RecordingState } from '../../shared/types';

export function FloatingWidget(): React.ReactElement {
  const [state, setState] = useState<RecordingState>('idle');
  const [resultText, setResultText] = useState('');
  const [partialText, setPartialText] = useState('');
  const [recordingSecs, setRecordingSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleDoubleTap = useCallback(async () => {
    if (state === 'idle') {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setResultText('');
      setPartialText('');
      setState('recording');
      try {
        await window.electronAPI?.startRecording();
      } catch {
        setState('error');
        hideTimerRef.current = setTimeout(() => setState('idle'), 2500);
      }
    } else if (state === 'recording') {
      setState('processing');
      try {
        await window.electronAPI?.stopRecording();
      } catch {
        setState('error');
        hideTimerRef.current = setTimeout(() => setState('idle'), 2500);
      }
    }
    // processing / success / error: ignore double-tap
  }, [state]);

  // Listen for hotkey events
  useEffect(() => {
    const off = window.electronAPI?.onHotkeyDoubleTap(handleDoubleTap);
    return () => off?.();
  }, [handleDoubleTap]);

  // Live partial transcript during recording
  useEffect(() => {
    const off = window.electronAPI?.onPartialTranscript(text => setPartialText(text));
    return () => off?.();
  }, []);

  // Listen for transcription result
  useEffect(() => {
    const off = window.electronAPI?.onTranscriptionResult((text) => {
      setResultText(text);
      setPartialText('');
      setState('success');
      hideTimerRef.current = setTimeout(() => setState('idle'), 1000);
    });
    return () => off?.();
  }, []);

  // Listen for errors
  useEffect(() => {
    const off = window.electronAPI?.onTranscriptionError((err) => {
      setResultText(err ?? 'Transcription failed');
      setPartialText('');
      setState('error');
      hideTimerRef.current = setTimeout(() => setState('idle'), 3000);
    });
    return () => off?.();
  }, []);

  // Listen for silent dismiss
  useEffect(() => {
    const off = window.electronAPI?.onHideFloating(() => {
      setPartialText('');
      setState('idle');
    });
    return () => off?.();
  }, []);

  if (state === 'idle') return <></>;

  return (
    <div className="flex items-end justify-center w-full h-full pb-2">
      <div
        className="relative max-w-[280px] w-full shadow-lg backdrop-blur-xl transition-all duration-300"
        style={{
          background: state === 'error' ? 'rgba(40,20,20,0.96)' : 'rgba(28,43,42,0.94)',
          border: `1px solid ${state === 'error' ? '#5A2222' : '#344A49'}`,
          borderRadius: '6px',
        }}
      >
        {/* ── Recording state ── */}
        {state === 'recording' && (
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-[3px] h-5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    style={{
                      width: '3px',
                      background: '#7ECEB3',
                      borderRadius: '2px',
                      height: `${[60, 90, 75, 100, 65][i]}%`,
                      animation: `barBounce 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
              <span className="text-hw-text text-sm font-mono">Recording</span>
              <span
                className="text-xs ml-auto font-mono tabular-nums"
                style={{ color: '#5A6E67' }}
              >
                {Math.floor(recordingSecs / 60).toString().padStart(2, '0')}:
                {(recordingSecs % 60).toString().padStart(2, '0')}
              </span>
            </div>
            {partialText && (
              <p
                className="text-[11px] text-hw-muted font-mono leading-relaxed"
                style={{
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}
              >
                {partialText}
              </p>
            )}
          </div>
        )}

        {/* ── Processing state ── */}
        {state === 'processing' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: '#7ECEB3' }}
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-hw-muted text-sm font-mono">Transcribing…</span>
          </div>
        )}

        {/* ── Success state ── */}
        {state === 'success' && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            {/* Green LED dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: '#5CB893',
                boxShadow: '0 0 6px rgba(92,184,147,0.5), 0 0 2px rgba(92,184,147,0.8)',
              }}
            />
            <span className="text-hw-text text-sm font-mono">Inserted</span>
          </div>
        )}

        {/* ── Error state ── */}
        {state === 'error' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: '#E06C6C',
                boxShadow: '0 0 6px rgba(224,108,108,0.5), 0 0 2px rgba(224,108,108,0.8)',
              }}
            />
            <span className="text-danger text-sm font-mono">{resultText || 'Error — try again'}</span>
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
