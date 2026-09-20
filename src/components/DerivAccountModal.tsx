/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogOut, ShieldCheck, X, LoaderCircle, Radio } from 'lucide-react';
import { DerivAccountInfo } from '../types';
import { derivService } from '../services/derivWs';

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
  onToggleAccountMode,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRealActive = accountInfo.isAuthorized && !accountInfo.isVirtual;

  const connectDeriv = async () => {
    setMessage(null);
    setIsSubmitting(true);
    try {
      const clientId = derivService.getStoredOAuthClientId();
      if (!clientId) {
        setMessage('Deriv connection is not available on this deployment yet.');
        setIsSubmitting(false);
        return;
      }
      await derivService.beginOAuthLogin(clientId);
    } catch (error: any) {
      setMessage(error?.message || 'Could not open Deriv sign-in.');
      setIsSubmitting(false);
    }
  };

  const switchDemo = () => {
    onToggleAccountMode('DEMO');
    onClose();
  };

  const disconnect = () => {
    derivService.disconnectTradingAccount();
    onToggleAccountMode('DEMO');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0b1120] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-black text-white font-mono">DERIV ACCOUNT</h2>
            <p className="text-xs text-slate-400 mt-1">Direct Deriv sign-in</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Deriv connection</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Radio className="w-3.5 h-3.5" />
              <span>Live{latency > 0 ? ` · ${latency}ms` : ''}</span>
            </div>
          </div>

          {isRealActive ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-wider font-black text-emerald-300">REAL CONNECTED</div>
              <div className="font-mono text-white font-black">{accountInfo.loginId}</div>
              <div className="text-sm text-slate-300 font-mono">
                Balance: <strong className="text-emerald-300">{accountInfo.balance?.toFixed(2) || '0.00'} {accountInfo.currency || 'USD'}</strong>
              </div>
              <button
                type="button"
                onClick={disconnect}
                className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-mono font-black text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                DISCONNECT
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={connectDeriv}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-black text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {isSubmitting ? 'OPENING DERIV...' : 'CONNECT DERIV'}
              </button>

              <button
                type="button"
                onClick={switchDemo}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs"
              >
                USE DEMO
              </button>
            </>
          )}

          {message && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
