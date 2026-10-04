import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { AppShell } from './components/layout/AppShell';
import { BrowserPage } from './pages/BrowserPage';
import { AllFilesPage } from './pages/AllFilesPage';
import { TrashPage } from './pages/TrashPage';
import { AccountsPage } from './pages/AccountsPage';
import { LoginPage } from './pages/LoginPage';

export const App: React.FC = () => {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 animate-pulse shadow-glow" />
          <span className="text-xs font-semibold text-slate-400">Initializing OmniDrive...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected Routes */}
      <Route
        element={user ? <AppShell /> : <Navigate to="/login" replace />}
      >
        <Route path="/" element={<BrowserPage />} />
        <Route path="/folder/:folderId" element={<BrowserPage />} />
        <Route path="/all" element={<AllFilesPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
