import React, { useRef, useState } from 'react';
import {
  Search,
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
  Info,
  ChevronDown,
  LogOut,
  Sparkles,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useUploadStore } from '../../store/useUploadStore';
import { BreadcrumbItem } from '@omnidrive/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/endpoints';

interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  onNavigateBreadcrumb?: (id: string) => void;
  currentParentId: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  breadcrumbs = [],
  onNavigateBreadcrumb,
  currentParentId,
}) => {
  const {
    viewMode,
    setViewMode,
    openModal,
    isDetailsOpen,
    toggleDetails,
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
  } = useUIStore();

  const { user, logout } = useAuthStore();
  const { addUpload } = useUploadStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'most_free' | 'fill_first' | 'manual'>('most_free');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.list,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        addUpload(file, currentParentId, selectedStrategy, selectedAccountId);
      }
      e.target.value = '';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-surface-950/70 backdrop-blur-xl px-6 flex items-center justify-between gap-4 z-20">
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Left: Breadcrumbs Chain */}
      <div className="flex items-center gap-1.5 text-sm overflow-x-auto py-1 max-w-md">
        {breadcrumbs.length === 0 ? (
          <span className="font-semibold text-slate-200">My Drives</span>
        ) : (
          breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <span className="text-slate-600">/</span>}
                <button
                  onClick={() => onNavigateBreadcrumb && onNavigateBreadcrumb(crumb.id)}
                  disabled={isLast}
                  className={`truncate max-w-[140px] px-2 py-1 rounded-lg transition-colors ${
                    isLast
                      ? 'font-semibold text-white bg-slate-800/40 cursor-default'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={crumb.name}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Center: Search Box */}
      <div className="flex-1 max-w-lg relative flex items-center">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search across all linked drives... (type to search)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-24 py-1.5 bg-surface-900/80 border border-slate-700/60 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
          {/* Filter Type Selector */}
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent text-[11px] text-slate-400 hover:text-slate-200 border-none outline-none cursor-pointer pr-1"
          >
            <option value="all" className="bg-surface-900 text-slate-200">All</option>
            <option value="document" className="bg-surface-900 text-slate-200">Docs</option>
            <option value="spreadsheet" className="bg-surface-900 text-slate-200">Sheets</option>
            <option value="pdf" className="bg-surface-900 text-slate-200">PDF</option>
            <option value="image" className="bg-surface-900 text-slate-200">Images</option>
            <option value="code" className="bg-surface-900 text-slate-200">Code</option>
          </select>
        </div>
      </div>

      {/* Right: Actions, View Toggles & User Menu */}
      <div className="flex items-center gap-2">
        {/* Upload Button with Strategy Dropdown */}
        <div className="relative">
          <div className="inline-flex rounded-xl shadow-glow-sm">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary rounded-r-none pr-3 text-sm py-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
            <button
              onClick={() => setUploadMenuOpen(!isUploadMenuOpen)}
              className="bg-brand-600 hover:bg-brand-500 text-white px-2 rounded-r-xl border-l border-brand-700/50 flex items-center justify-center transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Upload Strategy Menu */}
          {isUploadMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Upload Placement Strategy
              </div>
              <button
                onClick={() => {
                  setSelectedStrategy('most_free');
                  setSelectedAccountId(undefined);
                  setUploadMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                  selectedStrategy === 'most_free' && !selectedAccountId
                    ? 'bg-brand-500/20 text-brand-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <div>
                    <div>Most Free Space (Auto)</div>
                    <div className="text-[10px] text-slate-400 font-normal">Places in highest capacity drive</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedStrategy('fill_first');
                  setSelectedAccountId(undefined);
                  setUploadMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                  selectedStrategy === 'fill_first' && !selectedAccountId
                    ? 'bg-brand-500/20 text-brand-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <div>
                    <div>Fill-First Order</div>
                    <div className="text-[10px] text-slate-400 font-normal">Fills drives by priority order</div>
                  </div>
                </div>
              </button>

              {/* Explicit Account Choice */}
              {accountsData && accountsData.accounts.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-800/80 mt-1">
                    Or Upload to Specific Drive
                  </div>
                  {accountsData.accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedStrategy('manual');
                        setSelectedAccountId(acc.id);
                        setUploadMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                        selectedAccountId === acc.id
                          ? 'bg-brand-500/20 text-brand-400 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {acc.label || acc.email}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* New Folder Button */}
        <button
          onClick={() => openModal('newFolder')}
          className="btn-secondary py-1.5 px-3 text-sm"
        >
          <FolderPlus className="w-4 h-4 text-amber-400" />
          <span>New Folder</span>
        </button>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-surface-900 border border-slate-700/60 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-brand-500 text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-brand-500 text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Details Toggle Button */}
        <button
          onClick={toggleDetails}
          className={`p-2 rounded-xl border border-slate-700/60 transition-colors ${
            isDetailsOpen
              ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
              : 'bg-surface-900 text-slate-400 hover:text-slate-200'
          }`}
          title="Details Panel"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-glow-sm">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-panel rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                <div className="text-xs font-semibold text-slate-200 truncate">{user?.email}</div>
                <div className="text-[10px] text-slate-400">OmniDrive Member</div>
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
