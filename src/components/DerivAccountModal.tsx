/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DerivAccountInfo, AccountMode } from '../types';
import { derivService } from '../services/derivWs';
import {
  LogOut,
  X,
  Radio,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
  Laptop,
  Check,
  ShieldCheck,
  Lock,
  Settings,
  Sparkles,
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
  latency,
  accountMode,
  onToggleAccountMode,
}) => {
  const [activeTab, setActiveTab] = useState<'REAL_TOKEN' | 'DEMO' | 'ADVANCED'>('REAL_TOKEN');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAuthError(null);
      setSuccessMsg(null);
      try {

      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitchToDemo = () => {
    setAuthError(null);
    setSuccessMsg(null);
    onToggleAccountMode('DEMO');
    setSuccessMsg('Active session switched to DEMO Virtual Practice ($10,000 USD).');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleDisconnect = () => {
    derivService.disconnectTradingAccount();
    onToggleAccountMode('DEMO');
    try {
      localStorage.removeItem('deriv_token_real');
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_oauth_access_token_real');
      localStorage.removeItem('deriv_oauth_expires_at');
    } catch {}
    setSuccessMsg('Real account disconnected. Now in Demo Practice mode.');
    setTimeout(() => {
      setSuccessMsg(null);
    }, 2500);
  };

  const isRealActive = accountInfo.isAuthorized && !accountInfo.isVirtual;

  return (
    <div
      id="deriv-account-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="deriv-account-modal-card"
        className="w-full max-w-lg bg-[#0b1120] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#080d19]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                TRADING ACCOUNT
                {isRealActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    REAL CONNECTED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    DEMO PRACTICE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Connect your genuine Deriv account to trade with real funds
              </p>
            </div>
          </div>
          <button
            id="close-account-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Market Feed Status Pill */}
          <div
            id="market-feed-status-pill"
            className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              <span className="font-bold text-slate-200">Deriv Official WebSocket Gateway</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Radio className="w-3.5 h-3.5" />
              <span>Live ({latency > 0 ? latency : 95}ms)</span>
            </div>
          </div>

          {/* Connected Account Card (if already connected to REAL) */}
          {isRealActive && (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                  <div>
                    <div className="font-mono font-bold text-white text-sm flex items-center gap-2">
                      <span>{accountInfo.loginId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-bold">
                        GENUINE REAL ACCOUNT
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono mt-0.5">
                      Live Balance:{' '}
                      <strong className="text-emerald-300 text-sm">
                        ${accountInfo.balance?.toFixed(2) || '0.00'} {accountInfo.currency || 'USD'}
                      </strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('REAL_TOKEN')}
              className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'REAL_TOKEN'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Real Account</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DEMO')}
              className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'DEMO'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Demo ($10k)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ADVANCED')}
              className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ADVANCED'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Connection</span>
            </button>
          </div>

          {/* TAB 1: Direct Deriv Login */}
          {activeTab === 'REAL_TOKEN' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-mono font-black text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>CONNECT DERIV DIRECT</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  No API token or PAT is entered in SKIPPER. Press the button below to open Deriv, sign in there, then return connected.
                </p>
                <button
                  id="login-with-deriv-btn"
                  type="button"
                  onClick={async () => {
                    setAuthError(null);
                    setSuccessMsg(null);
                    setIsSubmitting(true);
                    try {
                      const savedClientId = derivService.getStoredOAuthClientId();
                      if (!savedClientId) {
                        setAuthError('Deriv OAuth login is not configured for this deployment yet.');
                        setIsSubmitting(false);
                        return;
                      }
                      await derivService.beginOAuthLogin(savedClientId);
                    } catch (err: any) {
                      setAuthError(err?.message || 'Could not open Deriv login.');
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <span>OPENING DERIV...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>CONNECT DERIV</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2 text-xs text-cyan-200 leading-relaxed">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Sign-in happens on Deriv. SKIPPER does not ask you to paste an API token.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Demo / Practice Session */}
          {activeTab === 'DEMO' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1628] border border-slate-800/90 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">VIRTUAL DEMO PRACTICE</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Trade in real-time on genuine Deriv market tick data with a safe $10,000 USD virtual balance.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
                <div>
                  <div className="text-[11px] text-slate-400">PRACTICE BALANCE</div>
                  <div className="text-xl font-black text-amber-400">$10,000.00 USD</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  RISK FREE
                </span>
              </div>

              <button
                type="button"
                onClick={handleSwitchToDemo}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>USE DEMO PRACTICE ACCOUNT</span>
              </button>
            </div>
          )}

          {/* TAB 3: Connection Info */}
          {activeTab === 'ADVANCED' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1628] border border-slate-800/90 space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">DIRECT DERIV CONNECTION</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Real-account login is handled through Deriv authorization. No PAT/API-token entry is used in this screen.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setAuthError(null);
                  setIsSubmitting(true);
                  try {
                    const savedClientId = derivService.getStoredOAuthClientId();
                    if (!savedClientId) {
                      setAuthError('Deriv OAuth login is not configured for this deployment yet.');
                      setIsSubmitting(false);
                      return;
                    }
                    await derivService.beginOAuthLogin(savedClientId);
                  } catch (err: any) {
                    setAuthError(err?.message || 'Could not open Deriv login.');
                    setIsSubmitting(false);
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>CONNECT DERIV</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

