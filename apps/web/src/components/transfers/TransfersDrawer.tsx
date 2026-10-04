import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ArrowRight, ArrowLeftRight, CheckCircle2, AlertCircle, Ban, RefreshCw } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../api/endpoints';
import { formatBytes } from '@omnidrive/shared';

export const TransfersDrawer: React.FC = () => {
  const queryClient = useQueryClient();
  const { isTransfersOpen, setTransfersOpen } = useUIStore();

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: api.transfers.list,
    enabled: isTransfersOpen,
    refetchInterval: isTransfersOpen ? 3000 : false,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.list,
  });

  if (!isTransfersOpen) return null;

  const transfers = transfersData?.transfers || [];
  const accountsMap = new Map(accountsData?.accounts.map((a) => [a.id, a]) || []);

  const handleCancel = async (id: string) => {
    try {
      await api.transfers.cancel(id);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    } catch (err) {
      console.warn('Failed to cancel transfer:', err);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 glass-modal shadow-2xl border-l border-slate-700/80 p-5 flex flex-col justify-between animate-in slide-in-from-right duration-200">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-sm text-white">Cross-Account Transfers</h3>
          </div>
          <button
            onClick={() => setTransfersOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transfers List */}
        <div className="overflow-y-auto max-h-[calc(100vh-10rem)] space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
              <span className="text-xs text-slate-400">Loading transfers...</span>
            </div>
          ) : transfers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No cross-account transfer jobs currently active.
            </div>
          ) : (
            transfers.map((job) => {
              const srcAcc = accountsMap.get(job.srcAccount);
              const dstAcc = accountsMap.get(job.dstAccount);
              const isRunning = job.status === 'running' || job.status === 'queued';

              return (
                <div key={job.id} className="p-3.5 rounded-2xl bg-surface-900/60 border border-slate-800/80 text-xs">
                  {/* Account route */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-brand-400">
                      {job.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        job.status === 'done'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : job.status === 'failed'
                          ? 'bg-rose-500/15 text-rose-400'
                          : job.status === 'cancelled'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-brand-500/20 text-brand-300 animate-pulse'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300 text-[11px] mb-3">
                    <span className="truncate max-w-[120px]" title={srcAcc?.label || job.srcAccount}>
                      {srcAcc?.label || srcAcc?.email || 'Source Drive'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="truncate max-w-[120px]" title={dstAcc?.label || job.dstAccount}>
                      {dstAcc?.label || dstAcc?.email || 'Destination Drive'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        job.status === 'done'
                          ? 'bg-emerald-400'
                          : job.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-brand-500'
                      }`}
                      style={{ width: `${job.percentDone || (job.status === 'done' ? 100 : 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {job.bytesTotal
                        ? `${formatBytes(job.bytesDone)} / ${formatBytes(job.bytesTotal)}`
                        : job.status}
                    </span>

                    {isRunning && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="text-rose-400 hover:text-rose-300 font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80">
        <button
          onClick={() => setTransfersOpen(false)}
          className="w-full btn-secondary py-2 text-xs"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
};
