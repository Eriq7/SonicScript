import React, { useState, useEffect } from 'react';
import { WHISPER_MODEL_DISPLAY_NAME, WHISPER_MODEL_SIZE_LABEL } from '../../shared/constants';

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
      <p className="text-sm text-slate-400">
        SonicScript uses <strong className="text-white">{WHISPER_MODEL_DISPLAY_NAME}</strong> — a
        high-accuracy model with fast inference via Metal GPU on Apple Silicon.
      </p>

      <div className="rounded-xl p-4 border border-violet-500 bg-violet-900/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{WHISPER_MODEL_DISPLAY_NAME}</span>
              {isDownloaded && (
                <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Ready</span>
              )}
            </div>
            <span className="text-sm text-slate-400">{WHISPER_MODEL_SIZE_LABEL}</span>
          </div>

          <div className="flex items-center gap-2">
            {isDownloading ? (
              <div className="flex flex-col items-end gap-1 min-w-[140px]">
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{status}</span>
              </div>
            ) : isDownloaded ? (
              <button
                onClick={handleDelete}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-900/40 text-slate-300 hover:text-red-300 transition-colors"
              >
                Delete
              </button>
            ) : (
              <button
                onClick={handleDownload}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                Download
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">Error: {error}</p>
        )}
      </div>

      {!isDownloaded && !isDownloading && (
        <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/30">
          <p className="text-xs text-amber-300">
            Model not downloaded. Recording will not work until you download it.
          </p>
        </div>
      )}
    </div>
  );
}
