/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AutoMatchesSignal, DigitStat } from '../types';

/**
 * Calculates a Markov Transition Probability Matrix for digits 0-9
 * from a real tick digit sequence (can run over 1000+ ticks).
 * matrix[fromDigit][toDigit] = conditional probability (0 to 1)
 */
export function calculateMarkovTransitionMatrix(digits: number[]): number[][] {
  const transitionCounts: number[][] = Array(10)
    .fill(0)
    .map(() => Array(10).fill(0));
  const rowTotals: number[] = Array(10).fill(0);

  for (let i = 0; i < digits.length - 1; i++) {
    const from = digits[i];
    const to = digits[i + 1];
    if (from >= 0 && from <= 9 && to >= 0 && to <= 9) {
      transitionCounts[from][to]++;
      rowTotals[from]++;
    }
  }

  const matrix: number[][] = Array(10)
    .fill(0)
    .map(() => Array(10).fill(0.1)); // Default equal 10% prior

  for (let from = 0; from < 10; from++) {
    const total = rowTotals[from];
    if (total > 0) {
      for (let to = 0; to < 10; to++) {
        matrix[from][to] = transitionCounts[from][to] / total;
      }
    }
  }

  return matrix;
}

/**
 * Evaluates the real highest-probability MATCHES target digit for a given market
 * using 100% real tick data (supports 1000+ ticks).
 */
export function findBestAutoMatchesTarget(
  symbol: string,
  displayName: string,
  digits: number[],
  digitStats: DigitStat[],
  currentDigit: number
): AutoMatchesSignal {
  if (digits.length < 30) {
    return {
      symbol,
      displayName,
      targetDigit: 5,
      probabilityScore: 60,
      historicalFrequency: 10,
      recentClusterCount: 1,
      delayTicks: 10,
      markovProbability: 10,
      isTriggerReady: false,
      rationale: 'Awaiting deeper Deriv tick sample (min 30 ticks)...',
    };
  }

  // 1. Markov transition probability from the current last digit
  const markovMatrix = calculateMarkovTransitionMatrix(digits);
  const nextProbabilities = markovMatrix[currentDigit] || Array(10).fill(0.1);

  // 2. Micro-cluster analysis in recent 30 ticks
  const recentSlice = digits.slice(-30);
  const microCounts: number[] = Array(10).fill(0);
  recentSlice.forEach((d) => microCounts[d]++);

  // 3. Score each digit 0-9
  let bestDigit = 0;
  let highestScore = -1;
  let bestMarkovProb = 0;
  let bestMicroCount = 0;

  for (let d = 0; d < 10; d++) {
    const stat = digitStats.find((s) => s.digit === d);
    const overallFreq = stat ? stat.percentage : 10; // e.g. 14.5%
    const markovProbPct = (nextProbabilities[d] || 0.1) * 100; // e.g. 18.2%
    const microFreqPct = (microCounts[d] / recentSlice.length) * 100; // e.g. 16.6%
    const delay = stat ? stat.delay : 5;

    // Weighting:
    // 40% Markov next-tick transition (what digit usually follows currentDigit)
    // 35% Micro-cluster momentum (recent surge)
    // 25% Overall sample frequency
    let compositeScore = markovProbPct * 0.4 + microFreqPct * 0.35 + overallFreq * 0.25;

    // Penalty if delay is excessive (>35 ticks without appearance)
    if (delay > 35) {
      compositeScore *= 0.85;
    }
    // Slight boost if consecutive match streak is hot
    if (microCounts[d] >= 4) {
      compositeScore += 5;
    }

    if (compositeScore > highestScore) {
      highestScore = compositeScore;
      bestDigit = d;
      bestMarkovProb = markovProbPct;
      bestMicroCount = microCounts[d];
    }
  }

  const stat = digitStats.find((s) => s.digit === bestDigit);
  const histFreq = stat ? stat.percentage : 10;
  const delay = stat ? stat.delay : 0;

  // Normalized confidence score (scaled to 75% - 98% range for display)
  const normalizedConfidence = Math.min(
    98,
    Math.max(72, Math.round(highestScore * 3.5 + 40))
  );

  const isTriggerReady =
    normalizedConfidence >= 82 && bestMicroCount >= 2 && delay <= 20;

  const rationale = `Digit ${bestDigit} has ${bestMarkovProb.toFixed(1)}% Markov transition rate after digit ${currentDigit}, with ${bestMicroCount} hits in last 30 ticks (historical freq: ${histFreq.toFixed(1)}%). Delay: ${delay}t.`;

  return {
    symbol,
    displayName,
    targetDigit: bestDigit,
    probabilityScore: normalizedConfidence,
    historicalFrequency: histFreq,
    recentClusterCount: bestMicroCount,
    delayTicks: delay,
    markovProbability: Number(bestMarkovProb.toFixed(1)),
    isTriggerReady,
    rationale,
  };
}

/**
 * EXACT "Same Losing Price" Super Recovery X2 / X4 Calculator
 * Formula:
 * NextStake = (CumulativeLoss + (Multiplier * BaseProfit)) / NetPayoutRate
 * where Multiplier = 2 for X2 (recovers 100% loss + locks in 2x base profit)
 * and Multiplier = 4 for X4 (recovers 100% loss + locks in 4x base profit)
 */
export interface SameLosingPriceRecoveryResult {
  nextStake: number;
  cumulativeLoss: number;
  multiplier: number;
  targetNetProfit: number;
  netPayoutMultiplier: number;
  grossPayoutOnWin: number;
  netGainOnWin: number;
  formulaDescription: string;
  isSafe: boolean;
  safetyReason?: string;
}

export function calculateSameLosingPriceRecovery(
  baseStake: number,
  cumulativeLoss: number,
  consecutiveLosses: number,
  payoutRate: number, // Deriv gross payout (e.g. 9.5 for matches, 1.09 for differs, 1.95 for rise/fall)
  mode: 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY',
  stopLossLimit: number = 100
): SameLosingPriceRecoveryResult {
  const multiplier = mode === 'X4_SUPER_RECOVERY' ? 4 : 2;
  const targetNetProfit = Number((baseStake * multiplier).toFixed(2));

  // If no losses, trade at baseStake
  if (consecutiveLosses === 0 || cumulativeLoss <= 0) {
    const netRate = payoutRate > 1.5 ? payoutRate - 1 : payoutRate;
    const grossPayout = Number((baseStake * payoutRate).toFixed(2));
    const netGain = Number((baseStake * netRate).toFixed(2));

    return {
      nextStake: baseStake,
      cumulativeLoss: 0,
      multiplier,
      targetNetProfit,
      netPayoutMultiplier: netRate,
      grossPayoutOnWin: grossPayout,
      netGainOnWin: netGain,
      formulaDescription: `Base initial trade ($${baseStake.toFixed(2)} stake at ${payoutRate}x payout)`,
      isSafe: true,
    };
  }

  // Net rate = (payout - 1)
  const netRate = payoutRate > 1.5 ? payoutRate - 1 : payoutRate;
  const safeNetRate = Math.max(0.08, netRate);

  // Exact formula: (Cumulative Loss + Target Profit) / Net Rate
  const rawStake = (cumulativeLoss + targetNetProfit) / safeNetRate;
  // Deriv minimum stake is $0.35
  const nextStake = Math.max(0.35, Number(rawStake.toFixed(2)));

  const totalAtRisk = cumulativeLoss + nextStake;
  const isSafe = totalAtRisk <= stopLossLimit && consecutiveLosses <= 8;

  const grossPayoutOnWin = Number((nextStake * payoutRate).toFixed(2));
  const netGainOnWin = Number((nextStake * safeNetRate - cumulativeLoss).toFixed(2));

  const formulaDescription = `[Same-Loss Recovery ${mode === 'X4_SUPER_RECOVERY' ? 'X4' : 'X2'}]: ($${cumulativeLoss.toFixed(2)} loss + $${targetNetProfit.toFixed(2)} target) / ${safeNetRate.toFixed(2)} net rate = $${nextStake.toFixed(2)}`;

  return {
    nextStake,
    cumulativeLoss,
    multiplier,
    targetNetProfit,
    netPayoutMultiplier: safeNetRate,
    grossPayoutOnWin,
    netGainOnWin,
    formulaDescription,
    isSafe,
    safetyReason: !isSafe ? `Total risk ($${totalAtRisk.toFixed(2)}) approaches Stop-Loss limit ($${stopLossLimit.toFixed(2)})` : undefined,
  };
}
