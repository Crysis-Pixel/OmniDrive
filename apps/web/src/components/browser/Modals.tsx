import React, { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  X,
  FolderPlus,
  Edit2,
  FolderInput,
  Copy,
  PlusCircle,
  HardDrive,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../api/endpoints';

interface ModalsProps {
  currentParentId: string;
}

export const Modals: React.FC<ModalsProps> = ({ currentParentId }) => {
  const queryClient = useQueryClient();
  const { activeModal, modalTargetNode, closeModal } = useUIStore();

  const [folderName, setFolderName] = useState('');
  const [renameValue, setRenameValue] = useState(modalTargetNode?.name || '');
  const [targetDestination, setTargetDestination] = useState<string>('');
  const [collisionPolicy, setCollisionPolicy] = useState<'keep_both' | 'replace' | 'skip'>('keep_both');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoLabel, setDemoLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Accounts list for destination pickers
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.list,
  });

  const { data: connectUrlData } = useQuery({
    queryKey: ['connectUrl'],
    queryFn: api.accounts.getConnectUrl,
    enabled: activeModal === 'linkAccount',
  });

  if (!activeModal) return null;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['nodes'] });
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  // 1. Create New Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.nodes.createFolder(currentParentId, folderName.trim());
      setFolderName('');
      closeModal();
      refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Rename File/Folder
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTargetNode || !renameValue.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.nodes.rename(modalTargetNode.id, renameValue.trim());
      closeModal();
      refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rename');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Move File/Folder
  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTargetNode || !targetDestination) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.nodes.move(modalTargetNode.id, targetDestination, collisionPolicy);
      closeModal();
      refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to move');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Copy File/Folder
  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTargetNode || !targetDestination) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.nodes.copy(modalTargetNode.id, targetDestination, undefined, collisionPolicy);
      closeModal();
      refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to copy');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Add Demo Account
  const handleAddDemoAccount = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.accounts.addDemoAccount(demoEmail || undefined, demoLabel || undefined);
      closeModal();
      refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add demo account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md glass-modal rounded-3xl p-6 shadow-2xl border border-slate-700/60 animate-in zoom-in-95 duration-200">
        <button
          onClick={closeModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal 1: New Folder */}
        {activeModal === 'newFolder' && (
          <form onSubmit={handleCreateFolder}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">New Folder</h3>
                <p className="text-xs text-slate-400">Create a folder in the current directory</p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="Folder Name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 mb-5"
            />

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-secondary py-2 text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !folderName.trim()}
                className="btn-primary py-2 text-xs"
              >
                {isSubmitting ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        )}

        {/* Modal 2: Rename */}
        {activeModal === 'rename' && modalTargetNode && (
          <form onSubmit={handleRename}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Rename</h3>
                <p className="text-xs text-slate-400">Enter a new name for this item</p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              defaultValue={modalTargetNode.name}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 mb-5"
            />

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-secondary py-2 text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !renameValue.trim()}
                className="btn-primary py-2 text-xs"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Modal 3: Move to Destination */}
        {activeModal === 'move' && modalTargetNode && (
          <form onSubmit={handleMove}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <FolderInput className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Move Item</h3>
                <p className="text-xs text-slate-400">
                  Moving: <span className="text-slate-200 font-semibold">{modalTargetNode.name}</span>
                </p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Destination Drive / Folder
            </label>
            <select
              value={targetDestination}
              onChange={(e) => setTargetDestination(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 mb-4"
            >
              <option value="">-- Choose destination drive --</option>
              {accountsData?.accounts.map((acc) => (
                <option key={acc.id} value={`${acc.id}:root`}>
                  Drive: {acc.label || acc.email} (Root)
                </option>
              ))}
            </select>

            {/* Collision Policy */}
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              If File Already Exists at Destination
            </label>
            <div className="grid grid-cols-3 gap-2 mb-5 text-xs">
              <button
                type="button"
                onClick={() => setCollisionPolicy('keep_both')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  collisionPolicy === 'keep_both'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-300 font-semibold'
                    : 'border-slate-800 bg-surface-950 text-slate-400'
                }`}
              >
                Keep Both (1)
              </button>
              <button
                type="button"
                onClick={() => setCollisionPolicy('replace')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  collisionPolicy === 'replace'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-300 font-semibold'
                    : 'border-slate-800 bg-surface-950 text-slate-400'
                }`}
              >
                Overwrite
              </button>
              <button
                type="button"
                onClick={() => setCollisionPolicy('skip')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  collisionPolicy === 'skip'
                    ? 'border-brand-500 bg-brand-500/20 text-brand-300 font-semibold'
                    : 'border-slate-800 bg-surface-950 text-slate-400'
                }`}
              >
                Skip
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-secondary py-2 text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !targetDestination}
                className="btn-primary py-2 text-xs"
              >
                {isSubmitting ? 'Queuing Transfer...' : 'Move'}
              </button>
            </div>
          </form>
        )}

        {/* Modal 4: Copy */}
        {activeModal === 'copy' && modalTargetNode && (
          <form onSubmit={handleCopy}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Make a Copy</h3>
                <p className="text-xs text-slate-400">
                  Copying: <span className="text-slate-200 font-semibold">{modalTargetNode.name}</span>
                </p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Destination Drive
            </label>
            <select
              value={targetDestination}
              onChange={(e) => setTargetDestination(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 mb-5"
            >
              <option value="">-- Choose destination drive --</option>
              {accountsData?.accounts.map((acc) => (
                <option key={acc.id} value={`${acc.id}:root`}>
                  Drive: {acc.label || acc.email} (Root)
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-secondary py-2 text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !targetDestination}
                className="btn-primary py-2 text-xs"
              >
                {isSubmitting ? 'Copying...' : 'Copy'}
              </button>
            </div>
          </form>
        )}

        {/* Modal 5: Link Account */}
        {activeModal === 'linkAccount' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center shadow-glow-sm">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Link Google Drive Account</h3>
                <p className="text-xs text-slate-400">Add another storage account to your unified system</p>
              </div>
            </div>

            {/* Option A: Real Google OAuth */}
            {connectUrlData?.isConfigured && connectUrlData.url ? (
              <a
                href={connectUrlData.url}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md active:scale-98 mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </a>
            ) : (
              <div className="p-3 rounded-2xl bg-surface-950 border border-slate-800 text-xs text-slate-400 mb-4">
                <span className="font-semibold text-slate-300">Live OAuth Note:</span> Google Cloud Client ID not set in environment. You can instantly test and explore all unified drive features with Simulated Demo Drives below!
              </div>
            )}

            {/* Option B: Simulated Demo Drive */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-brand-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instant Demo Account (Zero Setup)</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Instantly spawn a realistic 15 GB or 30 GB Google Drive account with sample files and quota.
              </p>

              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  placeholder="Custom Label (e.g. Work Drive 2)"
                  value={demoLabel}
                  onChange={(e) => setDemoLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="button"
                onClick={handleAddDemoAccount}
                disabled={isSubmitting}
                className="w-full btn-secondary py-2.5 text-xs text-brand-300 border-brand-500/30 hover:bg-brand-500/10 flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-brand-400" />
                <span>{isSubmitting ? 'Spawning Drive...' : 'Add Simulated Demo Drive'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
