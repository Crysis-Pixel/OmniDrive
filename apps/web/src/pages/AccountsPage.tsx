import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive,
  RefreshCw,
  Trash2,
  Edit2,
  PlusCircle,
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../api/endpoints';
import { useUIStore } from '../store/useUIStore';
import { formatBytes, LinkedAccountDTO, StorageSummaryResponse } from '@omnidrive/shared';
import { useAuthStore } from '../store/useAuthStore';

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { openModal } = useUIStore();
  const { user, updateSettings } = useAuthStore();

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: storageData, isLoading: isStorageLoading } = useQuery<StorageSummaryResponse>({
    queryKey: ['storage'],
    queryFn: api.storage.getSummary,
  });

  const { data: accountsData, isLoading: isAccountsLoading } = useQuery<{ accounts: LinkedAccountDTO[] }>({
    queryKey: ['accounts'],
    queryFn: api.accounts.list,
  });

  const currentStrategy = user?.settings?.uploadStrategy || 'most_free';

  const handleSyncAccount = async (id: string) => {
    setSyncingId(id);
    try {
      await api.accounts.sync(id);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    } finally {
      setSyncingId(null);
    }
  };

  const handleUnlink = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to unlink ${name}? This will remove cached files from OmniDrive.`)) {
      await api.accounts.unlink(id);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
    }
  };

  const handleSaveLabel = async (id: string) => {
    await api.accounts.update(id, { label: editingLabel.trim() || null });
    setEditingAccountId(null);
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['nodes'] });
  };

  const handleStrategyChange = async (strategy: 'most_free' | 'fill_first' | 'manual') => {
    await updateSettings({ uploadStrategy: strategy });
  };

  const accounts = accountsData?.accounts || [];

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Drives & Storage Quota</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your linked Google Drive accounts, monitor quotas, and customize upload routing.
          </p>
        </div>
        <button
          onClick={() => openModal('linkAccount')}
          className="btn-primary py-2 px-4 text-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Link Another Drive</span>
        </button>
      </div>

      {/* 1. Combined Storage Dashboard */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Unified Storage Capacity</h2>
            <p className="text-xs text-slate-400">Total combined storage across all active linked accounts</p>
          </div>
        </div>

        {storageData ? (
          <div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-3">
              <div>
                <span className="text-3xl font-extrabold text-white">
                  {formatBytes(storageData.totalUsage)}
                </span>
                <span className="text-sm text-slate-400 ml-2">
                  used of {formatBytes(storageData.totalLimit)} total
                </span>
              </div>
              <div className="text-xs font-semibold text-brand-400">
                {formatBytes(storageData.totalFree)} free space remaining ({100 - storageData.totalPercentUsed}%)
              </div>
            </div>

            {/* Combined Segmented Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-sky-400 transition-all duration-500"
                style={{ width: `${Math.min(100, storageData.totalPercentUsed)}%` }}
              />
            </div>

            {/* Per-account mini pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-slate-800/60">
              {storageData.accounts.map((acc) => (
                <div key={acc.accountId} className="p-3 rounded-2xl bg-surface-900/60 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 truncate">{acc.label || acc.email}</span>
                    <span className="text-[11px] font-bold text-slate-300">{acc.percentUsed}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${acc.percentUsed}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {formatBytes(acc.usage)} / {formatBytes(acc.limit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">Loading quota metrics...</div>
        )}
      </div>

      {/* 2. Upload Placement Strategy Settings */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-1">Upload Placement Strategy</h2>
        <p className="text-xs text-slate-400 mb-5">
          Controls how files uploaded to the virtual root or "All Files" view are routed to your linked accounts.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => handleStrategyChange('most_free')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              currentStrategy === 'most_free'
                ? 'bg-brand-500/15 border-brand-500 shadow-glow-sm ring-1 ring-brand-500/40'
                : 'bg-surface-900/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2 font-bold text-sm text-white">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Most Free Space (Default)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatically selects the drive with the highest remaining free capacity that can fit the file.
            </p>
          </div>

          <div
            onClick={() => handleStrategyChange('fill_first')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              currentStrategy === 'fill_first'
                ? 'bg-brand-500/15 border-brand-500 shadow-glow-sm ring-1 ring-brand-500/40'
                : 'bg-surface-900/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2 font-bold text-sm text-white">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Fill-First Priority</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fills drives sequentially based on your defined priority order until each drive reaches full capacity.
            </p>
          </div>

          <div
            onClick={() => handleStrategyChange('manual')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              currentStrategy === 'manual'
                ? 'bg-brand-500/15 border-brand-500 shadow-glow-sm ring-1 ring-brand-500/40'
                : 'bg-surface-900/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2 font-bold text-sm text-white">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>Manual Placement</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Always prompts you to pick a specific account and folder for each upload.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Linked Accounts List */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-4">Linked Accounts ({accounts.length})</h2>

        <div className="space-y-4">
          {accounts.map((acc) => {
            const isSyncing = syncingId === acc.id;
            const isEditing = editingAccountId === acc.id;

            return (
              <div
                key={acc.id}
                className="p-5 rounded-2xl bg-surface-900/50 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-950 border border-slate-800 flex items-center justify-center text-brand-400 flex-shrink-0 shadow-sm">
                    <HardDrive className="w-6 h-6" />
                  </div>

                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="px-2.5 py-1 bg-surface-950 border border-brand-500 rounded-lg text-sm text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveLabel(acc.id)}
                          className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingAccountId(null)}
                          className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">{acc.label || acc.displayName || acc.email}</h4>
                        <button
                          onClick={() => {
                            setEditingAccountId(acc.id);
                            setEditingLabel(acc.label || '');
                          }}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                          title="Rename alias"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-slate-400">{acc.email}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {formatBytes(acc.quotaUsage)} used of {formatBytes(acc.quotaLimit)} ({acc.percentUsed}%)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncAccount(acc.id)}
                    disabled={isSyncing}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-400' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    onClick={() => handleUnlink(acc.id, acc.label || acc.email)}
                    className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-transparent transition-colors"
                    title="Unlink Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
