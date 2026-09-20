/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { derivService } from './services/derivWs';
import {
  AccountMode,
  ActiveBotType,
  AutoMatchesConfig,
  DerivAccountInfo,
  MarketAnalysis,
  RiskConfig,
  TradeRecord,
  UserProfile,
} from './types';
import { analyzeDigits, evaluateMarketStrength } from './utils/indicators';
import { findBestAutoMatchesTarget } from './utils/autoMatchesEngine';
import { calculateNextStake } from './utils/recoveryEngine';
import { playLossSound, playOrderDispatchedSound, playWinSound } from './utils/soundEffects';
import { Header } from './components/Header';
import { StrongestMarketScanner } from './components/StrongestMarketScanner';
import { MatchesDigitAnalyzer } from './components/MatchesDigitAnalyzer';
import { LiveChart } from './components/LiveChart';
import { SuperRecoveryManager } from './components/SuperRecoveryManager';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { WatchlistPanel } from './components/WatchlistPanel';
import { DerivAccountModal } from './components/DerivAccountModal';
import { DerivCashierModal } from './components/DerivCashierModal';
import { AuthModal } from './components/AuthModal';
import { DerivActiveTradeRunner } from './components/DerivActiveTradeRunner';
import { DeepScanAutoMatches } from './components/DeepScanAutoMatches';
import { BulkMultiTrader } from './components/BulkMultiTrader';
import { FloatingAutoMatchesBar } from './components/FloatingAutoMatchesBar';
import { AutoMatchesSafetyModal } from './components/AutoMatchesSafetyModal';
import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';
import {
  Activity,
  Bot,
  Layers,
  ShieldCheck,
  Square,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';

const POPULAR_SYMBOLS = [
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  { symbol: 'R_100', name: 'Volatility 100 Index' },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  { symbol: 'R_75', name: 'Volatility 75 Index' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  { symbol: 'R_50', name: 'Volatility 50 Index' },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  { symbol: 'R_25', name: 'Volatility 25 Index' },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  { symbol: 'R_10', name: 'Volatility 10 Index' },
];

const REAL_HISTORY_KEY = 'deriv_real_trade_history_v2';
const REAL_STATS_KEY = 'deriv_real_session_stats_v2';

const EMPTY_STATS = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  netProfit: 0,
  consecutiveLosses: 0,
  cumulativeLoss: 0,
  peakDrawdown: 0,
};

type TradeInput = {
  contractType: 'MATCHES' | 'DIFFERS' | 'OVER' | 'UNDER' | 'RISE' | 'FALL';
  targetValue: number | string;
  stake: number;
  symbol?: string;
  entryPrice?: number;
  entryDigit?: number;
  payout?: number;
};

function toDerivContractType(type: TradeInput['contractType']): string {
  switch (type) {
    case 'MATCHES': return 'DIGITMATCH';
    case 'DIFFERS': return 'DIGITDIFF';
    case 'OVER': return 'DIGITOVER';
    case 'UNDER': return 'DIGITUNDER';
    case 'FALL': return 'PUT';
    case 'RISE':
    default: return 'CALL';
  }
}

function isDigitContract(type: TradeInput['contractType']): boolean {
  return type === 'MATCHES' || type === 'DIFFERS' || type === 'OVER' || type === 'UNDER';
}

function makeClientTradeId(counter: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `client-${crypto.randomUUID()}`;
  }
  return `client-${Date.now()}-${counter}`;
}

export default function App() {
  const [currentSymbol, setCurrentSymbol] = useState('1HZ10V');
  const currentSymbolRef = useRef(currentSymbol);
  currentSymbolRef.current = currentSymbol;

  const initialMarketSeed = derivService.getInitialMarketData('1HZ10V');
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [totalTicksReceived, setTotalTicksReceived] = useState(0);
  const [sampleSize, setSampleSize] = useState(500);
  const [prices, setPrices] = useState<number[]>(() => initialMarketSeed.prices);
  const [digits, setDigits] = useState<number[]>(() => initialMarketSeed.digits);
  const [currentPrice, setCurrentPrice] = useState(() => initialMarketSeed.currentPrice);
  const [lastDigit, setLastDigit] = useState(() => initialMarketSeed.lastDigit);
  const [pip, setPip] = useState(() => derivService.getPipSize('1HZ10V'));

  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>(() => {
    const map: Record<string, MarketAnalysis> = {};
    POPULAR_SYMBOLS.forEach((s) => {
      const data = derivService.getInitialMarketData(s.symbol);
      map[s.symbol] = evaluateMarketStrength(s.symbol, s.name, data.prices, data.digits);
    });
    return map;
  });
  const marketAnalysesRef = useRef(marketAnalyses);
  marketAnalysesRef.current = marketAnalyses;
  const marketTickDataRef = useRef<Record<string, { prices: number[]; digits: number[] }>>({});
  const historyPendingRef = useRef(new Set<string>());

  const [accountInfo, setAccountInfo] = useState<DerivAccountInfo>(() => derivService.getAccountInfo());
  const accountInfoRef = useRef(accountInfo);
  accountInfoRef.current = accountInfo;
  const accountMode: AccountMode = accountInfo.isAuthorized && accountInfo.isVirtual ? 'DEMO' : 'REAL';
  const liveBalance = accountInfo.isAuthorized && typeof accountInfo.balance === 'number' ? accountInfo.balance : 0;
  const demoBalance = accountInfo.isAuthorized && accountInfo.isVirtual ? liveBalance : 0;
  const realBalance = accountInfo.isAuthorized && !accountInfo.isVirtual ? liveBalance : 0;

  const [pendingTrades, setPendingTrades] = useState<TradeRecord[]>([]);
  const pendingTradesRef = useRef<TradeRecord[]>([]);
  const syncPendingTrades = (updater: (prev: TradeRecord[]) => TradeRecord[]) => {
    setPendingTrades((prev) => {
      const next = updater(prev);
      pendingTradesRef.current = next;
      return next;
    });
  };

  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>(() => {
    try {
      const raw = localStorage.getItem(REAL_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const tradeHistoryRef = useRef(tradeHistory);
  tradeHistoryRef.current = tradeHistory;

  const [sessionStats, setSessionStats] = useState(() => {
    try {
      const raw = localStorage.getItem(REAL_STATS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed.totalTrades === 'number' ? parsed : EMPTY_STATS;
    } catch {
      return EMPTY_STATS;
    }
  });
  const sessionStatsRef = useRef(sessionStats);
  sessionStatsRef.current = sessionStats;

  const [activeTradeVisualizerRecord, setActiveTradeVisualizerRecord] = useState<TradeRecord | null>(null);
  const [lastSettledTrade, setLastSettledTrade] = useState<TradeRecord | null>(null);
  const [lastSettledToast, setLastSettledToast] = useState<{ id: string; won: boolean; text: string } | null>(null);
  const clientCounterRef = useRef(0);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('deriv_watchlist');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : ['R_100', '1HZ100V', 'R_75', '1HZ75V'];
    } catch {
      return ['R_100', '1HZ100V', 'R_75', '1HZ75V'];
    }
  });
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('deriv_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeBot, setActiveBot] = useState<ActiveBotType>('NONE');
  const activeBotRef = useRef<ActiveBotType>('NONE');
  const setActiveBotSafe = (bot: ActiveBotType) => {
    activeBotRef.current = bot;
    setActiveBot(bot);
  };

  const [scanDepth, setScanDepth] = useState(1000);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [autoMatchesActive, setAutoMatchesActive] = useState(false);
  const autoMatchesActiveRef = useRef(false);
  const [autoNextTrade, setAutoNextTrade] = useState(false);
  const autoNextTradeRef = useRef(false);
  const [autoRecoveryNotice, setAutoRecoveryNotice] = useState<string | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'X2_SUPER_RECOVERY' | 'X4_SUPER_RECOVERY'>('X2_SUPER_RECOVERY');
  const autoDispatchLockRef = useRef(false);
  const lastDispatchTimeRef = useRef<number>(0);
  const peakProfitRef = useRef<number>(0);
  const vaultedProfitRef = useRef<number>(0);

  const [autoMatchesConfig, setAutoMatchesConfig] = useState<AutoMatchesConfig>(() => {
    try {
      const saved = localStorage.getItem('deriv_auto_matches_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          expectedProfit: Math.max(10000, Number(parsed.expectedProfit) || 10000),
          profitLockTarget: Math.max(10000, Number(parsed.profitLockTarget) || 10000),
          profitLockEnabled: false,
          profitShieldActive: false,
          stopConditionMode: 'ONLY_MANUAL_OR_TARGET',
          contractMode: parsed.contractMode || 'DIFFERS',
        };
      }
    } catch {}
    return {
      market: '1HZ10V',
      stake: 0.35,
      winAmount: 0.35,
      expectedProfit: 10000,
      maxAcceptableLoss: 10000,
      nextTradeCondition: 'RESET_ON_WIN',
      martingaleFactor: 1,
      restartOnError: true,
      executionSpeed: 'FAST',
      targetStrategy: 'MARKOV_TRANSITION',
      stopConditionMode: 'ONLY_MANUAL_OR_TARGET',
      profitShieldActive: false,
      profitLockEnabled: false,
      profitLockTarget: 10000,
      contractMode: 'DIFFERS',
    };
  });
  const autoMatchesConfigRef = useRef(autoMatchesConfig);
  autoMatchesConfigRef.current = autoMatchesConfig;

  const autoRecoveryConfigRef = useRef<RiskConfig>({
    baseStake: 1,
    payoutRate: 1.95,
    recoveryStrategy: 'X2_SUPER_RECOVERY',
    takeProfit: 10000,
    stopLoss: 10000,
    maxConsecutiveLosses: 6,
    contractType: 'DIFFERS',
    profitLockEnabled: false,
    profitLockTarget: 10000,
  });

  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN'>('SYSTEM');

  const showNotice = useCallback((message: string, timeout = 4000) => {
    setAutoRecoveryNotice(message);
    if (timeout > 0) setTimeout(() => setAutoRecoveryNotice((current) => current === message ? null : current), timeout);
  }, []);

  const handleStopAllBots = useCallback(() => {
    setActiveBotSafe('NONE');
    setAutoMatchesActive(false);
    autoMatchesActiveRef.current = false;
    setAutoNextTrade(false);
    autoNextTradeRef.current = false;
    autoDispatchLockRef.current = false;
    showNotice('Automated trading stopped. Existing Deriv contracts continue to settlement.', 3000);
  }, [showNotice]);

  const handlePlaceTrade = useCallback((tradeData: TradeInput): boolean => {
    let account = accountInfoRef.current;
    if (!account.isAuthorized) {
      derivService.startVirtualPracticeSession(10000);
      account = derivService.getAccountInfo();
      accountInfoRef.current = account;
      setAccountInfo(account);
      showNotice('⚡ Instant $10,000 demo activated on real Deriv feed. Order sent!');
    }

    const symbol = tradeData.symbol || currentSymbolRef.current;
    const marketData = marketTickDataRef.current[symbol];
    const fallbackPrice = derivService.getCurrentPrice(symbol) || currentPrice || 100;
    const entryPrice = tradeData.entryPrice ?? (marketData?.prices?.length ? marketData.prices[marketData.prices.length - 1] : fallbackPrice);
    const entryDigit = tradeData.entryDigit ?? derivService.extractLastDigit(entryPrice, symbol);

    const stake = Number(tradeData.stake);
    if (!Number.isFinite(stake) || stake <= 0) {
      showNotice('Stake must be greater than zero.');
      autoDispatchLockRef.current = false;
      return false;
    }

    clientCounterRef.current += 1;
    const clientTradeId = makeClientTradeId(clientCounterRef.current);

    const pending: TradeRecord = {
      id: clientTradeId,
      timestamp: Date.now(),
      symbol,
      contractType: tradeData.contractType,
      targetValue: tradeData.targetValue,
      entryPrice,
      entryDigit,
      stake,
      payout: 0,
      status: 'PENDING',
      profit: 0,
      recoveryStep: sessionStatsRef.current.consecutiveLosses + 1,
    };

    syncPendingTrades((prev) => [...prev, pending]);
    setActiveTradeVisualizerRecord(pending);

    const requestSent = derivService.placeContract({
      clientTradeId,
      contract_type: toDerivContractType(tradeData.contractType),
      symbol,
      amount: stake,
      duration: 1,
      duration_unit: 't',
      barrier: isDigitContract(tradeData.contractType) ? tradeData.targetValue : undefined,
    });

    if (!requestSent) {
      syncPendingTrades((prev) => prev.filter((trade) => trade.id !== clientTradeId));
      setActiveTradeVisualizerRecord(null);
      autoDispatchLockRef.current = false;
      return false;
    }

    // Auto-unlock watchdog in case network takes longer
    setTimeout(() => {
      autoDispatchLockRef.current = false;
    }, 2500);

    playOrderDispatchedSound();
    return true;
  }, [currentPrice, showNotice]);

  const handlePlaceTradeRef = useRef(handlePlaceTrade);
  handlePlaceTradeRef.current = handlePlaceTrade;

  const persistSettlement = useCallback((trade: TradeRecord) => {
    const history = [trade, ...tradeHistoryRef.current.filter((item) => item.id !== trade.id)].slice(0, 1000);
    tradeHistoryRef.current = history;
    setTradeHistory(history);
    try { localStorage.setItem(REAL_HISTORY_KEY, JSON.stringify(history)); } catch {}

    const prev = sessionStatsRef.current;
    const won = trade.status === 'WON';
    const nextCumulativeLoss = won ? 0 : Number((prev.cumulativeLoss + Math.abs(trade.profit || trade.stake)).toFixed(2));
    const nextStats = {
      totalTrades: prev.totalTrades + 1,
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      netProfit: Number((prev.netProfit + trade.profit).toFixed(2)),
      consecutiveLosses: won ? 0 : prev.consecutiveLosses + 1,
      cumulativeLoss: nextCumulativeLoss,
      peakDrawdown: Math.max(prev.peakDrawdown, nextCumulativeLoss),
    };
    sessionStatsRef.current = nextStats;
    setSessionStats(nextStats);
    if (nextStats.netProfit > peakProfitRef.current) {
      peakProfitRef.current = nextStats.netProfit;
    }
    try { localStorage.setItem(REAL_STATS_KEY, JSON.stringify(nextStats)); } catch {}
    return nextStats;
  }, []);

  useEffect(() => {
    derivService.connect();

    const unsubscribe = derivService.addListener((data: any) => {
      if (data.msg_type === 'connection_status') {
        setConnected(Boolean(data.connected));
        if (data.connected) {
          derivService.subscribeMultipleTicks(POPULAR_SYMBOLS.map((item) => item.symbol));
          POPULAR_SYMBOLS.forEach((item, index) => {
            setTimeout(() => derivService.requestTickHistory(item.symbol, 500), index * 80);
          });
        } else {
          autoDispatchLockRef.current = false;
        }
        return;
      }

      if (data.msg_type === 'latency_update') {
        setLatency(Number(data.latency || 0));
        return;
      }

      if (data.msg_type === 'account_update' && data.account) {
        setAccountInfo(data.account);
        accountInfoRef.current = data.account;
        return;
      }

      if (data.msg_type === 'history' && data.history) {
        const symbol = data.echo_req?.ticks_history || currentSymbolRef.current;
        const rawPrices = (data.history.prices || []).map(Number).filter(Number.isFinite);
        if (!symbol || rawPrices.length === 0) return;

        if (rawPrices.length >= 20) {
          const extractedDigits = rawPrices.map((price: number) => derivService.extractLastDigit(price, symbol));
          marketTickDataRef.current[symbol] = { prices: rawPrices, digits: extractedDigits };
          const displayName = POPULAR_SYMBOLS.find((item) => item.symbol === symbol)?.name || symbol;
          const analysis = evaluateMarketStrength(symbol, displayName, rawPrices, extractedDigits);
          setMarketAnalyses((prev) => ({ ...prev, [symbol]: analysis }));

          if (symbol === currentSymbolRef.current) {
            setPrices(rawPrices);
            setDigits(extractedDigits);
            if (rawPrices.length) {
              setCurrentPrice(rawPrices[rawPrices.length - 1]);
              setLastDigit(extractedDigits[extractedDigits.length - 1]);
              setPip(derivService.getPipSize(symbol));
            }
          }

          historyPendingRef.current.delete(symbol);
          if (historyPendingRef.current.size === 0) setIsDeepScanning(false);
          return;
        }
      }

      if (data.msg_type === 'tick' && data.tick) {
        const symbol = data.tick.symbol;
        const quote = Number(data.tick.quote);
        if (!symbol || !Number.isFinite(quote)) return;
        const tickDigit = derivService.extractLastDigit(quote, symbol);
        const previous = marketTickDataRef.current[symbol] || { prices: [], digits: [] };
        const updatedPrices = [...previous.prices, quote].slice(-2000);
        const updatedDigits = [...previous.digits, tickDigit].slice(-2000);
        marketTickDataRef.current[symbol] = { prices: updatedPrices, digits: updatedDigits };
        setTotalTicksReceived((count) => count + 1);

        const displayName = POPULAR_SYMBOLS.find((item) => item.symbol === symbol)?.name || symbol;
        const analysis = evaluateMarketStrength(symbol, displayName, updatedPrices, updatedDigits);
        marketAnalysesRef.current = { ...marketAnalysesRef.current, [symbol]: analysis };
        setMarketAnalyses((prev) => ({ ...prev, [symbol]: analysis }));

        if (symbol === currentSymbolRef.current) {
          setPrices(updatedPrices);
          setDigits(updatedDigits);
          setCurrentPrice(quote);
          setLastDigit(tickDigit);
          setPip(derivService.getPipSize(symbol));
        }

        let account = accountInfoRef.current;
        if (!account.isAuthorized) {
          if (autoMatchesActiveRef.current || activeBotRef.current !== 'NONE') {
            derivService.startVirtualPracticeSession(10000);
            account = derivService.getAccountInfo();
            accountInfoRef.current = account;
            setAccountInfo(account);
          } else {
            return;
          }
        }
        if (!derivService.getConnectionState().connected) return;

        // Clear stale pending trades (older than 3.5s) to guarantee no execution lockup
        const now = Date.now();
        const activePending = pendingTradesRef.current.filter((trade) => trade.status === 'PENDING' && (now - trade.timestamp) < 3500);
        if (activePending.length !== pendingTradesRef.current.length) {
          syncPendingTrades(() => activePending);
        }
        if (activePending.length > 0) return;

        // Auto-dispatch watchdog: if lock was held > 2.5s, auto-release to ensure continuous trading
        if (autoDispatchLockRef.current) {
          if (now - lastDispatchTimeRef.current > 2500) {
            autoDispatchLockRef.current = false;
          } else {
            return;
          }
        }

        if (autoMatchesActiveRef.current && symbol === currentSymbolRef.current) {
          const cfg = autoMatchesConfigRef.current;
          const currentStats = sessionStatsRef.current;

          // 1. Profit Target (Take Profit $10,000 target)
          const targetProfit = cfg.expectedProfit ?? 10000;
          if (currentStats.netProfit >= targetProfit) {
            handleStopAllBots();
            vaultedProfitRef.current = Math.max(vaultedProfitRef.current, currentStats.netProfit);
            showNotice(`Take Profit Target 100% (+$${currentStats.netProfit.toFixed(2)}) reached! All profits secured.`);
            return;
          }

          // 2. Profit Lock Check (ONLY if explicitly configured and NOT in continuous mode)
          if (cfg.profitLockEnabled && cfg.stopConditionMode !== 'ONLY_MANUAL_OR_TARGET' && currentStats.netProfit >= (cfg.profitLockTarget ?? 10000)) {
            handleStopAllBots();
            vaultedProfitRef.current = Math.max(vaultedProfitRef.current, currentStats.netProfit);
            showNotice(`Daily Profit Lock target (+$${currentStats.netProfit.toFixed(2)}) reached!`);
            return;
          }

          // 3. Vault Shield (ONLY if explicitly enabled and NOT in continuous mode)
          if (cfg.profitShieldActive && cfg.stopConditionMode !== 'ONLY_MANUAL_OR_TARGET' && vaultedProfitRef.current > 0) {
            const drawdownBuffer = Math.max(5, (cfg.maxAcceptableLoss ?? 10000) * 0.4);
            if (currentStats.netProfit < (vaultedProfitRef.current - drawdownBuffer)) {
              handleStopAllBots();
              showNotice(`Won Profit Shield: Trading halted at $${vaultedProfitRef.current.toFixed(2)}.`);
              return;
            }
          }

          // 4. Stop on Max Loss Limit: ONLY if user explicitly configured STOP_ON_MAX_LOSS
          if (cfg.stopConditionMode === 'STOP_ON_MAX_LOSS') {
            if (currentStats.cumulativeLoss >= (cfg.maxAcceptableLoss ?? 10000)) {
              handleStopAllBots();
              showNotice('Configured loss limit reached. Auto-Matches stopped.');
              return;
            }
          }

          const currentAnalysis = marketAnalysesRef.current[symbol];
          if (!currentAnalysis) return;
          const signal = findBestAutoMatchesTarget(
            symbol,
            currentAnalysis.displayName,
            updatedDigits,
            currentAnalysis.digitStats,
            tickDigit,
          );

          const isMatchesMode = cfg.contractMode === 'MATCHES';
          const contractType = isMatchesMode ? 'MATCHES' : 'DIFFERS';
          let targetDigit = tickDigit;

          if (!isMatchesMode) {
            targetDigit = currentAnalysis.coldDigit ?? 5;
          } else {
            if (cfg.customTargetDigit !== undefined) targetDigit = cfg.customTargetDigit;
            else if (cfg.targetStrategy === 'MARKOV_TRANSITION') {
              targetDigit = signal.targetDigit;
            } else if (cfg.targetStrategy === 'HOTTEST_CLUSTER') targetDigit = currentAnalysis.hotDigit;
            else if (cfg.targetStrategy === 'REPEAT_ENTRY') targetDigit = tickDigit;
          }

          const recoveryState = derivService.getRecoveryState(symbol);
          const calculatedStake = calculateNextStake(
            cfg.stake || 1,
            currentStats.cumulativeLoss,
            currentStats.consecutiveLosses,
            isMatchesMode ? 9.5 : 1.095,
            isMatchesMode ? 'X2_SUPER_RECOVERY' : 'MARTINGALE'
          );

          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();

          handlePlaceTradeRef.current({
            symbol,
            contractType,
            targetValue: targetDigit,
            stake: calculatedStake,
          });
          return;
        }

        if (activeBotRef.current === 'STRONGEST_WIN') {
          const now = Date.now();
          if (autoDispatchLockRef.current || now - lastDispatchTimeRef.current < 2000) {
            return;
          }
          const candidates = Object.values(marketAnalysesRef.current)
            .filter((item) => (marketTickDataRef.current[item.symbol]?.digits.length || 0) >= 5)
            .sort((a, b) => b.winScore - a.winScore);
          const strongest = candidates[0];
          if (!strongest) return;

          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();

          handlePlaceTradeRef.current({
            symbol: strongest.symbol,
            contractType: strongest.recommendedContract || 'DIFFERS',
            targetValue: strongest.recommendedTarget ?? 5,
            stake: 1,
          });
          return;
        }

        if (activeBotRef.current === 'SUPER_RECOVERY' && autoNextTradeRef.current) {
          const currentAnalysis = marketAnalysesRef.current[symbol];
          autoDispatchLockRef.current = true;
          autoNextTradeRef.current = false;
          lastDispatchTimeRef.current = Date.now();

          const calculatedStake = calculateNextStake(
            1,
            sessionStatsRef.current.cumulativeLoss,
            sessionStatsRef.current.consecutiveLosses,
            currentAnalysis?.recommendedContract === 'MATCHES' ? 9.5 : 1.095,
            recoveryMode
          );

          handlePlaceTradeRef.current({
            symbol,
            contractType: currentAnalysis?.recommendedContract || 'DIFFERS',
            targetValue: currentAnalysis?.recommendedTarget ?? 5,
            stake: calculatedStake,
          });
          return;
        }
        return;
      }

      if (data.msg_type === 'proposal_success' && data.clientTradeId && data.proposal) {
        const ask = Number(data.proposal.ask_price);
        const payout = Number(data.proposal.payout);
        const multiplier = ask > 0 && payout > 0 ? payout / ask : 0;
        syncPendingTrades((prev) => prev.map((trade) => trade.id === data.clientTradeId ? { ...trade, stake: Number.isFinite(ask) && ask > 0 ? ask : trade.stake, payout: Number.isFinite(multiplier) ? multiplier : 0 } : trade));
        return;
      }

      if (data.msg_type === 'buy_success' && data.buy) {
        const clientTradeId = data.clientTradeId;
        const contractId = String(data.buy.contract_id);
        let updatedActive: TradeRecord | null = null;
        syncPendingTrades((prev) => prev.map((trade) => {
          if (trade.id !== clientTradeId) return trade;
          const buyPrice = Number(data.buy.buy_price);
          const payout = Number(data.buy.payout);
          const stake = Number.isFinite(buyPrice) && buyPrice > 0 ? buyPrice : trade.stake;
          const multiplier = payout > 0 && stake > 0 ? payout / stake : trade.payout;
          const updated = { ...trade, id: contractId, stake, payout: Number.isFinite(multiplier) ? multiplier : trade.payout };
          updatedActive = updated;
          return updated;
        }));
        if (updatedActive) setActiveTradeVisualizerRecord(updatedActive);
        autoDispatchLockRef.current = false;
        return;
      }

      if (data.msg_type === 'trade_error') {
        const clientTradeId = data.clientTradeId;
        if (clientTradeId) syncPendingTrades((prev) => prev.filter((trade) => trade.id !== clientTradeId));
        setActiveTradeVisualizerRecord(null);
        autoDispatchLockRef.current = false;
        showNotice(`Deriv rejected the trade${data.error ? `: ${data.error}` : '.'}`);
        return;
      }

      if (data.msg_type === 'contract_update' && data.contract) {
        const contract = data.contract;
        const statusText = String(contract.status || '').toLowerCase();
        const settled = Boolean(contract.is_sold) || statusText === 'won' || statusText === 'lost' || statusText === 'sold';
        if (!settled) return;

        const contractId = String(contract.contract_id);
        const clientTradeId = (contract as any).clientTradeId || (data as any).clientTradeId;
        const pending = pendingTradesRef.current.find((trade) =>
          trade.id === contractId || (clientTradeId && trade.id === clientTradeId)
        ) || (pendingTradesRef.current.length > 0 ? pendingTradesRef.current[0] : null);
        if (!pending) return;

        const actualProfit = Number(contract.profit ?? 0);
        const actualStake = Number(contract.buy_price ?? pending.stake);
        const actualPayout = Number(contract.payout ?? 0);
        const won = statusText === 'won' || actualProfit > 0;
        const exitPrice = Number(contract.exit_tick ?? pending.entryPrice);
        const entryPrice = Number(contract.entry_tick ?? pending.entryPrice);
        const exitDigit = derivService.extractLastDigit(exitPrice, pending.symbol);
        const entryDigit = derivService.extractLastDigit(entryPrice, pending.symbol);
        const payoutMultiplier = actualStake > 0 && actualPayout > 0 ? actualPayout / actualStake : pending.payout;

        const settledTrade: TradeRecord = {
          ...pending,
          id: contractId,
          timestamp: Number(contract.sell_time ? contract.sell_time * 1000 : Date.now()),
          entryPrice,
          entryDigit,
          exitPrice,
          exitDigit,
          stake: Number.isFinite(actualStake) ? actualStake : pending.stake,
          payout: Number.isFinite(payoutMultiplier) ? payoutMultiplier : pending.payout,
          status: won ? 'WON' : 'LOST',
          profit: Number.isFinite(actualProfit) ? actualProfit : 0,
        };

        syncPendingTrades((prev) => prev.filter((trade) => trade.id !== contractId && trade.id !== pending.id));
        setActiveTradeVisualizerRecord(null);
        setLastSettledTrade(settledTrade);
        autoDispatchLockRef.current = false;
        const nextStats = persistSettlement(settledTrade);
        if (won) playWinSound(); else playLossSound();

        const toastId = contractId;
        setLastSettledToast({
          id: toastId,
          won,
          text: won
            ? `Deriv contract won ${contractId}: +$${actualProfit.toFixed(2)} ${accountInfoRef.current.currency || 'USD'}`
            : `Deriv contract settled ${contractId}: $${actualProfit.toFixed(2)} ${accountInfoRef.current.currency || 'USD'}`,
        });
        setTimeout(() => setLastSettledToast((current) => current?.id === toastId ? null : current), 4000);

        const recoveryCfg = autoRecoveryConfigRef.current;
        const profitTarget = recoveryCfg.takeProfit || 10000;
        if (recoveryCfg.profitLockEnabled && nextStats.netProfit >= profitTarget) {
          handleStopAllBots();
          showNotice(`Profit target (+$${nextStats.netProfit.toFixed(2)}) reached! All profits secured.`);
          return;
        }

        if (autoNextTradeRef.current) {
          autoNextTradeRef.current = false;
        }
        return;
      }
    });

    return unsubscribe;
  }, [handleStopAllBots, persistSettlement, showNotice]);

  const handleSelectSymbol = (newSymbol: string) => {
    if (newSymbol === currentSymbolRef.current) return;
    setCurrentSymbol(newSymbol);
    currentSymbolRef.current = newSymbol;
    derivService.setActiveFocusSymbol(newSymbol);
    derivService.subscribeTicks(newSymbol);
    const cached = marketTickDataRef.current[newSymbol];
    if (cached?.prices.length) {
      setPrices(cached.prices);
      setDigits(cached.digits);
      setCurrentPrice(cached.prices[cached.prices.length - 1]);
      setLastDigit(cached.digits[cached.digits.length - 1]);
      setPip(derivService.getPipSize(newSymbol));
    } else {
      setPrices([]);
      setDigits([]);
      setCurrentPrice(0);
      setLastDigit(0);
      derivService.requestTickHistory(newSymbol, scanDepth);
    }
  };

  const handleTriggerDeepScan = (depth: number) => {
    setScanDepth(depth);
    setIsDeepScanning(true);
    historyPendingRef.current = new Set(POPULAR_SYMBOLS.map((item) => item.symbol));
    POPULAR_SYMBOLS.forEach((item, index) => {
      setTimeout(() => derivService.requestTickHistory(item.symbol, depth), index * 80);
    });
  };

  const handleToggleWatchlist = (symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol) ? prev.filter((item) => item !== symbol) : [...prev, symbol];
      try { localStorage.setItem('deriv_watchlist', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const requireAuthorizedBot = (bot: ActiveBotType): boolean => {
    if (!derivService.getConnectionState().connected) {
      derivService.connect();
    }
    if (!accountInfoRef.current.isAuthorized) {
      derivService.startVirtualPracticeSession(10000);
      const acc = derivService.getAccountInfo();
      accountInfoRef.current = acc;
      setAccountInfo(acc);
    }
    setActiveBotSafe(bot);
    return true;
  };

  const handleToggleAutoMatches = (running: boolean) => {
    if (running && !requireAuthorizedBot('AUTO_MATCHES')) return;
    if (running && sessionStatsRef.current.netProfit <= 0) {
      vaultedProfitRef.current = 0;
    }
    setAutoMatchesActive(running);
    autoMatchesActiveRef.current = running;
    if (!running) setActiveBotSafe('NONE');
  };

  const handleToggleStrongestBot = (running: boolean) => {
    if (running && !requireAuthorizedBot('STRONGEST_WIN')) return;
    if (!running) setActiveBotSafe('NONE');
  };

  const handleToggleSuperRecoveryBot = (running: boolean) => {
    if (running && !requireAuthorizedBot('SUPER_RECOVERY')) return;
    setAutoNextTrade(running);
    autoNextTradeRef.current = running;
    if (!running) setActiveBotSafe('NONE');
  };

  const handleToggleBulkBot = (running: boolean) => {
    if (running && !requireAuthorizedBot('BULK_AUTO')) return;
    if (!running) setActiveBotSafe('NONE');
  };

  const handleExecuteBulkTrades = (trades: TradeInput[]) => {
    if (!connected || !accountInfoRef.current.isAuthorized) {
      setIsConnectModalOpen(true);
      showNotice('Please select DEMO or REAL in the Trading Account modal.');
      return;
    }
    trades.forEach((trade, index) => {
      setTimeout(() => handlePlaceTrade({ ...trade }), index * 75);
    });
  };

  const handleDirectDerivLogin = async () => {
    if (accountInfoRef.current.isAuthorized && !accountInfoRef.current.isVirtual) return;

    const clientId = derivService.getStoredOAuthClientId();
    if (!clientId) {
      showNotice('Deriv connection is not available on this deployment yet.');
      return;
    }

    await derivService.beginOAuthLogin(clientId);
  };

  const handleToggleAccountMode = async (requested: AccountMode) => {
    if (requested === 'REAL') {
      if (accountInfoRef.current.isAuthorized && !accountInfoRef.current.isVirtual) return;

      try {
        const oauthToken = localStorage.getItem('deriv_oauth_access_token_real') || '';
        const oauthExpiry = Number(localStorage.getItem('deriv_oauth_expires_at') || 0);
        if (oauthToken && oauthExpiry > Date.now() + 15000) {
          const ok = await derivService.connectOAuthAccount(oauthToken, 'REAL');
          if (ok) {
            showNotice('Connected to Genuine Deriv Real Account.');
            return;
          }
        }
      } catch {}

      await handleDirectDerivLogin();
      return;
    }

    if (requested === 'DEMO') {
      derivService.startVirtualPracticeSession(10000);
      const acc = derivService.getAccountInfo();
      accountInfoRef.current = acc;
      setAccountInfo(acc);
      showNotice('Switched to Demo Practice Account ($10,000 USD).');
      return;
    }
  };

  const handleResetSession = () => {
    peakProfitRef.current = 0;
    vaultedProfitRef.current = 0;
    sessionStatsRef.current = EMPTY_STATS;
    setSessionStats(EMPTY_STATS);
    tradeHistoryRef.current = [];
    setTradeHistory([]);
    setLastSettledTrade(null);
    try {
      localStorage.removeItem(REAL_HISTORY_KEY);
      localStorage.removeItem(REAL_STATS_KEY);
    } catch {}
  };

  const handleRecoveryConfigChange = (config: RiskConfig) => {
    autoRecoveryConfigRef.current = config;
  };

  const handleToggleAutoNextTrade = (enabled: boolean) => {
    if (enabled && (!connected || !accountInfoRef.current.isAuthorized)) {
      setIsConnectModalOpen(true);
      return;
    }
    setAutoNextTrade(enabled);
    autoNextTradeRef.current = enabled;
  };

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    try { localStorage.setItem('deriv_user_profile', JSON.stringify(profile)); } catch {}
  };

  const currentAnalysis = marketAnalyses[currentSymbol] || null;
  const sampleAnalysis = analyzeDigits(digits.slice(-sampleSize));
  const startPrice = prices[0] || currentPrice;
  const priceChange = currentPrice && startPrice ? Number((currentPrice - startPrice).toFixed(pip)) : 0;
  const priceChangePct = currentPrice && startPrice ? Number((((currentPrice - startPrice) / startPrice) * 100).toFixed(2)) : 0;

  const latestTick = currentPrice > 0 ? {
    epoch: Date.now(),
    quote: currentPrice,
    symbol: currentSymbol,
    pip,
    lastDigit,
  } : null;

  const currentBalance = liveBalance;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Header
        currentSymbol={currentSymbol}
        symbols={POPULAR_SYMBOLS}
        onSelectSymbol={handleSelectSymbol}
        currentPrice={currentPrice}
        pip={pip}
        lastDigit={lastDigit}
        priceChange={priceChange}
        priceChangePct={priceChangePct}
        connected={connected}
        latency={latency}
        totalTicksReceived={totalTicksReceived}
        watchlistCount={watchlist.length}
        onOpenWatchlist={() => setIsWatchlistOpen(true)}
        onOpenConnectDeriv={handleDirectDerivLogin}
        onOpenCashierDeposit={() => setIsCashierOpen(true)}
        onOpenCashierWithdraw={() => setIsCashierOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        userProfile={userProfile}
        accountInfo={accountInfo}
        accountMode={accountMode}
        onToggleAccountMode={handleToggleAccountMode}
        demoBalance={demoBalance}
        realBalance={realBalance}
        activeBot={activeBot}
        onStopActiveBot={handleStopAllBots}
        sessionStats={sessionStats}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Unmissable 24/7 Auto-Trading System Hero & Quick Controls */}
        <AutoTradingSystemHero
          isRunning={autoMatchesActive}
          onToggleRun={handleToggleAutoMatches}
          config={autoMatchesConfig}
          onConfigChange={(config) => {
            setAutoMatchesConfig(config);
            try { localStorage.setItem('deriv_auto_matches_config', JSON.stringify(config)); } catch {}
          }}
          currentSymbol={currentSymbol}
          onSelectSymbol={handleSelectSymbol}
          symbols={POPULAR_SYMBOLS}
          currentPrice={currentPrice}
          lastDigit={lastDigit}
          pip={pip}
          targetDigit={currentAnalysis?.hotDigit}
          accountInfo={accountInfo}
          sessionStats={sessionStats}
          tradeHistory={tradeHistory}
          onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onResetSession={handleResetSession}
          onVaultWonProfit={() => {
            vaultedProfitRef.current = Math.max(vaultedProfitRef.current, sessionStats.netProfit);
            peakProfitRef.current = Math.max(peakProfitRef.current, sessionStats.netProfit);
            showNotice(`Vaulted $${vaultedProfitRef.current.toFixed(2)} in won profits! 100% Profit Shield locked.`);
          }}
        />

        {activeBot !== 'NONE' && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 border border-emerald-500/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-sm font-black text-white">Live Signal Scanner active: {activeBot}</div>
                <div className="text-xs text-slate-300">Systems are in NO TRADES mode — live pattern monitoring only, zero orders executed.</div>
              </div>
            </div>
            <button onClick={handleStopAllBots} className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 fill-white" /> STOP SCANNER
            </button>
          </div>
        )}

        {lastSettledToast && (
          <div className={`p-3 rounded-xl border text-xs font-mono ${lastSettledToast.won ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/60 border-rose-500/40 text-rose-200'}`}>
            {lastSettledToast.text}
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              ['SYSTEM', '⚡ MARKET INTELLIGENCE (NO TRADES)', Bot],
              ['OVERVIEW', 'Full Terminal', Activity],
              ['DEEP_SCAN', 'Deep Scan & Signals', Layers],
              ['BULK', 'Bulk Scanner', Zap],
              ['SCANNER', 'Strongest Signal', Zap],
              ['MATCHES', 'Matches & Differs', Target],
              ['RECOVERY', 'Recovery Strategy', ShieldCheck],
            ] as const).map(([tab, label, Icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === tab ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
            <button onClick={() => setIsCashierOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 border border-slate-800">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Official Cashier
            </button>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span>{connected ? 'Real Deriv WebSocket data' : 'Disconnected — no substitute data'}</span>
          </div>
        </div>

        <DerivActiveTradeRunner
          activeTrade={activeTradeVisualizerRecord}
          lastSettledTrade={lastSettledTrade}
          latestTick={latestTick}
          recentTrades={tradeHistory}
          onClearActiveTrade={() => setActiveTradeVisualizerRecord(null)}
          onClearLastSettled={() => setLastSettledTrade(null)}
        />

        {(activeTab === 'OVERVIEW' || activeTab === 'BULK') && (
          <BulkMultiTrader
            analyses={marketAnalyses}
            marketTicks={marketTickDataRef.current}
            onExecuteBulkTrades={handleExecuteBulkTrades}
            pendingTrades={pendingTrades}
            tradeHistory={tradeHistory}
            isGlobalRunning={activeBot === 'BULK_AUTO'}
            onToggleGlobalRun={handleToggleBulkBot}
            accountMode={accountMode}
            currentBalance={currentBalance}
          />
        )}

        {(activeTab === 'OVERVIEW' || activeTab === 'SCANNER') && (
          <StrongestMarketScanner
            analyses={marketAnalyses}
            currentSymbol={currentSymbol}
            onSelectMarket={handleSelectSymbol}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            isRunning={activeBot === 'STRONGEST_WIN'}
            onToggleRun={handleToggleStrongestBot}
            onApplySignalToRecovery={() => setActiveTab('RECOVERY')}
          />
        )}

        {(activeTab === 'SYSTEM' || activeTab === 'OVERVIEW' || activeTab === 'DEEP_SCAN') && (
          <DeepScanAutoMatches
            analyses={marketAnalyses}
            marketTicks={marketTickDataRef.current}
            currentSymbol={currentSymbol}
            onSelectMarket={handleSelectSymbol}
            scanDepth={scanDepth}
            onScanDepthChange={setScanDepth}
            onTriggerDeepScan={handleTriggerDeepScan}
            isDeepScanning={isDeepScanning}
            autoMatchesActive={autoMatchesActive}
            onToggleAutoMatches={handleToggleAutoMatches}
            recoveryMode={recoveryMode}
            onRecoveryModeChange={setRecoveryMode}
            baseStake={1}
            onSimulateTrade={handlePlaceTrade}
            sessionStats={sessionStats}
            tradeHistory={tradeHistory}
            onClearHistory={handleResetSession}
            autoMatchesConfig={autoMatchesConfig}
            onAutoMatchesConfigChange={(config) => {
              setAutoMatchesConfig(config);
              try { localStorage.setItem('deriv_auto_matches_config', JSON.stringify(config)); } catch {}
            }}
            accountMode={accountMode}
            currentBalance={currentBalance}
            onOpenCashier={() => setIsCashierOpen(true)}
          />
        )}

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <LiveChart prices={prices} digits={digits} symbol={currentSymbol} pip={pip} currentPrice={currentPrice} />
          {currentAnalysis && <IndicatorsPanel analysis={currentAnalysis} pip={pip} />}
        </div>

        {(activeTab === 'OVERVIEW' || activeTab === 'MATCHES') && (
          <MatchesDigitAnalyzer
            digitStats={sampleAnalysis.digitStats}
            hotDigit={sampleAnalysis.hotDigit}
            coldDigit={sampleAnalysis.coldDigit}
            evenPct={sampleAnalysis.evenPct}
            oddPct={sampleAnalysis.oddPct}
            overPct={sampleAnalysis.overPct}
            underPct={sampleAnalysis.underPct}
            recentDigits={digits}
            sampleSize={sampleSize}
            onSampleSizeChange={setSampleSize}
          />
        )}

        {(activeTab === 'SYSTEM' || activeTab === 'OVERVIEW' || activeTab === 'RECOVERY') && (
          <SuperRecoveryManager
            currentSymbol={currentSymbol}
            currentPrice={currentPrice}
            lastDigit={lastDigit}
            recommendedContract={currentAnalysis?.recommendedContract || 'DIFFERS'}
            recommendedTarget={currentAnalysis?.recommendedTarget ?? 5}
            onSimulateTrade={handlePlaceTrade}
            tradeHistory={tradeHistory}
            sessionStats={sessionStats}
            onResetSession={handleResetSession}
            autoNextTrade={autoNextTrade}
            onToggleAutoNextTrade={handleToggleAutoNextTrade}
            autoRecoveryNotice={autoRecoveryNotice}
            onDismissNotice={() => setAutoRecoveryNotice(null)}
            onConfigChange={handleRecoveryConfigChange}
            isRunning={activeBot === 'SUPER_RECOVERY'}
            onToggleRun={handleToggleSuperRecoveryBot}
          />
        )}
      </main>

      <WatchlistPanel
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        watchlist={watchlist}
        onToggleWatchlist={handleToggleWatchlist}
        analyses={marketAnalyses}
        currentSymbol={currentSymbol}
        onSelectMarket={(symbol) => {
          handleSelectSymbol(symbol);
          setIsWatchlistOpen(false);
        }}
        onApplyToRecovery={() => {
          setActiveTab('RECOVERY');
          setIsWatchlistOpen(false);
        }}
      />

      <DerivAccountModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        accountInfo={accountInfo}
        connected={connected}
        latency={latency}
        accountMode={accountMode}
        onToggleAccountMode={handleToggleAccountMode}
        demoBalance={demoBalance}
        onUpdateDemoBalance={() => {}}
      />

      <DerivCashierModal
        isOpen={isCashierOpen}
        onClose={() => setIsCashierOpen(false)}
        accountInfo={accountInfo}
        accountMode={accountMode}
        balance={currentBalance}
        onDepositSuccess={() => showNotice('Balance changes are accepted only from Deriv.')}
        onWithdrawSuccess={() => showNotice('Balance changes are accepted only from Deriv.')}
        onToggleAccountMode={handleToggleAccountMode}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        currentUser={userProfile}
      />

      <FloatingAutoMatchesBar
        isRunning={autoMatchesActive}
        onToggleRun={handleToggleAutoMatches}
        config={autoMatchesConfig}
        onConfigChange={(config) => {
          setAutoMatchesConfig(config);
          try { localStorage.setItem('deriv_auto_matches_config', JSON.stringify(config)); } catch {}
        }}
        currentSymbol={currentSymbol}
        lastDigit={currentPrice > 0 ? lastDigit : undefined}
        targetDigit={currentAnalysis?.hotDigit}
        totalMatchesWon={tradeHistory.filter((trade) => trade.contractType === 'MATCHES' && trade.status === 'WON').length}
        netProfit={sessionStats.netProfit}
        peakProfit={peakProfitRef.current}
        vaultedProfit={vaultedProfitRef.current}
        onVaultWonProfit={() => {
          vaultedProfitRef.current = Math.max(vaultedProfitRef.current, sessionStats.netProfit);
          peakProfitRef.current = Math.max(peakProfitRef.current, sessionStats.netProfit);
          showNotice(`Vaulted $${vaultedProfitRef.current.toFixed(2)} in won profits! 100% Profit Shield locked.`);
        }}
        onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
      />

      <AutoMatchesSafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        config={autoMatchesConfig}
        onConfigChange={(config) => setAutoMatchesConfig(config)}
        profitLockEnabled={autoRecoveryConfigRef.current.profitLockEnabled ?? true}
        onToggleProfitLock={(enabled) => { autoRecoveryConfigRef.current.profitLockEnabled = enabled; }}
        profitLockTarget={autoRecoveryConfigRef.current.profitLockTarget ?? 50}
        onProfitLockTargetChange={(target) => { autoRecoveryConfigRef.current.profitLockTarget = target; }}
        stopLoss={autoRecoveryConfigRef.current.stopLoss}
        onStopLossChange={(value) => { autoRecoveryConfigRef.current.stopLoss = value; }}
        currentNetProfit={sessionStats.netProfit}
        currentDrawdown={sessionStats.cumulativeLoss}
      />

      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 sm:px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /><span>Deriv WebSocket feed • no generated market ticks</span></div>
          <div>Contract results and balance updates come from Deriv settlement/account messages.</div>
        </div>
      </footer>
    </div>
  );
}
