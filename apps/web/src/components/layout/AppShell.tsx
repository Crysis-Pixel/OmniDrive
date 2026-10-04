import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DetailsPanel } from '../details/DetailsPanel';
import { ContextMenu } from '../browser/ContextMenu';
import { Modals } from '../browser/Modals';
import { ViewerModal } from '../preview/ViewerModal';
import { UploadManager } from '../upload/UploadManager';
import { TransfersDrawer } from '../transfers/TransfersDrawer';
import { useSSE } from '../../hooks/useSSE';

export const AppShell: React.FC = () => {
  const location = useLocation();

  // Activate SSE background listener
  useSSE();

  // Extract current parent from location if in folder
  let currentParentId = 'root';
  if (location.pathname.startsWith('/folder/')) {
    const raw = location.pathname.replace('/folder/', '');
    currentParentId = decodeURIComponent(raw);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-950 text-slate-100">
      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Content View */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Outlet />
      </main>

      {/* Collapsible Details Panel */}
      <DetailsPanel />

      {/* Floating Overlays & Modals */}
      <ContextMenu />
      <Modals currentParentId={currentParentId} />
      <ViewerModal />
      <UploadManager />
      <TransfersDrawer />
    </div>
  );
};
