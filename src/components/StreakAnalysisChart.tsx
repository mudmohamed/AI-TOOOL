/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Flame,
  ShieldAlert,
  Award,
  TrendingUp,
  BarChart3,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { TradeRecord } from '../types';

interface StreakAnalysisChartProps {
  tradeHistory: TradeRecord[];
}

export const StreakAnalysisChart: React.FC<StreakAnalysisChartProps> = ({ tradeHistory }) => {
  const [viewMode, setViewMode] = useState<'PROGRESSION' | 'DISTRIBUTION'>('PROGRESSION');
  const [showSamplePreview, setShowSamplePreview] = useState<boolean>(false);

  // Sample data to preview when real session has no trades yet
  const sampleTrades: TradeRecord[] = useMemo(() => {
    const baseTime = Date.now() - 3600000;
    const pattern = [
      true, true, true, false, false,
      true, true, true, true, true, false,
      true, true, false, true, true, true, true, false, false, true
    ];
    return pattern.map((won, idx) => ({
      id: `sample-${idx}`,
      timestamp: baseTime + idx * 60000,
      symbol: '1HZ10V',
      contractType: won ? 'MATCHES' : 'DIFFERS',
      targetValue: 7,
      entryPrice: 1200 + idx * 2,
      entryDigit: 7,
      stake: 0.35,
      payout: won ? 3.32 : 0,
      status: won ? 'WON' : 'LOST',
      profit: won ? 2.97 : -0.35,
      recoveryStep: 0,
    }));
  }, []);

  const effectiveTrades = useMemo(() => {
    const realSettled = tradeHistory.filter((t) => t.status === 'WON' || t.status === 'LOST');
    if (realSettled.length > 0) return realSettled;
    if (showSamplePreview) return sampleTrades;
    return [];
  }, [tradeHistory, showSamplePreview, sampleTrades]);

  const isUsingSample = tradeHistory.filter((t) => t.status === 'WON' || t.status === 'LOST').length === 0 && showSamplePreview;

  // Compute Streak Timeline
  const { timelineData, distributionData, stats } = useMemo(() => {
    const sorted = [...effectiveTrades].sort((a, b) => a.timestamp - b.timestamp);

    let currentWin = 0;
    let currentLoss = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let runningPnl = 0;

    const winStreaksCount: Record<number, number> = {};
    const lossStreaksCount: Record<number, number> = {};

    let lastOutcome: 'WON' | 'LOST' | null = null;
    let tempStreak = 0;

    const timeline = sorted.map((t, index) => {
      const isWin = t.status === 'WON';
      if (isWin) totalWins += 1;
      else totalLosses += 1;

      runningPnl = Number((runningPnl + (t.profit || 0)).toFixed(2));

      if (isWin) {
        currentWin += 1;
        currentLoss = 0;
        if (currentWin > maxWin) maxWin = currentWin;
      } else {
        currentLoss += 1;
        currentWin = 0;
        if (currentLoss > maxLoss) maxLoss = currentLoss;
      }

      const outcome: 'WON' | 'LOST' = isWin ? 'WON' : 'LOST';

      // Track streak transitions for distribution
      if (lastOutcome === null) {
        lastOutcome = outcome;
        tempStreak = 1;
      } else if (lastOutcome === outcome) {
        tempStreak += 1;
      } else {
        // Streak ended, record it
        if (lastOutcome === 'WON') {
          winStreaksCount[tempStreak] = (winStreaksCount[tempStreak] || 0) + 1;
        } else {
          lossStreaksCount[tempStreak] = (lossStreaksCount[tempStreak] || 0) + 1;
        }
        lastOutcome = outcome;
        tempStreak = 1;
      }

      const streakValue = isWin ? currentWin : -currentLoss;
      const timeStr = new Date(t.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      return {
        tradeIndex: index + 1,
        time: timeStr,
        symbol: t.symbol,
        contractType: t.contractType,
        status: t.status,
        profit: t.profit || 0,
        runningProfit: runningPnl,
        streakValue,
        streakLen: Math.abs(streakValue),
        isWin,
      };
    });

    // Record last ongoing streak into distribution
    if (lastOutcome !== null && tempStreak > 0) {
      if (lastOutcome === 'WON') {
        winStreaksCount[tempStreak] = (winStreaksCount[tempStreak] || 0) + 1;
      } else {
        lossStreaksCount[tempStreak] = (lossStreaksCount[tempStreak] || 0) + 1;
      }
    }

    // Prepare distribution data
    const maxLen = Math.max(
      ...Object.keys(winStreaksCount).map(Number),
      ...Object.keys(lossStreaksCount).map(Number),
      5
    );
    const dist = [];
    for (let len = 1; len <= Math.min(10, maxLen); len++) {
      dist.push({
        length: `${len}${len === 10 ? '+' : ''}`,
        winStreakCount: winStreaksCount[len] || 0,
        lossStreakCount: lossStreaksCount[len] || 0,
      });
    }

    const currentStreakText =
      currentWin > 0 ? `+${currentWin} Win${currentWin > 1 ? 's' : ''}` :
      currentLoss > 0 ? `-${currentLoss} Loss${currentLoss > 1 ? 'es' : ''}` :
      '0';

    const winRate = sorted.length > 0 ? ((totalWins / sorted.length) * 100).toFixed(1) : '0.0';

    return {
      timelineData: timeline,
      distributionData: dist,
      stats: {
        totalTrades: sorted.length,
        totalWins,
        totalLosses,
        winRate,
        currentStreakText,
        currentStreakType: currentWin > 0 ? 'WIN' : currentLoss > 0 ? 'LOSS' : 'NONE',
        currentStreakLen: currentWin > 0 ? currentWin : currentLoss,
        maxWin,
        maxLoss,
        runningPnl,
      },
    };
  }, [effectiveTrades]);

  return (
    <div
      id="streak-analysis-chart-container"
      className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-purple-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Win / Loss Streak Progression (Session History)
              </h3>
              {isUsingSample && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> SAMPLE PREVIEW
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Calculated real-time streak lengths from authenticated Deriv settlements
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('PROGRESSION')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                viewMode === 'PROGRESSION'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DISTRIBUTION')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                viewMode === 'DISTRIBUTION'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Distribution
            </button>
          </div>

          {timelineData.length === 0 && (
            <button
              type="button"
              onClick={() => setShowSamplePreview(!showSamplePreview)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
            >
              {showSamplePreview ? 'Hide Preview' : 'Show Sample Preview'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Current Streak */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Current Streak</span>
            <Flame className={`w-3.5 h-3.5 ${stats.currentStreakType === 'WIN' ? 'text-emerald-400' : stats.currentStreakType === 'LOSS' ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div
            className={`text-lg font-black font-mono ${
              stats.currentStreakType === 'WIN'
                ? 'text-emerald-400'
                : stats.currentStreakType === 'LOSS'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {stats.currentStreakText}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {stats.currentStreakType === 'WIN' ? 'Winning streak active' : stats.currentStreakType === 'LOSS' ? 'Drawdown streak active' : 'Awaiting trades'}
          </div>
        </div>

        {/* Max Win Streak */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Peak Win Streak</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400">
            {stats.maxWin} Wins
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Highest consecutive wins
          </div>
        </div>

        {/* Max Loss Streak */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Peak Drawdown Streak</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-black font-mono text-rose-400">
            {stats.maxLoss} Losses
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Highest consecutive losses
          </div>
        </div>

        {/* Win Ratio */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Session Win Rate</span>
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-black font-mono text-cyan-300">
            {stats.winRate}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {stats.totalWins}W / {stats.totalLosses}L ({stats.totalTrades} total)
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      {timelineData.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400">
            <Info className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-white">No Settled Trades Recorded Yet</h4>
            <p className="text-xs text-slate-400">
              When trades execute via the live Deriv connection, every win/loss streak will be graphed here automatically with height indicating consecutive streak duration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSamplePreview(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition"
          >
            <Sparkles className="w-3.5 h-3.5" /> Preview Chart with Sample Session
          </button>
        </div>
      ) : viewMode === 'PROGRESSION' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Positive = Consecutive Wins
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Negative = Consecutive Losses
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timelineData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="tradeIndex"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#334155"
                  tickLine={{ stroke: '#334155' }}
                  label={{ value: 'Trade #', position: 'insideBottomRight', offset: -4, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#334155"
                  tickLine={{ stroke: '#334155' }}
                  domain={['auto', 'auto']}
                  allowDecimals={false}
                />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    const isWin = data.isWin;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl text-xs font-mono space-y-1.5 z-50">
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-white">Trade #{data.tradeIndex}</span>
                          <span className="text-slate-400">{data.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Market:</span>
                          <span className="font-bold text-white">{data.symbol}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                            {data.contractType}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Result:</span>
                          <span
                            className={`font-black flex items-center gap-1 ${
                              isWin ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isWin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {data.status} ({isWin ? `+${data.streakLen} in a row` : `-${data.streakLen} in a row`})
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Trade Profit:</span>
                          <span className={`font-bold ${data.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800 text-[11px]">
                          <span className="text-slate-400">Cumulative PnL:</span>
                          <span className={`font-bold ${data.runningProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {data.runningProfit >= 0 ? '+' : ''}${data.runningProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="streakValue" radius={[3, 3, 3, 3]}>
                  {timelineData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.streakValue > 0 ? '#10b981' : '#f43f5e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
            <span>Streak Length Distribution Frequency</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Win Streaks</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Loss Streaks</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="length"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#334155"
                  label={{ value: 'Consecutive Streak Count', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  stroke="#334155"
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl text-xs font-mono space-y-1.5 z-50">
                        <div className="font-bold text-white border-b border-slate-800 pb-1">
                          Streak Length: {label} in a row
                        </div>
                        <div className="text-emerald-400 font-semibold">
                          Win Streaks: {payload[0]?.value ?? 0} occurrence(s)
                        </div>
                        <div className="text-rose-400 font-semibold">
                          Loss Streaks: {payload[1]?.value ?? 0} occurrence(s)
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="winStreakCount" name="Win Streaks" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lossStreakCount" name="Loss Streaks" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
