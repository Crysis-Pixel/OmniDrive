import React, { useState } from 'react';
import { Cloud, Lock, Mail, ArrowRight, Sparkles, CheckCircle2, Shield } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, isLoading, error } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      await register({ email, password });
    } else {
      await login({ email, password });
    }
  };

  const handleDemoLogin = async () => {
    // Quick demo login
    const demoUser = `demo_${Math.floor(Math.random() * 9000) + 1000}@omnidrive.io`;
    const demoPass = 'Password123!';
    try {
      await register({ email: demoUser, password: demoPass });
    } catch {
      await login({ email: demoUser, password: demoPass });
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col md:flex-row items-stretch text-slate-100 select-none">
      {/* Left Hero Brand Panel */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-surface-950 via-brand-950/40 to-surface-950 border-r border-slate-800/80">
        {/* Ambient glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-glow">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">OmniDrive</span>
            <span className="block text-[10px] uppercase tracking-wider text-brand-400 font-semibold">
              Unified Cloud File System
            </span>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="my-12 relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 shadow-glow-sm">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Multiple Google Drives. One Virtual Filesystem.</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
            Unite all your storage into one cohesive drive.
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-8">
            Connect personal and work Google Drives. Browse files seamlessly, edit code in-browser, and transfer folders across accounts with smart automatic placement.
          </p>

          <div className="space-y-3 text-xs md:text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Smart upload placement (Most Free Space or Fill-First)</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>In-browser Monaco text & code editor with revision conflict detection</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Cross-account background copy and move streaming</span>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400 relative z-10">
          <Shield className="w-4 h-4 text-brand-400" />
          <span>Tokens encrypted with AES-256-GCM. Render cloud ready.</span>
        </div>
      </div>

      {/* Right Login / Register Card */}
      <div className="w-full md:w-[480px] p-8 md:p-12 flex flex-col justify-center bg-surface-950/90 backdrop-blur-2xl">
        <div className="max-w-sm w-full mx-auto">
          {/* Mode Switch Tabs */}
          <div className="flex bg-surface-900 border border-slate-800 rounded-2xl p-1 mb-8">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                !isRegister ? 'bg-brand-500 text-white shadow-glow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                isRegister ? 'bg-brand-500 text-white shadow-glow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {isRegister ? 'Get started with OmniDrive' : 'Welcome back'}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {isRegister
              ? 'Create your account to start unifying your cloud drives'
              : 'Enter your credentials to access your unified files'}
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-sm mt-2"
            >
              <span>{isLoading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instant 1-Click Demo Explore Button */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-900 hover:bg-slate-800 border border-slate-700/80 hover:border-brand-500/40 text-xs font-semibold text-brand-300 flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>1-Click Instant Demo Access (Preloaded Drives)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
