/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Target,
  ArrowRight,
  Shield,
  Activity,
  Award,
  Sparkles,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { TradeRecord, TickData } from '../types';

interface DerivActiveTradeRunnerProps {
  activeTrade?: TradeRecord | null;
  lastSettledTrade?: TradeRecord | null;
  latestTick?: TickData | null;
  recentTrades?: TradeRecord[];
  onClearActiveTrade?: () => void;
  onClearLastSettled?: () => void;
}

export const DerivActiveTradeRunner: React.FC<DerivActiveTradeRunnerProps> = ({
  activeTrade,
  lastSettledTrade,
  latestTick,
  recentTrades = [],
  onClearActiveTrade,
  onClearLastSettled,
}) => {
  const isRunning = activeTrade && activeTrade.status === 'PENDING';
  const hasSettled = Boolean(lastSettledTrade);

  // If there's neither an active running trade nor a recently settled trade, render a standby ticker
  if (!isRunning && !hasSettled) {
    return (
      <div
        id="deriv-trade-runner-idle"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-300">
            DERIV LIVE CONTRACT MONITOR:
          </span>
          <span className="text-slate-400">
            Awaiting order dispatch (Auto Bot or Manual 1-Click Trade)
          </span>
        </div>

        {recentTrades.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <span className="text-[10px] text-slate-500 uppercase">Recent:</span>
            {recentTrades.slice(-5).reverse().map((t, idx) => (
              <span
                key={`${t.id}-${idx}`}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  t.status === 'WON'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {t.status === 'WON' ? `WON +$${t.profit.toFixed(2)}` : `LOST -$${t.stake.toFixed(2)}`}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="deriv-active-trade-runner-container" className="space-y-3">
      {/* 1. RUNNING TRADE BANNER (Visible when trade is active on Deriv) */}
      {isRunning && (
        <div
          id="deriv-running-trade-card"
          className="rounded-2xl border border-cyan-500/60 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 sm:p-5 shadow-2xl shadow-cyan-950/50 ring-2 ring-cyan-500/30 animate-pulse space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-cyan-500/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5 animate-bounce fill-cyan-400/30" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-mono font-black tracking-wider uppercase border border-cyan-500/40">
                    LIVE CONTRACT RUNNING
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {activeTrade.symbol} • {activeTrade.contractType}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>Contract #{activeTrade.id.slice(-8)}</span>
                  <span>•</span>
                  <span>Duration: 1 Tick</span>
                  <span>•</span>
                  <span className="text-cyan-400 font-bold">Awaiting Next Tick Settlement</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-black animate-pulse">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>EXECUTING ON DERIV...</span>
              </div>
            </div>
          </div>

          {/* Spots Comparison Visualizer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Entry Spot */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center justify-between">
                <span>Entry Spot</span>
                <span className="text-slate-500">Tick 0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-mono font-bold text-white">
                  {activeTrade.entryPrice.toFixed(activeTrade.entryPrice < 10 ? 3 : 2)}
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-mono font-black text-sm">
                  {activeTrade.entryDigit}
                </div>
              </div>
            </div>

            {/* Target Match Barrier */}
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-1">
              <div className="text-[10px] uppercase font-bold text-cyan-400 font-mono flex items-center justify-between">
                <span>Target Match Digit</span>
                <span className="text-[9px] bg-cyan-500/20 px-1.5 py-0.2 rounded font-black text-cyan-300">
                  PAYOUT ~834%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Target Match:</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/30 border border-cyan-400 text-cyan-200 flex items-center justify-center font-mono font-black text-base shadow-lg shadow-cyan-950">
                  {activeTrade.targetValue}
                </div>
              </div>
            </div>

            {/* Exit Spot In-Flight */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 font-mono flex items-center justify-between">
                <span>Exit Spot</span>
                <span className="text-amber-400 animate-pulse font-bold">Tick 1 (Incoming)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  {latestTick ? latestTick.quote.toFixed(2) : 'Awaiting quote...'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center justify-center font-mono font-bold text-sm animate-pulse">
                  {latestTick ? latestTick.lastDigit : '?'}
                </div>
              </div>
            </div>
          </div>

          {/* Potential Return Strip */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Stake:</span>
                <span className="font-bold text-white">${activeTrade.stake.toFixed(2)} USD</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Potential Net Win:</span>
                <span className="font-bold text-emerald-400">
                  +${(activeTrade.stake * 7.3428).toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="text-[11px] text-cyan-300 font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>1-second settlement cycle...</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. LAST SETTLED CONTRACT (Pixel-perfect Deriv Settlement Card with WON / LOST results) */}
      {lastSettledTrade && (
        <div
          id="deriv-settled-trade-card"
          className={`rounded-2xl border p-4 sm:p-5 shadow-2xl transition-all duration-300 ${
            lastSettledTrade.status === 'WON'
              ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/70 border-emerald-500 ring-2 ring-emerald-400/50 shadow-emerald-950/80'
              : 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/70 border-rose-500 ring-2 ring-rose-400/40 shadow-rose-950/80'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shadow-lg ${
                  lastSettledTrade.status === 'WON'
                    ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 animate-bounce'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                }`}
              >
                {lastSettledTrade.status === 'WON' ? (
                  <Award className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-mono font-black uppercase tracking-wider ${
                      lastSettledTrade.status === 'WON'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                    }`}
                  >
                    {lastSettledTrade.status === 'WON'
                      ? '🎉 CONTRACT WON (DERIV CONFIRMED)'
                      : '❌ CONTRACT LOST'}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {lastSettledTrade.symbol}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                  <span>Contract #{lastSettledTrade.id.slice(-8)}</span>
                  <span>•</span>
                  <span>Settled at {new Date(lastSettledTrade.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Big Net Result Badge */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                  {lastSettledTrade.status === 'WON' ? 'Net Payout Credited' : 'Loss Realized'}
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                    lastSettledTrade.status === 'WON'
                      ? 'text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                      : 'text-rose-400'
                  }`}
                >
                  {lastSettledTrade.status === 'WON'
                    ? `+$${lastSettledTrade.profit.toFixed(2)} USD`
                    : `-$${Math.abs(lastSettledTrade.profit).toFixed(2)} USD`}
                </div>
              </div>

              {onClearLastSettled && (
                <button
                  onClick={onClearLastSettled}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Dismiss settlement banner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Deriv Settlement Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-mono font-bold">
                Entry Spot
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-mono text-slate-200">
                  {lastSettledTrade.entryPrice.toFixed(lastSettledTrade.entryPrice < 10 ? 3 : 2)}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold text-xs">
                  Digit: {lastSettledTrade.entryDigit}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] uppercase text-cyan-400 font-mono font-bold">
                Target Match
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-mono text-cyan-300">Target:</span>
                <span className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 flex items-center justify-center font-mono font-black text-xs">
                  {lastSettledTrade.targetValue}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-mono font-bold">
                Exit Spot
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-mono text-slate-200">
                  {lastSettledTrade.exitPrice?.toFixed(lastSettledTrade.exitPrice < 10 ? 3 : 2) ?? '--'}
                </span>
                <span
                  className={`w-6 h-6 rounded flex items-center justify-center font-mono font-black text-xs ${
                    lastSettledTrade.status === 'WON'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {lastSettledTrade.exitDigit ?? '--'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-mono font-bold">
                Contract Outcome
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs font-mono font-bold">
                {lastSettledTrade.status === 'WON' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    Digit #{lastSettledTrade.targetValue} Matched!
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <X className="w-4 h-4 text-rose-400" />
                    Exit #{lastSettledTrade.exitDigit} != #{lastSettledTrade.targetValue}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Trade Sequence Feed */}
          {recentTrades.length > 1 && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <span className="text-[11px] text-slate-400">Recent Session Trades:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
                {recentTrades.slice(-6).reverse().map((t, idx) => (
                  <span
                    key={`${t.id}-${idx}`}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.status === 'WON'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {t.status === 'WON' ? `WON +$${t.profit.toFixed(2)}` : `LOST -$${t.stake.toFixed(2)}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
