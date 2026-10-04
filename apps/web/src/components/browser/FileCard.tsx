import React from 'react';
import { MoreVertical, Download, Eye } from 'lucide-react';
import { FileNodeDTO, formatBytes, formatDate, isGoogleDoc } from '@omnidrive/shared';
import { FileIcon } from '../common/FileIcon';
import { useUIStore } from '../../store/useUIStore';

interface FileCardProps {
  node: FileNodeDTO;
  isSelected: boolean;
  onOpen: (node: FileNodeDTO) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ node, isSelected, onOpen }) => {
  const { selectNode, setContextMenu, setSelectedFileForDetails } = useUIStore();
  const isDoc = isGoogleDoc(node.mimeType);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          selectNode(node.id, true);
        } else {
          selectNode(node.id, false);
          onOpen(node);
        }
      }}
      onContextMenu={handleContextMenu}
      className={`group relative p-4 rounded-2xl border transition-all duration-200 select-none cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-brand-500/15 border-brand-500 shadow-glow-sm ring-1 ring-brand-500/50'
          : 'bg-surface-900/40 hover:bg-surface-900/80 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {/* Top Header: Icon & Quick Actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl bg-surface-950 flex items-center justify-center border border-slate-800 group-hover:scale-105 transition-transform">
          <FileIcon mimeType={node.mimeType} name={node.name} isFolder={node.isFolder} className="w-5 h-5" />
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!node.isFolder && !isDoc && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/nodes/${encodeURIComponent(node.id)}/content?download=1`, '_blank');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center: File Title */}
      <div className="mb-3">
        <h4
          className="text-sm font-semibold text-slate-200 group-hover:text-white truncate"
          title={node.name}
        >
          {node.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          {node.accountLabel && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60 truncate max-w-[120px]">
              {node.accountLabel}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Size & Modified Date */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <span>{node.isFolder ? 'Folder' : formatBytes(node.size)}</span>
        <span>{formatDate(node.modifiedTime)}</span>
      </div>
    </div>
  );
};
