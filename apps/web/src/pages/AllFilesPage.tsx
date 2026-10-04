import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { useUIStore } from '../store/useUIStore';
import { FileCard } from '../components/browser/FileCard';
import { FileRow } from '../components/browser/FileRow';
import { Files, RefreshCw } from 'lucide-react';
import { FileNodeDTO } from '@omnidrive/shared';

export const AllFilesPage: React.FC = () => {
  const { viewMode, selectedNodeIds, setActiveViewerNode, searchQuery, searchType } = useUIStore();

  const { data: searchData, isLoading } = useQuery<{ items: FileNodeDTO[]; total: number }>({
    queryKey: ['allFiles', searchQuery, searchType],
    queryFn: () =>
      api.search.query({
        q: searchQuery,
        type: searchType,
      }),
  });

  const items: FileNodeDTO[] = searchData?.items || [];

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">All Files</h1>
        <p className="text-xs text-slate-400 mt-1">
          Unified merged file catalog spanning every linked Google Drive account.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 text-brand-400 animate-spin" />
          <span className="text-xs text-slate-400">Loading all files...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-glass">
            <Files className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-white mb-1">No files found</h3>
          <p className="text-xs text-slate-400">Upload or link accounts to populate files</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((node: FileNodeDTO) => (
            <FileCard
              key={node.id}
              node={node}
              isSelected={selectedNodeIds.includes(node.id)}
              onOpen={(n) => setActiveViewerNode(n)}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-surface-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Drive Account</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Kind</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((node: FileNodeDTO) => (
                <FileRow
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeIds.includes(node.id)}
                  onOpen={(n) => setActiveViewerNode(n)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
