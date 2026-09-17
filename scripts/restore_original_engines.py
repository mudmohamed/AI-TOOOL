from pathlib import Path

# Restore the original cold-digit DIFFERS engine without replacing the current
# Auto-Matches implementation.
p = Path('src/utils/autoMatchesEngine.ts')
s = p.read_text()
if 'export function findBestDiffersTarget(' not in s:
    marker = 'export interface SameLosingPriceRecoveryResult {'
    block = r'''/**
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

'''
    if marker not in s:
        raise SystemExit('Auto-Matches recovery interface anchor missing')
    s = s.replace(marker, block + marker, 1)
    p.write_text(s)

# Types needed by the original backtester / performance engines.
p = Path('src/types.ts')
s = p.read_text()
if 'export interface SessionStats' not in s:
    anchor = 'export interface RiskConfig {'
    block = '''export interface SessionStats {\n  totalTrades: number;\n  wins: number;\n  losses: number;\n  netProfit: number;\n  consecutiveLosses: number;\n  cumulativeLoss: number;\n  peakDrawdown: number;\n  peakProfit?: number;\n  vaultedProfit?: number;\n}\n\n'''
    if anchor not in s:
        raise SystemExit('RiskConfig anchor missing')
    s = s.replace(anchor, block + anchor, 1)

if 'export interface BacktestConfig' not in s:
    anchor = 'export interface DBotXmlDefinition {'
    block = '''export interface BacktestConfig {\n  symbol: string;\n  sampleTicks: number;\n  strategy: 'DIFFERS_ACCOUNT_GROWER' | 'CONFIRMED_MATCHES_SNIPER' | 'OVER_UNDER_PROBABILITY' | 'REPEAT_DIGIT_MOMENTUM';\n  contractMode: 'DIFFERS' | 'MATCHES' | 'UNDER' | 'OVER';\n  stake: number;\n  stakeMode: 'FIXED_STAKE' | 'SMART_RECOVERY' | 'MARTINGALE';\n  maxStakeCap: number;\n  martingaleMultiplier: number;\n  maxAllowedLosses: number;\n  takeProfit: number;\n  stopLoss: number;\n  minConfidenceThreshold: number;\n}\n\nexport interface BacktestTrade {\n  tradeIndex: number;\n  tickIndex: number;\n  quote: number;\n  entryDigit: number;\n  targetDigit: number | string;\n  contractType: string;\n  exitPrice: number;\n  exitDigit: number;\n  won: boolean;\n  stake: number;\n  profit: number;\n  balanceAfter: number;\n  cumulativeProfit: number;\n  consecutiveLosses: number;\n}\n\nexport interface BacktestResult {\n  config: BacktestConfig;\n  symbol: string;\n  totalTicksTested: number;\n  totalTrades: number;\n  wins: number;\n  losses: number;\n  winRate: number;\n  initialBalance: number;\n  finalBalance: number;\n  netProfit: number;\n  profitFactor: number;\n  maxDrawdown: number;\n  maxDrawdownPct: number;\n  maxConsecutiveWins: number;\n  maxConsecutiveLosses: number;\n  trades: BacktestTrade[];\n  equityCurve: Array<{ trade: number; balance: number; profit: number }>;\n}\n\n'''
    if anchor not in s:
        raise SystemExit('DBotXmlDefinition anchor missing')
    s = s.replace(anchor, block + anchor, 1)

if 'fixedStakeMode?: boolean' not in s:
    idx = s.find('  market?: string;', s.find('export interface AutoMatchesConfig'))
    if idx < 0:
        raise SystemExit('AutoMatchesConfig anchor missing')
    e = s.find('\n', idx) + 1
    s = s[:e] + '  maxStakeCap?: number;\n  fixedStakeMode?: boolean;\n  maxAllowedLosses?: number;\n' + s[e:]

# Update the AutoMatchesConfig fields directly. Do not use a broad section test,
# because the BacktestConfig below it also contains FIXED_STAKE.
s = s.replace(
    "nextTradeCondition?: 'MARTINGALE' | 'SAME_LOSS_RECOVERY' | 'RESET_ON_WIN';",
    "nextTradeCondition?: 'FIXED_STAKE' | 'MARTINGALE' | 'SAME_LOSS_RECOVERY' | 'RESET_ON_WIN';",
    1,
)
s = s.replace(
    "targetStrategy: 'REPEAT_ENTRY' | 'MARKOV_TRANSITION' | 'HOTTEST_CLUSTER' | 'CUSTOM';",
    "targetStrategy: 'REPEAT_ENTRY' | 'MARKOV_TRANSITION' | 'HOTTEST_CLUSTER' | 'CUSTOM' | 'COLD_DIFFERS' | 'DIFFERS_SAFE_GROWTH';",
    1,
)
start = s.find('export interface AutoMatchesConfig')
end = s.find('export interface BacktestConfig', start)
if end < 0:
    end = s.find('export interface DBotXmlDefinition', start)
section = s[start:end]
if 'contractMode?:' not in section:
    marker = '  customTargetDigit?: number;\n'
    s = s.replace(marker, marker + "  contractMode?: 'MATCHES' | 'DIFFERS' | 'OVER_UNDER' | 'EVEN_ODD';\n  onlyWhenSignalConfirmed?: boolean;\n  minConfidenceThreshold?: number;\n", 1)
p.write_text(s)

# Compatibility export required by the untouched StrategyBacktesterTab.
p = Path('src/services/derivWs.ts')
s = p.read_text()
if 'export const POPULAR_DERIV_SYMBOLS' not in s:
    import_line = "import { DerivAccountInfo } from '../types';\n"
    if import_line not in s:
        raise SystemExit('derivWs import anchor missing')
    symbols = "\nexport const POPULAR_DERIV_SYMBOLS = ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V', 'R_10', 'R_25', 'R_50', 'R_75', 'R_100'];\n"
    s = s.replace(import_line, import_line + symbols, 1)
    p.write_text(s)

# Wire the original missing system panels into the current App without replacing
# the current live trade placement/settlement/recovery blocks.
p = Path('src/App.tsx')
s = p.read_text()
a = "import { AutoMatchesSafetyModal } from './components/AutoMatchesSafetyModal';\n"
if "./components/RecoveryPerformanceChart" not in s:
    s = s.replace(a, a + "import { RecoveryPerformanceChart } from './components/RecoveryPerformanceChart';\nimport { StrategyBacktesterTab } from './components/StrategyBacktesterTab';\nimport { DigitProfitabilityHeatmap } from './components/DigitProfitabilityHeatmap';\n", 1)

old = "const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN'>('OVERVIEW');"
new = "const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN' | 'BACKTEST' | 'HEATMAP'>('OVERVIEW');"
s = s.replace(old, new, 1)

tab_anchor = "              ['RECOVERY', 'Recovery', ShieldCheck],\n"
if "['BACKTEST', 'Real Backtester'" not in s:
    if tab_anchor not in s:
        raise SystemExit('Recovery tab anchor missing')
    s = s.replace(tab_anchor, tab_anchor + "              ['BACKTEST', 'Real Backtester', Activity],\n              ['HEATMAP', 'Profit Heatmap', Target],\n", 1)

chart = '''        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">\n          <LiveChart prices={prices} digits={digits} symbol={currentSymbol} pip={pip} currentPrice={currentPrice} />\n          {currentAnalysis && <IndicatorsPanel analysis={currentAnalysis} pip={pip} />}\n        </div>\n'''
if '<RecoveryPerformanceChart' not in s:
    block = '''\n        {activeTab === 'OVERVIEW' && (\n          <RecoveryPerformanceChart tradeHistory={tradeHistory} sessionStats={sessionStats} expectedProfitTarget={autoMatchesConfig.expectedProfit ?? 20} maxLossLimit={autoMatchesConfig.maxAcceptableLoss ?? 50} onClearSession={handleResetSession} isRunning={activeBot !== 'NONE' || autoMatchesActive || autoNextTrade} />\n        )}\n'''
    if chart not in s:
        raise SystemExit('Live chart anchor missing')
    s = s.replace(chart, chart + block, 1)

matches_anchor = "        {(activeTab === 'OVERVIEW' || activeTab === 'MATCHES') && (\n"
if '<DigitProfitabilityHeatmap' not in s:
    block = '''        {(activeTab === 'OVERVIEW' || activeTab === 'HEATMAP') && (\n          <DigitProfitabilityHeatmap tradeHistory={tradeHistory} currentAnalysis={currentAnalysis} currentPrice={currentPrice} lastDigit={lastDigit} currentSymbol={currentSymbol} accountMode={accountMode} accountInfo={accountInfo} currentBalance={currentBalance} netProfit={sessionStats.netProfit} onExecuteTrade={({ contractType, targetValue, stake }) => handlePlaceTrade({ contractType, targetValue, stake, symbol: currentSymbol, entryPrice: currentPrice, entryDigit: lastDigit })} onOpenConnectDeriv={() => setIsConnectModalOpen(true)} onSelectBotTarget={(digit) => setAutoMatchesConfig((prev) => ({ ...prev, customTargetDigit: digit }))} />\n        )}\n\n'''
    if matches_anchor not in s:
        raise SystemExit('Matches panel anchor missing')
    s = s.replace(matches_anchor, block + matches_anchor, 1)

if '<StrategyBacktesterTab' not in s:
    block = '''\n        {activeTab === 'BACKTEST' && (\n          <StrategyBacktesterTab currentSymbol={currentSymbol} marketTicks={marketTickDataRef.current} onApplyStrategyToLiveBot={(config) => { setAutoMatchesConfig((prev) => ({ ...prev, ...config })); setActiveTab('DEEP_SCAN'); }} onNavigateToTrader={() => setActiveTab('DEEP_SCAN')} />\n        )}\n'''
    pos = s.rfind('      </main>')
    if pos < 0:
        raise SystemExit('main close missing')
    s = s[:pos] + block + s[pos:]

p.write_text(s)
