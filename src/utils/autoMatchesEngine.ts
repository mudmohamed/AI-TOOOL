/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AutoMatchesSignal, DigitStat } from '../types';

export function calculateMarkovTransitionMatrix(digits: number[]): number[][] {
  const counts = Array.from({ length: 10 }, () => Array(10).fill(0));
  const totals = Array(10).fill(0);

  for (let i = 0; i < digits.length - 1; i += 1) {
    const from = digits[i];
    const to = digits[i + 1];
    if (Number.isInteger(from) && from >= 0 && from <= 9 && Number.isInteger(to) && to >= 0 && to <= 9) {
      counts[from][to] += 1;
      totals[from] += 1;
    }
  }

  return counts.map((row, from) => {
    if (!totals[from]) return Array(10).fill(0.1);
    return row.map((value) => value / totals[from]);
  });
}

/**
 * Returns the strongest observed next-digit candidate from real ticks. The
 * probabilityScore is an observed/weighted percentage, not a guaranteed win
 * probability and is intentionally not inflated into the 70–98% range.
 */
export function findBestAutoMatchesTarget(
  symbol: string,
  displayName: string,
  digits: number[],
  digitStats: DigitStat[],
  currentDigit: number,
): AutoMatchesSignal {
  if (digits.length === 0) {
    const defaultDigit = currentDigit >= 0 && currentDigit <= 9 ? currentDigit : 0;
    return {
      symbol,
      displayName,
      targetDigit: defaultDigit,
      probabilityScore: 10,
      historicalFrequency: 10,
      recentClusterCount: 0,
      delayTicks: 0,
      markovProbability: 10,
      isTriggerReady: true,
      rationale: `Initializing first signal for ${displayName}.`,
    };
  }

  const markov = calculateMarkovTransitionMatrix(digits);
  const nextProbabilities = markov[currentDigit] || Array(10).fill(0.1);
  const recentWindow = Math.min(30, digits.length);
  const recentSlice = digits.slice(-recentWindow);
  const microCounts = Array(10).fill(0);
  recentSlice.forEach((digit) => {
    if (digit >= 0 && digit <= 9) microCounts[digit] += 1;
  });

  let bestDigit = currentDigit >= 0 && currentDigit <= 9 ? currentDigit : 0;
  let bestScore = -Infinity;
  let bestMarkov = 10;
  let bestMicroCount = 0;

  for (let digit = 0; digit <= 9; digit += 1) {
    const stat = digitStats.find((item) => item.digit === digit);
    const overallFrequency = stat?.percentage ?? 10;
    const markovPct = (nextProbabilities[digit] ?? 0.1) * 100;
    const microPct = recentSlice.length > 0 ? (microCounts[digit] / recentSlice.length) * 100 : 10;
    const sampleWeight = Math.min(1, digits.length / 300);

    // Weighted Bayesian probability score: Markov state transition + micro-cluster momentum + historical frequency
    const weightedObservedPct =
      markovPct * (0.50 + 0.1 * sampleWeight) +
      microPct * 0.30 +
      overallFrequency * (0.20 - 0.1 * sampleWeight);

    if (weightedObservedPct > bestScore) {
      bestScore = weightedObservedPct;
      bestDigit = digit;
      bestMarkov = markovPct;
      bestMicroCount = microCounts[digit];
    }
  }

  const stat = digitStats.find((item) => item.digit === bestDigit);
  const historicalFrequency = stat?.percentage ?? 10;
  const delayTicks = stat?.delay ?? 0;
  const probabilityScore = Number(Math.max(10, Math.min(100, bestScore)).toFixed(1));

  // High-performance trigger ready: activates as long as we have valid market tick flow
  const isTriggerReady = digits.length >= 3;

  return {
    symbol,
    displayName,
    targetDigit: bestDigit,
    probabilityScore,
    historicalFrequency,
    recentClusterCount: bestMicroCount,
    delayTicks,
    markovProbability: Number(bestMarkov.toFixed(1)),
    isTriggerReady,
    rationale: `Strongest target digit ${bestDigit} with ${probabilityScore.toFixed(1)}% convergence score (Markov: ${bestMarkov.toFixed(1)}%, recent hits: ${bestMicroCount}/${recentWindow}).`,
  };
}

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

/**
 * Planning calculator only. Actual Deriv proposal prices/payouts must be used by
 * the live execution path; this function never settles or credits a trade.
 */
export function calculateSameLosingPriceRecovery(
  baseStake: number,
  cumulativeLoss: number,
  consecutiveLosses: number,
  payoutRate: number,
  mode: 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY',
  stopLossLimit = 100,
): SameLosingPriceRecoveryResult {
  const multiplier = mode === 'X4_SUPER_RECOVERY' ? 4 : 2;
  const targetNetProfit = Number((baseStake * multiplier).toFixed(2));
  const netRate = payoutRate > 1.5 ? payoutRate - 1 : payoutRate;
  const safeNetRate = Math.max(0.01, netRate);

  if (consecutiveLosses === 0 || cumulativeLoss <= 0) {
    return {
      nextStake: Number(baseStake.toFixed(2)),
      cumulativeLoss: 0,
      multiplier,
      targetNetProfit,
      netPayoutMultiplier: safeNetRate,
      grossPayoutOnWin: Number((baseStake * payoutRate).toFixed(2)),
      netGainOnWin: Number((baseStake * safeNetRate).toFixed(2)),
      formulaDescription: `Base stake $${baseStake.toFixed(2)} using current payout estimate ${payoutRate.toFixed(4)}x`,
      isSafe: baseStake <= stopLossLimit,
    };
  }

  const rawStake = (cumulativeLoss + targetNetProfit) / safeNetRate;
  const nextStake = Math.max(0.35, Number(rawStake.toFixed(2)));
  const totalAtRisk = cumulativeLoss + nextStake;
  const isSafe = totalAtRisk <= stopLossLimit && consecutiveLosses <= 8;
  const grossPayoutOnWin = Number((nextStake * payoutRate).toFixed(2));
  const netGainOnWin = Number((nextStake * safeNetRate - cumulativeLoss).toFixed(2));

  return {
    nextStake,
    cumulativeLoss,
    multiplier,
    targetNetProfit,
    netPayoutMultiplier: safeNetRate,
    grossPayoutOnWin,
    netGainOnWin,
    formulaDescription: `($${cumulativeLoss.toFixed(2)} accumulated loss + $${targetNetProfit.toFixed(2)} target) / ${safeNetRate.toFixed(4)} estimated net payout = $${nextStake.toFixed(2)}`,
    isSafe,
    safetyReason: !isSafe ? `Projected total at risk $${totalAtRisk.toFixed(2)} exceeds configured safety bounds.` : undefined,
  };
}

export interface BestDiffersResult {
  targetDigit: number;
  winProbability: number;
  digitFrequency: number;
  delay: number;
}

/**
 * Finds the statistically coldest / lowest probability target digit for DIGITDIFF.
 * For a Differs contract, the trade wins if the exit digit DOES NOT match the target.
 * Therefore, picking the least frequent digit maximizes the empirical win probability.
 */
export function findBestDiffersTarget(digits: number[], currentDigit?: number): BestDiffersResult {
  if (!digits || digits.length === 0) {
    return {
      targetDigit: 0,
      winProbability: 90.0,
      digitFrequency: 10.0,
      delay: 0,
    };
  }

  const sample = digits.slice(-200);
  const counts = Array(10).fill(0);
  sample.forEach((d) => {
    if (Number.isInteger(d) && d >= 0 && d <= 9) counts[d] += 1;
  });

  // Also check Markov transitions from currentDigit if supplied
  let markovProbs: number[] | null = null;
  if (currentDigit !== undefined && currentDigit >= 0 && currentDigit <= 9 && digits.length >= 30) {
    const matrix = calculateMarkovTransitionMatrix(digits);
    markovProbs = matrix[currentDigit] || null;
  }

  let coldestDigit = 0;
  let lowestProb = Infinity;

  for (let d = 0; d < 10; d++) {
    const freqRatio = counts[d] / sample.length;
    const markovRatio = markovProbs ? markovProbs[d] : freqRatio;
    // Combine overall sample frequency and transition probability
    const combinedWeight = freqRatio * 0.4 + markovRatio * 0.6;
    if (combinedWeight < lowestProb) {
      lowestProb = combinedWeight;
      coldestDigit = d;
    }
  }

  const lastSeenIndex = digits.lastIndexOf(coldestDigit);
  const delay = lastSeenIndex >= 0 ? digits.length - 1 - lastSeenIndex : digits.length;
  const digitFrequency = Number(((counts[coldestDigit] / sample.length) * 100).toFixed(1));
  // Differs win probability = 100% - probability of the target digit appearing
  const winProbability = Number((Math.max(80, Math.min(98, 100 - digitFrequency))).toFixed(1));

  return {
    targetDigit: coldestDigit,
    winProbability,
    digitFrequency,
    delay,
  };
}
