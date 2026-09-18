/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, X, ShieldCheck, Lock, Zap, Target } from 'lucide-react';
import { AutoMatchesConfig } from '../types';

interface AutoMatchesSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AutoMatchesConfig;
  onConfigChange: (config: AutoMatchesConfig) => void;
  profitLockEnabled: boolean;
  onToggleProfitLock: (enabled: boolean) => void;
  profitLockTarget: number;
  onProfitLockTargetChange: (target: number) => void;
  stopLoss: number;
  onStopLossChange: (sl: number) => void;
  currentNetProfit: number;
  currentDrawdown: number;
}

export const AutoMatchesSafetyModal: React.FC<AutoMatchesSafetyModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  profitLockEnabled,
  onToggleProfitLock,
  profitLockTarget,
  onProfitLockTargetChange,
  stopLoss,
  onStopLossChange,
  currentNetProfit,
  currentDrawdown,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div
        id="auto-matches-safety-modal"
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden space-y-4"
      >
        {/* Modal Header with Warning Icon */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-yellow-300 flex items-center justify-center shadow-lg shadow-blue-900/50">
              <AlertTriangle className="w-5 h-5 fill-yellow-400 text-blue-950" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Risk Management &amp; Circuit Breakers
              </h3>
              <p className="text-xs text-slate-400">
                Automated protections for high-speed Auto-Matches bot
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs font-sans">
          {/* Current Session Stats */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Current Session P/L</span>
              <span
                className={`text-base font-black ${
                  currentNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {currentNetProfit >= 0 ? '+' : ''}${currentNetProfit.toFixed(2)} USD
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Current Drawdown</span>
              <span className="text-base font-black text-rose-400">
                ${currentDrawdown.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* Setting 0A: Win Protection Strategy Mode */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-sm">Winning Strategy Mode</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Select the execution contract. 100% Win Shield trades DIFFERS against the coldest dormant digit for maximum win consistency.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    contractMode: 'DIFFERS',
                  })
                }
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  config.contractMode !== 'MATCHES'
                    ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-400'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>100% Win Shield (DIFFERS)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Highest win rate. Bets that the next tick will differ from the coldest stagnant digit.
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    contractMode: 'MATCHES',
                  })
                }
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  config.contractMode === 'MATCHES'
                    ? 'bg-amber-950/50 border-amber-500 text-white ring-1 ring-amber-400'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Target className="w-3.5 h-3.5" />
                  <span>High Payout (MATCHES 10X)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  High-risk / 10x payout. Trades for an exact digit match using Markov transition prediction.
                </div>
              </button>
            </div>
          </div>

          {/* Setting 0: Stop Condition Mode (Continuous vs Drawdown Circuit Breaker) */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-sm">Trading Halt &amp; Stop Policy</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Configure whether the bot trades continuously through losses or stops on drawdown.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    stopConditionMode: 'ONLY_MANUAL_OR_TARGET',
                  })
                }
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  (config.stopConditionMode || 'ONLY_MANUAL_OR_TARGET') === 'ONLY_MANUAL_OR_TARGET'
                    ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-400'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>24/7 Non-Stop (Stop ONLY by Me or TP)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Continuous trading. Never halts on loss or noise. Runs until you click STOP or hit TP $10,000.
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    stopConditionMode: 'STOP_ON_MAX_LOSS',
                  })
                }
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                  config.stopConditionMode === 'STOP_ON_MAX_LOSS'
                    ? 'bg-rose-950/50 border-rose-500 text-white ring-1 ring-rose-400'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Stop on Max Loss Limit</span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Circuit breaker halts trading if drawdown hits the stop loss threshold.
                </div>
              </button>
            </div>
          </div>

          {/* Setting 0B: Take Profit (TP) Target */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-sm">Take Profit (TP) Goal Target</span>
              </div>
              <span className="text-[10px] text-cyan-300 font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                Default $10,000
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              The bot will continuously trade until this target profit is reached, or until you click STOP manually.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono">
              <span className="text-slate-400 text-[11px]">TP Target:</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">$</span>
                <input
                  type="number"
                  step="100"
                  min="10"
                  max="50000"
                  value={config.expectedProfit || 10000}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      expectedProfit: Math.max(1, Number(e.target.value) || 10000),
                    })
                  }
                  className="w-28 py-1 px-2 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs"
                />
                <span className="text-slate-500">USD</span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {[1000, 5000, 10000, 20000].map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        expectedProfit: tp,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                      (config.expectedProfit || 10000) === tp
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    ${tp >= 1000 ? `${tp / 1000}k` : tp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Setting 1: 100% Won Profit Protection Vault */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">100% Won Profit Vault Shield</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    profitShieldActive: !(config.profitShieldActive ?? true),
                  })
                }
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  (config.profitShieldActive ?? true) ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    (config.profitShieldActive ?? true) ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Guarantees won profits are saved! When you gain profits, this shield trails peak gains. If the market retraces, trading halts immediately to secure 100% of accumulated profit.
            </p>
            {(config.profitShieldActive ?? true) && (
              <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                <span className="text-slate-400 text-[11px]">Protected Profit Portion:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  100% Locked &amp; Saved
                </span>
              </div>
            )}
          </div>

          {/* Setting 2: Profit Lock */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">Profit Lock Auto-Halt</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleProfitLock(!profitLockEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  profitLockEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    profitLockEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Instantly stops the bot and pauses all trades once daily profit target is secured.
            </p>
            {profitLockEnabled && (
              <div className="flex items-center gap-2 pt-1 font-mono">
                <span className="text-slate-400 text-[11px]">Daily Profit Target:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    step="100"
                    min="5"
                    max="50000"
                    value={profitLockTarget}
                    onChange={(e) => onProfitLockTargetChange(Number(e.target.value))}
                    className="w-24 py-1 px-2 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                  />
                  <span className="text-slate-500">USD</span>
                </div>
              </div>
            )}
          </div>

          {/* Setting 2: Session Stop Loss */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-white text-sm">Hard Stop Loss Circuit Breaker</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Immediately halts trading if cumulative drawdown reaches this threshold.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono">
              <span className="text-slate-400 text-[11px]">Stop Loss Limit:</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">$</span>
                <input
                  type="number"
                  step="100"
                  min="5"
                  max="50000"
                  value={stopLoss}
                  onChange={(e) => onStopLossChange(Number(e.target.value))}
                  className="w-24 py-1 px-2 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                />
                <span className="text-slate-500">USD</span>
              </div>
            </div>
          </div>

          {/* Setting 3: Auto-Matches Stake */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Default Matches Stake</span>
              <span className="text-emerald-400 font-mono font-bold text-xs">
                Win: +${((config.stake || 0.35) * 7.3428).toFixed(2)} USD
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[0.35, 0.5, 1.0, 2.0, 5.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onConfigChange({ ...config, stake: val })}
                  className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-all ${
                    config.stake === val
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  ${val.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Save &amp; Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
