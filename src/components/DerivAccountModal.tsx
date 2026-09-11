/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DerivAccountInfo } from '../types';
import { derivService } from '../services/derivWs';
import {
  ShieldCheck,
  Key,
  LogOut,
  ExternalLink,
  X,
  Zap,
  Radio,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Sparkles,
  ArrowRight,
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
  accountMode,
  onToggleAccountMode,
  demoBalance,
  onUpdateDemoBalance,
}) => {
  const [showManualToken, setShowManualToken] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1-Click Deriv OAuth (Direct login on Deriv without typing any token or ID)
  const handleConnectDerivOAuth = () => {
    setAuthError(null);
    const oauthUrl = derivService.getOAuthRedirectUrl('1089');
    
    // Open in a focused popup window
    const width = 560;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      oauthUrl,
      'DerivAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // If popup was blocked by browser, open in new tab
      window.open(oauthUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 1-Click Instant Demo Account ($10,000 USD)
  const handleActivateInstantDemo = () => {
    onToggleAccountMode('DEMO');
    onUpdateDemoBalance(10000.0);
    onClose();
  };

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTokenInput(text.trim());
        setAuthError(null);
      }
    } catch {
      // If clipboard permission is not granted, user can paste manually
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setAuthError('Please paste a valid Deriv API token.');
      return;
    }
    setAuthError(null);
    setIsSubmitting(true);
    try {
      derivService.reconnect('1089', tokenInput.trim());
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
    } catch (err: any) {
      setAuthError(err.message || 'Connection failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="deriv-connect-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
    >
      <div
        id="deriv-connect-modal"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                Connect Deriv Account
              </h3>
              <p className="text-[11px] text-slate-400">
                Official Deriv Gateway • Live Ticks &amp; Real Settlement
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Live Deriv WebSocket Connection Indicator */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-300 font-semibold">Deriv WebSocket Stream</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>{connected ? `Connected (${latency > 0 ? latency : 16}ms)` : 'Connecting...'}</span>
            </div>
          </div>

          {accountInfo.isAuthorized ? (
            /* CURRENTLY CONNECTED VIEW */
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      <span>{accountInfo.loginId}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          accountInfo.isVirtual
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {accountInfo.isVirtual ? 'DEMO / VIRTUAL' : 'REAL ACCOUNT'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {accountInfo.email || 'Deriv Authorized User'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Live Balance</div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                    ${accountInfo.balance !== undefined ? accountInfo.balance.toFixed(2) : '0.00'}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {accountInfo.currency || 'USD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Switcher if multiple accounts linked */}
              {accountInfo.accountsList && accountInfo.accountsList.length > 1 && (
                <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between gap-3 text-xs font-mono">
                  <span className="text-slate-400">Switch linked account:</span>
                  <select
                    value={accountInfo.loginId}
                    onChange={(e) => derivService.switchAccount(e.target.value)}
                    className="bg-slate-950 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {accountInfo.accountsList.map((acc) => (
                      <option key={acc.loginid} value={acc.loginid}>
                        {acc.loginid} ({acc.is_virtual ? 'Demo' : 'Real'} • {acc.currency})
                      </option>
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500/40 border border-slate-700 text-slate-300 text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Disconnect Account</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black font-mono transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950"
                >
                  <span>Start Trading</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* NOT CONNECTED - 100% SIMPLE ZERO TOKEN CONNECT */
            <div className="space-y-3">
              {/* Primary 1-Click Deriv OAuth Button (FasterPro Analyzer Style) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-emerald-500/40 shadow-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white font-mono">
                      Connect Deriv (1-Click Login)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Zero tokens or IDs required. Log in directly with your Deriv account.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="modal-connect-deriv-oauth-btn"
                  onClick={handleConnectDerivOAuth}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm font-mono shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Connect with Deriv</span>
                  <ExternalLink className="w-4 h-4" />
                </button>

                <div className="text-[10px] text-slate-400 text-center font-mono">
                  Supports Deriv Real (CR) &amp; Virtual Demo (VRTC) accounts automatically.
                </div>
              </div>

              {/* Instant Free Demo Mode Option */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white font-mono">
                      Instant Demo Mode ($10,000 Free)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 font-mono font-bold">
                    No Login Required
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Start trading instantly on live Deriv market ticks with a virtual $10,000 USD practice balance.
                </p>
                <button
                  type="button"
                  id="modal-instant-demo-btn"
                  onClick={handleActivateInstantDemo}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                >
                  <span>Activate Instant Demo ($10,000)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>

              {/* Optional Collapsed Manual API Token section (for advanced users only) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualToken(!showManualToken)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 font-mono py-1 transition cursor-pointer"
                >
                  <span>Advanced: Enter API Token Manually</span>
                  {showManualToken ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showManualToken && (
                  <form onSubmit={handleManualTokenSubmit} className="mt-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 font-mono font-semibold">
                        Deriv API Token
                      </label>
                      <button
                        type="button"
                        onClick={handlePasteToken}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono hover:bg-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Paste</span>
                      </button>
                    </div>

                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste your Deriv token..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />

                    {authError && (
                      <div className="text-[11px] text-rose-400 font-mono font-semibold">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !tokenInput.trim()}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs font-mono transition cursor-pointer"
                    >
                      {isSubmitting ? 'Authenticating...' : 'Authorize Token'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
