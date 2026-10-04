import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useUploadStore } from '../../store/useUploadStore';
import { FileNodeDTO, NodeListingResponse } from '@omnidrive/shared';
import { AccountFolderCard } from './AccountFolderCard';
import { FileCard } from './FileCard';
import { FileRow } from './FileRow';
import { Plus, UploadCloud, FolderOpen, ArrowUpDown, Trash2 } from 'lucide-react';
import { api } from '../../api/endpoints';
import { useQueryClient } from '@tanstack/react-query';

interface FileBrowserProps {
  data?: NodeListingResponse;
  isLoading: boolean;
  onOpenFolder: (node: FileNodeDTO) => void;
  currentParentId: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  data,
  isLoading,
  onOpenFolder,
  currentParentId,
}) => {
  const queryClient = useQueryClient();
  const { viewMode, selectedNodeIds, clearSelection, setActiveViewerNode, openModal } = useUIStore();
  const { addUpload } = useUploadStore();
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['storage-summary'] });
    };
    window.addEventListener('omnidrive:refresh', handleRefresh);
    return () => window.removeEventListener('omnidrive:refresh', handleRefresh);
  }, [queryClient]);

  const handleDeleteSelected = async () => {
    if (selectedNodeIds.length === 0) return;
    const count = selectedNodeIds.length;
    if (confirm(`Move ${count} item${count > 1 ? 's' : ''} to trash?`)) {
      try {
        await Promise.all(selectedNodeIds.map((id) => api.nodes.delete(id)));
        clearSelection();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['nodes'] }),
          queryClient.invalidateQueries({ queryKey: ['trash'] }),
          queryClient.invalidateQueries({ queryKey: ['storage-summary'] }),
        ]);
      } catch (err: any) {
        console.error('Delete failed:', err);
        alert(err.message || 'Failed to move selected items to trash');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds]);

  // Drag and drop upload from desktop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Check if internal file move (dragged node ID)
    const draggedNodeId = e.dataTransfer.getData('text/plain');
    if (draggedNodeId && currentParentId !== 'root') {
      try {
        await api.nodes.move(draggedNodeId, currentParentId);
        queryClient.invalidateQueries({ queryKey: ['nodes'] });
        return;
      } catch (err) {
        console.warn('Move failed:', err);
      }
    }

    // Otherwise, external desktop file upload
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        addUpload(file, currentParentId);
      }
    }
  };

  const handleItemOpen = (node: FileNodeDTO) => {
    if (node.isFolder) {
      onOpenFolder(node);
    } else {
      setActiveViewerNode(node);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-400">Loading virtual file tree...</span>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const isRoot = data?.isRoot;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={clearSelection}
      className={`flex-1 p-6 overflow-y-auto relative transition-colors ${
        isDragOver ? 'bg-brand-500/5 ring-2 ring-inset ring-brand-500' : ''
      }`}
    >
      {/* Drag Over Overlay Alert */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-surface-950/70 backdrop-blur-sm">
          <div className="p-8 rounded-3xl glass-panel text-center animate-bounce">
            <UploadCloud className="w-12 h-12 text-brand-400 mx-auto mb-3" />
            <div className="text-lg font-bold text-white">Drop files to upload</div>
            <div className="text-xs text-slate-400">
              Files will be stored using your automatic placement strategy
            </div>
          </div>
        </div>
      )}

      {/* Case 1: Virtual Root (Accounts List) */}
      {isRoot ? (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Linked Drives</h2>
            <p className="text-xs text-slate-400 mt-1">
              Click on any drive to explore its folders and files, or upload directly to auto-distribute.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((node) => (
              <AccountFolderCard key={node.id} node={node} onOpen={handleItemOpen} />
            ))}

            {/* Add Account Card */}
            <div
              onClick={() => openModal('linkAccount')}
              className={`p-6 rounded-3xl border border-dashed border-slate-700/80 hover:border-brand-500/50 bg-surface-900/20 hover:bg-brand-500/5 cursor-pointer flex flex-col items-center justify-center text-center group transition-all duration-200 ${
                items.length === 0 ? 'col-span-full py-12 min-h-[220px]' : 'min-h-[170px]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-surface-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-brand-400 group-hover:scale-105 transition-all mb-4 shadow-sm">
                <Plus className="w-7 h-7" />
              </div>
              <div className="font-bold text-base text-slate-200 group-hover:text-white">
                {items.length === 0 ? 'Link Your Google Drive Account' : 'Link Another Drive'}
              </div>
              <div className="text-xs text-slate-400 mt-1 max-w-sm">
                {items.length === 0
                  ? 'Connect your personal or workspace Google Drive to start browsing, uploading, and managing your files.'
                  : 'Add another Google Drive account to expand your unified storage.'}
              </div>
              {items.length === 0 && (
                <button
                  type="button"
                  className="btn-primary py-2 px-5 text-xs font-semibold mt-4 pointer-events-none"
                >
                  <span>Connect Google Drive</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        // Empty Folder State
        <div className="h-full flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-glass">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">This folder is empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            Drag files from your computer and drop them here, or use the upload button above.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((node) => (
            <FileCard
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.includes(node.id)}
              onOpen={handleItemOpen}
            />
          ))}
        </div>
      ) : (
        // List Table View
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-surface-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Drive Account</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Kind</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((node) => (
                <FileRow
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeIds.includes(node.id)}
                  onOpen={handleItemOpen}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedNodeIds.length > 0 && !isRoot && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-900/95 border border-slate-700/80 backdrop-blur-xl shadow-2xl rounded-2xl px-5 py-2.5 flex items-center gap-4 animate-in slide-in-from-bottom duration-150">
          <span className="text-xs font-semibold text-slate-200">
            {selectedNodeIds.length} item{selectedNodeIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Move to Trash</span>
          </button>
          <button
            onClick={clearSelection}
            className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
};
