import React from 'react';
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useUploadStore } from '../../store/useUploadStore';
import { formatBytes } from '@omnidrive/shared';

export const UploadManager: React.FC = () => {
  const { uploads, isManagerOpen, setManagerOpen, cancelUpload, clearCompleted } = useUploadStore();

  if (uploads.length === 0) return null;

  const activeCount = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending').length;

  return (
    <div className="fixed bottom-5 right-6 z-40 w-80 glass-panel rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden animate-in slide-in-from-bottom duration-200">
      {/* Dock Header */}
      <div
        onClick={() => setManagerOpen(!isManagerOpen)}
        className="px-4 py-3 bg-surface-950/80 flex items-center justify-between cursor-pointer select-none border-b border-slate-800"
      >
        <div className="flex items-center gap-2.5">
          <UploadCloud className="w-4 h-4 text-brand-400" />
          <span className="font-bold text-xs text-white">
            {activeCount > 0 ? `Uploading ${activeCount} item${activeCount > 1 ? 's' : ''}` : 'Uploads completed'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {activeCount === 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
          <button className="text-slate-400 hover:text-white p-0.5">
            {isManagerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dock Content */}
      {isManagerOpen && (
        <div className="max-h-60 overflow-y-auto p-2 space-y-2">
          {uploads.map((item) => (
            <div key={item.id} className="p-2.5 rounded-xl bg-surface-900/60 border border-slate-800/80 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-200 truncate max-w-[170px]" title={item.fileName}>
                  {item.fileName}
                </span>
                <button
                  onClick={() => cancelUpload(item.id)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.status === 'completed'
                      ? 'bg-emerald-400'
                      : item.status === 'failed'
                      ? 'bg-rose-500'
                      : 'bg-brand-500'
                  }`}
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  {item.status === 'completed' ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Done
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Failed
                    </span>
                  ) : (
                    `${item.progressPercent}% • ${formatBytes(item.bytesUploaded)} of ${formatBytes(item.fileSize)}`
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
