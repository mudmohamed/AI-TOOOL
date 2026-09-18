export interface ActiveSymbol {
  symbol: string;
  display_name: string;
  market: string;
  submarket: string;
  pip: number;
}

export interface TickData {
  epoch: number;
  quote: number;
  symbol: string;
  pip: number;
  lastDigit: number;
}

export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
  deviation: number; // percentage-point difference from the 10% uniform baseline
  delay: number;
  maxStreak: number;
  isHot: boolean;
  isCold: boolean;
}

export interface MarketAnalysis {
  symbol: string;
  displayName: string;
  currentPrice: number;
  pip: number;
  lastDigit: number;
  priceChange: number;
  priceChangePct: number;
  rsi: number;
  ema9: number;
  ema21: number;
  ema50: number;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  volatilityAtr: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerBandwidth: number;
  digitStats: DigitStat[];
  hotDigit: number;
  coldDigit: number;
  evenPct: number;
  oddPct: number;
  overPct: number;
  underPct: number;
  consecutiveMatches: number;
  // 10-period Simple Moving Average
  sma10?: number;
  // Compatibility field: a 0-100 evidence/ranking score, not a predicted win rate.
  winScore: number;
  recommendedContract: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  recommendedTarget: number | string;
  // Same evidence score kept for components that use the older field name.
  signalConfidence: number;
  rationale: string;
}

export type RecoveryStrategy = 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY' | 'MARTINGALE' | 'DALEMBERT';

export interface RecoveryStep {
  step: number;
  stake: number;
  cumulativeLoss: number;
  totalAtRisk: number;
  payoutOnWin: number;
  netProfitOnWin: number;
  recoveryRatio: number;
  riskGrade: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  contractType: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  targetValue: number | string;
  entryPrice: number;
  entryDigit: number;
  exitPrice?: number;
  exitDigit?: number;
  stake: number;
  // Gross payout multiplier when Deriv supplies one; 0 while awaiting a proposal.
  payout: number;
  status: 'PENDING' | 'WON' | 'LOST';
  // Actual settled profit from Deriv for completed contracts.
  profit: number;
  recoveryStep: number;
}

export interface RiskConfig {
  baseStake: number;
  // Planning estimate only. Live orders use the current Deriv proposal price/payout.
  payoutRate: number;
  recoveryStrategy: RecoveryStrategy;
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  contractType: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  autoNextTrade?: boolean;
  profitLockEnabled?: boolean;
  profitLockTarget?: number;
}

export interface DerivAccountInfo {
  isAuthorized: boolean;
  appId: string;
  loginId?: string;
  email?: string;
  currency?: string;
  balance?: number;
  isVirtual?: boolean;
  accountsList?: Array<{
    loginid: string;
    currency: string;
    is_virtual: boolean;
    token?: string;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  country?: string;
  createdAt: number;
  avatarUrl?: string;
  isLoggedIn: boolean;
  tier: 'STANDARD' | 'PRO' | 'VIP';
}

export interface AutoMatchesSignal {
  symbol: string;
  displayName: string;
  targetDigit: number;
  // Weighted percentage measured from observed data, not a guaranteed probability.
  probabilityScore: number;
  historicalFrequency: number;
  recentClusterCount: number;
  delayTicks: number;
  markovProbability: number;
  isTriggerReady: boolean;
  rationale: string;
}

export interface DeepScanSettings {
  depth: number;
  autoDeepScan: boolean;
  autoMatchesEngine: boolean;
  recoveryMode: 'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY';
}

export type AccountMode = 'DEMO' | 'REAL';

export type ActiveBotType =
  | 'NONE'
  | 'BULK_AUTO'
  | 'STRONGEST_WIN'
  | 'AUTO_MATCHES'
  | 'SUPER_RECOVERY';

export type BulkStrategyType =
  | 'SMART_AUTO_PICK'
  | 'ULTRA_DIFFERS_WAVE'
  | 'OVER_UNDER_MOMENTUM'
  | 'MATCHES_SNIPER_WAVE';

export interface SessionStats {
  totalTrades: number;
  wins: number;
  losses: number;
  netProfit: number;
  consecutiveLosses: number;
  cumulativeLoss: number;
  peakDrawdown: number;
}

export interface BacktestConfig {
  symbol: string;
  strategy: 'DIFFERS_ACCOUNT_GROWER' | 'CONFIRMED_MATCHES_SNIPER' | 'OVER_UNDER_PROBABILITY' | 'REPEAT_DIGIT_MOMENTUM';
  contractMode: 'DIFFERS' | 'MATCHES' | 'UNDER' | 'OVER';
  sampleTicks: number;
  stake: number;
  stakeMode: 'FIXED_STAKE' | 'SMART_RECOVERY' | 'MARTINGALE';
  martingaleMultiplier: number;
  maxStakeCap: number;
  maxAllowedLosses: number;
  takeProfit: number;
  stopLoss: number;
  minConfidenceThreshold: number;
}

export interface BacktestTrade {
  tradeIndex: number;
  tickIndex: number;
  quote: number;
  entryDigit: number;
  targetDigit: number;
  contractType: 'DIFFERS' | 'MATCHES' | 'UNDER' | 'OVER';
  exitPrice: number;
  exitDigit: number;
  won: boolean;
  stake: number;
  profit: number;
  balanceAfter: number;
  cumulativeProfit: number;
  consecutiveLosses: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  symbol: string;
  totalTicksTested: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  trades: BacktestTrade[];
  equityCurve: Array<{ trade: number; balance: number; profit: number }>;
}

export interface AutoMatchesConfig {
  market?: string;
  stake: number;
  winAmount?: number;
  expectedProfit?: number;
  maxAcceptableLoss?: number;
  nextTradeCondition?: 'MARTINGALE' | 'SAME_LOSS_RECOVERY' | 'RESET_ON_WIN' | 'FIXED_STAKE';
  martingaleFactor?: number;
  restartOnError?: boolean;
  executionSpeed: 'FAST' | 'NORMAL';
  targetStrategy: 'REPEAT_ENTRY' | 'MARKOV_TRANSITION' | 'HOTTEST_CLUSTER' | 'CUSTOM' | 'COLD_DIFFERS';
  customTargetDigit?: number;
  // Safety & 24/7 Controls
  stopConditionMode?: 'ONLY_MANUAL_OR_TARGET' | 'STOP_ON_MAX_LOSS';
  profitShieldActive?: boolean;
  profitLockEnabled?: boolean;
  profitLockTarget?: number;
  fixedStakeMode?: boolean;
  maxStakeCap?: number;
  maxAllowedLosses?: number;
  contractMode?: 'DIFFERS' | 'OVER_UNDER' | 'MATCHES';
  onlyWhenSignalConfirmed?: boolean;
}

export interface DBotXmlDefinition {
  symbol: string;
  market: string;
  submarket: string;
  tradeType: string;
  contractType: string;
  candleInterval: number;
  timeMachineEnabled: boolean;
  restartOnError: boolean;
  initialAmount: number;
  winAmount: number;
  expectedProfit: number;
  maxAcceptableLoss: number;
  nextTradeCondition: string;
}

export interface BulkTradeConfig {
  simultaneousTrades: number;
  stakePerTrade: number;
  strategy: BulkStrategyType;
  autoRepeatCycle: boolean;
  takeProfit: number;
  stopLoss: number;
  cooldownSeconds: number;
}

export interface BulkTradeBatch {
  id: string;
  timestamp: number;
  strategy: BulkStrategyType;
  tradeIds: string[];
  totalStake: number;
  status: 'ACTIVE' | 'COMPLETED';
  wins: number;
  losses: number;
  netProfit: number;
}
