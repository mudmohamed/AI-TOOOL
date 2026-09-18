/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AutoMatchesConfig, AutoMatchesSignal, MarketAnalysis, TradeRecord } from '../types';
import { findBestAutoMatchesTarget } from '../utils/autoMatchesEngine';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Target,
  Zap,
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
  autoMatchesConfig,
  onAutoMatchesConfigChange,
  accountMode = 'REAL',
  currentBalance = 0,
  onOpenCashier,
}) => {
  const [internalConfig, setInternalConfig] = useState<AutoMatchesConfig>({
    market: '1HZ10V',
    stake: 0.35,
    winAmount: 0.35,
    expectedProfit: 20,
    maxAcceptableLoss: 50,
    nextTradeCondition: 'RESET_ON_WIN',
    martingaleFactor: 1,
    restartOnError: true,
    executionSpeed: 'FAST',
    targetStrategy: 'MARKOV_TRANSITION',
  });
  const config = autoMatchesConfig || internalConfig;

  const updateConfig = (next: AutoMatchesConfig) => {
    if (onAutoMatchesConfigChange) onAutoMatchesConfigChange(next);
    else setInternalConfig(next);
  };

  const signals: AutoMatchesSignal[] = Object.entries(marketTicks)
    .map(([symbol, data]) => {
      const analysis = analyses[symbol];
      if (!analysis || !data?.digits || data.digits.length < 30) return null;
      return findBestAutoMatchesTarget(symbol, analysis.displayName, data.digits, analysis.digitStats, analysis.lastDigit);
    })
    .filter((signal): signal is AutoMatchesSignal => Boolean(signal))
    .sort((a, b) => b.probabilityScore - a.probabilityScore);

  const activeAnalysis = analyses[currentSymbol];
  const activeTicks = marketTicks[currentSymbol];
  const lastObservedDigit = activeAnalysis?.lastDigit ?? activeTicks?.digits?.slice(-1)[0] ?? 0;
  const bestSignal = signals.find((signal) => signal.symbol === currentSymbol) || signals[0];

  const manualTarget = config.customTargetDigit !== undefined
    ? config.customTargetDigit
    : config.targetStrategy === 'HOTTEST_CLUSTER'
      ? activeAnalysis?.hotDigit ?? lastObservedDigit
      : config.targetStrategy === 'MARKOV_TRANSITION'
        ? bestSignal?.targetDigit ?? lastObservedDigit
        : lastObservedDigit;

  const handleManualTrade = () => {
    onSimulateTrade({
      contractType: 'MATCHES',
      targetValue: manualTarget,
      stake: config.stake || baseStake || 0.35,
      symbol: currentSymbol,
      entryDigit: lastObservedDigit,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-slate-100">Live Deriv Matches analysis</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Payout is requested live from Deriv before every buy</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <Guide title="Real data" text="The scanner uses only tick history and tick streams returned by Deriv. No generated seed prices are used." />
          <Guide title="Observed evidence" text="Markov and digit-frequency values are measured from the selected real sample. They are not guaranteed win percentages." />
          <Guide title="Real settlement" text="A trade is marked WON or LOST only after Deriv returns a settled proposal_open_contract result." />
        </div>
      </div>

      <div className="p-4 sm:p-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-black flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> DIGITMATCH ENGINE</span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">Market: <strong className="text-white">{currentSymbol}</strong></span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Live Matches Bot</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">The app first requests a real Deriv proposal. The real ask price and payout returned by Deriv are then used for the buy; no fixed 834%/950% payout is assumed.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 px-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div className="text-[9px] uppercase text-slate-400 font-bold">{accountMode === 'REAL' ? 'Real balance' : 'Virtual balance'}</div>
              <div className="text-sm font-black text-emerald-400">${currentBalance.toFixed(2)}</div>
            </div>
            {onOpenCashier && <button onClick={onOpenCashier} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">Official Cashier</button>}
            <button onClick={handleManualTrade} disabled={autoMatchesActive || !activeTicks?.digits?.length} className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-mono font-bold text-xs flex items-center gap-2 border border-slate-700"><Zap className="w-4 h-4 text-amber-400" /> TRADE 1 TICK (${(config.stake || 0.35).toFixed(2)})</button>
            <button onClick={() => onToggleAutoMatches(!autoMatchesActive)} className={`px-7 py-3 rounded-xl font-mono font-black text-sm flex items-center gap-2.5 ${autoMatchesActive ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'}`}>
              {autoMatchesActive ? <><Square className="w-4 h-4 fill-white" /> STOP AUTO</> : <><Play className="w-4 h-4 fill-slate-950" /> RUN AUTO</>}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2"><Target className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-bold text-white">Observed Matches candidates</h3></div>
            <div className="flex items-center gap-2">
              <select value={scanDepth} onChange={(e) => onScanDepthChange(Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono">
                {[100, 250, 500, 1000, 1500, 2000].map((depth) => <option key={depth} value={depth}>{depth} ticks</option>)}
              </select>
              <button onClick={() => onTriggerDeepScan(scanDepth)} disabled={isDeepScanning} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isDeepScanning ? 'animate-spin' : ''}`} /> {isDeepScanning ? 'Loading real history…' : 'Deep Scan'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px]"><tr><th className="text-left p-3">Market</th><th className="text-left p-3">Target</th><th className="text-left p-3">Observed score</th><th className="text-left p-3">Markov</th><th className="text-left p-3">Recent</th><th className="text-left p-3">State</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {signals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Waiting for enough real Deriv ticks to rank signals.</td></tr>}
                {signals.map((signal) => (
                  <tr key={signal.symbol} onClick={() => onSelectMarket(signal.symbol)} className={`cursor-pointer hover:bg-slate-800/40 ${signal.symbol === currentSymbol ? 'bg-purple-500/5' : ''}`}>
                    <td className="p-3"><div className="font-bold text-white">{signal.displayName}</div><div className="text-[10px] text-slate-500 font-mono">{signal.symbol}</div></td>
                    <td className="p-3"><span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-black">{signal.targetDigit}</span></td>
                    <td className="p-3 font-mono text-emerald-300 font-bold">{signal.probabilityScore.toFixed(1)}%</td>
                    <td className="p-3 font-mono text-cyan-300">{signal.markovProbability.toFixed(1)}%</td>
                    <td className="p-3 font-mono text-slate-300">{signal.recentClusterCount}/30</td>
                    <td className="p-3">{signal.isTriggerReady ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> evidence gate</span> : <span className="text-slate-500">waiting</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-bold text-white">Execution settings</h3></div>
          <label className="block text-xs text-slate-400">Stake
            <input type="number" min="0.01" step="0.01" value={config.stake} onChange={(e) => updateConfig({ ...config, stake: Math.max(0.01, Number(e.target.value)) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono" />
          </label>
          <label className="block text-xs text-slate-400">Target strategy
            <select value={config.targetStrategy} onChange={(e) => updateConfig({ ...config, targetStrategy: e.target.value as AutoMatchesConfig['targetStrategy'] })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs">
              <option value="MARKOV_TRANSITION">Observed Markov transition</option>
              <option value="HOTTEST_CLUSTER">Observed hottest digit</option>
              <option value="REPEAT_ENTRY">Repeat current digit</option>
              <option value="CUSTOM">Custom target</option>
            </select>
          </label>
          {config.targetStrategy === 'CUSTOM' && (
            <label className="block text-xs text-slate-400">Custom digit
              <input type="number" min="0" max="9" value={config.customTargetDigit ?? 0} onChange={(e) => updateConfig({ ...config, customTargetDigit: Math.max(0, Math.min(9, Number(e.target.value))) })} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono" />
            </label>
          )}
          <label className="block text-xs text-slate-400">Run & Stop Mode
            <select
              value={config.stopConditionMode ?? 'ONLY_MANUAL_OR_TARGET'}
              onChange={(e) => updateConfig({ ...config, stopConditionMode: e.target.value as AutoMatchesConfig['stopConditionMode'] })}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
            >
              <option value="ONLY_MANUAL_OR_TARGET">24/7 Run (Stop only by me or Target 100%)</option>
              <option value="STOP_ON_MAX_LOSS">Stop on Max Loss Limit</option>
            </select>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={config.profitShieldActive ?? true}
              onChange={(e) => updateConfig({ ...config, profitShieldActive: e.target.checked })}
              className="rounded text-emerald-500 focus:ring-emerald-400"
            />
            <div>
              <div className="font-bold text-emerald-400">100% Won Profit Vault Shield</div>
              <div className="text-[10px] text-slate-400">Lock in won profits: never give back accumulated profit</div>
            </div>
          </label>

          <label className="block text-xs text-slate-400">Target Profit ($)
            <input
              type="number"
              min="1"
              step="1"
              value={config.expectedProfit ?? 20}
              onChange={(e) => updateConfig({ ...config, expectedProfit: Math.max(1, Number(e.target.value)) })}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
            />
          </label>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono space-y-1">
            <div>Trades settled: {sessionStats.totalTrades}</div>
            <div>Wins / losses: {sessionStats.wins} / {sessionStats.losses}</div>
            <div>Actual session P/L: <span className={sessionStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{sessionStats.netProfit >= 0 ? '+' : ''}${sessionStats.netProfit.toFixed(2)}</span></div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Signal statistics cannot guarantee the next digit. Contract price and payout are accepted only from the live Deriv proposal.</span></div>
        </div>
      </div>
    </div>
  );
};

const Guide: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
    <div className="text-emerald-400 font-bold flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> {title}</div>
    <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
  </div>
);
