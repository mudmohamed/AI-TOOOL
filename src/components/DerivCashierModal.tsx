import React from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  X,
  Users,
} from 'lucide-react';
import { DerivAccountInfo } from '../types';

interface DerivCashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountInfo: DerivAccountInfo;
  accountMode: 'DEMO' | 'REAL';
  balance: number;
  onDepositSuccess: (amount: number, method: string) => void;
  onWithdrawSuccess: (amount: number, method: string) => void;
  onToggleAccountMode?: (mode: 'DEMO' | 'REAL') => void;
}

const DERIV_DEPOSIT_URL = 'https://app.deriv.com/cashier/deposit';
const DERIV_WITHDRAW_URL = 'https://app.deriv.com/cashier/withdrawal';
const DERIV_P2P_URL = 'https://app.deriv.com/cashier/p2p';

export const DerivCashierModal: React.FC<DerivCashierModalProps> = ({
  isOpen,
  onClose,
  accountInfo,
  accountMode,
  balance,
}) => {
  if (!isOpen) return null;

  const isRealAuthorized = accountInfo.isAuthorized && !accountInfo.isVirtual;
  const isVirtualAuthorized = accountInfo.isAuthorized && Boolean(accountInfo.isVirtual);
  const liveBalance = accountInfo.isAuthorized && typeof accountInfo.balance === 'number'
    ? accountInfo.balance
    : balance;

  const openOfficialCashier = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Deriv Cashier</h3>
              <p className="text-xs text-slate-400">Official Deriv funding and withdrawal gateway</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Authorized account</div>
              <div className="text-sm font-bold text-white font-mono">
                {accountInfo.loginId || 'Not connected'}
                {accountInfo.isAuthorized && (
                  <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${accountInfo.isVirtual ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {accountInfo.isVirtual ? 'VIRTUAL' : 'REAL'}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Deriv balance</div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {accountInfo.isAuthorized ? `${liveBalance.toFixed(2)} ${accountInfo.currency || 'USD'}` : '—'}
              </div>
            </div>
          </div>

          {!accountInfo.isAuthorized && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Connect your Deriv account first. This app does not invent deposits, balances, wallet addresses, card transactions, or withdrawal confirmations.</span>
            </div>
          )}

          {isVirtualAuthorized && (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 text-xs text-cyan-200">
              You are connected to a Deriv virtual account. Funding a real-money account must be done through Deriv's official cashier after switching to a real account.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => openOfficialCashier(DERIV_DEPOSIT_URL)}
              disabled={!isRealAuthorized}
              className="p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold flex items-center justify-between gap-3 transition"
            >
              <span className="flex items-center gap-2"><ArrowDownLeft className="w-4 h-4" /> Deposit with Deriv</span>
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => openOfficialCashier(DERIV_WITHDRAW_URL)}
              disabled={!isRealAuthorized}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:text-slate-600 text-white font-bold flex items-center justify-between gap-3 transition border border-slate-700"
            >
              <span className="flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-emerald-400" /> Withdraw with Deriv</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => openOfficialCashier(DERIV_P2P_URL)}
            disabled={!isRealAuthorized}
            className="w-full p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 disabled:text-slate-600 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-between gap-3 transition"
          >
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" /> Open official Deriv P2P</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 flex gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Real balance changes are accepted only from Deriv's authenticated balance stream. This interface no longer credits or debits a real account locally.</span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono text-center">Current UI mode: {accountMode}. Actual account type is determined by the authorized Deriv account.</div>
        </div>
      </div>
    </div>
  );
};
