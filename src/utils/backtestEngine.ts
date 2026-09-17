/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BacktestConfig, BacktestResult, BacktestTrade } from '../types';
import {
  calculateMarkovTransitionMatrix,
  findBestDiffersTarget,
  findBestAutoMatchesTarget,
} from './autoMatchesEngine';

export function runHistoricalBacktest(
  prices: number[],
  digits: number[],
  config: BacktestConfig,
  initialBalance: number = 1000
): BacktestResult {
  const trades: BacktestTrade[] = [];
  const minWarmup = 30; // Need at least 30 ticks to compute statistics

  if (prices.length < minWarmup + 10 || digits.length < minWarmup + 10) {
    return {
      config,
      symbol: config.symbol,
      totalTicksTested: digits.length,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      initialBalance,
      finalBalance: initialBalance,
      netProfit: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      trades: [],
      equityCurve: [{ trade: 0, balance: initialBalance, profit: 0 }],
    };
  }

  let currentBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  let cumulativeLoss = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  const equityCurve: Array<{ trade: number; balance: number; profit: number }> = [
    { trade: 0, balance: initialBalance, profit: 0 },
  ];

  // Tick-by-tick simulation from warmup index to end
  for (let i = minWarmup; i < digits.length - 1; i++) {
    // Check Take Profit or Stop Loss hit
    const currentNet = currentBalance - initialBalance;
    if (config.takeProfit > 0 && currentNet >= config.takeProfit) {
      break;
    }
    if (config.stopLoss > 0 && currentNet <= -config.stopLoss) {
      break;
    }

    // Check Max Allowed Losses protection
    if (config.maxAllowedLosses > 0 && consecutiveLosses >= config.maxAllowedLosses) {
      // Pause/skip until simulated reset or break
      consecutiveLosses = 0;
      cumulativeLoss = 0;
      continue;
    }

    const pastDigits = digits.slice(0, i + 1);
    const curPrice = prices[i];
    const curDigit = digits[i];

    // Determine target digit & contract type based on strategy
    let targetDigit: number = 0;
    let contractType: 'DIFFERS' | 'MATCHES' | 'UNDER' | 'OVER' = config.contractMode;
    let payoutRate = 1.09;
    let isSignalConfirmed = true;

    if (config.strategy === 'DIFFERS_ACCOUNT_GROWER' || config.contractMode === 'DIFFERS') {
      contractType = 'DIFFERS';
      payoutRate = 1.095; // 9.5% net return on Differs
      const differsResult = findBestDiffersTarget(pastDigits, curDigit);
      targetDigit = differsResult.targetDigit;
      if (differsResult.winProbability < config.minConfidenceThreshold) {
        isSignalConfirmed = false;
      }
    } else if (config.strategy === 'CONFIRMED_MATCHES_SNIPER' || config.contractMode === 'MATCHES') {
      contractType = 'MATCHES';
      payoutRate = 8.35; // Deriv DIGITMATCH payout
      // Markov / micro-cluster analysis
      const matrix = calculateMarkovTransitionMatrix(pastDigits);
      const nextProbs = matrix[curDigit] || Array(10).fill(0.1);
      let bestD = curDigit;
      let highestP = 0;
      for (let d = 0; d < 10; d++) {
        if (nextProbs[d] > highestP) {
          highestP = nextProbs[d];
          bestD = d;
        }
      }
      targetDigit = bestD;

      // Filter: only trade when Markov transition probability shows strong statistical cluster
      const probPct = highestP * 100;
      if (probPct < (config.minConfidenceThreshold > 50 ? config.minConfidenceThreshold * 0.25 : 20)) {
        isSignalConfirmed = false;
      }
    } else if (config.strategy === 'OVER_UNDER_PROBABILITY') {
      contractType = 'UNDER';
      targetDigit = 7;
      payoutRate = 1.40; // Under 7 (~70% win rate)
    } else {
      // REPEAT_DIGIT_MOMENTUM
      contractType = 'MATCHES';
      targetDigit = curDigit;
      payoutRate = 8.35;
      // Only trade if the last 2 digits were identical (streak momentum)
      const prevDigit = digits[i - 1];
      if (prevDigit !== curDigit) {
        isSignalConfirmed = false;
      }
    }

    if (!isSignalConfirmed) {
      continue; // Skip tick without valid confirmation
    }

    // Calculate trade stake
    let currentStake = config.stake;
    if (config.stakeMode === 'FIXED_STAKE') {
      currentStake = config.stake; // NEVER ESCALATE: 100% strict user price
    } else if (consecutiveLosses > 0) {
      if (config.stakeMode === 'SMART_RECOVERY') {
        const netPayout = payoutRate > 1.5 ? payoutRate - 1 : payoutRate - 1;
        const targetProfit = config.stake;
        const safeNetRate = Math.max(0.08, netPayout);
        currentStake = Number(((cumulativeLoss + targetProfit) / safeNetRate).toFixed(2));
      } else if (config.stakeMode === 'MARTINGALE') {
        const factor = config.martingaleMultiplier || 1.15;
        currentStake = Number((config.stake * Math.pow(factor, consecutiveLosses)).toFixed(2));
      }
    }

    // Apply strict Max Stake Cap so user never loses more than allowed
    const maxCap = config.maxStakeCap > 0 ? config.maxStakeCap : config.stake * 3;
    currentStake = Math.min(maxCap, Math.max(0.35, currentStake));

    // Next tick is the settlement tick
    const exitPrice = prices[i + 1];
    const exitDigit = digits[i + 1];

    let won = false;
    if (contractType === 'DIFFERS') {
      won = exitDigit !== targetDigit;
    } else if (contractType === 'MATCHES') {
      won = exitDigit === targetDigit;
    } else if (contractType === 'UNDER') {
      won = exitDigit < targetDigit;
    } else if (contractType === 'OVER') {
      won = exitDigit > targetDigit;
    }

    let profit = 0;
    if (won) {
      const netMultiplier = payoutRate > 1.5 ? payoutRate - 1 : payoutRate - 1;
      profit = Number((currentStake * Math.max(0.09, netMultiplier)).toFixed(2));
      currentBalance = Number((currentBalance + profit).toFixed(2));
      grossProfit += profit;
      consecutiveWins++;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      consecutiveLosses = 0;
      cumulativeLoss = 0;
    } else {
      profit = -currentStake;
      currentBalance = Number((currentBalance - currentStake).toFixed(2));
      grossLoss += currentStake;
      consecutiveLosses++;
      cumulativeLoss += currentStake;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      consecutiveWins = 0;
    }

    peakBalance = Math.max(peakBalance, currentBalance);
    const currentDd = peakBalance - currentBalance;
    if (currentDd > maxDrawdown) {
      maxDrawdown = currentDd;
    }

    const tradeRecord: BacktestTrade = {
      tradeIndex: trades.length + 1,
      tickIndex: i,
      quote: curPrice,
      entryDigit: curDigit,
      targetDigit,
      contractType,
      exitPrice,
      exitDigit,
      won,
      stake: currentStake,
      profit,
      balanceAfter: currentBalance,
      cumulativeProfit: Number((currentBalance - initialBalance).toFixed(2)),
      consecutiveLosses,
    };

    trades.push(tradeRecord);
    equityCurve.push({
      trade: trades.length,
      balance: currentBalance,
      profit: Number((currentBalance - initialBalance).toFixed(2)),
    });
  }

  const winsCount = trades.filter((t) => t.won).length;
  const lossesCount = trades.length - winsCount;
  const winRate = trades.length > 0 ? Number(((winsCount / trades.length) * 100).toFixed(1)) : 0;
  const netProfit = Number((currentBalance - initialBalance).toFixed(2));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;
  const maxDrawdownPct = peakBalance > 0 ? Number(((maxDrawdown / peakBalance) * 100).toFixed(1)) : 0;

  return {
    config,
    symbol: config.symbol,
    totalTicksTested: digits.length,
    totalTrades: trades.length,
    wins: winsCount,
    losses: lossesCount,
    winRate,
    initialBalance,
    finalBalance: currentBalance,
    netProfit,
    profitFactor,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPct,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    trades,
    equityCurve,
  };
}
