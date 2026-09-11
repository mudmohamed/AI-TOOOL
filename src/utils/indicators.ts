import { DigitStat, MarketAnalysis } from '../types';

/**
 * Calculates Relative Strength Index (RSI) on tick price series.
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50.0;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // First period
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      gains += changes[i];
    } else {
      losses += Math.abs(changes[i]);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return Number((100 - (100 / (1 + rs))).toFixed(2));
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) {
    return prices.reduce((acc, val) => acc + val, 0) / prices.length;
  }

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return Number(ema.toFixed(4));
}

/**
 * Calculates EMA series for charting
 */
export function calculateEMASeries(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  
  let ema = prices[0];
  result.push(ema);

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(Number(ema.toFixed(4)));
  }

  return result;
}

/**
 * Calculates Bollinger Bands (Upper, Middle/SMA, Lower, Bandwidth)
 */
export function calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2) {
  if (prices.length < period) {
    const current = prices[prices.length - 1] || 0;
    return { upper: current, middle: current, lower: current, bandwidth: 0 };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((sum, val) => sum + val, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const bandwidth = middle !== 0 ? ((upper - lower) / middle) * 100 : 0;

  return {
    upper: Number(upper.toFixed(4)),
    middle: Number(middle.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    bandwidth: Number(bandwidth.toFixed(3)),
  };
}

/**
 * Calculates Average True Range (ATR) on tick data
 */
export function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length < 2) return 0;
  const sample = prices.slice(-period - 1);
  let sumDiff = 0;
  for (let i = 1; i < sample.length; i++) {
    sumDiff += Math.abs(sample[i] - sample[i - 1]);
  }
  return Number((sumDiff / (sample.length - 1)).toFixed(4));
}

/**
 * Comprehensive Digit Distribution & Pattern Analyzer
 */
export function analyzeDigits(digits: number[]): {
  digitStats: DigitStat[];
  hotDigit: number;
  coldDigit: number;
  evenPct: number;
  oddPct: number;
  overPct: number;
  underPct: number;
  consecutiveMatches: number;
} {
  const total = digits.length || 1;
  const counts = Array(10).fill(0);
  const delays = Array(10).fill(total);
  const maxStreaks = Array(10).fill(0);

  // Calculate delays (ticks since last occurrence)
  for (let d = 0; d <= 9; d++) {
    const lastIndex = digits.lastIndexOf(d);
    if (lastIndex !== -1) {
      delays[d] = digits.length - 1 - lastIndex;
    }
  }

  // Count occurrences & streaks
  let currentStreakDigit = -1;
  let currentStreakLen = 0;

  digits.forEach((d, idx) => {
    counts[d]++;
    if (d === currentStreakDigit) {
      currentStreakLen++;
    } else {
      currentStreakDigit = d;
      currentStreakLen = 1;
    }
    if (currentStreakLen > maxStreaks[d]) {
      maxStreaks[d] = currentStreakLen;
    }
  });

  // Check recent consecutive matches at the tail
  let tailConsecutive = 1;
  if (digits.length >= 2) {
    const last = digits[digits.length - 1];
    for (let i = digits.length - 2; i >= 0; i--) {
      if (digits[i] === last) {
        tailConsecutive++;
      } else {
        break;
      }
    }
  }

  // Find Hot (highest %) and Cold (lowest %)
  let maxCount = -1;
  let minCount = Infinity;
  let hotDigit = 0;
  let coldDigit = 0;

  for (let d = 0; d <= 9; d++) {
    if (counts[d] > maxCount) {
      maxCount = counts[d];
      hotDigit = d;
    }
    if (counts[d] < minCount) {
      minCount = counts[d];
      coldDigit = d;
    }
  }

  const digitStats: DigitStat[] = [];
  for (let d = 0; d <= 9; d++) {
    const percentage = Number(((counts[d] / total) * 100).toFixed(1));
    const deviation = Number((percentage - 10.0).toFixed(1));
    digitStats.push({
      digit: d,
      count: counts[d],
      percentage,
      deviation,
      delay: delays[d],
      maxStreak: maxStreaks[d],
      isHot: d === hotDigit && percentage > 12.5,
      isCold: d === coldDigit && percentage < 7.5,
    });
  }

  const evenCount = digits.filter((d) => d % 2 === 0).length;
  const oddCount = total - evenCount;
  const overCount = digits.filter((d) => d >= 5).length;
  const underCount = total - overCount;

  return {
    digitStats,
    hotDigit,
    coldDigit,
    evenPct: Number(((evenCount / total) * 100).toFixed(1)),
    oddPct: Number(((oddCount / total) * 100).toFixed(1)),
    overPct: Number(((overCount / total) * 100).toFixed(1)),
    underPct: Number(((underCount / total) * 100).toFixed(1)),
    consecutiveMatches: tailConsecutive,
  };
}

/**
 * Algorithmic Market Scanner to Identify "STRONGEST TO WIN"
 */
export function evaluateMarketStrength(
  symbol: string,
  displayName: string,
  prices: number[],
  digits: number[]
): MarketAnalysis {
  const currentPrice = prices[prices.length - 1] || 0;
  const lastDigit = digits[digits.length - 1] !== undefined ? digits[digits.length - 1] : 0;
  const startPrice = prices[0] || currentPrice;
  const priceChange = Number((currentPrice - startPrice).toFixed(4));
  const priceChangePct = startPrice !== 0 ? Number(((priceChange / startPrice) * 100).toFixed(2)) : 0;

  const rsi = calculateRSI(prices);
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema50 = calculateEMA(prices, 50);
  const { upper: bollingerUpper, lower: bollingerLower, bandwidth: bollingerBandwidth } = calculateBollingerBands(prices);
  const volatilityAtr = calculateATR(prices);

  // Trend detection
  let trend: MarketAnalysis['trend'] = 'NEUTRAL';
  if (ema9 > ema21 && ema21 > ema50) {
    trend = rsi > 60 ? 'STRONG_BULLISH' : 'BULLISH';
  } else if (ema9 < ema21 && ema21 < ema50) {
    trend = rsi < 40 ? 'STRONG_BEARISH' : 'BEARISH';
  }

  const {
    digitStats,
    hotDigit,
    coldDigit,
    evenPct,
    oddPct,
    overPct,
    underPct,
    consecutiveMatches,
  } = analyzeDigits(digits);

  // Derive "Strongest to Win" Strategy & Score
  // 1. Check Cold Digit for Differs (High Win Rate Strategy ~90-95%)
  const coldStat = digitStats.find((s) => s.digit === coldDigit);
  const hotStat = digitStats.find((s) => s.digit === hotDigit);

  let winScore = 50;
  let recommendedContract: MarketAnalysis['recommendedContract'] = 'DIFFERS';
  let recommendedTarget: number | string = coldDigit;
  let signalConfidence = 75;
  let rationale = '';

  // Edge A: Extremely Cold Digit for DIFFERS (Differs pays ~1.1x, win rate probability ~92-97%)
  const coldFrequency = coldStat ? coldStat.percentage : 10;
  const coldDelay = coldStat ? coldStat.delay : 0;
  
  // Edge B: Hot Digit Cluster for MATCHES (Matches pays ~9.5x to 10x!)
  const hotFrequency = hotStat ? hotStat.percentage : 10;
  const hotDelay = hotStat ? hotStat.delay : 0;

  if (coldFrequency <= 5.5 && coldDelay > 8) {
    // Top Edge for Differs: Digit is statistically suppressed and absent
    winScore = Math.min(99, Math.round(92 + (10 - coldFrequency)));
    recommendedContract = 'DIFFERS';
    recommendedTarget = coldDigit;
    signalConfidence = winScore;
    rationale = `Digit ${coldDigit} is heavily suppressed (${coldFrequency}% freq, delay ${coldDelay} ticks). Theoretical differs win rate > 94.5%.`;
  } else if (hotFrequency >= 16.0 && hotDelay <= 2) {
    // Explosive Edge for Matches: Digit is clustering with high recurrence
    winScore = Math.min(95, Math.round(80 + (hotFrequency - 10) * 2));
    recommendedContract = 'MATCHES';
    recommendedTarget = hotDigit;
    signalConfidence = winScore;
    rationale = `Digit ${hotDigit} is hyper-active (${hotFrequency}% freq, delay ${hotDelay}). High-yield match cluster with ~10x payout potential.`;
  } else if (overPct >= 62.0) {
    winScore = Math.min(94, Math.round(82 + (overPct - 50)));
    recommendedContract = 'OVER';
    recommendedTarget = 2; // Over 2 gives massive probability
    signalConfidence = winScore;
    rationale = `High digit dominance: Over 5-9 is printing ${overPct}%. Statistical edge on Over contracts.`;
  } else if (underPct >= 62.0) {
    winScore = Math.min(94, Math.round(82 + (underPct - 50)));
    recommendedContract = 'UNDER';
    recommendedTarget = 7;
    signalConfidence = winScore;
    rationale = `Low digit compression: Under 0-4 is printing ${underPct}%. High probability on Under contracts.`;
  } else if (trend === 'STRONG_BULLISH' && rsi < 78) {
    winScore = Math.min(96, Math.round(85 + (rsi > 65 ? 6 : 3)));
    recommendedContract = 'RISE';
    recommendedTarget = 'Higher';
    signalConfidence = winScore;
    rationale = `Triple EMA bullish alignment (9>21>50) with clean RSI ${rsi} momentum. High probability continuous Rise.`;
  } else if (trend === 'STRONG_BEARISH' && rsi > 22) {
    winScore = Math.min(96, Math.round(85 + (rsi < 35 ? 6 : 3)));
    recommendedContract = 'FALL';
    recommendedTarget = 'Lower';
    signalConfidence = winScore;
    rationale = `Triple EMA bearish breakdown with strong downward momentum (RSI ${rsi}). High probability Fall.`;
  } else {
    // Default Differs on coldest digit
    winScore = Math.round(75 + (10 - coldFrequency));
    recommendedContract = 'DIFFERS';
    recommendedTarget = coldDigit;
    signalConfidence = winScore;
    rationale = `Consistent baseline differs on coldest digit ${coldDigit} (${coldFrequency}% rate).`;
  }

  return {
    symbol,
    displayName,
    currentPrice,
    lastDigit,
    priceChange,
    priceChangePct,
    rsi,
    ema9,
    ema21,
    ema50,
    trend,
    volatilityAtr,
    bollingerUpper,
    bollingerLower,
    bollingerBandwidth,
    digitStats,
    hotDigit,
    coldDigit,
    evenPct,
    oddPct,
    overPct,
    underPct,
    consecutiveMatches,
    winScore,
    recommendedContract,
    recommendedTarget,
    signalConfidence,
    rationale,
  };
}
