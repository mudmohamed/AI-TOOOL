import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  ShieldAlert,
  Zap,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { TradeRecord, SessionStats } from '../types';

interface RecoveryPerformanceChartProps {
  tradeHistory: TradeRecord[];
  sessionStats: SessionStats;
  expectedProfitTarget?: number;
  maxLossLimit?: number;
  onClearSession?: () => void;
  isRunning?: boolean;
}

interface ChartDataPoint {
  index: number;
  tradeLabel: string;
  time: string;
  profit: number;
  tradeDelta: number;
  status: 'WON' | 'LOST' | 'START';
  symbol: string;
  contractType: string;
  stake: number;
  recoveryStep: number;
}

export const RecoveryPerformanceChart: React.FC<RecoveryPerformanceChartProps> = ({
  tradeHistory,
  sessionStats,
  expectedProfitTarget = 20.0,
  maxLossLimit = 50.0,
  onClearSession,
  isRunning = false,
}) => {
  const [filterRange, setFilterRange] = useState<'ALL' | 'LAST_20' | 'LAST_50'>('ALL');

  // Compute cumulative profit series from tradeHistory
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const settled = tradeHistory.filter((t) => t.status === 'WON' || t.status === 'LOST');

    // Starting baseline point at $0
    const points: ChartDataPoint[] = [
      {
        index: 0,
        tradeLabel: '#0',
        time: 'Start',
        profit: 0,
        tradeDelta: 0,
        status: 'START',
        symbol: 'BASE',
        contractType: 'INIT',
        stake: 0,
        recoveryStep: 0,
      },
    ];

    let runningProfit = 0;
    settled.forEach((trade, idx) => {
      runningProfit = Number((runningProfit + trade.profit).toFixed(2));
      const date = new Date(trade.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      points.push({
        index: idx + 1,
        tradeLabel: `#${idx + 1}`,
        time: timeStr,
        profit: runningProfit,
        tradeDelta: trade.profit,
        status: trade.status as 'WON' | 'LOST',
        symbol: trade.symbol,
        contractType: trade.contractType,
        stake: trade.stake,
        recoveryStep: trade.recoveryStep || 1,
      });
    });

    if (filterRange === 'LAST_20' && points.length > 21) {
      return [points[0], ...points.slice(-20)];
    }
    if (filterRange === 'LAST_50' && points.length > 51) {
      return [points[0], ...points.slice(-50)];
    }

    return points;
  }, [tradeHistory, filterRange]);

  const latestProfit = sessionStats.netProfit;
  const isNetPositive = latestProfit >= 0;
  const winRate =
    sessionStats.totalTrades > 0
      ? ((sessionStats.wins / sessionStats.totalTrades) * 100).toFixed(1)
      : '0.0';

  // Calculate gross profit and loss for profit factor
  const { grossProfit, grossLoss, maxProfitPeak } = useMemo(() => {
    let gp = 0;
    let gl = 0;
    let peak = 0;
    let current = 0;
    tradeHistory.forEach((t) => {
      if (t.status === 'WON') gp += t.profit;
      if (t.status === 'LOST') gl += Math.abs(t.profit);
      current += t.profit;
      if (current > peak) peak = current;
    });
    return {
      grossProfit: gp,
      grossLoss: gl,
      maxProfitPeak: peak,
    };
  }, [tradeHistory]);

  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';

  // Min & max for chart domain bounds with aesthetic padding
  const yValues = chartData.map((d) => d.profit);
  const minY = Math.min(0, ...yValues, -10);
  const maxY = Math.max(0, ...yValues, expectedProfitTarget || 20, 10);
  const yDomain = [Math.floor(minY * 1.15), Math.ceil(maxY * 1.15)];

  const strokeColor = isNetPositive ? '#10b981' : '#f43f5e';
  const gradientId = isNetPositive ? 'profitGradientEmerald' : 'lossGradientRose';

  return (
    <div id="super-recovery-performance-chart" className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-4 sm:p-6 space-y-5 backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${isNetPositive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            {isNetPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black font-mono tracking-tight text-white flex items-center gap-2">
                SUPER RECOVERY P/L PERFORMANCE
              </h3>
              {isRunning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  LIVE STREAMING
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Real-time session cumulative profit/loss curve tracking recovery Martingale &amp; auto-matches efficiency
            </p>
          </div>
        </div>

        {/* Quick Range / Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {(['ALL', 'LAST_20', 'LAST_50'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setFilterRange(range)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  filterRange === range
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === 'ALL' ? 'All Trades' : range === 'LAST_20' ? 'Last 20' : 'Last 50'}
              </button>
            ))}
          </div>

          {onClearSession && (
            <button
              type="button"
              onClick={onClearSession}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer"
              title="Reset Performance Curve"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Dashboard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        {/* Net Profit */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Net Profit</div>
          <div className={`text-base sm:text-lg font-black tracking-tight ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {latestProfit >= 0 ? '+' : ''}${latestProfit.toFixed(2)} USD
          </div>
          <div className="text-[10px] text-slate-500">
            Peak: <strong className="text-emerald-300">+${maxProfitPeak.toFixed(2)}</strong>
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Win Rate</div>
          <div className="text-base sm:text-lg font-black text-cyan-400 tracking-tight">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-500">
            {sessionStats.wins}W / {sessionStats.losses}L ({sessionStats.totalTrades} total)
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Profit Factor</div>
          <div className="text-base sm:text-lg font-black text-amber-400 tracking-tight">
            {profitFactor}
          </div>
          <div className="text-[10px] text-slate-500">
            Wins: ${grossProfit.toFixed(2)}
          </div>
        </div>

        {/* Peak Drawdown */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Max Drawdown</div>
          <div className="text-base sm:text-lg font-black text-rose-400 tracking-tight">
            -${sessionStats.peakDrawdown.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            Limit: ${maxLossLimit.toFixed(0)}
          </div>
        </div>

        {/* Expected Target */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Target Goal</div>
          <div className="text-base sm:text-lg font-black text-emerald-300 tracking-tight">
            ${expectedProfitTarget.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            {Math.min(100, Math.max(0, ((latestProfit / expectedProfitTarget) * 100))).toFixed(0)}% reached
          </div>
        </div>

        {/* Consecutive Losses / Current Status */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Recovery Status</div>
          <div className={`text-base sm:text-lg font-black tracking-tight ${sessionStats.consecutiveLosses > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {sessionStats.consecutiveLosses > 0 ? `Step #${sessionStats.consecutiveLosses}` : 'Optimal (0)'}
          </div>
          <div className="text-[10px] text-slate-500">
            {sessionStats.consecutiveLosses > 0 ? `Recouping -$${sessionStats.cumulativeLoss.toFixed(2)}` : 'In profit baseline'}
          </div>
        </div>
      </div>

      {/* Main Recharts Area / Line Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="profitGradientEmerald" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="lossGradientRose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="tradeLabel"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis
              domain={yDomain}
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickFormatter={(v) => `$${v}`}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            {/* Zero Baseline */}
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />

            {/* Target Profit Line */}
            {expectedProfitTarget > 0 && (
              <ReferenceLine
                y={expectedProfitTarget}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{
                  value: `Target +$${expectedProfitTarget}`,
                  position: 'insideTopRight',
                  fill: '#34d399',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              />
            )}

            {/* Max Loss Limit Line */}
            {maxLossLimit > 0 && (
              <ReferenceLine
                y={-maxLossLimit}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: `Max Loss -$${maxLossLimit}`,
                  position: 'insideBottomRight',
                  fill: '#fb7185',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as ChartDataPoint;
                if (data.status === 'START') {
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-xs font-mono shadow-xl text-slate-300">
                      <div className="font-bold text-white">Session Baseline</div>
                      <div>Initial Cumulative Profit: $0.00</div>
                    </div>
                  );
                }

                const isWin = data.status === 'WON';
                return (
                  <div className="bg-slate-950/95 border border-slate-700/80 backdrop-blur-md p-3 rounded-xl text-xs font-mono shadow-2xl space-y-1.5 z-50">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        Trade {data.tradeLabel} ({data.symbol})
                      </span>
                      <span className="text-[10px] text-slate-400">{data.time}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-0.5">
                      <div className="text-slate-400">Trade Result:</div>
                      <div className={`font-bold text-right ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? '+' : ''}${data.tradeDelta.toFixed(2)} USD
                      </div>

                      <div className="text-slate-400">Cumulative P/L:</div>
                      <div className={`font-black text-right ${data.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)} USD
                      </div>

                      <div className="text-slate-400">Contract Type:</div>
                      <div className="text-slate-200 text-right">{data.contractType}</div>

                      <div className="text-slate-400">Stake:</div>
                      <div className="text-slate-200 text-right">${data.stake.toFixed(2)} USD</div>

                      {data.recoveryStep > 1 && (
                        <>
                          <div className="text-amber-400">Recovery Step:</div>
                          <div className="text-amber-300 font-bold text-right">Step #{data.recoveryStep}</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="profit"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: strokeColor,
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Notes */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full" />
            <span>Cumulative Profit</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 border border-emerald-400 border-dashed rounded-full" />
            <span>Target Goal (${expectedProfitTarget})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500 border border-rose-400 border-dashed rounded-full" />
            <span>Loss Boundary (-${maxLossLimit})</span>
          </span>
        </div>
        <div className="text-slate-500">
          Super Recovery Engine • Live WebSocket Synced
        </div>
      </div>
    </div>
  );
};
