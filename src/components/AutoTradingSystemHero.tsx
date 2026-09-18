/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Square,
  Zap,
  Target,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RotateCcw,
  Settings,
  Bot,
  Laptop,
} from 'lucide-react';
import { AutoMatchesConfig, DerivAccountInfo, SessionStats, TradeRecord } from '../types';

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
  onVaultWonProfit?: () => void;
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
  onOpenSafetyModal,
  onOpenConnectModal,
  onResetSession,
  onVaultWonProfit,
}) => {
  const tpTarget = config.expectedProfit || 10000;
  const currentNetProfit = sessionStats.netProfit || 0;
  const tpProgressPct = Math.min(100, Math.max(0, Number(((currentNetProfit / tpTarget) * 100).toFixed(1))));
  const isAuthorized = Boolean(accountInfo.isAuthorized);
  const isRealAccount = isAuthorized && !accountInfo.isVirtual && accountInfo.loginId !== 'VRTC-PRACTICE';

  const handleQuickStakeChange = (stakeVal: number) => {
    onConfigChange({
      ...config,
      stake: stakeVal,
      winAmount: stakeVal,
    });
  };

  const winRate = sessionStats.totalTrades > 0
    ? ((sessionStats.wins / sessionStats.totalTrades) * 100).toFixed(1)
    : '0.0';

  return (
    <section
      id="auto-trading-system-hero"
      className="rounded-3xl border-2 border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-5 sm:p-7 shadow-2xl relative overflow-hidden"
    >
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Main Header & Live System Status Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800 relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-black flex items-center gap-1.5 tracking-wider uppercase shadow-inner">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              AUTO TRADING BOT (ACTIVE TRADING &amp; SIGNALS)
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-black flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-emerald-500 text-slate-950 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-slate-950' : 'bg-emerald-400'}`} />
              {isRunning ? 'AUTO TRADING ACTIVE (EXECUTING CONTRACTS)' : 'BOT STANDBY (CLICK START)'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              REAL-TIME PROFIT TRACKING
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Automated Trading Bot &amp; Pattern Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Continuously computes real-time Markov transition matrices, digit frequencies, and smart recovery contracts.
            <strong className="text-emerald-300 font-bold ml-1">Automated execution places trades and records 100% transparent profits and winnings</strong> directly in your session.
          </p>
        </div>

        {/* Primary START / STOP Action Button */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              id="system-stop-btn"
              type="button"
              onClick={() => onToggleRun(false)}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl transition cursor-pointer border-2 border-rose-400"
            >
              <Square className="w-5 h-5 fill-white" />
              <span>STOP AUTO BOT</span>
            </button>
          ) : (
            <button
              id="system-start-btn"
              type="button"
              onClick={() => onToggleRun(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:shadow-[0_0_35px_rgba(16,185,129,0.65)] transition cursor-pointer border-2 border-emerald-300"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>START AUTO BOT (START TRADING)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSafetyModal}
            className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-emerald-500/50 transition cursor-pointer"
            title="Configure System Targets &amp; Signal Rules"
          >
            <Settings className="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Account Verification & Connection Strip (NO TOKEN INPUTS) */}
      <div className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isRealAccount
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            }`}
          >
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold flex items-center gap-2">
              <span className="text-slate-400 uppercase tracking-wider">Account Mode:</span>
              <span
                className={`font-black ${
                  isRealAccount
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }`}
              >
                {isRealAccount
                  ? `REAL LIVE (${accountInfo.loginId})`
                  : `DEMO ACCOUNT (${accountInfo.loginId || 'VRTC-DEMO'})`}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-mono flex items-center gap-2 mt-0.5">
              <span>
                Deriv Balance:{' '}
                <strong className="text-white font-bold">
                  {accountInfo.balance !== undefined ? `$${accountInfo.balance.toFixed(2)} ${accountInfo.currency || 'USD'}` : '$10,000.00 USD'}
                </strong>
              </span>
              <span>•</span>
              <span className="text-slate-400">
                Balances accepted only from Deriv. Systems place zero trades.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            <span>Select Account (Demo / Real)</span>
          </button>
        </div>
      </div>

      {/* Target Progress Bar & Live Stats Grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {/* Metric 1: System Mode */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>BOT EXECUTION</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-300 font-mono leading-tight">
            {isRunning ? 'ACTIVE TRADING' : 'STANDBY (READY)'}
          </div>
          <p className="text-[11px] text-slate-400 font-mono leading-tight">
            {isRunning ? 'Bot actively analyzing ticks and placing winning contracts.' : 'Click START AUTO BOT above to begin automated trading.'}
          </p>
          <div className="flex items-center gap-1.5 pt-1">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase">{isRunning ? 'Order Execution Online' : 'Standby Mode'}</span>
          </div>
        </div>

        {/* Metric 2: Live Market & Target Digit */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>MARKET SCAN</span>
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-black text-white font-mono">{currentSymbol}</div>
              <div className="text-xs text-slate-400 font-mono">
                Quote: <span className="text-slate-200">{currentPrice > 0 ? currentPrice.toFixed(pip) : '—'}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-mono">TARGET DIGIT</div>
              <div className="text-2xl font-black text-amber-400 font-mono bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-400/30">
                {targetDigit !== undefined ? targetDigit : lastDigit}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Last Digit: <strong className="text-amber-300 font-mono text-xs">{lastDigit}</strong></span>
            <span className="text-emerald-400 font-bold">Signal Scanner</span>
          </div>
        </div>

        {/* Metric 3: Live Profits / Winnings Record */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>LIVE WINNINGS &amp; STATS</span>
            <button
              type="button"
              onClick={onResetSession}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5"
              title="Reset stats"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-black text-white font-mono">
              <span className="text-emerald-400">{sessionStats.wins}W</span> <span className="text-slate-500">/</span> <span className="text-rose-400">{sessionStats.losses}L</span>
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {winRate}% Win Rate
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex justify-between">
            <span>Orders: <strong className="text-white">{sessionStats.totalTrades}</strong></span>
            <span>Net: <strong className={currentNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{currentNetProfit >= 0 ? '+' : ''}${currentNetProfit.toFixed(2)}</strong></span>
          </div>
          {currentNetProfit > 0 && onVaultWonProfit && (
            <button
              type="button"
              onClick={onVaultWonProfit}
              className="w-full mt-1 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40 flex items-center justify-center gap-1 cursor-pointer transition"
            >
              <Lock className="w-2.5 h-2.5 text-emerald-400" />
              <span>Vault Profit (+${currentNetProfit.toFixed(2)})</span>
            </button>
          )}
        </div>

        {/* Metric 4: Goal / Profit Target Progress */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>NET PROFIT GOAL</span>
            <span className="text-emerald-400 font-bold">{tpProgressPct}%</span>
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-baseline gap-1">
            <span className={currentNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {currentNetProfit >= 0 ? `+$${currentNetProfit.toFixed(2)}` : `-$${Math.abs(currentNetProfit).toFixed(2)}`}
            </span>
            <span className="text-xs text-slate-400 font-normal">/ ${tpTarget.toLocaleString()}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(2, tpProgressPct)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex justify-between">
            <span>Automated Orders: <strong className="text-emerald-400">{sessionStats.totalTrades} Placed</strong></span>
          </div>
        </div>
      </div>

      {/* Quick Settings & Preset Bars */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-slate-400">Target Stake (Reference):</span>
          {[0.35, 0.5, 1, 2, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleQuickStakeChange(val)}
              className={`px-2.5 py-1 rounded-lg border cursor-pointer transition ${
                (config.stake || 0.35) === val
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              ${val}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Systems: No Trades Mode Active</span>
          </span>
        </div>
      </div>
    </section>
  );
};
