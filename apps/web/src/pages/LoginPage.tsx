import React, { useState } from 'react';
import { Cloud, Lock, Mail, ArrowRight, Sparkles, CheckCircle2, Shield } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../api/endpoints';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleTabSwitch = (toRegister: boolean) => {
    setIsRegister(toRegister);
    setGoogleError(null);
    clearError();
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    clearError();
    try {
      const res = await api.auth.getGoogleAuthUrl();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Failed to start Google authentication');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await register({ email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
    } catch {
      // Error is set in auth store
    }
  };

  const handleDemoLogin = async () => {
    clearError();
    try {
      await login({ email: 'demo@omnidrive.io', password: 'DemoUser123!' });
    } catch {
      try {
        await register({ email: 'demo@omnidrive.io', password: 'DemoUser123!' });
      } catch {
        await login({ email: 'demo@omnidrive.io', password: 'Password123!' });
      }
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@omnidrive.io');
    setPassword('DemoUser123!');
    setIsRegister(false);
    clearError();
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
          <div className="w-11 h-11 rounded-2xl bg-surface-900 border border-slate-700/60 p-1.5 flex items-center justify-center shadow-glow">
            <img src="/logo.svg" alt="OmniDrive" className="w-full h-full object-contain" />
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
              type="button"
              onClick={() => handleTabSwitch(false)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                !isRegister ? 'bg-brand-500 text-white shadow-glow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch(true)}
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
              ? 'Create a new account (email & password minimum 8 characters)'
              : 'Sign in to access your unified drives and files'}
          </p>

          {(error || googleError) && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1.5 animate-fade-in">
              <p className="font-semibold">{error || googleError}</p>
              {error && error.toLowerCase().includes('invalid email or password') && (
                <p className="text-[11px] opacity-90">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch(true)}
                    className="underline font-bold text-white hover:text-brand-300"
                  >
                    Click here to Create Account
                  </button>
                </p>
              )}
              {error && error.toLowerCase().includes('already exists') && (
                <p className="text-[11px] opacity-90">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabSwitch(false)}
                    className="underline font-bold text-white hover:text-brand-300"
                  >
                    Click here to Sign In
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Direct Sign in with Google */}
          <div className="space-y-4 mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs md:text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
              <span>
                {isGoogleLoading
                  ? 'Connecting to Google...'
                  : isRegister
                  ? 'Sign up with Google'
                  : 'Sign in with Google'}
              </span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-surface-950 px-2.5 text-slate-500 font-semibold tracking-wider">
                  Or continue with email
                </span>
              </div>
            </div>
          </div>

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
              {isRegister && (
                <p className="text-[11px] text-slate-400 mt-1">Must be at least 8 characters long</p>
              )}
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
          <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-2">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-900 hover:bg-slate-800 border border-slate-700/80 hover:border-brand-500/40 text-xs font-semibold text-brand-300 flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>1-Click Instant Demo Access</span>
            </button>
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Or fill default demo credentials (demo@omnidrive.io)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
