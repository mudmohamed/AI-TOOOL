/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TradeRecord } from '../types';
import { Target, CheckCircle2, XCircle, FileSpreadsheet, Download, RefreshCw } from 'lucide-react';
import { exportTradesToCsv } from '../utils/csvExport';

interface DerivStatementReceiptsProps {
  trades: TradeRecord[];
  onClearHistory?: () => void;
  currency?: string;
  isCompact?: boolean;
}

export const DerivStatementReceipts: React.FC<DerivStatementReceiptsProps> = ({
  trades,
  onClearHistory,
  currency = 'USD',
  isCompact = false,
}) => {
  const reversedTrades = [...trades].reverse();

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.status === 'WON').length;
  const losses = trades.filter((t) => t.status === 'LOST').length;
  const netProfit = trades.reduce((acc, t) => acc + (t.status === 'WON' ? t.profit : t.status === 'LOST' ? -t.stake : 0), 0);
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

  const handleExportCsv = () => {
    if (trades.length === 0) return;
    exportTradesToCsv(trades, 'deriv_statement_matches_receipts');
  };

  return (
    <div
      id="deriv-statement-receipts-container"
      className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden"
    >
      {/* Deriv Statement Header Bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>Deriv Live Statement View</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono border border-emerald-500/30 font-bold">
                100% Real Deriv Ticks
              </span>
            </div>
            <div className="text-sm font-black text-white">
              Matches Contracts (Entry/Exit Spot &amp; P/L Statement)
            </div>
          </div>
        </div>

        {/* Quick Summary Pill & Actions */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Net P/L</span>
              <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} {currency}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Win Rate</span>
              <span className="text-white font-bold">{winRate}% ({wins}W / {losses}L)</span>
            </div>
          </div>

          {trades.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {onClearHistory && trades.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
              title="Clear Statement History"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Header exactly matching User's Image 1 */}
      <div className="grid grid-cols-2 px-6 py-3.5 bg-slate-900/60 border-b border-slate-800/80 text-xs font-bold text-slate-400 font-sans">
        <div>Entry/Exit spot</div>
        <div className="text-right">Buy price and P/L</div>
      </div>

      {/* Trade Rows List */}
      <div className="divide-y divide-slate-800/70 max-h-[500px] overflow-y-auto">
        {reversedTrades.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-2">
            <Target className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
            <p>No matches trades executed in this session yet.</p>
            <p className="text-[11px] text-slate-600">
              Click &quot;Run&quot; on the Auto Matches bar to start automated digit match trades on live Deriv ticks.
            </p>
          </div>
        ) : (
          reversedTrades.map((trade, idx) => {
            const isWon = trade.status === 'WON';
            const isLost = trade.status === 'LOST';
            const isPending = trade.status === 'PENDING';

            // Extract entry and exit digits with formatting
            const entryPriceStr = trade.entryPrice !== undefined ? trade.entryPrice.toFixed(4) : '---';
            const exitPriceStr = trade.exitPrice !== undefined ? trade.exitPrice.toFixed(4) : 'Waiting...';

            const entryDigit = trade.entryDigit ?? (trade.entryPrice ? parseInt(entryPriceStr.slice(-1), 10) : 0);
            const exitDigit = trade.exitDigit ?? (trade.exitPrice ? parseInt(exitPriceStr.slice(-1), 10) : undefined);

            const isDigitMatched = exitDigit !== undefined && exitDigit === Number(trade.targetValue);

            return (
              <div
                key={`${trade.id}-${idx}`}
                id={`statement-row-${trade.id}-${idx}`}
                className="grid grid-cols-2 px-6 py-4 items-center hover:bg-slate-900/40 transition-colors font-mono"
              >
                {/* Column 1: Entry / Exit Spot with Red Circle and Grey/Blue Circle */}
                <div className="space-y-1.5">
                  {/* Entry Spot */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-200">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 bg-rose-500/20 shrink-0 inline-block shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                    <span className="tracking-tight">
                      {trade.entryPrice ? (
                        <>
                          <span>{entryPriceStr.slice(0, -1)}</span>
                          <span className="font-black text-rose-400 bg-rose-950/60 px-1 py-0.5 rounded border border-rose-500/40">
                            {entryPriceStr.slice(-1)}
                          </span>
                        </>
                      ) : (
                        entryPriceStr
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 font-sans hidden sm:inline">
                      ({trade.symbol})
                    </span>
                  </div>

                  {/* Exit Spot */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-200">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-slate-800 shrink-0 inline-block" />
                    <span className="tracking-tight">
                      {trade.exitPrice ? (
                        <>
                          <span>{exitPriceStr.slice(0, -1)}</span>
                          <span
                            className={`font-black px-1 py-0.5 rounded border ${
                              isDigitMatched
                                ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                : 'text-slate-300 bg-slate-800 border-slate-700'
                            }`}
                          >
                            {exitPriceStr.slice(-1)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500 text-[11px] animate-pulse">Waiting for tick...</span>
                      )}
                    </span>
                    {isDigitMatched && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold hidden sm:inline">
                        MATCHED #{trade.targetValue}
                      </span>
                    )}
                  </div>
                </div>

                {/* Column 2: Buy Price and P/L (Exact Deriv screenshot format) */}
                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-300 font-semibold">
                    {trade.stake.toFixed(2)} {currency}
                  </div>

                  <div>
                    {isWon && (
                      <span className="text-sm sm:text-base font-black text-emerald-400 tracking-tight">
                        +{trade.profit.toFixed(2)} {currency}
                      </span>
                    )}
                    {isLost && (
                      <span className="text-sm sm:text-base font-black text-rose-500 tracking-tight">
                        -{trade.stake.toFixed(2)} {currency}
                      </span>
                    )}
                    {isPending && (
                      <span className="text-xs font-bold text-amber-400 animate-pulse">
                        ORDER PENDING...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
