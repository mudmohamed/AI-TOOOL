/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DerivAccountInfo } from '../types';
import { derivService } from '../services/derivWs';
import {
  ShieldCheck,
  LogOut,
  ExternalLink,
  X,
  Radio,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface DerivAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountInfo: DerivAccountInfo;
  connected: boolean;
  latency: number;
  accountMode: 'DEMO' | 'REAL';
  onToggleAccountMode: (mode: 'DEMO' | 'REAL') => void;
  demoBalance: number;
  onUpdateDemoBalance: (balance: number) => void;
}

export const DerivAccountModal: React.FC<DerivAccountModalProps> = ({
  isOpen,
  onClose,
  accountInfo,
  connected,
  latency,
}) => {
  const [showManualToken, setShowManualToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectDerivOAuth = () => {
    setAuthError(null);
    const oauthUrl = derivService.getOAuthRedirectUrl();
    window.location.assign(oauthUrl);
  };

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTokenInput(text.trim());
    } catch {
      setAuthError('Clipboard access was blocked. Paste the token manually.');
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setAuthError('Enter a valid Deriv API token.');
      return;
    }

    setAuthError(null);
    setIsSubmitting(true);
    derivService.reconnect(undefined, token);
    setTimeout(() => setIsSubmitting(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">Connect Deriv Account</h3>
              <p className="text-[11px] text-slate-400">Official authorization, live balance and real contract settlement</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 font-semibold">Deriv WebSocket</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>{connected ? `Connected${latency > 0 ? ` (${latency}ms)` : ''}` : 'Disconnected'}</span>
            </div>
          </div>

          {accountInfo.isAuthorized ? (
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>{accountInfo.loginId}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${accountInfo.isVirtual ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {accountInfo.isVirtual ? 'VIRTUAL' : 'REAL'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{accountInfo.email || 'Authorized Deriv account'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Live balance</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {accountInfo.balance !== undefined ? accountInfo.balance.toFixed(2) : '0.00'} <span className="text-xs text-slate-400">{accountInfo.currency || 'USD'}</span>
                  </div>
                </div>
              </div>

              {accountInfo.accountsList && accountInfo.accountsList.length > 1 && (
                <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between gap-3 text-xs font-mono">
                  <span className="text-slate-400">Switch linked account:</span>
                  <select
                    value={accountInfo.loginId}
                    onChange={(e) => derivService.switchAccount(e.target.value)}
                    className="bg-slate-950 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    {accountInfo.accountsList.map((acc) => (
                      <option key={acc.loginid} value={acc.loginid}>{acc.loginid} ({acc.is_virtual ? 'Virtual' : 'Real'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    derivService.logout();
                    setTokenInput('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700 text-slate-300 text-xs font-bold font-mono flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Disconnect
                </button>
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black font-mono flex items-center justify-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-emerald-500/40 space-y-3">
                <h4 className="text-sm font-black text-white font-mono">Official Deriv Login</h4>
                <p className="text-[11px] text-slate-400">Authorize a real or virtual Deriv account. No account number or balance is fabricated locally.</p>
                <button
                  type="button"
                  onClick={handleConnectDerivOAuth}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm font-mono flex items-center justify-center gap-2"
                >
                  Connect with Deriv <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-2.5 text-[11px] text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>A Deriv virtual account is also a real authorized Deriv account. The app no longer creates a fake $10,000 demo account or fake login ID.</span>
              </div>

              <button type="button" onClick={() => setShowManualToken(!showManualToken)} className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 font-mono py-1">
                <span>Advanced: authorize with API token</span>
                {showManualToken ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showManualToken && (
                <form onSubmit={handleManualTokenSubmit} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-400 font-mono font-semibold">Deriv API token</label>
                    <button type="button" onClick={handlePasteToken} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                      <Clipboard className="w-3 h-3" /> Paste
                    </button>
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste token with trading permission"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                  {authError && <div className="text-[11px] text-rose-400 font-mono">{authError}</div>}
                  <button type="submit" disabled={isSubmitting || !tokenInput.trim()} className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs font-mono">
                    {isSubmitting ? 'Authorizing...' : 'Authorize token'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
