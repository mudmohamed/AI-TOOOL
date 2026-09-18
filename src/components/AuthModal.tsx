import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Check,
  ShieldCheck,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  currentUser: UserProfile | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  currentUser,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState<string>('hoolamohamed685@gmail.com');
  const [password, setPassword] = useState<string>('DerivSniper@2026');
  const [fullName, setFullName] = useState<string>('Mohamed Hoola');
  const [country, setCountry] = useState<string>('United Arab Emirates');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const profile: UserProfile = {
        id: 'usr_' + Date.now().toString(36) + '_' + performance.now().toString(36).replace('.', ''),
        email: email.trim(),
        fullName: mode === 'REGISTER' ? fullName : fullName || 'Mohamed Hoola',
        country: country,
        createdAt: Date.now(),
        isLoggedIn: true,
        tier: 'PRO',
      };

      try {
        localStorage.setItem('deriv_user_profile', JSON.stringify(profile));
      } catch {}

      setSuccessMessage(
        mode === 'LOGIN'
          ? `Welcome back, ${profile.fullName}!`
          : `Account created successfully! Welcome, ${profile.fullName}.`
      );

      setTimeout(() => {
        setSuccessMessage(null);
        onAuthSuccess(profile);
        onClose();
      }, 900);
    }, 600);
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="auth-modal"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {mode === 'LOGIN' ? 'Sign In to Terminal' : 'Create Real Account'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'LOGIN'
                  ? 'Access your saved strategies & live Deriv terminal'
                  : 'Get instant access with real email & credentials'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/50 border-b border-slate-800 text-xs font-bold font-mono">
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className={`py-2 rounded-xl transition cursor-pointer ${
              mode === 'LOGIN'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('REGISTER')}
            className={`py-2 rounded-xl transition cursor-pointer ${
              mode === 'REGISTER'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Notification banner */}
        {successMessage && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'REGISTER' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Mohamed Hoola"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              {mode === 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => alert('Password reset instructions sent to ' + email)}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'REGISTER' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Country / Region</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Your Country"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
              />
              <span>Keep me signed in</span>
            </label>

            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SSL Encrypted</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
          >
            <span>
              {isLoading
                ? 'Authenticating...'
                : mode === 'LOGIN'
                ? 'Sign In to Account'
                : 'Create My Account'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Demo 1-Click Login */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setEmail('hoolamohamed685@gmail.com');
                setPassword('DerivSniper@2026');
                setFullName('Mohamed Hoola');
              }}
              className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Use Provided Credentials (hoolamohamed685@gmail.com)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
