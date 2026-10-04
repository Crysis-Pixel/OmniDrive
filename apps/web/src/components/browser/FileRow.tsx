import React from 'react';
import { MoreVertical, Download, Eye, ExternalLink } from 'lucide-react';
import { FileNodeDTO, formatBytes, formatDate, isGoogleDoc, getFileTypeCategory } from '@omnidrive/shared';
import { FileIcon } from '../common/FileIcon';
import { useUIStore } from '../../store/useUIStore';

interface FileRowProps {
  node: FileNodeDTO;
  isSelected: boolean;
  onOpen: (node: FileNodeDTO) => void;
}

export const FileRow: React.FC<FileRowProps> = ({ node, isSelected, onOpen }) => {
  const { selectNode, setContextMenu } = useUIStore();
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
    <tr
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(node.id, e.ctrlKey || e.metaKey || e.shiftKey);
      }}
      onDoubleClick={() => onOpen(node)}
      onContextMenu={handleContextMenu}
      className={`group select-none cursor-pointer border-b border-slate-800/60 transition-colors ${
        isSelected
          ? 'bg-brand-500/15 text-white'
          : 'hover:bg-surface-900/60 text-slate-300'
      }`}
    >
      {/* Name Column */}
      <td className="py-3 px-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-950 flex items-center justify-center border border-slate-800/80 flex-shrink-0">
          <FileIcon mimeType={node.mimeType} name={node.name} isFolder={node.isFolder} className="w-4 h-4" />
        </div>
        <span className="font-medium text-sm text-slate-200 group-hover:text-white truncate max-w-xs md:max-w-md">
          {node.name}
        </span>
      </td>

      {/* Account Badge */}
      <td className="py-3 px-4 text-xs">
        {node.accountLabel ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60">
            {node.accountLabel}
          </span>
        ) : (
          <span className="text-slate-400">--</span>
        )}
      </td>

      {/* Size Column */}
      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
        {node.isFolder ? '--' : formatBytes(node.size)}
      </td>

      {/* Type Column */}
      <td className="py-3 px-4 text-xs text-slate-400 capitalize whitespace-nowrap">
        {getFileTypeCategory(node.mimeType, node.name)}
      </td>

      {/* Modified Date */}
      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
        {formatDate(node.modifiedTime)}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </td>
    </tr>
  );
};
