import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api/endpoints';
import { FileIcon } from '../components/common/FileIcon';
import { formatBytes, formatDate, FileNodeDTO } from '@omnidrive/shared';

export const TrashPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: trashData, isLoading } = useQuery<{ items: FileNodeDTO[] }>({
    queryKey: ['trash'],
    queryFn: api.trash.list,
  });

  const handleRestore = async (nodeId: string) => {
    await api.nodes.restore(nodeId);
    queryClient.invalidateQueries({ queryKey: ['trash'] });
    queryClient.invalidateQueries({ queryKey: ['nodes'] });
    queryClient.invalidateQueries({ queryKey: ['storage'] });
  };

  const handlePermanentDelete = async (nodeId: string) => {
    if (confirm('Permanently delete this file from Google Drive? This cannot be undone.')) {
      await api.nodes.delete(nodeId, true);
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm('Are you sure you want to empty the trash across all linked accounts? This is permanent.')) {
      await api.trash.empty();
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    }
  };

  const items = trashData?.items || [];

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Trash</h1>
          <p className="text-xs text-slate-400 mt-1">
            Items in trash still consume storage quota until emptied permanently.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="btn-secondary py-2 px-4 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 text-brand-400 animate-spin" />
          <span className="text-xs text-slate-400">Loading trash...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-glass">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-white mb-1">Trash is empty</h3>
          <p className="text-xs text-slate-400">Items moved to trash will appear here</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-surface-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Drive Account</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Trashed Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((node) => (
                <tr key={node.id} className="border-b border-slate-800/60 hover:bg-surface-900/50 text-xs">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <FileIcon mimeType={node.mimeType} name={node.name} isFolder={node.isFolder} className="w-4 h-4" />
                    <span className="font-semibold text-slate-200">{node.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {node.accountLabel || node.accountEmail || node.accountId}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{formatBytes(node.size)}</td>
                  <td className="py-3 px-4 text-slate-400">{formatDate(node.modifiedTime)}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleRestore(node.id)}
                      className="px-2.5 py-1 rounded-lg bg-surface-800 hover:bg-slate-700 text-brand-300 font-medium text-xs inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(node.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
