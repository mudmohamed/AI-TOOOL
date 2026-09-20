import React from 'react';
import { MarketAnalysis } from '../types';
import {
  Trophy,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Flame,
  Snowflake,
  ChevronRight,
  Star,
  Play,
  Square,
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
  const analysisList: MarketAnalysis[] = Object.values(analyses);

  // Sort by winScore descending
  const sortedAnalyses = [...analysisList].sort((a, b) => b.winScore - a.winScore);
  const strongestMarket = sortedAnalyses[0];

  if (!strongestMarket) {
    return (
      <div id="market-scanner-loading" className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center animate-pulse">
        <div className="text-slate-400 text-sm font-medium">Scanning Deriv Live Markets for Strongest Win Potential...</div>
      </div>
    );
  }

  const getContractBadge = (contract: MarketAnalysis['recommendedContract']) => {
    switch (contract) {
      case 'MATCHES':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'DIFFERS':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'OVER':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'UNDER':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'RISE':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'FALL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
  };

  return (
    <div id="strongest-market-scanner" className="space-y-4">
      {/* Spotlight Top Recommendation */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-lg shadow-emerald-950/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Strongest to Win Right Now
              </span>
              <span className="text-xs text-slate-400 font-mono">100% Real Deriv Live Algorithm</span>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {strongestMarket.displayName}
                </h2>
                {onToggleWatchlist && (
                  <button
                    onClick={() => onToggleWatchlist(strongestMarket.symbol)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-amber-400 transition-colors"
                    title={
                      watchlist.includes(strongestMarket.symbol)
                        ? 'Remove from Watchlist'
                        : 'Add to Watchlist'
                    }
                  >
                    <Star
                      className={`w-5 h-5 ${
                        watchlist.includes(strongestMarket.symbol)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-500 hover:text-amber-400'
                      }`}
                    />
                  </button>
                )}
              </div>
              <span className="text-sm font-mono text-slate-400">({strongestMarket.symbol})</span>
              <span className="text-sm font-mono font-bold text-amber-400">
                Live Price: {strongestMarket.currentPrice.toFixed(2)}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              <span className="font-semibold text-emerald-400">Quantitative Rationale: </span>
              {strongestMarket.rationale}
            </p>
          </div>

          {/* Right Metrics & Quick Apply */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 shrink-0">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Win Confidence</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {strongestMarket.winScore}%
              </div>
            </div>

            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Recommended</div>
              <div className={`text-xs font-extrabold px-2 py-0.5 mt-1 rounded border ${getContractBadge(strongestMarket.recommendedContract)}`}>
                {strongestMarket.recommendedContract} {strongestMarket.recommendedTarget}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {onToggleRun && (
                <button
                  id="run-strongest-bot-btn"
                  onClick={() => onToggleRun(!isRunning)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    isRunning
                      ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-500/30'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>STOP BOT (RUNNING)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>RUN STRONGEST BOT</span>
                    </>
                  )}
                </button>
              )}
              <button
                id="select-strongest-market-btn"
                onClick={() => onSelectMarket(strongestMarket.symbol)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
              >
                Inspect Market
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {onApplySignalToRecovery && (
                <button
                  id="apply-strongest-signal-btn"
                  onClick={() => onApplySignalToRecovery(strongestMarket)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors border border-slate-800"
                >
                  Apply to Recovery
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scanned Markets Table/Cards */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">
              Deriv Synthetic Indices Matrix ({analysisList.length} Real-Time Scanners)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Live WebSocket Streaming</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Market</th>
                <th className="py-2.5 px-3">Price & Digit</th>
                <th className="py-2.5 px-3">Trend / RSI</th>
                <th className="py-2.5 px-3">Hot / Cold Digits</th>
                <th className="py-2.5 px-3">Strongest Strategy</th>
                <th className="py-2.5 px-3 text-center">Win Score</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedAnalyses.map((m, idx) => {
                const isSelected = m.symbol === currentSymbol;
                const isTop = idx === 0;

                return (
                  <tr
                    key={m.symbol}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {onToggleWatchlist && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleWatchlist(m.symbol);
                            }}
                            className="p-1 rounded text-amber-400 hover:bg-slate-800 transition-colors"
                            title={
                              watchlist.includes(m.symbol)
                                ? 'Remove from Watchlist'
                                : 'Add to Watchlist'
                            }
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                watchlist.includes(m.symbol)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-600 hover:text-amber-400'
                              }`}
                            />
                          </button>
                        )}
                        {isTop ? (
                          <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-[10px]">
                            1
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px] w-5 text-center">
                            {idx + 1}
                          </span>
                        )}
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {m.displayName}
                            {isSelected && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.symbol}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="text-white font-bold">
                        {m.currentPrice.toFixed(2)}
                        <span className="ml-1 px-1 rounded bg-amber-400/20 text-amber-300 text-[11px]">
                          [{m.lastDigit}]
                        </span>
                      </div>
                      <div className={`text-[10px] flex items-center gap-0.5 ${m.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.priceChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {m.priceChangePct >= 0 ? '+' : ''}{m.priceChangePct}%
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.trend.includes('BULLISH')
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : m.trend.includes('BEARISH')
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {m.trend.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        RSI: <span className={m.rsi > 70 ? 'text-rose-400 font-bold' : m.rsi < 30 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{m.rsi}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="flex items-center gap-0.5 text-emerald-400" title="Hot Digit (High Frequency)">
                          <Flame className="w-3 h-3 text-emerald-400" />
                          {m.hotDigit}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="flex items-center gap-0.5 text-sky-400" title="Cold Digit (Low Frequency)">
                          <Snowflake className="w-3 h-3 text-sky-400" />
                          {m.coldDigit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Ev: {m.evenPct}% / Od: {m.oddPct}%
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getContractBadge(m.recommendedContract)}`}>
                        {m.recommendedContract} {m.recommendedTarget}
                      </span>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5" title={m.rationale}>
                        {m.rationale}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`font-mono font-extrabold text-sm ${
                        m.winScore >= 90
                          ? 'text-emerald-400'
                          : m.winScore >= 80
                          ? 'text-teal-400'
                          : 'text-slate-300'
                      }`}>
                        {m.winScore}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectMarket(m.symbol)}
                        className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isSelected ? 'Loaded' : 'Analyze'}
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
