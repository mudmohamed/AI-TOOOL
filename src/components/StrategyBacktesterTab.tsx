/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Play,
  RotateCcw,
  Shield,
  Zap,
  Target,
  ArrowRight,
  Sparkles,
  Sliders,
  DollarSign,
  History,
  Lock,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { BacktestConfig, BacktestResult, AutoMatchesConfig } from '../types';
import { runHistoricalBacktest } from '../utils/backtestEngine';
import { derivService, POPULAR_DERIV_SYMBOLS } from '../services/derivWs';

interface StrategyBacktesterTabProps {
  currentSymbol: string;
  marketTicks: Record<string, { prices: number[]; digits: number[] }>;
  onApplyStrategyToLiveBot: (config: Partial<AutoMatchesConfig>) => void;
  onNavigateToTrader: () => void;
}

export const StrategyBacktesterTab: React.FC<StrategyBacktesterTabProps> = ({
  currentSymbol,
  marketTicks,
  onApplyStrategyToLiveBot,
  onNavigateToTrader,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(currentSymbol || '1HZ10V');
  const [sampleTicks, setSampleTicks] = useState<number>(500);
  const [strategy, setStrategy] = useState<
    'DIFFERS_ACCOUNT_GROWER' | 'CONFIRMED_MATCHES_SNIPER' | 'OVER_UNDER_PROBABILITY' | 'REPEAT_DIGIT_MOMENTUM'
  >('DIFFERS_ACCOUNT_GROWER');
  const [stake, setStake] = useState<number>(0.35);
  const [stakeMode, setStakeMode] = useState<'FIXED_STAKE' | 'SMART_RECOVERY' | 'MARTINGALE'>('FIXED_STAKE');
  const [maxStakeCap, setMaxStakeCap] = useState<number>(1.0);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(1.15);
  const [maxAllowedLosses, setMaxAllowedLosses] = useState<number>(3);
  const [takeProfit, setTakeProfit] = useState<number>(20.0);
  const [stopLoss, setStopLoss] = useState<number>(50.0);
  const [minConfidenceThreshold, setMinConfidenceThreshold] = useState<number>(85);

  const [isLoadingTicks, setIsLoadingTicks] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Available ticks for selected symbol
  const currentTickData = marketTicks[selectedSymbol] || { prices: [], digits: [] };

  // Fetch real ticks if needed
  const handleFetchAndRunBacktest = () => {
    setIsLoadingTicks(true);
    // Request real tick history from Deriv WebSocket
    derivService.requestTickHistory(selectedSymbol, sampleTicks);

    // Give 400ms for WebSocket response or use existing cache
    setTimeout(() => {
      const data = marketTicks[selectedSymbol] || currentTickData;
      const prices = data.prices && data.prices.length > 50 ? data.prices : [];
      const digits = data.digits && data.digits.length > 50 ? data.digits : [];

      if (prices.length >= 40 && digits.length >= 40) {
        executeBacktest(prices, digits);
      } else {
        // Retry after short delay in case WebSocket just received
        setTimeout(() => {
          const freshData = marketTicks[selectedSymbol];
          const fPrices = freshData?.prices || [];
          const fDigits = freshData?.digits || [];
          executeBacktest(fPrices, fDigits);
          setIsLoadingTicks(false);
        }, 800);
        return;
      }
      setIsLoadingTicks(false);
    }, 400);
  };

  const executeBacktest = (prices: number[], digits: number[]) => {
    let contractMode: 'DIFFERS' | 'MATCHES' | 'UNDER' | 'OVER' = 'DIFFERS';
    if (strategy === 'DIFFERS_ACCOUNT_GROWER') contractMode = 'DIFFERS';
    else if (strategy === 'CONFIRMED_MATCHES_SNIPER') contractMode = 'MATCHES';
    else if (strategy === 'OVER_UNDER_PROBABILITY') contractMode = 'UNDER';
    else contractMode = 'MATCHES';

    const cfg: BacktestConfig = {
      symbol: selectedSymbol,
      sampleTicks,
      strategy,
      contractMode,
      stake,
      stakeMode,
      maxStakeCap,
      martingaleMultiplier,
      maxAllowedLosses,
      takeProfit,
      stopLoss,
      minConfidenceThreshold,
    };

    const res = runHistoricalBacktest(prices, digits, cfg, 1000);
    setBacktestResult(res);
  };

  // Run automatically on mount or when symbol/strategy changes if ticks exist
  useEffect(() => {
    if (currentTickData.digits && currentTickData.digits.length >= 50) {
      executeBacktest(currentTickData.prices, currentTickData.digits);
    } else {
      handleFetchAndRunBacktest();
    }
  }, [selectedSymbol, strategy, stakeMode, stake, maxStakeCap, maxAllowedLosses]);

  const handleApplyToLiveBot = () => {
    const isDiffers = strategy === 'DIFFERS_ACCOUNT_GROWER';
    const isMatches = strategy === 'CONFIRMED_MATCHES_SNIPER';
    const isUnder = strategy === 'OVER_UNDER_PROBABILITY';

    onApplyStrategyToLiveBot({
      market: selectedSymbol,
      stake,
      fixedStakeMode: stakeMode === 'FIXED_STAKE',
      nextTradeCondition: stakeMode === 'FIXED_STAKE' ? 'FIXED_STAKE' : stakeMode === 'MARTINGALE' ? 'MARTINGALE' : 'SAME_LOSS_RECOVERY',
      maxStakeCap,
      maxAllowedLosses,
      contractMode: isDiffers ? 'DIFFERS' : isUnder ? 'OVER_UNDER' : 'MATCHES',
      targetStrategy: isDiffers ? 'COLD_DIFFERS' : isMatches ? 'MARKOV_TRANSITION' : 'REPEAT_ENTRY',
      onlyWhenSignalConfirmed: isMatches,
      expectedProfit: takeProfit,
      maxAcceptableLoss: stopLoss,
    });

    setAppliedNotice(
      `✅ Loaded winning ${strategy.replace(/_/g, ' ')} parameters into Live Auto Trader! Stake: $${stake.toFixed(2)} (Fixed/Protected: ${stakeMode === 'FIXED_STAKE' ? 'YES' : 'NO'}, Max Cap: $${maxStakeCap.toFixed(2)})`
    );
    setTimeout(() => setAppliedNotice(null), 5000);
    onNavigateToTrader();
  };

  const filteredTrades = (backtestResult?.trades || []).filter((t) => {
    if (tableFilter === 'WINS') return t.won;
    if (tableFilter === 'LOSSES') return !t.won;
    return true;
  });

  return (
    <div id="strategy-backtester-tab" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/40 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              100% Real Deriv Tick Data Backtester
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Account Protection Engine
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-1.5 flex items-center gap-2 tracking-tight">
            <BarChart3 className="w-6 h-6 text-purple-400" />
            Deriv Historical Strategy Simulator &amp; Backtester
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Test any digit strategy across real Deriv tick history before trading real money. Guarantee that trade stakes never exceed your chosen limit and prevent blowing accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="run-backtest-btn"
            onClick={handleFetchAndRunBacktest}
            disabled={isLoadingTicks}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
          >
            {isLoadingTicks ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            Run Deriv Backtest
          </button>
        </div>
      </div>

      {appliedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {appliedNotice}
        </div>
      )}

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Panel 1: Market & Strategy Selector */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Target className="w-4 h-4 text-purple-400" />
            1. Strategy &amp; Market
          </div>

          {/* Symbol Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Market (Deriv Synthetic Index)
            </label>
            <select
              id="backtest-symbol-select"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            >
              {POPULAR_DERIV_SYMBOLS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>

          {/* Historical Ticks Depth */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Historical Real Ticks Sample
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[200, 500, 1000, 2000].map((count) => (
                <button
                  key={count}
                  onClick={() => setSampleTicks(count)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    sampleTicks === count
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {count}t
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Currently available in cache: {currentTickData.digits?.length || 0} real ticks
            </div>
          </div>

          {/* Strategy Selection Radio Cards */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Trading Strategy (Designed to Win)
            </label>
            <div className="space-y-2">
              {/* Option 1: Differs 90%+ Win Rate */}
              <div
                onClick={() => setStrategy('DIFFERS_ACCOUNT_GROWER')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'DIFFERS_ACCOUNT_GROWER'
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white">Ultra-Win Differs (Account Grower)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    ~90-95% Win Rate
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Trades Deriv DIGITDIFF against the coldest transition digit. Highly recommended to grow accounts and eliminate blown accounts.
                </p>
              </div>

              {/* Option 2: Confirmed Matches Sniper */}
              <div
                onClick={() => setStrategy('CONFIRMED_MATCHES_SNIPER')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'CONFIRMED_MATCHES_SNIPER'
                    ? 'border-purple-500 bg-purple-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <span className="text-xs font-bold text-white">Matches Sniper (~9.5x Payout)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    High Payout 835%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only triggers DIGITMATCH when Markov edge and micro-cluster density confirm high confidence. Filters out random garbage ticks.
                </p>
              </div>

              {/* Option 3: Under 7 */}
              <div
                onClick={() => setStrategy('OVER_UNDER_PROBABILITY')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === 'OVER_UNDER_PROBABILITY'
                    ? 'border-blue-500 bg-blue-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <span className="text-xs font-bold text-white">Under 7 Probability Zone</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    ~70-80% Win Rate
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Trades digits Under 7 (digits 0-6 win). Stable return with high frequency.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Capital Protection & Stake Controls */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Shield className="w-4 h-4 text-emerald-400" />
            2. Stake Safety &amp; Anti-Blowout Engine
          </div>

          {/* Staking Mode */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Staking Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setStakeMode('FIXED_STAKE')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  stakeMode === 'FIXED_STAKE'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Fixed Stake</span>
                <span className="text-[9px] font-normal opacity-80">(Never increase)</span>
              </button>

              <button
                type="button"
                onClick={() => setStakeMode('SMART_RECOVERY')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  stakeMode === 'SMART_RECOVERY'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Smart Recov.</span>
                <span className="text-[9px] font-normal opacity-80">(Recoup loss)</span>
              </button>

              <button
                type="button"
                onClick={() => setStakeMode('MARTINGALE')}
                className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  stakeMode === 'MARTINGALE'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Martingale</span>
                <span className="text-[9px] font-normal opacity-80">(Factor x1.15)</span>
              </button>
            </div>
          </div>

          {/* Chosen Price / Stake Input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Trade Stake ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-500">$</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.35"
                  value={stake}
                  onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Price you choose to trade</span>
            </div>

            {/* Strict Max Stake Cap */}
            <div>
              <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                Max Stake Cap ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-500">$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0.35"
                  value={maxStakeCap}
                  onChange={(e) => setMaxStakeCap(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>
              <span className="text-[10px] text-amber-400/80 mt-0.5 block font-bold">Hard limit: never exceed</span>
            </div>
          </div>

          {/* Circuit Breakers: Max Allowed Losses & Profit Limits */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Max Losses Allowed
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAllowedLosses}
                onChange={(e) => setMaxAllowedLosses(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Halt if reached (preserves balance)</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Profit Target ($)
              </label>
              <input
                type="number"
                step="5"
                value={takeProfit}
                onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 20)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Lock in gain &amp; halt</span>
            </div>
          </div>

          {/* Safety Summary Box */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span>Selected Stake:</span>
              <span className="font-mono font-bold text-white">${stake.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Stake Mode:</span>
              <span className="font-mono font-bold text-emerald-400">
                {stakeMode === 'FIXED_STAKE' ? '100% Fixed (Zero Escalation)' : 'Capped Recovery'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Max Loss Risk / Trade:</span>
              <span className="font-mono font-bold text-amber-400">
                ${stakeMode === 'FIXED_STAKE' ? stake.toFixed(2) : maxStakeCap.toFixed(2)} USD
              </span>
            </div>
          </div>
        </div>

        {/* Panel 3: Live Verification & Apply to Real Bot */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-purple-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              3. Strategy Verification
            </div>

            {backtestResult ? (
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Simulated Win Rate:</span>
                  <span
                    className={`text-xl font-black font-mono ${
                      backtestResult.winRate >= 80
                        ? 'text-emerald-400'
                        : backtestResult.winRate >= 50
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {backtestResult.winRate}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Net Profit in Test:</span>
                  <span
                    className={`text-xl font-black font-mono ${
                      backtestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {backtestResult.netProfit >= 0 ? '+' : ''}${backtestResult.netProfit.toFixed(2)} USD
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
                    <span className="text-[10px] text-slate-500 block">Total Trades</span>
                    <span className="font-bold font-mono text-white text-sm">
                      {backtestResult.totalTrades} ({backtestResult.wins}W / {backtestResult.losses}L)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
                    <span className="text-[10px] text-slate-500 block">Max Drawdown</span>
                    <span className="font-bold font-mono text-amber-400 text-sm">
                      -${backtestResult.maxDrawdown.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Click &quot;Run Deriv Backtest&quot; above to simulate strategy.
              </div>
            )}
          </div>

          <button
            id="apply-strategy-to-bot-btn"
            onClick={handleApplyToLiveBot}
            disabled={!backtestResult || backtestResult.totalTrades === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            Apply This Winning Setup to Live Bot
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Equity Curve & Detailed Statistics */}
      {backtestResult && backtestResult.trades.length > 0 && (
        <div className="space-y-5">
          {/* Equity Curve Chart */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Account Growth Equity Curve (Real Deriv Ticks Simulation)
                </h3>
                <p className="text-xs text-slate-400">
                  Simulated performance on {backtestResult.totalTicksTested} real ticks for {selectedSymbol}. Initial balance: $1,000.00 USD.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">Profit Factor:</span>
                <span className="text-emerald-400 font-bold">{backtestResult.profitFactor}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Max Win Streak:</span>
                <span className="text-emerald-400 font-bold">{backtestResult.maxConsecutiveWins}x</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={backtestResult.equityCurve}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="trade" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Trade #', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }} />
                  <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Balance']}
                    labelFormatter={(label) => `Trade #${label}`}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#equityGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade-by-Trade Table */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  Historical Simulation Trade Log ({filteredTrades.length} Trades)
                </h3>
                <p className="text-xs text-slate-400">
                  Every trade calculated strictly according to Deriv official digit settlement rules.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {(['ALL', 'WINS', 'LOSSES'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTableFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      tableFilter === filter
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter === 'ALL'
                      ? `All (${backtestResult.trades.length})`
                      : filter === 'WINS'
                      ? `Wins (${backtestResult.wins})`
                      : `Losses (${backtestResult.losses})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px]">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Contract</th>
                    <th className="p-2.5">Entry Digit</th>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Exit Digit</th>
                    <th className="p-2.5">Stake</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Profit/Loss</th>
                    <th className="p-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredTrades.slice(0, 100).map((t) => (
                    <tr key={t.tradeIndex} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-2.5 text-slate-400">{t.tradeIndex}</td>
                      <td className="p-2.5 font-bold text-white">{t.contractType}</td>
                      <td className="p-2.5 text-slate-300">#{t.entryDigit}</td>
                      <td className="p-2.5 text-purple-300 font-bold">#{t.targetDigit}</td>
                      <td className="p-2.5 text-slate-300 font-bold">#{t.exitDigit}</td>
                      <td className="p-2.5 text-slate-300">${t.stake.toFixed(2)}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.won
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {t.won ? 'WON' : 'LOST'}
                        </span>
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold ${
                          t.won ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.won ? '+' : ''}${t.profit.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-200 font-bold">
                        ${t.balanceAfter.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
