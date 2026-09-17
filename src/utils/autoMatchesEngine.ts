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
  if (digits.length < 30) {
    return {
      symbol,
      displayName,
      targetDigit: currentDigit >= 0 && currentDigit <= 9 ? currentDigit : 0,
      probabilityScore: 0,
      historicalFrequency: 0,
      recentClusterCount: 0,
      delayTicks: 0,
      markovProbability: 0,
      isTriggerReady: false,
      rationale: `Waiting for real Deriv sample (${digits.length}/30 ticks).`,
    };
  }

  const markov = calculateMarkovTransitionMatrix(digits);
  const nextProbabilities = markov[currentDigit] || Array(10).fill(0.1);
  const recentSlice = digits.slice(-30);
  const microCounts = Array(10).fill(0);
  recentSlice.forEach((digit) => {
    if (digit >= 0 && digit <= 9) microCounts[digit] += 1;
  });

  let bestDigit = 0;
  let bestScore = -Infinity;
  let bestMarkov = 0;
  let bestMicroCount = 0;

  for (let digit = 0; digit <= 9; digit += 1) {
    const stat = digitStats.find((item) => item.digit === digit);
    const overallFrequency = stat?.percentage ?? 10;
    const markovPct = (nextProbabilities[digit] ?? 0.1) * 100;
    const microPct = (microCounts[digit] / recentSlice.length) * 100;
    const sampleWeight = Math.min(1, digits.length / 500);

    // Weighted observed percentage. It remains close to the natural ~10%
    // baseline unless the real sample shows a measurable deviation.
    const weightedObservedPct =
      markovPct * (0.45 + 0.1 * sampleWeight) +
      microPct * 0.3 +
      overallFrequency * (0.25 - 0.1 * sampleWeight);

    if (weightedObservedPct > bestScore) {
      bestScore = weightedObservedPct;
      bestDigit = digit;
      bestMarkov = markovPct;
      bestMicroCount = microCounts[digit];
    }
  }

  const stat = digitStats.find((item) => item.digit === bestDigit);
  const historicalFrequency = stat?.percentage ?? 0;
  const delayTicks = stat?.delay ?? 0;
  const probabilityScore = Number(Math.max(0, Math.min(100, bestScore)).toFixed(1));

  // This is only an evidence gate. A true DIGITMATCH contract still has high
  // outcome uncertainty; a trigger does not imply a guaranteed result.
  const isTriggerReady =
    digits.length >= 100 &&
    probabilityScore >= 12.5 &&
    bestMicroCount >= 3 &&
    delayTicks <= 20;

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
    rationale: `Observed next-digit score ${probabilityScore.toFixed(1)}% for digit ${bestDigit}; Markov transition ${bestMarkov.toFixed(1)}%, ${bestMicroCount}/30 recent hits, ${historicalFrequency.toFixed(1)}% historical frequency, delay ${delayTicks} ticks. This is statistical evidence, not a win guarantee.`,
  };
}

/**
 * Evaluates the coldest / least likely digit for high-win DIFFERS trades (90%+ theoretical win rate)
 */
export function findBestDiffersTarget(
  digits: number[],
  currentDigit: number
): { targetDigit: number; winProbability: number; rationale: string } {
  if (digits.length < 20) {
    const fallback = (currentDigit + 5) % 10;
    return {
      targetDigit: fallback,
      winProbability: 90.0,
      rationale: `Targeting opposite digit ${fallback} for 90% theoretical DIFFERS win rate.`,
    };
  }

  const markovMatrix = calculateMarkovTransitionMatrix(digits);
  const nextProbabilities = markovMatrix[currentDigit] || Array(10).fill(0.1);
  const recentSlice = digits.slice(-30);
  const microCounts: number[] = Array(10).fill(0);
  recentSlice.forEach((d) => {
    if (d >= 0 && d <= 9) microCounts[d]++;
  });

  let lowestScore = 9999;
  let coldestDigit = (currentDigit + 5) % 10;
  for (let d = 0; d < 10; d++) {
    const markovProbPct = (nextProbabilities[d] ?? 0.1) * 100;
    const microFreqPct = (microCounts[d] / recentSlice.length) * 100;
    const score = markovProbPct * 0.6 + microFreqPct * 0.4;
    if (score < lowestScore) {
      lowestScore = score;
      coldestDigit = d;
    }
  }

  const estimatedWinRate = Number((100 - Math.min(15, lowestScore)).toFixed(1));
  return {
    targetDigit: coldestDigit,
    winProbability: Math.max(88, Math.min(96, estimatedWinRate)),
    rationale: `Digit ${coldestDigit} has the lowest transition probability (${lowestScore.toFixed(1)}%). DIFFERS contract has ~${estimatedWinRate}% empirical win expectation.`,
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
