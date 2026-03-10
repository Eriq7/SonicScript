import React, { useState, useEffect } from 'react';
import { WHISPER_MODELS } from '../../shared/constants';
import type { WhisperModelName } from '../../shared/types';

interface ModelStatus {
  name: WhisperModelName;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  status: string;
}

export function ModelManager(): React.ReactElement {
  const [models, setModels] = useState<Record<WhisperModelName, ModelStatus>>({
    tiny: { name: 'tiny', isDownloaded: false, isDownloading: false, progress: 0, status: '' },
    base: { name: 'base', isDownloaded: false, isDownloading: false, progress: 0, status: '' },
  });
  const [activeModel, setActiveModel] = useState<WhisperModelName>('base');

  // Load initial state
  useEffect(() => {
    (async () => {
      const [downloaded, settings] = await Promise.all([
        window.electronAPI?.getModelStatus(),
        window.electronAPI?.getSettings(),
      ]);
      setActiveModel(settings.whisper.model);
      setModels(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(downloaded)) {
          next[k as WhisperModelName] = { ...next[k as WhisperModelName], isDownloaded: v };
        }
        return next;
      });
    })();
  }, []);

  // Progress events
  useEffect(() => {
    const off = window.electronAPI?.onModelProgress((model, progress, status) => {
      setModels(prev => ({
        ...prev,
        [model]: { ...prev[model], isDownloading: true, progress, status },
      }));
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onModelReady((model) => {
      setModels(prev => ({
        ...prev,
        [model]: { ...prev[model], isDownloaded: true, isDownloading: false, progress: 100, status: 'Ready' },
      }));
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.electronAPI?.onModelError((model, error) => {
      setModels(prev => ({
        ...prev,
        [model]: { ...prev[model], isDownloading: false, status: `Error: ${error}` },
      }));
    });
    return off;
  }, []);

  const handleDownload = async (model: WhisperModelName) => {
    setModels(prev => ({ ...prev, [model]: { ...prev[model], isDownloading: true, progress: 0, status: 'Starting...' } }));
    await window.electronAPI?.downloadModel(model);
  };

  const handleDelete = async (model: WhisperModelName) => {
    if (!confirm(`Delete ${WHISPER_MODELS[model].displayName} model?`)) return;
    await window.electronAPI?.deleteModel(model);
    setModels(prev => ({ ...prev, [model]: { ...prev[model], isDownloaded: false, progress: 0 } }));
    if (activeModel === model) {
      const fallback: WhisperModelName = 'base';
      setActiveModel(fallback);
      await window.electronAPI?.setSettings({ whisper: { model: fallback, language: 'auto' } });
    }
  };

  const handleSetActive = async (model: WhisperModelName) => {
    setActiveModel(model);
    await window.electronAPI?.setSettings({ whisper: { model, language: 'auto' } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400 mb-4">
        The <strong className="text-white">Base</strong> model is recommended for best accuracy.
        The <strong className="text-white">Tiny</strong> model is faster but less accurate.
      </p>
      {(Object.keys(WHISPER_MODELS) as WhisperModelName[]).map((name) => {
        const info = WHISPER_MODELS[name];
        const status = models[name];
        const isActive = activeModel === name;

        return (
          <div
            key={name}
            className={`rounded-xl p-4 border transition-colors ${
              isActive
                ? 'border-violet-500 bg-violet-900/20'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{info.displayName}</span>
                  {isActive && (
                    <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <span className="text-sm text-slate-400">{info.sizeLabel}</span>
              </div>

              <div className="flex items-center gap-2">
                {status.isDownloading ? (
                  <div className="flex flex-col items-end gap-1 min-w-[120px]">
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{status.status}</span>
                  </div>
                ) : status.isDownloaded ? (
                  <>
                    {!isActive && (
                      <button
                        onClick={() => handleSetActive(name)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                      >
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(name)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-900/40 text-slate-300 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDownload(name)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
