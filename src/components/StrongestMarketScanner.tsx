import React from 'react';
import { MarketAnalysis } from '../types';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Flame,
  Play,
  Snowflake,
  Square,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';

interface StrongestMarketScannerProps {
  analyses: Record<string, MarketAnalysis>;
  currentSymbol: string;
  onSelectMarket: (symbol: string) => void;
  onApplySignalToRecovery?: (analysis: MarketAnalysis) => void;
  watchlist?: string[];
  onToggleWatchlist?: (symbol: string) => void;
  isRunning?: boolean;
  onToggleRun?: (running: boolean) => void;
}

export const StrongestMarketScanner: React.FC<StrongestMarketScannerProps> = ({
  analyses,
  currentSymbol,
  onSelectMarket,
  onApplySignalToRecovery,
  watchlist = [],
  onToggleWatchlist,
  isRunning = false,
  onToggleRun,
}) => {
  const sorted = (Object.values(analyses) as MarketAnalysis[]).sort((a, b) => b.winScore - a.winScore);
  const strongest = sorted[0];

  const badge = (contract: MarketAnalysis['recommendedContract']) => {
    if (contract === 'MATCHES') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (contract === 'DIFFERS') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (contract === 'OVER' || contract === 'UNDER') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    return contract === 'RISE' ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  };

  if (!strongest) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
        <div className="text-slate-300 text-sm font-bold">Waiting for real Deriv market samples…</div>
        <div className="text-slate-500 text-xs mt-1">No ranking is shown until actual tick history arrives.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5" /> Strongest observed signal
              </span>
              <span className="text-xs text-slate-400 font-mono">Ranked from real Deriv ticks • not a win guarantee</span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-white">{strongest.displayName}</h2>
              <span className="text-sm font-mono text-slate-400">{strongest.symbol}</span>
              <span className="text-sm font-mono font-bold text-amber-400">{strongest.currentPrice > 0 ? strongest.currentPrice.toFixed(2) : '—'}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">{strongest.rationale}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Signal score</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{strongest.winScore}/100</div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Observed setup</div>
              <div className={`text-xs font-extrabold px-2 py-0.5 mt-1 rounded border ${badge(strongest.recommendedContract)}`}>
                {strongest.recommendedContract} {strongest.recommendedTarget}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {onToggleRun && (
                <button onClick={() => onToggleRun(!isRunning)} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 ${isRunning ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'}`}>
                  {isRunning ? <><Square className="w-3.5 h-3.5 fill-white" /> STOP BOT</> : <><Play className="w-3.5 h-3.5 fill-slate-950" /> RUN SIGNAL BOT</>}
                </button>
              )}
              <button onClick={() => onSelectMarket(strongest.symbol)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1">
                Inspect market <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {onApplySignalToRecovery && (
                <button onClick={() => onApplySignalToRecovery(strongest)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 text-[11px] border border-slate-800">Apply setup</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-bold text-white uppercase">Deriv market signal matrix</h3></div>
          <span className="text-[11px] text-slate-400 font-mono">Observed data only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr><th className="py-2.5 px-4">Market</th><th className="py-2.5 px-3">Price / digit</th><th className="py-2.5 px-3">Trend</th><th className="py-2.5 px-3">Digits</th><th className="py-2.5 px-3">Setup</th><th className="py-2.5 px-3">Score</th><th className="py-2.5 px-4 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map((market, index) => (
                <tr key={market.symbol} className={market.symbol === currentSymbol ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {onToggleWatchlist && <button onClick={() => onToggleWatchlist(market.symbol)}><Star className={`w-3.5 h-3.5 ${watchlist.includes(market.symbol) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} /></button>}
                      <span className="text-slate-500 font-mono w-4">{index + 1}</span>
                      <div><div className="font-bold text-white">{market.displayName}</div><div className="text-[10px] text-slate-500 font-mono">{market.symbol}</div></div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono"><div className="text-white font-bold">{market.currentPrice.toFixed(2)} <span className="text-amber-300">[{market.lastDigit}]</span></div><div className={`text-[10px] flex items-center ${market.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{market.priceChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{market.priceChangePct}%</div></td>
                  <td className="py-3 px-3"><span className="text-slate-200 text-[10px] font-bold">{market.trend.replace('_', ' ')}</span><div className="text-[10px] text-slate-500">RSI {market.rsi}</div></td>
                  <td className="py-3 px-3 font-mono"><div className="flex gap-2"><span className="text-emerald-400 flex items-center"><Flame className="w-3 h-3" />{market.hotDigit}</span><span className="text-sky-400 flex items-center"><Snowflake className="w-3 h-3" />{market.coldDigit}</span></div><div className="text-[10px] text-slate-500">E {market.evenPct}% / O {market.oddPct}%</div></td>
                  <td className="py-3 px-3"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge(market.recommendedContract)}`}>{market.recommendedContract} {market.recommendedTarget}</span></td>
                  <td className="py-3 px-3"><span className="font-mono font-extrabold text-emerald-400">{market.winScore}/100</span></td>
                  <td className="py-3 px-4 text-right"><button onClick={() => onSelectMarket(market.symbol)} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold">Select</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
