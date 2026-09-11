import { DigitStat, MarketAnalysis } from '../types';

const PIP_BY_SYMBOL: Record<string, number> = {
  R_10: 3,
  R_25: 3,
  R_50: 4,
  R_75: 4,
  R_100: 2,
  '1HZ10V': 2,
  '1HZ25V': 2,
  '1HZ50V': 2,
  '1HZ75V': 2,
  '1HZ100V': 2,
};

export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((price, i) => price - prices[i]);
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i += 1) {
    if (changes[i] >= 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i += 1) {
    const change = changes[i];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) {
    return Number((prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(4));
  }
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < prices.length; i += 1) ema = prices[i] * k + ema * (1 - k);
  return Number(ema.toFixed(4));
}

export function calculateEMASeries(prices: number[], period: number): number[] {
  if (!prices.length) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = prices[0];
  result.push(ema);
  for (let i = 1; i < prices.length; i += 1) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(Number(ema.toFixed(4)));
  }
  return result;
}

export function calculateBollingerBands(prices: number[], period = 20, multiplier = 2) {
  if (prices.length < period) {
    const current = prices[prices.length - 1] || 0;
    return { upper: current, middle: current, lower: current, bandwidth: 0 };
  }
  const slice = prices.slice(-period);
  const middle = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + Math.pow(value - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  return {
    upper: Number(upper.toFixed(4)),
    middle: Number(middle.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    bandwidth: Number((middle ? ((upper - lower) / middle) * 100 : 0).toFixed(3)),
  };
}

export function calculateATR(prices: number[], period = 14): number {
  if (prices.length < 2) return 0;
  const sample = prices.slice(-(period + 1));
  let total = 0;
  for (let i = 1; i < sample.length; i += 1) total += Math.abs(sample[i] - sample[i - 1]);
  return Number((total / Math.max(1, sample.length - 1)).toFixed(4));
}

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
  const validDigits = digits.filter((d) => Number.isInteger(d) && d >= 0 && d <= 9);
  const total = validDigits.length;
  const counts = Array(10).fill(0);
  const delays = Array(10).fill(total);
  const maxStreaks = Array(10).fill(0);

  validDigits.forEach((digit) => { counts[digit] += 1; });
  for (let digit = 0; digit <= 9; digit += 1) {
    const lastIndex = validDigits.lastIndexOf(digit);
    delays[digit] = lastIndex >= 0 ? validDigits.length - 1 - lastIndex : total;
  }

  let activeDigit = -1;
  let streak = 0;
  validDigits.forEach((digit) => {
    if (digit === activeDigit) streak += 1;
    else {
      activeDigit = digit;
      streak = 1;
    }
    maxStreaks[digit] = Math.max(maxStreaks[digit], streak);
  });

  let consecutiveMatches = 0;
  if (validDigits.length) {
    const last = validDigits[validDigits.length - 1];
    consecutiveMatches = 1;
    for (let i = validDigits.length - 2; i >= 0 && validDigits[i] === last; i -= 1) consecutiveMatches += 1;
  }

  let hotDigit = 0;
  let coldDigit = 0;
  for (let digit = 1; digit <= 9; digit += 1) {
    if (counts[digit] > counts[hotDigit]) hotDigit = digit;
    if (counts[digit] < counts[coldDigit]) coldDigit = digit;
  }

  const denominator = Math.max(1, total);
  const digitStats: DigitStat[] = Array.from({ length: 10 }, (_, digit) => {
    const percentage = total ? Number(((counts[digit] / denominator) * 100).toFixed(1)) : 0;
    return {
      digit,
      count: counts[digit],
      percentage,
      deviation: Number((percentage - 10).toFixed(1)),
      delay: delays[digit],
      maxStreak: maxStreaks[digit],
      isHot: total >= 30 && digit === hotDigit && percentage > 12.5,
      isCold: total >= 30 && digit === coldDigit && percentage < 7.5,
    };
  });

  const evenCount = validDigits.filter((digit) => digit % 2 === 0).length;
  const overCount = validDigits.filter((digit) => digit >= 5).length;
  const evenPct = total ? Number(((evenCount / denominator) * 100).toFixed(1)) : 0;
  const overPct = total ? Number(((overCount / denominator) * 100).toFixed(1)) : 0;

  return {
    digitStats,
    hotDigit,
    coldDigit,
    evenPct,
    oddPct: total ? Number((100 - evenPct).toFixed(1)) : 0,
    overPct,
    underPct: total ? Number((100 - overPct).toFixed(1)) : 0,
    consecutiveMatches,
  };
}

/**
 * `winScore` is retained for UI compatibility but is an evidence/ranking score,
 * not a predicted win percentage.
 */
export function evaluateMarketStrength(
  symbol: string,
  displayName: string,
  prices: number[],
  digits: number[],
): MarketAnalysis {
  const currentPrice = prices[prices.length - 1] || 0;
  const pip = PIP_BY_SYMBOL[symbol] ?? 2;
  const lastDigit = digits.length ? digits[digits.length - 1] : 0;
  const startPrice = prices[0] || currentPrice;
  const priceChange = Number((currentPrice - startPrice).toFixed(pip));
  const priceChangePct = startPrice ? Number(((priceChange / startPrice) * 100).toFixed(2)) : 0;
  const rsi = calculateRSI(prices);
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema50 = calculateEMA(prices, 50);
  const bands = calculateBollingerBands(prices);
  const volatilityAtr = calculateATR(prices);
  const stats = analyzeDigits(digits);

  let trend: MarketAnalysis['trend'] = 'NEUTRAL';
  if (ema9 > ema21 && ema21 > ema50) trend = rsi >= 60 ? 'STRONG_BULLISH' : 'BULLISH';
  else if (ema9 < ema21 && ema21 < ema50) trend = rsi <= 40 ? 'STRONG_BEARISH' : 'BEARISH';

  const hotStat = stats.digitStats.find((s) => s.digit === stats.hotDigit);
  const coldStat = stats.digitStats.find((s) => s.digit === stats.coldDigit);
  const hotFrequency = hotStat?.percentage || 0;
  const coldFrequency = coldStat?.percentage || 0;
  const sampleReliability = Math.min(1, digits.length / 500);
  const largestDigitDeviation = stats.digitStats.reduce((max, s) => Math.max(max, Math.abs(s.deviation)), 0);
  const parityDeviation = Math.max(Math.abs(stats.evenPct - 50), Math.abs(stats.overPct - 50));

  let recommendedContract: MarketAnalysis['recommendedContract'] = 'DIFFERS';
  let recommendedTarget: number | string = stats.coldDigit;
  let rationale = `Coldest observed digit is ${stats.coldDigit} at ${coldFrequency.toFixed(1)}% across ${digits.length} real ticks.`;
  let featureStrength = Math.min(25, largestDigitDeviation * 2);

  if (digits.length < 30) {
    rationale = `Waiting for a larger real tick sample (${digits.length}/30 minimum for ranking).`;
  } else if (hotFrequency >= 14 && (hotStat?.delay ?? 99) <= 2) {
    recommendedContract = 'MATCHES';
    recommendedTarget = stats.hotDigit;
    featureStrength = Math.min(25, Math.max(0, hotFrequency - 10) * 3);
    rationale = `Digit ${stats.hotDigit} appeared ${hotFrequency.toFixed(1)}% in the observed sample and was seen ${(hotStat?.delay ?? 0)} ticks ago.`;
  } else if (stats.overPct >= 57) {
    recommendedContract = 'OVER';
    recommendedTarget = 2;
    featureStrength = Math.min(25, (stats.overPct - 50) * 2.5);
    rationale = `Digits 5–9 represent ${stats.overPct.toFixed(1)}% of the observed real sample.`;
  } else if (stats.underPct >= 57) {
    recommendedContract = 'UNDER';
    recommendedTarget = 7;
    featureStrength = Math.min(25, (stats.underPct - 50) * 2.5);
    rationale = `Digits 0–4 represent ${stats.underPct.toFixed(1)}% of the observed real sample.`;
  } else if (trend === 'STRONG_BULLISH') {
    recommendedContract = 'RISE';
    recommendedTarget = 'Higher';
    featureStrength = 18;
    rationale = `EMA 9 > EMA 21 > EMA 50 with RSI ${rsi.toFixed(1)} on the observed real tick series.`;
  } else if (trend === 'STRONG_BEARISH') {
    recommendedContract = 'FALL';
    recommendedTarget = 'Lower';
    featureStrength = 18;
    rationale = `EMA 9 < EMA 21 < EMA 50 with RSI ${rsi.toFixed(1)} on the observed real tick series.`;
  } else {
    featureStrength = Math.min(20, parityDeviation * 1.5 + largestDigitDeviation);
  }

  const samplePoints = Math.round(sampleReliability * 35);
  const basePoints = digits.length >= 30 ? 25 : Math.round((digits.length / 30) * 20);
  const winScore = Math.max(0, Math.min(90, Math.round(basePoints + samplePoints + featureStrength)));

  return {
    symbol,
    displayName,
    currentPrice,
    pip,
    lastDigit,
    priceChange,
    priceChangePct,
    rsi,
    ema9,
    ema21,
    ema50,
    trend,
    volatilityAtr,
    bollingerUpper: bands.upper,
    bollingerLower: bands.lower,
    bollingerBandwidth: bands.bandwidth,
    digitStats: stats.digitStats,
    hotDigit: stats.hotDigit,
    coldDigit: stats.coldDigit,
    evenPct: stats.evenPct,
    oddPct: stats.oddPct,
    overPct: stats.overPct,
    underPct: stats.underPct,
    consecutiveMatches: stats.consecutiveMatches,
    winScore,
    recommendedContract,
    recommendedTarget,
    signalConfidence: winScore,
    rationale: `${rationale} Signal score ${winScore}/100 is a ranking metric, not a win probability.`,
  };
}
