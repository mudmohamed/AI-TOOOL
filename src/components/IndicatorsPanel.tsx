import React from 'react';
import { MarketAnalysis } from '../types';
import { Activity, Gauge, TrendingUp, TrendingDown, Layers, Waves } from 'lucide-react';

interface IndicatorsPanelProps {
  analysis: MarketAnalysis | null;
  pip: number;
}

export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({ analysis, pip }) => {
  if (!analysis) return null;

  const {
    rsi,
    ema9,
    ema21,
    ema50,
    trend,
    volatilityAtr,
    bollingerUpper,
    bollingerLower,
    bollingerBandwidth,
    currentPrice,
  } = analysis;

  let rsiStatus = 'Neutral (Balanced)';
  let rsiColor = 'text-slate-200';
  if (rsi >= 70) {
    rsiStatus = 'Overbought (Caution on Calls/Rise)';
    rsiColor = 'text-rose-400 font-bold';
  } else if (rsi <= 30) {
    rsiStatus = 'Oversold (Caution on Puts/Fall)';
    rsiColor = 'text-emerald-400 font-bold';
  }

  // Bollinger Position %B: (price - lower) / (upper - lower)
  const bbRange = bollingerUpper - bollingerLower || 0.0001;
  const percentB = Math.max(0, Math.min(100, ((currentPrice - bollingerLower) / bbRange) * 100));

  return (
    <div id="technical-indicators-panel" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. RSI Indicator Card */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            RSI (14 Ticks)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">0 - 100</span>
        </div>

        <div className="my-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white">{rsi}</span>
            <span className={`text-[11px] font-mono ${rsiColor}`}>{rsiStatus}</span>
          </div>

          {/* RSI Visual Range Bar */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative mt-1.5">
            {/* 30 oversold & 70 overbought markers */}
            <div className="absolute top-0 bottom-0 left-[30%] w-0.5 bg-emerald-500/50" />
            <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-rose-500/50" />
            <div
              className={`h-full transition-all duration-300 ${
                rsi >= 70 ? 'bg-rose-500' : rsi <= 30 ? 'bg-emerald-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${rsi}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>Oversold: &lt;30</span>
          <span>Mid: 50</span>
          <span>Overbought: &gt;70</span>
        </div>
      </div>

      {/* 2. Multi-EMA Trend Alignment */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            EMA Alignment (9 / 21 / 50)
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            trend.includes('BULLISH')
              ? 'bg-emerald-500/20 text-emerald-300'
              : trend.includes('BEARISH')
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {trend.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 my-2 font-mono text-xs text-center">
          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-cyan-400 font-bold">EMA 9</div>
            <div className="text-white font-bold">{ema9.toFixed(pip)}</div>
          </div>
          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-amber-400 font-bold">EMA 21</div>
            <div className="text-white font-bold">{ema21.toFixed(pip)}</div>
          </div>
          <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-bold">EMA 50</div>
            <div className="text-white font-bold">{ema50.toFixed(pip)}</div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
          <span>Fast / Slow Spread:</span>
          <span className={ema9 >= ema21 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {(ema9 - ema21).toFixed(pip)}
          </span>
        </div>
      </div>

      {/* 3. Bollinger Bands Envelopes */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Bollinger Envelope (20, 2)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Bandwidth: {bollingerBandwidth}%
          </span>
        </div>

        <div className="space-y-1 my-1.5 font-mono text-xs">
          <div className="flex justify-between text-sky-400">
            <span>Upper Band:</span>
            <span className="font-bold">{bollingerUpper.toFixed(pip)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Current Price:</span>
            <span className="font-bold text-amber-400">{currentPrice.toFixed(pip)}</span>
          </div>
          <div className="flex justify-between text-sky-400">
            <span>Lower Band:</span>
            <span className="font-bold">{bollingerLower.toFixed(pip)}</span>
          </div>
        </div>

        {/* Position in envelope %B */}
        <div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-300"
              style={{ width: `${percentB}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
            <span>Lower</span>
            <span>%B: {percentB.toFixed(0)}%</span>
            <span>Upper</span>
          </div>
        </div>
      </div>

      {/* 4. ATR & Tick Volatility Level */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-teal-400" />
            Tick Volatility &amp; ATR
          </span>
          <span className="text-[10px] text-teal-300 bg-teal-950/40 px-1.5 py-0.2 rounded font-mono">
            Active Market
          </span>
        </div>

        <div className="my-2">
          <div className="text-2xl font-black font-mono text-white">
            {volatilityAtr.toFixed(pip)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Average Price Delta per Tick
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
          <span>Volatility Regime:</span>
          <span className="text-emerald-400 font-bold">Stable Synthetic Run</span>
        </div>
      </div>
    </div>
  );
};
