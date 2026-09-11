import React, { useState, useEffect, useMemo } from 'react';
import { RiskConfig, RecoveryStrategy, TradeRecord } from '../types';
import { generateRecoveryLadder, calculateNextStake, CONTRACT_PAYOUT_PRESETS } from '../utils/recoveryEngine';
import { exportTradesToCsv } from '../utils/csvExport';
import {
  Shield,
  AlertTriangle,
  Play,
  Square,
  RotateCcw,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Gauge,
  Download,
  FileSpreadsheet,
  Zap,
  Lock,
  Unlock,
  Clock,
  Target,
  Timer,
  Activity,
  Sparkles,
} from 'lucide-react';

interface SuperRecoveryManagerProps {
  currentSymbol: string;
  currentPrice: number;
  lastDigit: number;
  recommendedContract: string;
  recommendedTarget: number | string;
  onSimulateTrade: (trade: {
    contractType: any;
    targetValue: any;
    stake: number;
  }) => void;
  tradeHistory: TradeRecord[];
  sessionStats: {
    totalTrades: number;
    wins: number;
    losses: number;
    netProfit: number;
    consecutiveLosses: number;
    cumulativeLoss: number;
    peakDrawdown: number;
  };
  onResetSession: () => void;
  autoNextTrade?: boolean;
  onToggleAutoNextTrade?: (enabled: boolean) => void;
  autoRecoveryNotice?: string | null;
  onDismissNotice?: () => void;
  onConfigChange?: (config: RiskConfig) => void;
  isRunning?: boolean;
  onToggleRun?: (running: boolean) => void;
}

export const SuperRecoveryManager: React.FC<SuperRecoveryManagerProps> = ({
  currentSymbol,
  currentPrice,
  lastDigit,
  recommendedContract,
  recommendedTarget,
  onSimulateTrade,
  tradeHistory,
  sessionStats,
  onResetSession,
  autoNextTrade,
  onToggleAutoNextTrade,
  autoRecoveryNotice,
  onDismissNotice,
  onConfigChange,
  isRunning = false,
  onToggleRun,
}) => {
  const [config, setConfig] = useState<RiskConfig>({
    baseStake: 1.0,
    payoutRate: CONTRACT_PAYOUT_PRESETS[recommendedContract]?.payoutRate || 1.95,
    recoveryStrategy: 'X2_SUPER_RECOVERY',
    takeProfit: 50.0,
    stopLoss: 100.0,
    maxConsecutiveLosses: 6,
    contractType: (recommendedContract as any) || 'DIFFERS',
    autoNextTrade: autoNextTrade ?? false,
    profitLockEnabled: true,
    profitLockTarget: 50.0,
  });

  // Local fallback for autoNextTrade if not provided as controlled prop
  const [localAutoNextTrade, setLocalAutoNextTrade] = useState<boolean>(() => {
    try {
      return localStorage.getItem('deriv_auto_next_trade') === 'true';
    } catch {
      return false;
    }
  });

  const isAutoArmed = autoNextTrade !== undefined ? autoNextTrade : localAutoNextTrade;

  const handleToggleAuto = () => {
    const nextState = !isAutoArmed;
    if (onToggleAutoNextTrade) {
      onToggleAutoNextTrade(nextState);
    } else {
      setLocalAutoNextTrade(nextState);
      try {
        localStorage.setItem('deriv_auto_next_trade', String(nextState));
      } catch {}
    }
  };

  // Notify parent on config change
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange({ ...config, autoNextTrade: isAutoArmed });
    }
  }, [config, isAutoArmed, onConfigChange]);

  const [selectedTargetDigit, setSelectedTargetDigit] = useState<number>(
    typeof recommendedTarget === 'number' ? recommendedTarget : 5
  );

  // Sync contract preset when contract type changes
  const handleContractChange = (contract: any) => {
    const preset = CONTRACT_PAYOUT_PRESETS[contract];
    setConfig((prev) => ({
      ...prev,
      contractType: contract,
      payoutRate: preset ? preset.payoutRate : 1.95,
    }));
  };

  // Generate recovery ladder
  const ladder = generateRecoveryLadder(config, config.maxConsecutiveLosses);

  // Current recovery stake
  const currentStake = calculateNextStake(
    config.baseStake,
    sessionStats.cumulativeLoss,
    sessionStats.consecutiveLosses,
    config.payoutRate,
    config.recoveryStrategy
  );

  const isInRecovery = sessionStats.consecutiveLosses > 0;
  const currentStepNum = Math.min(config.maxConsecutiveLosses, sessionStats.consecutiveLosses + 1);

  // Profit Lock feature: automatically stops the bot and pauses recovery if predefined daily profit target reached
  const [tempUnlocked, setTempUnlocked] = useState(false);
  const isProfitLockEnabled = config.profitLockEnabled ?? true;
  const dailyProfitTarget = config.profitLockTarget ?? config.takeProfit;
  const isProfitLockHit = isProfitLockEnabled && sessionStats.netProfit >= dailyProfitTarget;

  // Reset temporary unlock if profit falls below target
  useEffect(() => {
    if (!isProfitLockHit && tempUnlocked) {
      setTempUnlocked(false);
    }
  }, [isProfitLockHit, tempUnlocked]);

  // When daily profit target is reached, automatically stop the bot and pause recovery
  useEffect(() => {
    if (isProfitLockHit && !tempUnlocked) {
      if (isRunning && onToggleRun) {
        onToggleRun(false);
      }
      if (isAutoArmed && onToggleAutoNextTrade) {
        onToggleAutoNextTrade(false);
      }
    }
  }, [isProfitLockHit, tempUnlocked, isRunning, isAutoArmed, onToggleRun, onToggleAutoNextTrade]);

  // Check circuit breakers
  const isStopLossHit = sessionStats.cumulativeLoss >= config.stopLoss;
  const isTakeProfitHit = sessionStats.netProfit >= config.takeProfit;

  // Effective target for tracking and time estimation
  const effectiveTarget = isProfitLockEnabled ? dailyProfitTarget : config.takeProfit;
  const currentNetProfit = sessionStats.netProfit;
  const progressPercent = effectiveTarget > 0 ? Math.min(100, Math.max(0, (currentNetProfit / effectiveTarget) * 100)) : 0;
  const remainingProfit = Math.max(0, effectiveTarget - currentNetProfit);

  // Calculate trade frequency and estimated Time to Reach Target
  const targetMetrics = useMemo(() => {
    if (tradeHistory.length < 2) {
      return {
        tradesPerMinute: 0,
        avgSecondsPerTrade: 0,
        profitPerMinute: 0,
        timeToTarget: 'Awaiting trades (≥2 needed)',
        timeSecs: null,
        status: 'INITIALIZING' as const,
      };
    }

    const sortedTrades = [...tradeHistory].sort((a, b) => a.timestamp - b.timestamp);
    const firstTradeTime = sortedTrades[0].timestamp;
    const lastTradeTime = sortedTrades[sortedTrades.length - 1].timestamp;

    // Recent trades window (up to 25 trades) for responsive frequency
    const recentTrades = sortedTrades.slice(-25);
    const windowMs = Math.max(2000, recentTrades[recentTrades.length - 1].timestamp - recentTrades[0].timestamp);
    const windowMins = windowMs / 60000;

    // Overall session minutes
    const totalSessionMs = Math.max(2000, lastTradeTime - firstTradeTime);
    const totalSessionMins = totalSessionMs / 60000;

    // Trade frequency calculation: trades per minute
    const recentFrequency = (recentTrades.length - 1) / Math.max(0.08, windowMins);
    const sessionFrequency = (sortedTrades.length - 1) / Math.max(0.08, totalSessionMins);
    // Smooth recent frequency with overall session frequency
    const tradesPerMinute = Number((recentTrades.length >= 4 ? recentFrequency : sessionFrequency).toFixed(1));
    const avgSecondsPerTrade = tradesPerMinute > 0 ? Number((60 / tradesPerMinute).toFixed(1)) : 0;

    // Profit velocity (dollars per minute)
    const recentNetProfit = recentTrades.reduce(
      (sum, t) => sum + (t.status === 'WON' ? t.profit : t.status === 'LOST' ? -t.stake : 0),
      0
    );
    const recentProfitPerMin = windowMins > 0.08 ? recentNetProfit / windowMins : 0;
    const sessionProfitPerMin = totalSessionMins > 0.08 ? currentNetProfit / totalSessionMins : 0;
    const effectiveProfitPerMin = recentProfitPerMin > 0 ? recentProfitPerMin : sessionProfitPerMin;

    if (currentNetProfit >= effectiveTarget) {
      return {
        tradesPerMinute,
        avgSecondsPerTrade,
        profitPerMinute: Number(effectiveProfitPerMin.toFixed(2)),
        timeToTarget: 'Target Achieved! 🎯',
        timeSecs: 0,
        status: 'REACHED' as const,
      };
    }

    if (effectiveProfitPerMin > 0.05) {
      const minsLeft = remainingProfit / effectiveProfitPerMin;
      const secsLeft = Math.round(minsLeft * 60);

      let formatted = '';
      if (secsLeft < 60) {
        formatted = `< 1 min (~${Math.max(5, secsLeft)}s)`;
      } else if (secsLeft < 3600) {
        const m = Math.floor(secsLeft / 60);
        const s = secsLeft % 60;
        formatted = `~${m}m ${s > 0 ? `${s}s` : ''}`;
      } else {
        const h = Math.floor(secsLeft / 3600);
        const m = Math.floor((secsLeft % 3600) / 60);
        formatted = `~${h}h ${m}m`;
      }

      return {
        tradesPerMinute,
        avgSecondsPerTrade,
        profitPerMinute: Number(effectiveProfitPerMin.toFixed(2)),
        timeToTarget: formatted,
        timeSecs: secsLeft,
        status: 'ON_TRACK' as const,
      };
    }

    // If current profit velocity is flat or in drawdown, estimate from win rate expectancy & trade frequency
    if (sessionStats.totalTrades > 0 && tradesPerMinute > 0) {
      const winRate = sessionStats.wins / sessionStats.totalTrades;
      const avgWin = config.baseStake * (config.payoutRate > 1.5 ? config.payoutRate - 1 : config.payoutRate);
      const avgLoss = config.baseStake;
      const expectedProfitPerTrade = (winRate * avgWin) - ((1 - winRate) * avgLoss);

      if (expectedProfitPerTrade > 0) {
        const estTrades = Math.ceil(remainingProfit / expectedProfitPerTrade);
        const estSecs = Math.round(estTrades * avgSecondsPerTrade);
        const m = Math.floor(estSecs / 60);
        const s = estSecs % 60;
        return {
          tradesPerMinute,
          avgSecondsPerTrade,
          profitPerMinute: Number((expectedProfitPerTrade * tradesPerMinute).toFixed(2)),
          timeToTarget: `~${m}m ${s}s (Pacing)`,
          timeSecs: estSecs,
          status: 'ESTIMATING' as const,
        };
      }
    }

    if (currentNetProfit < 0) {
      return {
        tradesPerMinute,
        avgSecondsPerTrade,
        profitPerMinute: Number(effectiveProfitPerMin.toFixed(2)),
        timeToTarget: 'Recouping drawdown...',
        timeSecs: null,
        status: 'RECOVERING' as const,
      };
    }

    return {
      tradesPerMinute,
      avgSecondsPerTrade,
      profitPerMinute: Number(effectiveProfitPerMin.toFixed(2)),
      timeToTarget: 'Calculating pace...',
      timeSecs: null,
      status: 'CALCULATING' as const,
    };
  }, [tradeHistory, sessionStats, effectiveTarget, currentNetProfit, remainingProfit, config]);

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExportCsv = () => {
    const result = exportTradesToCsv(tradeHistory, `deriv_recovery_${currentSymbol}`);
    if (result.success) {
      setExportNotice(`Exported ${result.count} trade record(s) to CSV successfully!`);
      setTimeout(() => setExportNotice(null), 4000);
    } else {
      setExportNotice(result.error || 'Failed to export trades');
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  const isTradeBlocked = isStopLossHit || isTakeProfitHit || (isProfitLockHit && !tempUnlocked);

  const handleExecuteTrade = (contractType: any, target: any) => {
    if (isTradeBlocked) return;
    onSimulateTrade({
      contractType,
      targetValue: target,
      stake: currentStake,
    });
  };

  return (
    <div id="super-recovery-manager" className="space-y-4">
      {/* Recovery Engine Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Algorithmic Super Recovery &amp; Risk Protocol (X2 / X4)
            </h3>
            <p className="text-xs text-slate-400">
              Same-loss-price restitution mathematically calibrated to contract payout. Recovers 100% drawdown + locks profit.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              id="export-session-csv-btn"
              onClick={handleExportCsv}
              disabled={tradeHistory.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border ${
                tradeHistory.length > 0
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-pointer shadow-sm'
                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
              title="Export recorded trade history to RFC-4180 compliant CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
              {tradeHistory.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                  {tradeHistory.length}
                </span>
              )}
            </button>

            <button
              id="reset-session-btn"
              onClick={onResetSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Reset Stats
            </button>
          </div>
        </div>

        {/* Live Session Status Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {/* Net Profit */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Session Net P&amp;L</div>
            <div className={`text-xl font-black font-mono mt-0.5 ${sessionStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {sessionStats.netProfit >= 0 ? '+' : ''}${sessionStats.netProfit.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Target: ${config.takeProfit.toFixed(2)}
            </div>
          </div>

          {/* Win Rate */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Trades &amp; Win Rate</div>
            <div className="text-xl font-black font-mono text-white mt-0.5">
              {sessionStats.totalTrades > 0
                ? `${((sessionStats.wins / sessionStats.totalTrades) * 100).toFixed(1)}%`
                : '0.0%'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {sessionStats.wins}W - {sessionStats.losses}L ({sessionStats.totalTrades} Total)
            </div>
          </div>

          {/* Recovery State */}
          <div className={`p-3 rounded-xl border ${
            isInRecovery ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950 border-slate-800/80'
          }`}>
            <div className="text-[10px] uppercase font-bold text-slate-400">Recovery Status</div>
            <div className={`text-xl font-black font-mono mt-0.5 ${isInRecovery ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isInRecovery ? `Step ${currentStepNum} Active` : 'Step 1 (Normal)'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {isInRecovery ? `Recouping $${sessionStats.cumulativeLoss.toFixed(2)}` : 'Zero Drawdown'}
            </div>
          </div>

          {/* Next Trade Stake */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Next Trade Stake</div>
            <div className="text-xl font-black font-mono text-cyan-400 mt-0.5">
              ${currentStake.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Mode: {config.recoveryStrategy === 'X2_SUPER_RECOVERY' ? 'Super X2' : config.recoveryStrategy === 'X4_SUPER_RECOVERY' ? 'Super X4' : 'Standard'}
            </div>
          </div>
        </div>

        {/* Visual Target Progress Bar & Estimated Time to Reach Target */}
        <div
          id="target-progress-velocity-panel"
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl mb-5 space-y-4"
        >
          {/* Header row: Target Progress & Estimated Time Indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                  <span>Target Progress</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 font-bold">
                    {progressPercent.toFixed(1)}% Completed
                  </span>
                  {isProfitLockEnabled && (
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] border flex items-center gap-1 font-semibold ${
                        isProfitLockHit
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      {isProfitLockHit ? 'Profit Lock Triggered' : 'Profit Lock Armed'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  Current Net Profit:{' '}
                  <span className={`font-bold ${currentNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentNetProfit >= 0 ? '+' : ''}${currentNetProfit.toFixed(2)}
                  </span>{' '}
                  /{' '}
                  <span className="text-slate-300 font-bold">${effectiveTarget.toFixed(2)} Target</span>
                  {remainingProfit > 0 ? (
                    <span className="text-slate-500 ml-1.5">(${remainingProfit.toFixed(2)} left to lock)</span>
                  ) : (
                    <span className="text-emerald-400 font-bold ml-1.5">🎯 (Target Secured)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Estimated Time to Reach Target Indicator */}
            <div
              id="time-to-target-indicator"
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border shadow-sm self-start sm:self-auto ${
                targetMetrics.status === 'REACHED'
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300'
                  : targetMetrics.status === 'ON_TRACK'
                  ? 'bg-slate-900/90 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                <Clock
                  className={`w-4 h-4 ${
                    targetMetrics.status === 'ON_TRACK'
                      ? 'text-cyan-400 animate-pulse'
                      : targetMetrics.status === 'REACHED'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Est. Time to Target
                </div>
                <div className="text-sm font-black font-mono tracking-tight flex items-center gap-1.5">
                  <span
                    className={
                      targetMetrics.status === 'REACHED'
                        ? 'text-emerald-400 font-bold'
                        : targetMetrics.status === 'ON_TRACK'
                        ? 'text-cyan-300 font-bold'
                        : 'text-slate-200'
                    }
                  >
                    {targetMetrics.timeToTarget}
                  </span>
                  {targetMetrics.status === 'ON_TRACK' && (
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar with Milestones */}
          <div className="space-y-1.5 pt-1">
            <div className="relative h-4 w-full bg-slate-950 rounded-full border border-slate-800/80 p-0.5 overflow-hidden shadow-inner flex items-center">
              {/* Progress track fill */}
              <div
                className={`h-full rounded-full transition-all duration-700 relative ${
                  progressPercent >= 100
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-md shadow-emerald-500/40'
                    : progressPercent >= 60
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400'
                    : 'bg-gradient-to-r from-teal-600 to-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              >
                {/* Subtle highlight sheen */}
                <div className="absolute inset-0 bg-white/15 rounded-full" />
              </div>

              {/* Milestone ticks inside bar at 25%, 50%, 75% */}
              <div className="absolute left-1/4 top-0 bottom-0 w-px bg-slate-800/90 pointer-events-none" />
              <div className="absolute left-2/4 top-0 bottom-0 w-px bg-slate-800/90 pointer-events-none" />
              <div className="absolute left-3/4 top-0 bottom-0 w-px bg-slate-800/90 pointer-events-none" />
            </div>

            {/* Milestone labels */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-0.5 select-none">
              <span>$0.00 (0%)</span>
              <span className="hidden sm:inline">25% (${(effectiveTarget * 0.25).toFixed(0)})</span>
              <span>50% (${(effectiveTarget * 0.5).toFixed(0)})</span>
              <span className="hidden sm:inline">75% (${(effectiveTarget * 0.75).toFixed(0)})</span>
              <span className={`font-bold flex items-center gap-1 ${progressPercent >= 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                ${effectiveTarget.toFixed(0)} Lock
                <Lock className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>

          {/* Real-time Velocity & Frequency Statistics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-800/70">
            {/* Session Trade Frequency */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                Trade Frequency
              </div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {targetMetrics.tradesPerMinute > 0 ? `${targetMetrics.tradesPerMinute} trades/min` : 'Calibrating...'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {targetMetrics.avgSecondsPerTrade > 0 ? `Avg ~${targetMetrics.avgSecondsPerTrade}s per trade` : `${sessionStats.totalTrades} trades in session`}
              </div>
            </div>

            {/* Net Profit Velocity */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                Profit Velocity
              </div>
              <div className={`text-sm font-mono font-bold mt-0.5 ${targetMetrics.profitPerMinute >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {targetMetrics.profitPerMinute >= 0 ? '+' : ''}${targetMetrics.profitPerMinute.toFixed(2)}/min
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Session pace velocity
              </div>
            </div>

            {/* Remaining To Target */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                Remaining to Lock
              </div>
              <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                ${remainingProfit.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {progressPercent >= 100 ? 'Target secured' : `${(100 - progressPercent).toFixed(1)}% remaining`}
              </div>
            </div>

            {/* Profit Lock Volatility Shield */}
            <div
              className={`p-2.5 rounded-xl border ${
                isProfitLockHit
                  ? 'bg-amber-950/30 border-amber-500/50'
                  : isProfitLockEnabled
                  ? 'bg-slate-900/60 border-slate-800/60'
                  : 'bg-slate-900/40 border-slate-800/40'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Lock className={`w-3 h-3 ${isProfitLockHit ? 'text-amber-400' : 'text-slate-400'}`} />
                Profit Lock Guard
              </div>
              <div
                className={`text-sm font-mono font-bold mt-0.5 ${
                  isProfitLockHit
                    ? 'text-amber-400'
                    : isProfitLockEnabled
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {isProfitLockHit ? 'LOCKED 🔒' : isProfitLockEnabled ? 'ARMED 🛡️' : 'DISABLED'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                {isProfitLockHit ? 'Bot halted & paused' : isProfitLockEnabled ? `Auto-stop at $${dailyProfitTarget.toFixed(2)}` : 'No auto-lock'}
              </div>
            </div>
          </div>
        </div>

        {/* Profit Lock Triggered Alert Banner */}
        {isProfitLockHit && !tempUnlocked && (
          <div
            id="profit-lock-alert-banner"
            className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-950 to-emerald-950/60 border-2 border-amber-500/70 shadow-xl shadow-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/50 shrink-0">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-white tracking-tight">
                    PROFIT LOCK ACTIVATED — TARGET SECURED
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40">
                    Bot Stopped &amp; Recovery Paused
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Predefined daily profit target of <span className="font-bold font-mono text-emerald-300">${dailyProfitTarget.toFixed(2)}</span> has been reached with session net profit of{' '}
                  <span className="font-bold font-mono text-emerald-400">+{currentNetProfit >= 0 ? '$' : '-$'}{Math.abs(currentNetProfit).toFixed(2)}</span>.
                  Automated execution is automatically stopped and the recovery protocol is paused to protect capital against sudden market volatility.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                id="unlock-profit-lock-btn"
                onClick={() => setTempUnlocked(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                title="Temporarily bypass profit lock and resume manual or automated trading"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock &amp; Resume</span>
              </button>
            </div>
          </div>
        )}

        {/* Circuit Breakers Alerts */}
        {isStopLossHit && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center gap-3 text-rose-300 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold">STOP LOSS CIRCUIT BREAKER TRIPPED: </span>
              Cumulative loss reached ${sessionStats.cumulativeLoss.toFixed(2)} (Limit: ${config.stopLoss.toFixed(2)}). Trading halted for capital preservation.
            </div>
          </div>
        )}
        {isTakeProfitHit && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">TAKE PROFIT TARGET ACHIEVED: </span>
              Target profit of ${config.takeProfit.toFixed(2)} secured! Congratulations on a disciplined trading session.
            </div>
          </div>
        )}

        {/* Real-Time Auto-Recovery Action Notification Banner */}
        {autoRecoveryNotice && (
          <div className="mb-4 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 text-cyan-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-cyan-950/30">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
              <span className="font-mono">{autoRecoveryNotice}</span>
            </div>
            {onDismissNotice && (
              <button
                onClick={onDismissNotice}
                className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-300 text-[10px] font-mono shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Automatic Next Trade Following Loss Card */}
        <div
          id="auto-next-trade-card"
          className={`p-4 rounded-xl border transition-all mb-5 ${
            isAutoArmed
              ? 'bg-gradient-to-r from-emerald-950/30 via-slate-950 to-cyan-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/20'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={`p-1.5 rounded-lg ${
                    isAutoArmed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">
                  Automatic Next Trade Following Loss
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isAutoArmed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isAutoArmed ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      ARMED &amp; ACTIVE
                    </>
                  ) : (
                    'DISABLED (MANUAL ONLY)'
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                When active, if any trade concludes in a loss, the engine automatically calculates the required restitution stake via{' '}
                <span className="text-cyan-400 font-mono font-bold">
                  {config.recoveryStrategy.replace(/_/g, ' ')}
                </span>{' '}
                and executes the next trade with the <span className="text-white font-semibold">same market parameters</span> on the <span className="text-emerald-400 font-semibold">very next incoming Deriv tick</span> for rapid, unhesitating recovery.
              </p>
            </div>

            {/* Accessible Toggle & Run Bot Button */}
            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center flex-wrap">
              {onToggleRun && (
                <button
                  id="run-super-recovery-bot-btn"
                  onClick={() => {
                    const next = !isRunning;
                    onToggleRun(next);
                    if (next && !isAutoArmed) {
                      if (onToggleAutoNextTrade) {
                        onToggleAutoNextTrade(true);
                      } else {
                        setLocalAutoNextTrade(true);
                      }
                    }
                  }}
                  className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                    isRunning
                      ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-rose-950/50'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50 ring-2 ring-emerald-500/30'
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
                      <span>RUN RECOVERY BOT</span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
                <button
                  id="toggle-auto-next-trade-btn"
                  onClick={handleToggleAuto}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer ${
                    isAutoArmed ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={isAutoArmed}
                  aria-label="Toggle Automatic Next Trade Following Loss"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isAutoArmed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-xs font-mono font-bold ${isAutoArmed ? 'text-emerald-400' : 'text-slate-400'}`}>
                  AUTO: {isAutoArmed ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Auto-Trade Telemetry */}
          {isAutoArmed && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                <span className="text-slate-500">Auto Execution:</span>
                <span className="text-emerald-400 font-bold">100% Real Deriv WebSocket Ticks</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                <span className="text-slate-500">Next Auto Stake:</span>
                <span className="text-cyan-400 font-bold">${currentStake.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                <span className="text-slate-500">Circuit Guard:</span>
                <span className="text-amber-400 font-bold">Max {config.maxConsecutiveLosses} Steps / ${config.stopLoss} SL</span>
              </div>
            </div>
          )}
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4">
          {/* Recovery Strategy Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              Recovery Protocol
            </label>
            <select
              value={config.recoveryStrategy}
              onChange={(e) => setConfig({ ...config, recoveryStrategy: e.target.value as RecoveryStrategy })}
              aria-label="Select Recovery Protocol"
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="X2_SUPER_RECOVERY">Super Recovery X2 (Same Loss + 2x Profit)</option>
              <option value="X4_SUPER_RECOVERY">Super Recovery X4 (High-Speed Single Win + 4x Profit)</option>
              <option value="MARTINGALE">Classic Martingale (x2 Double)</option>
              <option value="DALEMBERT">D'Alembert (Conservative +1 Unit)</option>
            </select>
          </div>

          {/* Contract Type Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              Contract Market
            </label>
            <select
              value={config.contractType}
              onChange={(e) => handleContractChange(e.target.value)}
              aria-label="Select Contract Market"
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="MATCHES">Matches (Exact Digit, 9.5x Payout)</option>
              <option value="DIFFERS">Differs (Avoid Digit, 1.09x Payout)</option>
              <option value="RISE">Rise (Higher, 1.95x Payout)</option>
              <option value="FALL">Fall (Lower, 1.95x Payout)</option>
              <option value="OVER">Over (Over Digit, 1.45x Payout)</option>
              <option value="UNDER">Under (Under Digit, 1.45x Payout)</option>
            </select>
          </div>

          {/* Base Stake */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              Base Stake ($)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.35"
              max="500"
              value={config.baseStake}
              onChange={(e) => setConfig({ ...config, baseStake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Take Profit */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              Take Profit ($)
            </label>
            <input
              type="number"
              step="5"
              min="5"
              value={config.takeProfit}
              onChange={(e) => setConfig({ ...config, takeProfit: Math.max(5, parseFloat(e.target.value) || 10) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Stop Loss */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              Stop Loss ($)
            </label>
            <input
              type="number"
              step="10"
              min="10"
              value={config.stopLoss}
              onChange={(e) => setConfig({ ...config, stopLoss: Math.max(10, parseFloat(e.target.value) || 50) })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Dedicated Profit Lock & Volatility Guard Settings Card */}
        <div
          id="profit-lock-config-card"
          className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-md mb-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                  <span>Profit Lock &amp; Volatility Guard</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                    isProfitLockHit
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : isProfitLockEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {isProfitLockHit ? 'LOCKED & PAUSED' : isProfitLockEnabled ? 'ACTIVE & ARMED' : 'OFF'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Automatically stops the bot and pauses recovery when predefined daily profit target is reached, preventing over-trading during high volatility.
                </div>
              </div>
            </div>

            <button
              type="button"
              id="toggle-profit-lock-btn"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  profitLockEnabled: !isProfitLockEnabled,
                }))
              }
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isProfitLockEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {isProfitLockEnabled ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isProfitLockEnabled ? 'Profit Lock: ON' : 'Profit Lock: OFF'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono flex items-center justify-between">
                <span>Predefined Daily Profit Target ($)</span>
                <span className="text-amber-400 font-mono font-bold">${dailyProfitTarget.toFixed(2)}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="5"
                  min="5"
                  value={config.profitLockTarget ?? config.takeProfit}
                  onChange={(e) => {
                    const val = Math.max(5, parseFloat(e.target.value) || 10);
                    setConfig((prev) => ({ ...prev, profitLockTarget: val }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="50.00"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {[25, 50, 100, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, profitLockTarget: preset }))
                      }
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer border ${
                        (config.profitLockTarget ?? config.takeProfit) === preset
                          ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 flex items-center text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
              <Shield className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
              <span>
                <strong className="text-white font-semibold">Over-trading Protection:</strong> High volatility often triggers sudden drawdown spikes following a profitable run. Profit Lock guarantees that your daily winnings are banked by shutting down active execution and disarming auto-recovery.
              </span>
            </div>
          </div>
        </div>

        {/* Live Trade Action Trigger Bar */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                <Gauge className="w-4 h-4 text-emerald-400" />
                Live Real-Time Trade Execution ({currentSymbol})
                {isAutoArmed && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Auto-Next Armed
                  </span>
                )}
                {isProfitLockHit && !tempUnlocked && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/40 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Halted by Profit Lock
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300">
                Ready to trade on <span className="font-bold text-emerald-400">Next Incoming Deriv Tick</span> with calculated recovery stake{' '}
                <span className="font-mono font-bold text-cyan-400">${currentStake.toFixed(2)}</span>
                {isAutoArmed && (
                  <span className="text-emerald-400 ml-1">
                    • Auto-recovers on next tick if lost
                  </span>
                )}
              </div>
            </div>

            {/* Target Digit Selector for Matches / Differs */}
            {(config.contractType === 'MATCHES' || config.contractType === 'DIFFERS') && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">Target Digit:</span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedTargetDigit(d)}
                      className={`w-6 h-7 rounded text-xs font-mono font-bold transition-all ${
                        selectedTargetDigit === d
                          ? 'bg-purple-600 text-white scale-110 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {config.contractType === 'MATCHES' && (
                <button
                  id="trade-matches-btn"
                  onClick={() => handleExecuteTrade('MATCHES', selectedTargetDigit)}
                  disabled={isTradeBlocked}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Execute MATCHES (Digit {selectedTargetDigit})
                </button>
              )}

              {config.contractType === 'DIFFERS' && (
                <button
                  id="trade-differs-btn"
                  onClick={() => handleExecuteTrade('DIFFERS', selectedTargetDigit)}
                  disabled={isTradeBlocked}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Execute DIFFERS (Avoid {selectedTargetDigit})
                </button>
              )}

              {config.contractType === 'RISE' && (
                <button
                  id="trade-rise-btn"
                  onClick={() => handleExecuteTrade('RISE', 'Higher')}
                  disabled={isTradeBlocked}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  Execute RISE (Higher)
                </button>
              )}

              {config.contractType === 'FALL' && (
                <button
                  id="trade-fall-btn"
                  onClick={() => handleExecuteTrade('FALL', 'Lower')}
                  disabled={isTradeBlocked}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <TrendingUp className="w-4 h-4 rotate-180" />
                  Execute FALL (Lower)
                </button>
              )}

              {(config.contractType === 'OVER' || config.contractType === 'UNDER') && (
                <button
                  id="trade-over-under-btn"
                  onClick={() => handleExecuteTrade(config.contractType, selectedTargetDigit)}
                  disabled={isTradeBlocked}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Execute {config.contractType} {selectedTargetDigit}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recovery Ladder Step Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="uppercase tracking-wider">
              {config.recoveryStrategy.replace('_', ' ')} Forecast Ladder (Up to {config.maxConsecutiveLosses} Steps)
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              Target Contract Net Payout: {(config.payoutRate > 1.5 ? (config.payoutRate - 1) * 100 : config.payoutRate * 100).toFixed(0)}%
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Step</th>
                  <th className="py-2 px-3">Trade Stake</th>
                  <th className="py-2 px-3">Total Invested</th>
                  <th className="py-2 px-3">Gross Return</th>
                  <th className="py-2 px-3">Net Profit Recovered</th>
                  <th className="py-2 px-3">Risk Level</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {ladder.map((row) => {
                  const isCurrentActiveStep = isInRecovery
                    ? row.step === currentStepNum
                    : row.step === 1;

                  let riskBadgeColor = 'text-slate-300 bg-slate-800';
                  if (row.riskGrade === 'CRITICAL') riskBadgeColor = 'text-rose-400 bg-rose-950/40 border border-rose-500/30';
                  else if (row.riskGrade === 'HIGH') riskBadgeColor = 'text-amber-400 bg-amber-950/40 border border-amber-500/30';
                  else if (row.riskGrade === 'ELEVATED') riskBadgeColor = 'text-yellow-300 bg-yellow-950/30';
                  else if (row.riskGrade === 'LOW') riskBadgeColor = 'text-emerald-400 bg-emerald-950/30';

                  return (
                    <tr
                      key={row.step}
                      className={`transition-colors ${
                        isCurrentActiveStep
                          ? 'bg-emerald-500/10 font-bold border-l-4 border-l-emerald-500'
                          : 'hover:bg-slate-850'
                      }`}
                    >
                      <td className="py-2 px-3">
                        <span className="flex items-center gap-1.5">
                          Step {row.step}
                          {isCurrentActiveStep && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-cyan-400 font-bold">
                        ${row.stake.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        ${row.totalAtRisk.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        ${row.payoutOnWin.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-emerald-400 font-bold">
                        +${row.netProfitOnWin.toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskBadgeColor}`}>
                          {row.riskGrade}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isCurrentActiveStep ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                            NEXT TO EXECUTE
                          </span>
                        ) : row.step < currentStepNum ? (
                          <span className="text-[10px] text-slate-500">EXHAUSTED</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">RESERVE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Simulated Trades Audit Log & CSV Export */}
        {exportNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300 font-mono animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{exportNotice}</span>
            </div>
          </div>
        )}

        {tradeHistory.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trade Execution Log ({tradeHistory.length} Recorded)</span>
              </div>

              <button
                id="export-trade-history-csv-bottom-btn"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition-all shadow-sm cursor-pointer"
                title="Download entire trade history as a CSV file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV ({tradeHistory.length})</span>
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Contract</th>
                    <th className="py-2 px-3">Stake</th>
                    <th className="py-2 px-3">Result Digit</th>
                    <th className="py-2 px-3">Profit/Loss</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                  {tradeHistory.slice(-8).reverse().map((t, idx) => (
                    <tr key={`${t.id}-${idx}`} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 text-slate-200 font-semibold">{t.symbol}</td>
                      <td className="py-2 px-3">
                        <span className="text-slate-300 font-bold">{t.contractType}</span>{' '}
                        <span className="text-amber-400">({t.targetValue})</span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">${t.stake.toFixed(2)}</td>
                      <td className="py-2 px-3">
                        {t.exitDigit !== undefined ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-white">
                            {t.exitDigit}
                          </span>
                        ) : (
                          <span className="text-slate-500 animate-pulse">Waiting Tick...</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {t.status === 'WON' && (
                          <span className="text-emerald-400">+${t.profit.toFixed(2)}</span>
                        )}
                        {t.status === 'LOST' && (
                          <span className="text-rose-400">-${t.stake.toFixed(2)}</span>
                        )}
                        {t.status === 'PENDING' && <span className="text-slate-500">---</span>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {t.status === 'WON' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            WON
                          </span>
                        )}
                        {t.status === 'LOST' && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                            LOST (Recovery Triggered)
                          </span>
                        )}
                        {t.status === 'PENDING' && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] animate-pulse">
                            PENDING NEXT TICK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
