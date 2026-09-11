/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Square, AlertTriangle, ChevronUp, ChevronDown, Zap, Target, DollarSign } from 'lucide-react';
import { AutoMatchesConfig } from '../types';

interface FloatingAutoMatchesBarProps {
  isRunning: boolean;
  onToggleRun: (running: boolean) => void;
  config: AutoMatchesConfig;
  onConfigChange: (config: AutoMatchesConfig) => void;
  currentSymbol: string;
  lastDigit?: number;
  targetDigit?: number;
  totalMatchesWon?: number;
  netProfit?: number;
  onOpenSafetyModal?: () => void;
}

export const FloatingAutoMatchesBar: React.FC<FloatingAutoMatchesBarProps> = ({
  isRunning,
  onToggleRun,
  config,
  onConfigChange,
  currentSymbol,
  lastDigit,
  targetDigit,
  totalMatchesWon = 0,
  netProfit = 0,
  onOpenSafetyModal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isFast = config.executionSpeed === 'FAST';

  const toggleExecutionSpeed = () => {
    onConfigChange({
      ...config,
      executionSpeed: isFast ? 'NORMAL' : 'FAST',
    });
  };

  const handleStakeChange = (newStake: number) => {
    onConfigChange({
      ...config,
      stake: newStake,
    });
  };

  const currentStake = config.stake || 0.35;

  return (
    <div
      id="floating-auto-matches-container"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-3 sm:px-4 pointer-events-none select-none"
    >
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        {/* Top Control Bar: Circuit Breaker & Collapse Toggle */}
        <div className="w-full flex items-center justify-between px-2">
          {/* Circuit Breaker Button (Left) */}
          <button
            id="safety-circuit-trigger-btn"
            type="button"
            onClick={onOpenSafetyModal}
            className="px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-yellow-400 border border-slate-700/80 shadow-lg flex items-center gap-1.5 text-xs font-mono transition cursor-pointer"
            title="Safety Limits & Circuit Breakers (Profit Lock / Stop Loss)"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">Safety Limits</span>
          </button>

          {/* Current Live Tick & Target Indicator (Center) */}
          <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-lg flex items-center gap-2.5 text-[11px] font-mono text-slate-300">
            <span>
              Tick: <strong className="text-emerald-400">{lastDigit ?? '-'}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Target: <strong className="text-teal-300">#{targetDigit ?? lastDigit ?? 0}</strong>
            </span>
          </div>

          {/* Accordion Toggle Chevron (Right) */}
          <button
            id="toggle-floating-bar-expand-btn"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 backdrop-blur-md transition cursor-pointer shadow-md"
            title={isExpanded ? 'Collapse Trading Dock' : 'Expand Trading Dock'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Main Floating Runner Dock */}
        {isExpanded && (
          <div
            id="floating-dock-controls-bar"
            className="w-full rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 shadow-[0_10px_35px_rgba(0,0,0,0.85)] p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 transition-all"
          >
            {/* Primary RUN / STOP Controller */}
            <button
              id="floating-run-toggle-btn"
              type="button"
              onClick={() => onToggleRun(!isRunning)}
              className={`px-6 sm:px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 transition-all shadow-md cursor-pointer shrink-0 font-mono ${
                isRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60 ring-2 ring-rose-400/50 animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-emerald-950/60 ring-2 ring-emerald-400/40'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>STOP TRADER</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>RUN TRADER</span>
                </>
              )}
            </button>

            {/* Stake Quick-Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase hidden sm:inline">
                Stake:
              </span>
              {[0.35, 1.0, 2.0, 5.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStakeChange(s)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    currentStake === s
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  ${s.toFixed(2)}
                </button>
              ))}
            </div>

            {/* Execution Speed Toggle */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-left font-mono">
                <div className="text-[9px] font-bold text-slate-400 uppercase">SPEED</div>
                <div className="text-[11px] font-bold text-white">{isFast ? '1-TICK' : 'STANDARD'}</div>
              </div>
              <button
                id="floating-execution-speed-toggle"
                type="button"
                onClick={toggleExecutionSpeed}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none ${
                  isFast ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                title={isFast ? '1-Tick: Trades on every tick' : 'Standard: Trades with confirmation'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ${
                    isFast ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Live Status & Performance Display */}
            <div
              id="floating-bot-status-card"
              className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-xl border text-center font-mono text-xs flex flex-col justify-center ${
                isRunning
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 font-bold truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                  }`}
                />
                <span>{isRunning ? 'TRADING ACTIVE' : 'IDLE / READY'}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Won: <strong className="text-white">{totalMatchesWon}</strong> • P&amp;L:{' '}
                <strong className={netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {netProfit >= 0 ? `+$${netProfit.toFixed(2)}` : `-$${Math.abs(netProfit).toFixed(2)}`}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
