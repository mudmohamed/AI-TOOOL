/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  Award,
  CheckCircle,
  Clock,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { TickData, TradeRecord } from '../types';

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
  const isRunning = Boolean(activeTrade && activeTrade.status === 'PENDING');

  if (!isRunning && !lastSettledTrade) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          <span className="font-bold text-slate-300">DERIV CONTRACT MONITOR</span>
          <span className="text-slate-500">Waiting for a Deriv proposal/buy.</span>
        </div>
        {recentTrades.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <span className="text-[10px] text-slate-500 uppercase">Recent:</span>
            {recentTrades.slice(0, 5).map((trade) => (
              <span key={trade.id} className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.status === 'WON' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {trade.status} {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isRunning && activeTrade && (
        <div className="rounded-2xl border border-cyan-500/60 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-cyan-500/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-mono font-black border border-cyan-500/40">DERIV CONTRACT PENDING</span>
                  <span className="text-xs font-mono font-bold text-white">{activeTrade.symbol} • {activeTrade.contractType}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">Contract/request #{activeTrade.id.slice(-12)} • waiting for Deriv settlement</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-black">
              <Activity className="w-3.5 h-3.5 animate-pulse" /> LIVE
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Metric label="Entry reference" value={activeTrade.entryPrice > 0 ? activeTrade.entryPrice.toString() : 'Awaiting Deriv'} />
            <Metric label="Target" value={String(activeTrade.targetValue)} accent="cyan" />
            <Metric label="Stake / buy price" value={`$${activeTrade.stake.toFixed(2)}`} />
            <Metric label="Live tick" value={latestTick ? `${latestTick.quote} [${latestTick.lastDigit}]` : 'Awaiting tick'} accent="amber" />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-500">Quoted payout: </span>
              <span className="text-slate-200 font-bold">{activeTrade.payout > 0 ? `${activeTrade.payout.toFixed(4)}x gross` : 'Awaiting Deriv proposal'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-cyan-300"><Clock className="w-3.5 h-3.5" /> No local timeout settlement</div>
          </div>

          {onClearActiveTrade && (
            <div className="text-[10px] text-slate-500">Dismiss only hides this card; it does not cancel an open Deriv contract.</div>
          )}
        </div>
      )}

      {lastSettledTrade && (
        <div className={`rounded-2xl border p-4 sm:p-5 shadow-xl ${lastSettledTrade.status === 'WON' ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/60 border-emerald-500/70' : 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border-rose-500/70'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lastSettledTrade.status === 'WON' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'}`}>
                {lastSettledTrade.status === 'WON' ? <Award className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-0.5 rounded-full text-xs font-mono font-black ${lastSettledTrade.status === 'WON' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/30 text-rose-300'}`}>
                    {lastSettledTrade.status === 'WON' ? 'DERIV SETTLED — WON' : 'DERIV SETTLED — LOST'}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{lastSettledTrade.symbol}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">Contract #{lastSettledTrade.id} • {new Date(lastSettledTrade.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Actual contract profit</div>
                <div className={`text-xl sm:text-2xl font-black font-mono ${lastSettledTrade.profit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {lastSettledTrade.profit >= 0 ? '+' : ''}${lastSettledTrade.profit.toFixed(2)}
                </div>
              </div>
              {onClearLastSettled && (
                <button onClick={onClearLastSettled} className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white" title="Dismiss">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
            <Metric label="Entry spot" value={`${lastSettledTrade.entryPrice} [${lastSettledTrade.entryDigit}]`} />
            <Metric label="Target" value={String(lastSettledTrade.targetValue)} accent="cyan" />
            <Metric label="Exit spot" value={lastSettledTrade.exitPrice !== undefined ? `${lastSettledTrade.exitPrice} [${lastSettledTrade.exitDigit ?? '-'}]` : '—'} />
            <Metric label="Buy price" value={`$${lastSettledTrade.stake.toFixed(2)}`} />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            {lastSettledTrade.status === 'WON' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
            <span>Result recorded only after proposal_open_contract reported settlement.</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; accent?: 'cyan' | 'amber' }> = ({ label, value, accent }) => (
  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
    <div className={`text-[10px] uppercase font-bold font-mono ${accent === 'cyan' ? 'text-cyan-400' : accent === 'amber' ? 'text-amber-400' : 'text-slate-400'}`}>{label}</div>
    <div className="text-sm font-mono font-bold text-white break-all">{value}</div>
  </div>
);
