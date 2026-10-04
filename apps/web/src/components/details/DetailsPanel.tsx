import React from 'react';
import { X, Download, Eye, ExternalLink, HardDrive, Calendar, FileText, Hash, ShieldCheck } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { formatBytes, formatDate, isGoogleDoc, getFileTypeCategory } from '@omnidrive/shared';
import { FileIcon } from '../common/FileIcon';

export const DetailsPanel: React.FC = () => {
  const { isDetailsOpen, setDetailsOpen, selectedFileForDetails, setActiveViewerNode } = useUIStore();

  if (!isDetailsOpen || !selectedFileForDetails) return null;

  const node = selectedFileForDetails;
  const isDoc = isGoogleDoc(node.mimeType);

  return (
    <aside className="w-80 border-l border-slate-800/80 bg-surface-950/80 backdrop-blur-xl p-5 flex flex-col justify-between h-[calc(100vh-4rem)] z-10 animate-in slide-in-from-right duration-200">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 mb-5">
          <h3 className="font-bold text-sm text-white">Item Details</h3>
          <button
            onClick={() => setDetailsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Preview Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-surface-900 border border-slate-800/80 flex items-center justify-center mb-3 shadow-glass">
            <FileIcon mimeType={node.mimeType} name={node.name} isFolder={node.isFolder} className="w-10 h-10" />
          </div>
          <h4 className="font-bold text-sm text-white truncate max-w-full px-2" title={node.name}>
            {node.name}
          </h4>
          <span className="text-xs text-slate-400 capitalize mt-0.5">
            {getFileTypeCategory(node.mimeType, node.name)}
          </span>
        </div>

        {/* Metadata List */}
        <div className="space-y-3.5 text-xs">
          <div className="flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-slate-400">Account Drive</div>
              <div className="text-slate-200 font-medium">{node.accountLabel || node.accountEmail || node.accountId}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-slate-400">File Size</div>
              <div className="text-slate-200 font-medium">{node.isFolder ? '--' : formatBytes(node.size)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-slate-400">Last Modified</div>
              <div className="text-slate-200 font-medium">{formatDate(node.modifiedTime)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Hash className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-slate-400">Composite Node ID</div>
              <div className="text-slate-400 font-mono text-[10px] break-all">{node.id}</div>
            </div>
          </div>

          {node.headRevisionId && (
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-400">Head Revision</div>
                <div className="text-slate-300 font-mono text-[10px] truncate max-w-[180px]">
                  {node.headRevisionId}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <button
          onClick={() => {
            if (isDoc && node.webViewLink) {
              window.open(node.webViewLink, '_blank');
            } else {
              setActiveViewerNode(node);
            }
          }}
          className="w-full btn-primary py-2 text-xs"
        >
          {isDoc ? <ExternalLink className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isDoc ? 'Open in Google Drive' : 'Preview / Edit'}</span>
        </button>

        {!node.isFolder && !isDoc && (
          <button
            onClick={() => window.open(`/api/nodes/${encodeURIComponent(node.id)}/content?download=1`, '_blank')}
            className="w-full btn-secondary py-2 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
        )}
      </div>
    </aside>
  );
};
