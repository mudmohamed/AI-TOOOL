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
  X,
  Radio,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  WalletCards,
  LoaderCircle,
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
  const [isSubmitting, setIsSubmitting] = useState<'DEMO' | 'REAL' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const actualMode: 'DEMO' | 'REAL' = accountInfo.isAuthorized && accountInfo.isVirtual ? 'DEMO' : 'REAL';

  const handleChooseMode = async (requested: 'DEMO' | 'REAL') => {
    if (accountInfo.isAuthorized && actualMode === requested) {
      onClose();
      return;
    }

    setAuthError(null);
    setIsSubmitting(requested);
    try {
      const ok = await derivService.connectTradingAccount(requested);
      if (ok) onClose();
      else setAuthError('Account connection was not completed. If a window was blocked, allow pop-ups for this site and try again.');
    } catch (error: any) {
      setAuthError(error?.message || 'Could not open the selected account.');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <WalletCards className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">Trading Account</h3>
              <p className="text-[11px] text-slate-400">Choose DEMO or REAL without leaving the Matrix screen</p>
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
              <span className="text-slate-300 font-semibold">Deriv market feed</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>{connected ? `Live${latency > 0 ? ` (${latency}ms)` : ''}` : 'Disconnected'}</span>
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
                        {accountInfo.isVirtual ? 'DEMO' : 'REAL'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">Verified Deriv Options account</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Live balance</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {accountInfo.balance !== undefined ? accountInfo.balance.toFixed(2) : '0.00'} <span className="text-xs text-slate-400">{accountInfo.currency || 'USD'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  disabled={Boolean(isSubmitting)}
                  onClick={() => handleChooseMode('DEMO')}
                  className={`py-2.5 rounded-xl border font-black text-xs font-mono transition disabled:opacity-50 ${actualMode === 'DEMO' ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-950 text-amber-300 border-slate-700 hover:border-amber-400/50'}`}
                >
                  {isSubmitting === 'DEMO' ? 'OPENING…' : 'DEMO'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(isSubmitting)}
                  onClick={() => handleChooseMode('REAL')}
                  className={`py-2.5 rounded-xl border font-black text-xs font-mono transition disabled:opacity-50 ${actualMode === 'REAL' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-emerald-300 border-slate-700 hover:border-emerald-500/50'}`}
                >
                  {isSubmitting === 'REAL' ? 'OPENING…' : 'REAL'}
                </button>
              </div>

              {authError && <div className="text-[11px] text-rose-300 font-mono">{authError}</div>}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => derivService.logout()}
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
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-sm font-black text-white font-mono">Select trading account</h4>
                  <p className="text-[11px] text-slate-400 mt-1">The Matrix stays open. A small secure account window is used only when Deriv needs to verify the session.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={Boolean(isSubmitting)}
                    onClick={() => handleChooseMode('DEMO')}
                    className="p-4 rounded-2xl bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/40 text-left transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs font-black font-mono text-amber-300">
                      {isSubmitting === 'DEMO' && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />} DEMO
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Genuine Deriv virtual account</div>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(isSubmitting)}
                    onClick={() => handleChooseMode('REAL')}
                    className="p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/40 text-left transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs font-black font-mono text-emerald-300">
                      {isSubmitting === 'REAL' && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />} REAL
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Genuine Deriv real-money account</div>
                  </button>
                </div>
              </div>

              {authError && <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 font-mono">{authError}</div>}

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex gap-2.5 text-[11px] text-emerald-200">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Balances and trading permission are accepted only from Deriv. The Matrix never creates a fake REAL account.</span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-2.5 text-[11px] text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>On the first REAL/DEMO session Deriv may require its secure sign-in inside the small account window. After authorization, account switching can reuse the active session until it expires.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
