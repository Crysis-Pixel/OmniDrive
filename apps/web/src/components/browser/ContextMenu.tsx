import React, { useEffect, useRef } from 'react';
import {
  Eye,
  Download,
  Edit2,
  FolderInput,
  Copy,
  Trash2,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { isGoogleDoc } from '@omnidrive/shared';
import { api } from '../../api/endpoints';
import { useQueryClient } from '@tanstack/react-query';

export const ContextMenu: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeContextMenu,
    setContextMenu,
    setActiveViewerNode,
    openModal,
    setSelectedFileForDetails,
  } = useUIStore();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', () => setContextMenu(null));
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [setContextMenu]);

  if (!activeContextMenu) return null;

  const { x, y, node } = activeContextMenu;
  const isDoc = isGoogleDoc(node.mimeType);

  const handleOpen = () => {
    setContextMenu(null);
    if (isDoc && node.webViewLink) {
      window.open(node.webViewLink, '_blank');
    } else {
      setActiveViewerNode(node);
    }
  };

  const handleDownload = () => {
    setContextMenu(null);
    window.open(`/api/nodes/${encodeURIComponent(node.id)}/content?download=1`, '_blank');
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-50 w-52 glass-panel rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 truncate border-b border-slate-800/80 mb-1">
        {node.name}
      </div>

      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
      >
        {isDoc ? <ExternalLink className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5 text-brand-400" />}
        <span>{isDoc ? 'Open in Google Drive' : 'Open / Preview'}</span>
      </button>

      {!node.isFolder && !isDoc && (
        <button
          onClick={handleDownload}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Download</span>
        </button>
      )}

      <div className="my-1 border-t border-slate-800/80" />

      <button
        onClick={() => {
          setContextMenu(null);
          openModal('rename', node);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
      >
        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
        <span>Rename</span>
      </button>

      <button
        onClick={() => {
          setContextMenu(null);
          openModal('move', node);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
      >
        <FolderInput className="w-3.5 h-3.5 text-indigo-400" />
        <span>Move to...</span>
      </button>

      <button
        onClick={() => {
          setContextMenu(null);
          openModal('copy', node);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-purple-400" />
        <span>Make a copy</span>
      </button>

      <div className="my-1 border-t border-slate-800/80" />

      <button
        onClick={() => {
          setContextMenu(null);
          setSelectedFileForDetails(node);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <span>Details & Info</span>
      </button>

      <button
        onClick={async () => {
          setContextMenu(null);
          try {
            await api.nodes.delete(node.id);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['nodes'] }),
              queryClient.invalidateQueries({ queryKey: ['trash'] }),
              queryClient.invalidateQueries({ queryKey: ['storage-summary'] }),
            ]);
          } catch (err: any) {
            console.error('Failed to move to trash:', err);
            alert(err.message || 'Failed to move to trash');
          }
        }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 rounded-xl transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Move to Trash</span>
      </button>
    </div>
  );
};
