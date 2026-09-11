import React from 'react';
import { DigitStat } from '../types';
import { Flame, Snowflake, Target, Shield, Clock, Hash, Repeat, Zap } from 'lucide-react';

interface MatchesDigitAnalyzerProps {
  digitStats: DigitStat[];
  hotDigit: number;
  coldDigit: number;
  evenPct: number;
  oddPct: number;
  overPct: number;
  underPct: number;
  recentDigits: number[];
  sampleSize: number;
  onSampleSizeChange: (size: number) => void;
  onSelectTargetDigit?: (digit: number, type: 'MATCHES' | 'DIFFERS') => void;
}

export const MatchesDigitAnalyzer: React.FC<MatchesDigitAnalyzerProps> = ({
  digitStats,
  hotDigit,
  coldDigit,
  evenPct,
  oddPct,
  overPct,
  underPct,
  recentDigits,
  sampleSize,
  onSampleSizeChange,
  onSelectTargetDigit,
}) => {
  const hotStat = digitStats.find((s) => s.digit === hotDigit);
  const coldStat = digitStats.find((s) => s.digit === coldDigit);

  return (
    <div id="matches-digit-analyzer" className="space-y-4">
      {/* Header and Sample Size Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            Deriv Matches &amp; Differs Real-Time Digit Engine
          </h3>
          <p className="text-[11px] text-slate-400">
            Real tick digit distribution, Poisson variance &amp; delay metrics calculated from 100% live Deriv tick stream.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 font-mono mr-1">Ticks Sample:</span>
          {[50, 100, 200, 500, 1000].map((size) => (
            <button
              key={size}
              onClick={() => onSampleSizeChange(size)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
                sampleSize === size
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Top Digit Edge Recommendations for MATCHES vs DIFFERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Matches Edge */}
        <div className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-slate-900 to-slate-900 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 uppercase tracking-wider">
              <Flame className="w-4 h-4 text-purple-400" />
              Optimal MATCHES Target (~9.5x Payout)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">Digit {hotDigit}</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {hotStat?.percentage}% Freq
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Delay: <span className="text-amber-400 font-bold">{hotStat?.delay} ticks ago</span> | Max Streak: {hotStat?.maxStreak}x
            </div>
          </div>
          {onSelectTargetDigit && (
            <button
              id="pick-matches-digit-btn"
              onClick={() => onSelectTargetDigit(hotDigit, 'MATCHES')}
              className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              Target Matches
            </button>
          )}
        </div>

        {/* Differs Edge */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wider">
              <Snowflake className="w-4 h-4 text-sky-400" />
              Optimal DIFFERS Safe Target (Win Prob ~94-98%)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">Avoid {coldDigit}</span>
              <span className="text-sm font-mono font-bold text-sky-400">
                {coldStat?.percentage}% Freq
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Theoretical Win Rate: <span className="text-emerald-400 font-bold">{(100 - (coldStat?.percentage || 10)).toFixed(1)}%</span> | Delay: {coldStat?.delay} ticks
            </div>
          </div>
          {onSelectTargetDigit && (
            <button
              id="pick-differs-digit-btn"
              onClick={() => onSelectTargetDigit(coldDigit, 'DIFFERS')}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              Target Differs
            </button>
          )}
        </div>
      </div>

      {/* Real-time 0-9 Digit Distribution Histogram */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            Digit Frequency Heatmap (0 - 9)
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Hot (&gt;12.5%)
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span> Cold (&lt;7.5%)
            </span>
            <span className="text-slate-500">Benchmark: 10.0%</span>
          </div>
        </div>

        {/* 10-Digit Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {digitStats.map((stat) => {
            const isHot = stat.digit === hotDigit;
            const isCold = stat.digit === coldDigit;

            let cardBg = 'bg-slate-950 border-slate-800';
            let barColor = 'bg-slate-700';
            let textColor = 'text-slate-300';

            if (isHot) {
              cardBg = 'bg-purple-950/30 border-purple-500/50 shadow-sm shadow-purple-950';
              barColor = 'bg-gradient-to-t from-purple-600 to-purple-400';
              textColor = 'text-purple-300 font-black';
            } else if (isCold) {
              cardBg = 'bg-sky-950/20 border-sky-500/40';
              barColor = 'bg-gradient-to-t from-sky-600 to-sky-400';
              textColor = 'text-sky-300 font-black';
            } else if (stat.percentage > 10) {
              barColor = 'bg-emerald-600';
            }

            // Height scaling relative to maximum possible frequency (~25%)
            const barHeightPct = Math.min(100, Math.max(8, (stat.percentage / 22) * 100));

            return (
              <div
                key={stat.digit}
                className={`p-2.5 rounded-xl border flex flex-col items-center text-center relative overflow-hidden transition-all hover:border-slate-600 ${cardBg}`}
              >
                {/* Digit Number */}
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-base font-mono font-bold ${textColor}`}>
                    {stat.digit}
                  </span>
                  {isHot && <Flame className="w-3.5 h-3.5 text-purple-400" />}
                  {isCold && <Snowflake className="w-3.5 h-3.5 text-sky-400" />}
                </div>

                {/* Vertical Bar Meter with 10% line */}
                <div className="w-full h-24 bg-slate-900 rounded-lg relative flex items-end justify-center p-1 my-1 overflow-hidden">
                  {/* 10% theoretical line */}
                  <div
                    className="absolute w-full border-b border-dashed border-slate-600/70 z-10"
                    style={{ bottom: `${(10 / 22) * 100}%` }}
                    title="Theoretical Mean (10.0%)"
                  />

                  {/* Frequency fill */}
                  <div
                    className={`w-full rounded transition-all duration-300 ${barColor}`}
                    style={{ height: `${barHeightPct}%` }}
                  />

                  {/* Percentage label */}
                  <span className="absolute bottom-1 font-mono text-[10px] font-bold text-white drop-shadow z-20">
                    {stat.percentage}%
                  </span>
                </div>

                {/* Sub metrics: Deviation, count, delay */}
                <div className="w-full space-y-0.5 text-[10px] font-mono mt-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Dev:</span>
                    <span className={stat.deviation >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {stat.deviation >= 0 ? '+' : ''}{stat.deviation}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Delay:</span>
                    <span className="text-slate-200 font-semibold">{stat.delay}t</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Hits:</span>
                    <span>{stat.count}</span>
                  </div>
                </div>

                {/* Action buttons */}
                {onSelectTargetDigit && (
                  <button
                    onClick={() => onSelectTargetDigit(stat.digit, 'MATCHES')}
                    className="w-full mt-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Select
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parity & Magnitude Equilibrium Dials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Even vs Odd */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-300">
            <span>Even vs Odd Parity</span>
            <span className="font-mono text-[11px] text-slate-400">
              Even: {evenPct}% | Odd: {oddPct}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${evenPct}%` }}
              title={`Even ${evenPct}%`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${oddPct}%` }}
              title={`Odd ${oddPct}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span className="text-emerald-400">● Even (0,2,4,6,8)</span>
            <span className="text-amber-400">● Odd (1,3,5,7,9)</span>
          </div>
        </div>

        {/* Over (5-9) vs Under (0-4) */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-300">
            <span>Under (0-4) vs Over (5-9)</span>
            <span className="font-mono text-[11px] text-slate-400">
              Under: {underPct}% | Over: {overPct}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${underPct}%` }}
              title={`Under ${underPct}%`}
            />
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${overPct}%` }}
              title={`Over ${overPct}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span className="text-indigo-400">● Under 5 (0,1,2,3,4)</span>
            <span className="text-cyan-400">● Over 4 (5,6,7,8,9)</span>
          </div>
        </div>
      </div>

      {/* Historical Real-Time Tick Digits Ribbon */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Live Real-Time Digit Ribbon (Latest Arrivals &rarr;)
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Stream updates every tick</span>
        </div>

        {/* Horizontal scrolling strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
          {recentDigits.slice(-35).map((digit, idx, arr) => {
            const isLatest = idx === arr.length - 1;
            const isEven = digit % 2 === 0;
            const isHot = digit === hotDigit;
            const isCold = digit === coldDigit;

            return (
              <div
                key={idx}
                className={`w-7 h-8 shrink-0 rounded-lg flex flex-col items-center justify-center font-mono font-bold text-xs transition-all ${
                  isLatest
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 scale-110 shadow-lg'
                    : isHot
                    ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50'
                    : isCold
                    ? 'bg-sky-600/30 text-sky-200 border border-sky-500/40'
                    : isEven
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}
                title={`Digit ${digit} (${isEven ? 'Even' : 'Odd'}, ${digit >= 5 ? 'Over' : 'Under'})`}
              >
                <span>{digit}</span>
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isEven ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
