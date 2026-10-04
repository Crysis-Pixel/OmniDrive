import React from 'react';
import { HardDrive, RefreshCw, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { FileNodeDTO, formatBytes } from '@omnidrive/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';

interface AccountFolderCardProps {
  node: FileNodeDTO;
  onOpen: (node: FileNodeDTO) => void;
}

export const AccountFolderCard: React.FC<AccountFolderCardProps> = ({ node, onOpen }) => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    try {
      await api.accounts.sync(node.accountId);
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      onDoubleClick={() => onOpen(node)}
      className="group relative p-5 rounded-3xl glass-card hover:bg-surface-900/80 cursor-pointer transition-all duration-300 hover:shadow-glow-sm hover:-translate-y-0.5 border border-slate-800/80"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-glow-sm group-hover:scale-105 transition-transform">
          <HardDrive className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Sync metadata"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-400' : ''}`} />
          </button>
          <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors truncate">
          {node.name}
        </h4>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {node.accountEmail || node.name}
        </p>
      </div>

      {/* Enter Folder Link Button */}
      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-brand-400 group-hover:text-brand-300 font-medium">
        <span>Browse files</span>
        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </div>
    </div>
  );
};
