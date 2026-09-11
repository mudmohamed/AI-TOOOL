/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MarketAnalysis } from '../types';
import { Star, ChevronRight, X, Sparkles, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';

interface WatchlistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
  analyses: Record<string, MarketAnalysis>;
  currentSymbol: string;
  onSelectMarket: (symbol: string) => void;
  onApplyToRecovery?: (analysis: MarketAnalysis) => void;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
  isOpen,
  onClose,
  watchlist,
  onToggleWatchlist,
  analyses,
  currentSymbol,
  onSelectMarket,
  onApplyToRecovery,
}) => {
  if (!isOpen) return null;

  const watchlistAnalyses = watchlist
    .map((sym) => analyses[sym])
    .filter((a): a is MarketAnalysis => Boolean(a));

  return (
    <aside
      id="watchlist-persistent-panel"
      aria-label="Starred Symbols Watchlist"
      className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
              Starred Watchlist
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold">
                {watchlist.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Persistent real-time monitored markets</p>
          </div>
        </div>

        <button
          id="close-watchlist-btn"
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          title="Close Watchlist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Watchlist Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {watchlist.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3 my-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <Star className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-300">Your Watchlist is Empty</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click the <Star className="w-3.5 h-3.5 inline text-amber-400 mx-0.5" /> star toggle on any symbol in the Scanner to pin it here for instant monitoring.
            </p>
          </div>
        ) : (
          watchlistAnalyses.map((m) => {
            const isSelected = m.symbol === currentSymbol;

            return (
              <div
                key={m.symbol}
                className={`p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: Name, Star Toggle, Win Score */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white">{m.displayName}</h4>
                      {isSelected && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{m.symbol}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {m.winScore}%
                    </span>
                    <button
                      onClick={() => onToggleWatchlist(m.symbol)}
                      className="p-1 text-amber-400 hover:text-amber-300 transition-colors"
                      title="Remove from watchlist"
                    >
                      <Star className="w-4 h-4 fill-amber-400" />
                    </button>
                  </div>
                </div>

                {/* Price, Last Digit, Price Change */}
                <div className="flex items-baseline justify-between text-xs font-mono mb-2.5">
                  <div className="flex items-center gap-1 text-white font-bold">
                    <span>${m.currentPrice.toFixed(2)}</span>
                    <span className="px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[11px] font-black">
                      [{m.lastDigit}]
                    </span>
                  </div>

                  <div
                    className={`text-[10px] flex items-center gap-0.5 font-bold ${
                      m.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {m.priceChange >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {m.priceChangePct >= 0 ? '+' : ''}
                    {m.priceChangePct}%
                  </div>
                </div>

                {/* Quick Info & Target Strategy */}
                <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 mb-2.5">
                  <div className="flex items-center gap-1 text-purple-300">
                    <Target className="w-3 h-3 text-purple-400" />
                    <span className="font-bold">{m.recommendedContract} {m.recommendedTarget}</span>
                  </div>
                  <div className="text-slate-400">
                    RSI: <span className="text-slate-200">{m.rsi}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectMarket(m.symbol);
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isSelected ? 'Loaded in Terminal' : 'Load Market'}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {onApplyToRecovery && (
                    <button
                      onClick={() => onApplyToRecovery(m)}
                      className="py-1.5 px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors"
                      title="Apply signal to Super Recovery"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>Persistent Browser Storage</span>
        <span className="text-emerald-400">● Streaming Real Ticks</span>
      </div>
    </aside>
  );
};
