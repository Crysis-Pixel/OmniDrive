import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Files,
  Trash2,
  ArrowLeftRight,
  Database,
  Cloud,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { useUIStore } from '../../store/useUIStore';
import { formatBytes } from '@omnidrive/shared';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { isTransfersOpen, setTransfersOpen, openModal } = useUIStore();

  const { data: storage } = useQuery({
    queryKey: ['storage'],
    queryFn: api.storage.getSummary,
    refetchInterval: 30000,
  });

  const { data: transfersData } = useQuery({
    queryKey: ['transfers'],
    queryFn: api.transfers.list,
    refetchInterval: 5000,
  });

  const activeTransfersCount =
    transfersData?.transfers.filter((t) => t.status === 'running' || t.status === 'queued').length || 0;

  const navItems = [
    { label: 'My Files', to: '/', icon: HardDrive, end: true },
    { label: 'All Files', to: '/all', icon: Files },
    { label: 'Trash', to: '/trash', icon: Trash2 },
    { label: 'Accounts & Quota', to: '/accounts', icon: Database },
  ];

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-screen border-r border-slate-800/80 bg-surface-950/80 backdrop-blur-xl select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800/60">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform duration-200">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              OmniDrive
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-brand-400 font-semibold">
              Unified Storage
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          File System
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="pt-4 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Operations
        </div>

        {/* Transfers Drawer Toggle Button */}
        <button
          onClick={() => setTransfersOpen(!isTransfersOpen)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
            isTransfersOpen
              ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transfers</span>
          </div>
          {activeTransfersCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-500 text-white animate-pulse">
              {activeTransfersCount}
            </span>
          )}
        </button>

        {/* Quick Link Drive Action */}
        <button
          onClick={() => openModal('linkAccount')}
          className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 border border-dashed border-slate-700/60 hover:border-brand-500/40 transition-all duration-150"
        >
          <PlusCircle className="w-4 h-4 text-brand-400" />
          <span>Link Drive Account</span>
        </button>
      </nav>

      {/* Storage Capacity Widget */}
      <div className="p-4 border-t border-slate-800/60 bg-surface-900/40">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400 font-medium">Storage Quota</span>
          <span className="text-slate-200 font-bold">
            {storage ? `${storage.totalPercentUsed}%` : '--'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-sky-400 transition-all duration-500"
            style={{ width: `${storage ? Math.min(100, storage.totalPercentUsed) : 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{storage ? formatBytes(storage.totalUsage) : '--'} used</span>
          <span>{storage ? formatBytes(storage.totalLimit) : '--'}</span>
        </div>

        <button
          onClick={() => navigate('/accounts')}
          className="mt-3 w-full py-1.5 px-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg flex items-center justify-center gap-1 transition-colors"
        >
          <span>Manage Drives</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};
