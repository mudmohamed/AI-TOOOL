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
  deviation: number; // percentage difference from theoretical 10.0%
  delay: number; // ticks elapsed since this digit last appeared
  maxStreak: number;
  isHot: boolean;
  isCold: boolean;
}

export interface MarketAnalysis {
  symbol: string;
  displayName: string;
  currentPrice: number;
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
  
  // Digit analysis
  digitStats: DigitStat[];
  hotDigit: number;
  coldDigit: number;
  evenPct: number;
  oddPct: number;
  overPct: number; // 5-9
  underPct: number; // 0-4
  consecutiveMatches: number;
  
  // Strongest to win signal
  winScore: number; // 0 - 100
  recommendedContract: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  recommendedTarget: number | string;
  signalConfidence: number; // percentage
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
  payout: number;
  status: 'PENDING' | 'WON' | 'LOST';
  profit: number;
  recoveryStep: number;
}

export interface RiskConfig {
  baseStake: number;
  payoutRate: number; // e.g. 9.5 for matches (950%), 0.95 for rise/fall (95%), 0.10 for differs (10%)
  recoveryStrategy: RecoveryStrategy;
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  contractType: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  autoNextTrade?: boolean;
  profitLockEnabled?: boolean;
  profitLockTarget?: number; // Predefined daily profit target ($) to stop bot and pause recovery
}

export interface DerivAccountInfo {
  isAuthorized: boolean;
  appId: string;
  token?: string;
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
  probabilityScore: number; // 0 - 100
  historicalFrequency: number;
  recentClusterCount: number;
  delayTicks: number;
  markovProbability: number;
  isTriggerReady: boolean;
  rationale: string;
}

export interface DeepScanSettings {
  depth: number; // 500, 1000, 1500, 2000 ticks
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

export interface AutoMatchesConfig {
  market?: string; // Default '1HZ10V' (Volatility 10 (1s) Index)
  stake: number; // Initial Amount (e.g. 0.35 USD)
  winAmount?: number; // Win Amount (resets to initial amount, e.g. 0.35 USD)
  expectedProfit?: number; // Expected Profit target ($20.00)
  maxAcceptableLoss?: number; // Max Acceptable Loss ($50.00)
  nextTradeCondition?: 'MARTINGALE' | 'SAME_LOSS_RECOVERY' | 'RESET_ON_WIN';
  martingaleFactor?: number; // e.g. 1.15
  restartOnError?: boolean; // RESTARTONERROR: TRUE
  executionSpeed: 'FAST' | 'NORMAL';
  targetStrategy: 'REPEAT_ENTRY' | 'MARKOV_TRANSITION' | 'HOTTEST_CLUSTER' | 'CUSTOM';
  customTargetDigit?: number;
}

export interface DBotXmlDefinition {
  symbol: string; // '1HZ10V'
  market: string; // 'synthetic_index'
  submarket: string; // 'random_index'
  tradeType: string; // 'matchesdiffers'
  contractType: string; // 'DIGITMATCH'
  candleInterval: number; // 60
  timeMachineEnabled: boolean; // false
  restartOnError: boolean; // true
  initialAmount: number;
  winAmount: number;
  expectedProfit: number;
  maxAcceptableLoss: number;
  nextTradeCondition: string;
}

export interface BulkTradeConfig {
  simultaneousTrades: number; // 2, 3, 5, 8
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
