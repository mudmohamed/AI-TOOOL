/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Lock,
  Play,
  Radio,
  RotateCcw,
  Settings,
  ShieldCheck,
  Square,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import { AutoMatchesConfig, DerivAccountInfo, TradeRecord } from '../types';

interface SessionStats {
  totalTrades: number;
  wins: number;
  losses: number;
  netProfit: number;
  consecutiveLosses: number;
  cumulativeLoss: number;
  peakDrawdown: number;
}

interface AutoTradingSystemHeroProps {
  isRunning: boolean;
  onToggleRun: (running: boolean) => void;
  config: AutoMatchesConfig;
  onConfigChange: (config: AutoMatchesConfig) => void;
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  symbols: { symbol: string; name: string }[];
  currentPrice: number;
  lastDigit: number;
  pip: number;
  targetDigit?: number;
  accountInfo: DerivAccountInfo;
  sessionStats: SessionStats;
  tradeHistory: TradeRecord[];
  onOpenSafetyModal: () => void;
  onOpenConnectModal: () => void;
  onResetSession: () => void;
}

export const AutoTradingSystemHero: React.FC<AutoTradingSystemHeroProps> = ({
  isRunning,
  onToggleRun,
  config,
  onConfigChange,
  currentSymbol,
  onSelectSymbol,
  symbols,
  currentPrice,
  lastDigit,
  pip,
  targetDigit,
  accountInfo,
  sessionStats,
  tradeHistory,
  onOpenSafetyModal,
  onOpenConnectModal,
  onResetSession,
}) => {
  const isAuthorized = Boolean(accountInfo.isAuthorized);
  const isRealAccount = isAuthorized && !accountInfo.isVirtual;
  const currency = accountInfo.currency || 'USD';
  const expectedProfit = Number(config.expectedProfit ?? 20);
  const stake = Number(config.stake || 0.35);
  const progress = expectedProfit > 0
    ? Math.max(0, Math.min(100, (sessionStats.netProfit / expectedProfit) * 100))
    : 0;
  const winRate = sessionStats.totalTrades > 0
    ? (sessionStats.wins / sessionStats.totalTrades) * 100
    : 0;
  const pendingCount = tradeHistory.filter((trade) => trade.status === 'PENDING').length;
  const matchesWins = tradeHistory.filter((trade) => trade.contractType === 'MATCHES' && trade.status === 'WON').length;

  const setStake = (value: number) => {
    onConfigChange({
      ...config,
      stake: value,
      winAmount: value,
    });
  };

  const setTargetProfit = (value: number) => {
    onConfigChange({
      ...config,
      expectedProfit: value,
    });
  };

  return (
    <section
      id="auto-trading-system-hero"
      className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/45 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/35 shadow-2xl"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                <Zap className="h-3.5 w-3.5" /> Deriv Auto-Matches System
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${isRunning ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}>
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-slate-950 animate-pulse' : 'bg-amber-400'}`} />
                {isRunning ? 'System running' : 'System ready'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Auto-Matches & Recovery Trading System
            </h2>
            <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-300">
              Live Deriv market data, account-backed order execution, Auto-Matches controls, recovery status, session performance, and the original system controls in one panel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleRun(!isRunning)}
              className={`inline-flex min-w-[185px] items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black transition active:scale-95 ${isRunning ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'}`}
            >
              {isRunning ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {isRunning ? 'STOP SYSTEM' : 'START SYSTEM'}
            </button>
            <button
              type="button"
              onClick={onOpenSafetyModal}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-3.5 text-slate-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
              title="Safety and profit-lock settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${isRealAccount ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : isAuthorized ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
                {isRealAccount ? <ShieldCheck className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
                  <span className="text-slate-400">ACCOUNT</span>
                  <span className={isRealAccount ? 'text-emerald-300' : isAuthorized ? 'text-cyan-300' : 'text-rose-300'}>
                    {isRealAccount ? `REAL LIVE ${accountInfo.loginId || ''}` : isAuthorized ? `DEMO ${accountInfo.loginId || ''}` : 'NOT AUTHORIZED'}
                  </span>
                </div>
                <div className="mt-1 text-xs font-mono text-slate-400">
                  Balance: <span className="font-bold text-white">{isAuthorized && accountInfo.balance !== undefined ? `${Number(accountInfo.balance).toFixed(2)} ${currency}` : '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenConnectModal}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
              >
                <Lock className="h-3.5 w-3.5" /> {isAuthorized ? 'ACCOUNT SETTINGS' : 'CONNECT DERIV'}
              </button>
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-mono text-slate-400">
                <Radio className={`h-3.5 w-3.5 ${isAuthorized ? 'text-emerald-400' : 'text-amber-400'}`} />
                {isAuthorized ? 'Authorized execution' : 'Market data only'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-400">
              <span>Profit target</span><Target className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1 text-2xl font-black text-white">
              {expectedProfit.toLocaleString()} <span className="text-xs font-medium text-slate-500">{currency}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${Math.max(2, progress)}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-mono text-slate-500">
              <span>Net {sessionStats.netProfit.toFixed(2)}</span><span>{progress.toFixed(1)}%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-400">
              <span>Live market</span><Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-black text-white">{currentSymbol}</div>
            <div className="mt-1 text-xs font-mono text-slate-400">
              {currentPrice > 0 ? currentPrice.toFixed(pip) : 'Waiting for tick'}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Last digit <strong className="text-amber-300">{lastDigit}</strong></span>
              <span className="text-slate-500">Target <strong className="text-emerald-300">{targetDigit ?? '—'}</strong></span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-400">
              <span>Session</span><Gauge className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-black text-white">{sessionStats.wins}W <span className="text-slate-600">/</span> {sessionStats.losses}L</div>
            <div className="mt-1 text-xs font-mono text-emerald-300">{winRate.toFixed(1)}% settled wins</div>
            <div className="mt-2 text-[11px] font-mono text-slate-500">Trades {sessionStats.totalTrades} • Pending {pendingCount}</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-400">
              <span>Recovery status</span><ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xl font-black text-white">{sessionStats.consecutiveLosses} loss streak</div>
            <div className="mt-1 text-xs font-mono text-slate-400">Drawdown {sessionStats.cumulativeLoss.toFixed(2)} {currency}</div>
            <div className="mt-2 text-[11px] font-mono text-slate-500">Matches wins {matchesWins}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-wider text-slate-300">Live system controls</div>
              <CircleDollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-mono text-slate-400">
                <span>Market</span>
                <select
                  value={currentSymbol}
                  onChange={(event) => onSelectSymbol(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                >
                  {symbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] font-mono text-slate-400">
                <span>Stake</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stake}
                  onChange={(event) => setStake(Math.max(0.01, Number(event.target.value) || 0.01))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-500">Quick stake</span>
              {[0.35, 0.5, 1, 2, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStake(value)}
                  className={`rounded-lg border px-2.5 py-1.5 font-bold transition ${stake === value ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-wider text-slate-300">Target & session</div>
              <Target className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[20, 50, 100, 500, 1000].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTargetProfit(value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-mono font-bold transition ${expectedProfit === value ? 'border-cyan-400 bg-cyan-500 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'}`}
                >
                  TP {value}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onResetSession} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-300 hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Reset session
              </button>
              <button type="button" onClick={onOpenSafetyModal} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/15">
                <ShieldCheck className="h-3.5 w-3.5" /> Safety / profit lock
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-[10px] font-mono text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Uses the existing live Deriv execution engine</span>
          <span>Execution strategy code is not defined in this UI component.</span>
        </div>
      </div>
    </section>
  );
};
