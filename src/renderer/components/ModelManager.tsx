/**
 * ModelManager.tsx — LEGACY: Whisper model download UI (not currently used).
 *
 * NOTE: This component was part of the original Whisper-based architecture.
 * It references electronAPI methods (getModelStatus, onModelProgress, onModelReady,
 * onModelError, downloadModel, deleteModel) and constants (WHISPER_MODEL_DISPLAY_NAME,
 * WHISPER_MODEL_SIZE_LABEL) that no longer exist after the switch to SFSpeechRecognizer.
 * This file is retained for reference but is NOT imported or rendered anywhere.
 *
 * Main exports:
 *   - ModelManager(): React.ReactElement — download/delete UI for a Whisper GGUF model
 *
 * Design notes:
 *   - Do not delete until the Whisper → SF refactor is confirmed stable and the file
 *     is no longer needed as a reference for the download flow
 */
import React, { useState, useEffect } from 'react';
import { WHISPER_MODEL_DISPLAY_NAME, WHISPER_MODEL_SIZE_LABEL } from '../../shared/constants';

const VU_SEGMENTS = 20;

function VUMeter({ progress }: { progress: number }) {
  const filled = Math.round((progress / 100) * VU_SEGMENTS);
  return (
    <div className="flex items-center gap-[2px]" style={{ height: '12px' }}>
      {Array.from({ length: VU_SEGMENTS }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <div
            key={i}
            style={{
              width: '6px',
              height: '100%',
              borderRadius: '1px',
              background: isFilled ? '#7ECEB3' : '#344A49',
              boxShadow: isFilled ? '0 0 4px rgba(126,206,179,0.4)' : 'none',
              transition: 'background 0.1s ease, box-shadow 0.1s ease',
            }}
          />
        );
      })}
    </div>
  );
}

export function ModelManager(): React.ReactElement {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.electronAPI?.getModelStatus().then(setIsDownloaded);
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onModelProgress((prog, stat) => {
      setIsDownloading(true);
      setProgress(prog);
      setStatus(stat);
      setError('');
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onModelReady(() => {
      setIsDownloaded(true);
      setIsDownloading(false);
      setProgress(100);
      setStatus('Ready');
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onModelError((err) => {
      setIsDownloading(false);
      setError(err);
    });
    return off;
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    setProgress(0);
    setStatus('Starting...');
    setError('');
    await window.electronAPI?.downloadModel();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${WHISPER_MODEL_DISPLAY_NAME} model? You'll need to re-download it.`)) return;
    await window.electronAPI?.deleteModel();
    setIsDownloaded(false);
    setProgress(0);
    setStatus('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-mono text-hw-muted leading-relaxed">
        SonicScript uses{' '}
        <span className="text-hw-text">{WHISPER_MODEL_DISPLAY_NAME}</span> — high-accuracy
        inference with Metal GPU on Apple Silicon.
      </p>

      {/* Model card */}
      <div
        className="p-4"
        style={{
          background: '#2A3F3E',
          border: '1px solid #344A49',
          borderRadius: '4px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="font-mono text-sm text-hw-text">{WHISPER_MODEL_DISPLAY_NAME}</span>
              {/* LED status badge */}
              {isDownloaded && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: '#5CB893',
                      boxShadow: '0 0 6px rgba(92,184,147,0.5), 0 0 2px rgba(92,184,147,0.8)',
                    }}
                  />
                  <span className="text-[10px] font-mono text-hw-muted uppercase tracking-wider">Ready</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-hw-dim font-mono uppercase tracking-wider">{WHISPER_MODEL_SIZE_LABEL}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDownloading ? null : isDownloaded ? (
              <button
                onClick={handleDelete}
                className="text-[11px] font-mono px-3 py-1.5 text-hw-muted transition-all duration-200 uppercase tracking-wider"
                style={{
                  background: 'transparent',
                  border: '1px solid #344A49',
                  borderRadius: '4px',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#E06C6C';
                  (e.currentTarget as HTMLButtonElement).style.color = '#E06C6C';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#344A49';
                  (e.currentTarget as HTMLButtonElement).style.color = '#8A9E97';
                }}
              >
                Delete
              </button>
            ) : (
              <button
                onClick={handleDownload}
                className="text-[11px] font-mono px-3 py-1.5 font-medium transition-all duration-200 uppercase tracking-wider"
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
                Download
              </button>
            )}
          </div>
        </div>

        {/* VU meter progress */}
        {isDownloading && (
          <div className="mt-4 space-y-2">
            <VUMeter progress={progress} />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-hw-dim">{status}</span>
              <span className="text-[10px] font-mono text-accent">{progress}%</span>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-[11px] font-mono text-danger">ERR: {error}</p>
        )}
      </div>

      {!isDownloaded && !isDownloading && (
        <div
          className="p-3"
          style={{
            background: 'rgba(126,206,179,0.06)',
            borderLeft: '2px solid rgba(126,206,179,0.5)',
            borderTop: '1px solid rgba(126,206,179,0.15)',
            borderRight: '1px solid rgba(126,206,179,0.15)',
            borderBottom: '1px solid rgba(126,206,179,0.15)',
            borderRadius: '4px',
          }}
        >
          <p className="text-[11px] font-mono text-accent uppercase tracking-wider">
            Model not downloaded — recording disabled
          </p>
        </div>
      )}
    </div>
  );
}
