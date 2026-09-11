/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MarketAnalysis, AutoMatchesSignal, TradeRecord, AutoMatchesConfig } from '../types';
import {
  findBestAutoMatchesTarget,
  calculateSameLosingPriceRecovery,
} from '../utils/autoMatchesEngine';
import { DerivStatementReceipts } from './DerivStatementReceipts';
import {
  Zap,
  Target,
  ShieldCheck,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Code2,
  DollarSign,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface DeepScanAutoMatchesProps {
  analyses: Record<string, MarketAnalysis>;
  marketTicks: Record<string, { prices: number[]; digits: number[] }>;
  currentSymbol: string;
  onSelectMarket: (symbol: string) => void;
  scanDepth: number;
  onScanDepthChange: (depth: number) => void;
  onTriggerDeepScan: (depth: number) => void;
  isDeepScanning: boolean;
  autoMatchesActive: boolean;
  onToggleAutoMatches: (active: boolean) => void;
  recoveryMode: 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY';
  onRecoveryModeChange: (mode: 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY') => void;
  baseStake: number;
  onSimulateTrade: (trade: {
    contractType: any;
    targetValue: any;
    stake: number;
    symbol?: string;
    payout?: number;
    entryPrice?: number;
    entryDigit?: number;
  }) => void;
  sessionStats: {
    totalTrades: number;
    wins: number;
    losses: number;
    netProfit: number;
    consecutiveLosses: number;
    cumulativeLoss: number;
  };
  tradeHistory?: TradeRecord[];
  onClearHistory?: () => void;
  autoMatchesConfig?: AutoMatchesConfig;
  onAutoMatchesConfigChange?: (cfg: AutoMatchesConfig) => void;
  accountMode?: 'DEMO' | 'REAL';
  currentBalance?: number;
  onOpenCashier?: () => void;
}

export const DeepScanAutoMatches: React.FC<DeepScanAutoMatchesProps> = ({
  analyses,
  marketTicks,
  currentSymbol,
  onSelectMarket,
  scanDepth,
  onScanDepthChange,
  onTriggerDeepScan,
  isDeepScanning,
  autoMatchesActive,
  onToggleAutoMatches,
  recoveryMode,
  onRecoveryModeChange,
  baseStake,
  onSimulateTrade,
  sessionStats,
  tradeHistory = [],
  onClearHistory,
  autoMatchesConfig,
  onAutoMatchesConfigChange,
  accountMode = 'REAL',
  currentBalance,
  onOpenCashier,
}) => {
  const [internalConfig, setInternalConfig] = useState<AutoMatchesConfig>(() => {
    try {
      const saved = localStorage.getItem('deriv_auto_matches_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      market: '1HZ10V',
      stake: 0.35, // Initial Amount
      winAmount: 0.35, // Win Amount
      expectedProfit: 20.0, // Expected Profit
      maxAcceptableLoss: 50.0, // Max Acceptable Loss
      nextTradeCondition: 'MARTINGALE',
      martingaleFactor: 1.15,
      restartOnError: true,
      executionSpeed: 'FAST',
      targetStrategy: 'REPEAT_ENTRY',
    };
  });

  const activeConfig = autoMatchesConfig || internalConfig;

  const handleConfigChange = (newConfig: AutoMatchesConfig) => {
    if (onAutoMatchesConfigChange) {
      onAutoMatchesConfigChange(newConfig);
    } else {
      setInternalConfig(newConfig);
      try {
        localStorage.setItem('deriv_auto_matches_config', JSON.stringify(newConfig));
      } catch {}
    }
  };

  // Generate Auto-Matches signals across all available markets
  const signals: AutoMatchesSignal[] = Object.entries(marketTicks)
    .map(([symbol, rawData]) => {
      const data = rawData as { prices: number[]; digits: number[] } | undefined;
      const analysis = analyses[symbol];
      if (!analysis || !data || !data.digits || data.digits.length < 10) return null;
      return findBestAutoMatchesTarget(
        symbol,
        analysis.displayName,
        data.digits,
        analysis.digitStats,
        analysis.lastDigit
      );
    })
    .filter((s): s is AutoMatchesSignal => Boolean(s))
    .sort((a, b) => b.probabilityScore - a.probabilityScore);

  const activeMarketAnalysis = analyses[currentSymbol];
  const activeMarketTicks = marketTicks[currentSymbol];
  const currentLastDigit = activeMarketAnalysis?.lastDigit ?? (activeMarketTicks?.digits?.slice(-1)[0] ?? 0);

  // Dynamic next stake calculation matching DBot XML logic
  const calculateNextStake = (): number => {
    const initialAmt = activeConfig.stake || 0.35;
    const winAmt = activeConfig.winAmount || initialAmt;
    const maxLoss = activeConfig.maxAcceptableLoss || 50.0;

    if (sessionStats.consecutiveLosses <= 0) {
      return winAmt;
    }

    if (activeConfig.nextTradeCondition === 'SAME_LOSS_RECOVERY') {
      return Number(
        Math.min(maxLoss, Math.max(initialAmt, (sessionStats.cumulativeLoss + winAmt) / 8.5)).toFixed(2)
      );
    }

    if (activeConfig.nextTradeCondition === 'RESET_ON_WIN') {
      return initialAmt;
    }

    // Default: Martingale
    const factor = activeConfig.martingaleFactor || 1.15;
    return Number(
      Math.min(maxLoss, initialAmt * Math.pow(factor, sessionStats.consecutiveLosses)).toFixed(2)
    );
  };

  const nextCalculatedStake = calculateNextStake();

  const handleManualTradeNow = () => {
    const targetDigit =
      activeConfig.customTargetDigit !== undefined
        ? activeConfig.customTargetDigit
        : currentLastDigit;

    onSimulateTrade({
      contractType: 'MATCHES',
      targetValue: targetDigit,
      stake: nextCalculatedStake,
      symbol: currentSymbol,
      payout: 8.342857,
      entryDigit: currentLastDigit,
    });
  };

  return (
    <div id="deep-scan-auto-matches" className="space-y-6">
      {/* QUICK SYSTEM GUIDE: HOW TO TRADE 100% REAL ON DERIV */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-100">
              SYSTEM GUIDE: HOW THIS DERIV BOT TRADES (100% REAL)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/30">
            834% Contract Payout Multiplier
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px] font-black">
                1
              </span>
              <span>100% Real Live Stream</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Connected to <strong>Volatility 10 (1s) Index (1HZ10V)</strong>. Every tick quote and last digit updates live directly from Deriv.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-cyan-400 font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px] font-black">
                2
              </span>
              <span>Digit Match Contract</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Buys <strong>DIGITMATCH</strong> (1 tick). If the exit digit matches the target digit, you win <strong>+$2.57 USD on $0.35 stake (~834% return)</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-amber-400 font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-black">
                3
              </span>
              <span>Recovery &amp; Martingale</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Losses increase stake via <strong>Martingale</strong> or <strong>Same-Loss-Recovery</strong>. A single win restores all past losses plus win amount.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-purple-400 font-bold flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center text-[11px] font-black">
                4
              </span>
              <span>Run Auto or 1-Click</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Click <strong>RUN AUTO BOT</strong> or <strong>TRADE 1 TICK</strong>. Stops automatically at <strong>Expected Profit ($20)</strong> or <strong>Max Loss ($50)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* DBOT XML HEADER & PRIMARY RUN / STOP COCKPIT */}
      <div className="p-4 sm:p-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                DBOT XML DIGITMATCH ENGINE
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">
                Market: <strong className="text-white">1HZ10V</strong>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">
                Type: <strong className="text-emerald-400">DIGITMATCH</strong>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">
                Restart On Error: <strong className="text-cyan-400">TRUE</strong>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Deriv Volatility 10 (1s) Matches Bot</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                100% REAL
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Automated high-frequency XML DBot trading directly on the live Deriv tick stream. Operates on{' '}
              <strong className="text-white">1HZ10V</strong> with <strong className="text-white">DIGITMATCH</strong> (834% to 950% payout multiplier). Automatically adjusts recovery stakes on loss and resets to Win Amount on success.
            </p>
          </div>

          {/* Master Control Buttons */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto shrink-0">
            {/* Live Working Balance indicator */}
            {currentBalance !== undefined && (
              <div className="flex items-center gap-2.5 p-2 px-3 rounded-xl bg-slate-950 border border-slate-800 font-mono shadow-inner">
                <div>
                  <div className="text-[9px] uppercase text-slate-400 font-bold">
                    {accountMode === 'REAL' ? 'Live Real Balance' : 'Practice Demo'}
                  </div>
                  <div className="text-sm font-black text-emerald-400">
                    ${currentBalance.toFixed(2)} USD
                  </div>
                </div>
                {accountMode === 'REAL' && onOpenCashier && (
                  <button
                    type="button"
                    onClick={onOpenCashier}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40 transition cursor-pointer"
                    title="Open Cashier to deposit funds"
                  >
                    + Deposit
                  </button>
                )}
              </div>
            )}

            {/* Quick 1-Click Trade Now */}
            <button
              id="dbot-manual-trade-btn"
              onClick={handleManualTradeNow}
              disabled={autoMatchesActive}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-mono font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-md"
              title="Execute a single 100% real live match trade now"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>TRADE 1 TICK (${nextCalculatedStake.toFixed(2)})</span>
            </button>

            {/* Run / Stop Auto Bot Button */}
            <button
              id="toggle-auto-matches-bot-btn"
              onClick={() => onToggleAutoMatches(!autoMatchesActive)}
              className={`px-7 py-3 rounded-xl font-mono font-black text-sm flex items-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                autoMatchesActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-rose-950/60 ring-2 ring-rose-400/50'
                  : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-emerald-950/60 ring-2 ring-emerald-300'
              }`}
            >
              {autoMatchesActive ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>STOP DBOT (ACTIVE)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>RUN AUTO BOT (100% REAL)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* DBOT XML VARIABLES TELEMETRY DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Initial Amount</div>
          <div className="text-lg font-black text-white font-mono mt-0.5">
            ${(activeConfig.stake || 0.35).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">XML: Initial Stake</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Win Amount</div>
          <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
            ${(activeConfig.winAmount || activeConfig.stake || 0.35).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">XML: Reset on Win</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Expected Profit</div>
          <div className="text-lg font-black text-cyan-400 font-mono mt-0.5">
            ${(activeConfig.expectedProfit || 20.0).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Net: <span className={sessionStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${sessionStats.netProfit.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Max Acceptable Loss</div>
          <div className="text-lg font-black text-rose-400 font-mono mt-0.5">
            ${(activeConfig.maxAcceptableLoss || 50.0).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Loss: ${sessionStats.cumulativeLoss.toFixed(2)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Next Trade Stake</div>
          <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
            ${nextCalculatedStake.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Losses: {sessionStats.consecutiveLosses}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Current Last Digit</div>
          <div className="text-lg font-black text-purple-300 font-mono mt-0.5 flex items-center gap-1">
            <span className="px-2 py-0.2 rounded bg-purple-600/40 border border-purple-500/50 text-white">
              {currentLastDigit}
            </span>
            <span className="text-xs text-slate-400 font-normal">({currentSymbol})</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Live Deriv Tick</div>
        </div>
      </div>

      {/* DBOT CONFIGURATION CONTROLS */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                DBot Parameters &amp; Next Trade Conditions
              </h3>
              <p className="text-xs text-slate-400">
                Direct translation of Blockly XML variables into high-speed executable TypeScript.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Engine State:</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                autoMatchesActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoMatchesActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              {autoMatchesActive ? 'TRADING LIVE DERIV STREAM' : 'READY TO TRADE'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Parameter 1: Initial Amount (Stake) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
              <span>Initial Amount</span>
              <span className="text-emerald-400">Deriv Min $0.35</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0.35, 0.5, 1.0, 2.0].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleConfigChange({ ...activeConfig, stake: amt, winAmount: amt })}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    activeConfig.stake === amt
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ${amt.toFixed(2)}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Net profit on single match win: +${((activeConfig.stake || 0.35) * 7.3428).toFixed(2)} USD
            </div>
          </div>

          {/* Parameter 2: Expected Profit (Take Profit) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
              <span>Expected Profit</span>
              <span className="text-cyan-400 font-bold">${(activeConfig.expectedProfit || 20).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[10, 20, 50, 100].map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => handleConfigChange({ ...activeConfig, expectedProfit: tp })}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    activeConfig.expectedProfit === tp
                      ? 'bg-cyan-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ${tp}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Bot automatically pauses and secures capital upon reaching target.
            </div>
          </div>

          {/* Parameter 3: Max Acceptable Loss (Stop Loss) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold">
              <span>Max Acceptable Loss</span>
              <span className="text-rose-400 font-bold">${(activeConfig.maxAcceptableLoss || 50).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[25, 50, 75, 100].map((sl) => (
                <button
                  key={sl}
                  type="button"
                  onClick={() => handleConfigChange({ ...activeConfig, maxAcceptableLoss: sl })}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    activeConfig.maxAcceptableLoss === sl
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ${sl}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Hard circuit breaker halts trading if drawdown hits this limit.
            </div>
          </div>

          {/* Parameter 4: Next Trade Condition */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Next Trade Condition
            </div>
            <select
              value={activeConfig.nextTradeCondition || 'MARTINGALE'}
              onChange={(e) =>
                handleConfigChange({
                  ...activeConfig,
                  nextTradeCondition: e.target.value as any,
                })
              }
              className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="MARTINGALE">Smart Martingale (1.15x per loss)</option>
              <option value="SAME_LOSS_RECOVERY">Same-Loss-Price (1 Win Recovers All)</option>
              <option value="RESET_ON_WIN">Fixed Base Stake (No Martingale)</option>
            </select>
            <div className="text-[10px] text-slate-500 font-mono">
              Due to 8.34x payout, 1 win recovers multiple prior losses easily.
            </div>
          </div>
        </div>

        {/* Prediction Target Strategy Row */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              Target Digit Strategy:
            </div>
            <div className="text-[11px] text-slate-400">
              Select how the predicted match digit is determined for each 1HZ10V contract:
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleConfigChange({ ...activeConfig, targetStrategy: 'REPEAT_ENTRY', customTargetDigit: undefined })}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                activeConfig.targetStrategy === 'REPEAT_ENTRY' && activeConfig.customTargetDigit === undefined
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Repeat Entry Spot (Screenshot Mode)
            </button>

            <button
              type="button"
              onClick={() => handleConfigChange({ ...activeConfig, targetStrategy: 'MARKOV_TRANSITION', customTargetDigit: undefined })}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                activeConfig.targetStrategy === 'MARKOV_TRANSITION'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Markov Transition Edge
            </button>

            {/* Custom Target Digit Picker */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 px-1">Fixed:</span>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleConfigChange({ ...activeConfig, targetStrategy: 'CUSTOM', customTargetDigit: d })}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold transition cursor-pointer ${
                    activeConfig.customTargetDigit === d
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE DERIV STATEMENT RECEIPTS (Pixel-perfect audit trail of all real matches trades) */}
      <DerivStatementReceipts
        trades={tradeHistory.filter((t) => t.contractType === 'MATCHES')}
        onClearHistory={onClearHistory}
        currency="USD"
      />

      {/* MULTI-MARKET STATISTICAL RADAR */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Real-Time Synthetic Index Rankings ({signals.length} Markets)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Active: <strong className="text-emerald-400">{currentSymbol}</strong> (Click any to switch)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Market</th>
                <th className="py-2.5 px-3">Target Digit</th>
                <th className="py-2.5 px-3">Markov Prob</th>
                <th className="py-2.5 px-3">Surge Frequency</th>
                <th className="py-2.5 px-3">Delay</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-4 text-right">Switch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {signals.map((sig, idx) => {
                const isSelected = sig.symbol === currentSymbol;

                return (
                  <tr
                    key={sig.symbol}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-slate-500 font-bold text-[11px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {sig.displayName}
                            {isSelected && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{sig.symbol}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded bg-purple-600/30 border border-purple-500/50 text-purple-200 font-black text-sm">
                        {sig.targetDigit}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-emerald-400">{sig.markovProbability}%</span>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {sig.recentClusterCount} in 30t
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-amber-400 font-bold">{sig.delayTicks}t</span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black text-sm ${
                          sig.probabilityScore >= 88
                            ? 'text-emerald-400'
                            : sig.probabilityScore >= 80
                            ? 'text-teal-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {sig.probabilityScore}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectMarket(sig.symbol)}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isSelected ? 'Loaded' : 'Switch'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
