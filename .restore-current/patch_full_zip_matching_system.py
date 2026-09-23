from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# Complete the ZIP's MATCHES migration.
p = 'src/main.tsx'
s = read(p)
s = one(s, "const migrationKey = 'deriv_first_real_matches_engine_v1';", "const migrationKey = 'deriv_first_real_matches_engine_v2';", 'migration key')
s = one(s, "      targetStrategy: 'MARKOV_TRANSITION',\n", "      targetStrategy: 'MARKOV_TRANSITION',\n      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n", 'migration matches config')
write(p, s)

# Connect the ZIP's own WIN/MATCHES engines in App.
p = 'src/App.tsx'
s = read(p)
s = one(s, "import { findBestAutoMatchesTarget } from './utils/autoMatchesEngine';", "import { findBestAutoMatchesTarget, findBestDiffersTarget } from './utils/autoMatchesEngine';", 'engine import')
s = one(s, "import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';", "import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';\nimport { StrategyBacktesterTab } from './components/StrategyBacktesterTab';", 'backtester import')
s = one(s, "const [activeTab, setActiveTab] = useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN'>('SYSTEM');", "const [activeTab, setActiveTab] = useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN' | 'BACKTEST'>('SYSTEM');", 'tab type')
s = one(s, "          contractMode: parsed.contractMode || 'DIFFERS',\n", "          contractMode: parsed.contractMode || 'MATCHES',\n          onlyWhenSignalConfirmed: parsed.onlyWhenSignalConfirmed ?? true,\n", 'saved default')
s = one(s, "      contractMode: 'DIFFERS',\n", "      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n", 'fresh default')
s = one(s, "  const autoNextTradeRef = useRef(false);\n", "  const autoNextTradeRef = useRef(false);\n  const recoveryTradeRef = useRef<TradeInput | null>(null);\n", 'recovery ref')

# Clear exact-loss recovery only when the user stops the bots.
s = one(s, "    autoNextTradeRef.current = false;\n    autoDispatchLockRef.current = false;", "    autoNextTradeRef.current = false;\n    recoveryTradeRef.current = null;\n    autoDispatchLockRef.current = false;", 'stop clear')

# Recovery has priority on the next real tick for the same symbol and repeats the exact lost contract/target.
anchor = "        if (autoMatchesActiveRef.current && symbol === currentSymbolRef.current) {\n"
recovery = """        if (autoNextTradeRef.current && recoveryTradeRef.current && symbol === recoveryTradeRef.current.symbol) {
          const rt = recoveryTradeRef.current;
          const rc = autoRecoveryConfigRef.current;
          const observedPayout = Number(rt.payout || 0);
          const payoutRate = observedPayout > 0
            ? observedPayout
            : rt.contractType === 'MATCHES' ? 9.5 : rt.contractType === 'DIFFERS' ? 1.095 : rc.payoutRate;
          const recoveryStake = calculateNextStake(
            rc.baseStake,
            sessionStatsRef.current.cumulativeLoss,
            sessionStatsRef.current.consecutiveLosses,
            payoutRate,
            rc.recoveryStrategy,
          );
          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();
          handlePlaceTradeRef.current({ ...rt, stake: recoveryStake, entryPrice: quote, entryDigit: tickDigit });
          return;
        }

"""
s = one(s, anchor, recovery + anchor, 'recovery priority')

# MATCHES must wait for the ZIP confirmation trigger. DIFFERS must use the ZIP Win Shield target engine.
old = """          const isMatchesMode = cfg.contractMode === 'MATCHES';
          const contractType = isMatchesMode ? 'MATCHES' : 'DIFFERS';
          let targetDigit = tickDigit;

          if (!isMatchesMode) {
            targetDigit = currentAnalysis.coldDigit ?? 5;
          } else {
"""
new = """          const isMatchesMode = cfg.contractMode === 'MATCHES';
          const contractType = isMatchesMode ? 'MATCHES' : 'DIFFERS';
          let targetDigit = tickDigit;

          if (isMatchesMode && cfg.onlyWhenSignalConfirmed && !signal.isTriggerReady) return;

          if (!isMatchesMode) {
            targetDigit = findBestDiffersTarget(updatedDigits, tickDigit).targetDigit;
          } else {
"""
s = one(s, old, new, 'live signal wiring')

# The old SUPER_RECOVERY block changed contract/target. Keep it idle unless an exact loss has been captured.
old_recovery = """        if (activeBotRef.current === 'SUPER_RECOVERY' && autoNextTradeRef.current) {
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
"""
new_recovery = """        if (activeBotRef.current === 'SUPER_RECOVERY' && autoNextTradeRef.current && !recoveryTradeRef.current) {
          return;
        }
"""
s = one(s, old_recovery, new_recovery, 'old recovery block')

# On official Deriv settlement, remember the exact lost parameters and keep recovery armed until a real win.
old_settle = """        if (autoNextTradeRef.current) {
          autoNextTradeRef.current = false;
        }
        return;
"""
new_settle = """        if (won) {
          recoveryTradeRef.current = null;
        } else if (autoNextTradeRef.current) {
          recoveryTradeRef.current = {
            symbol: settledTrade.symbol,
            contractType: settledTrade.contractType,
            targetValue: settledTrade.targetValue,
            stake: settledTrade.stake,
            payout: settledTrade.payout,
            entryPrice: settledTrade.exitPrice,
            entryDigit: settledTrade.exitDigit,
          };
          setAutoRecoveryNotice(`Loss on ${settledTrade.symbol}. Same ${settledTrade.contractType} target ${settledTrade.targetValue} armed for the next real Deriv tick.`);
        }
        return;
"""
s = one(s, old_settle, new_settle, 'settlement recovery')

# Add the ZIP backtester to navigation.
s = one(s, "              ['RECOVERY', 'Recovery Strategy', ShieldCheck],\n", "              ['RECOVERY', 'Recovery Strategy', ShieldCheck],\n              ['BACKTEST', 'Winning Setup Backtester', Activity],\n", 'backtest nav')

# Wire manual MATCHES/DIFFERS digit choice into the actual live configuration.
old_analyzer = """            sampleSize={sampleSize}
            onSampleSizeChange={setSampleSize}
          />
"""
new_analyzer = """            sampleSize={sampleSize}
            onSampleSizeChange={setSampleSize}
            onSelectTargetDigit={(digit, type) => {
              const nextConfig: AutoMatchesConfig = {
                ...autoMatchesConfigRef.current,
                contractMode: type,
                targetStrategy: 'CUSTOM',
                customTargetDigit: digit,
              };
              setAutoMatchesConfig(nextConfig);
              autoMatchesConfigRef.current = nextConfig;
              try { localStorage.setItem('deriv_auto_matches_config', JSON.stringify(nextConfig)); } catch {}
              showNotice(`${type} target digit ${digit} loaded into the real Auto Trader.`);
            }}
          />
"""
s = one(s, old_analyzer, new_analyzer, 'manual target wiring')

# Render the ZIP backtester and let its Apply-to-Live button update the real Auto bot.
recovery_render = """        {(activeTab === 'SYSTEM' || activeTab === 'OVERVIEW' || activeTab === 'RECOVERY') && (
          <SuperRecoveryManager
"""
backtest_render = """        {activeTab === 'BACKTEST' && (
          <StrategyBacktesterTab
            currentSymbol={currentSymbol}
            marketTicks={marketTickDataRef.current}
            onApplyStrategyToLiveBot={(partial) => {
              const nextConfig: AutoMatchesConfig = { ...autoMatchesConfigRef.current, ...partial };
              setAutoMatchesConfig(nextConfig);
              autoMatchesConfigRef.current = nextConfig;
              try { localStorage.setItem('deriv_auto_matches_config', JSON.stringify(nextConfig)); } catch {}
              showNotice('Backtested setup loaded into the real Auto Trader.');
            }}
            onNavigateToTrader={() => setActiveTab('DEEP_SCAN')}
          />
        )}

""" + recovery_render
s = one(s, recovery_render, backtest_render, 'backtester render')

# Floating bar must show the target the live bot would actually use.
return_anchor = "  const currentBalance = liveBalance;\n\n  return (\n"
calc = """  const currentBalance = liveBalance;
  const currentAutoSignal = currentAnalysis
    ? findBestAutoMatchesTarget(currentSymbol, currentAnalysis.displayName, digits, currentAnalysis.digitStats, lastDigit)
    : null;
  const currentDiffersTarget = findBestDiffersTarget(digits, lastDigit).targetDigit;
  const displayedAutoTarget = autoMatchesConfig.contractMode === 'MATCHES'
    ? autoMatchesConfig.customTargetDigit !== undefined
      ? autoMatchesConfig.customTargetDigit
      : autoMatchesConfig.targetStrategy === 'MARKOV_TRANSITION'
        ? currentAutoSignal?.targetDigit ?? currentAnalysis?.hotDigit
        : autoMatchesConfig.targetStrategy === 'REPEAT_ENTRY'
          ? lastDigit
          : currentAnalysis?.hotDigit
    : currentDiffersTarget;

  return (
"""
s = one(s, return_anchor, calc, 'display target calc')

count = s.count("        targetDigit={currentAnalysis?.hotDigit}\n")
if count != 2:
    raise SystemExit(f'target display: expected 2 matches, found {count}')
s = s.replace("        targetDigit={currentAnalysis?.hotDigit}\n", "        targetDigit={displayedAutoTarget}\n")
write(p, s)

# Bulk WIN/MATCHES waves must use the same ZIP target engines as the main bot.
p = 'src/components/BulkMultiTrader.tsx'
s = read(p)
s = one(s, "import React, { useState, useEffect, useRef, useMemo } from 'react';\n", "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { findBestAutoMatchesTarget, findBestDiffersTarget } from '../utils/autoMatchesEngine';\n", 'bulk engine import')
old = """        if (config.strategy === 'ULTRA_DIFFERS_WAVE') {
          // Find coldest digit with largest delay
          const coldest = item.digitStats.reduce((min, cur) => (cur.percentage < min.percentage ? cur : min), item.digitStats[0]);
          recommendedContract = 'DIFFERS';
          recommendedTarget = coldest ? coldest.digit : item.coldDigit;
          score = coldest ? Math.min(96, Math.max(70, Math.round((100 - coldest.percentage) * 0.98 + (coldest.delay > 15 ? 8 : 0)))) : 85;
          rationale = `Coldest digit #${recommendedTarget} (only ${coldest?.percentage.toFixed(1)}% freq, delay ${coldest?.delay || 0} ticks)`;
"""
new = """        if (config.strategy === 'ULTRA_DIFFERS_WAVE') {
          const differs = findBestDiffersTarget(marketTicks[item.symbol]?.digits || [], item.lastDigit);
          recommendedContract = 'DIFFERS';
          recommendedTarget = differs.targetDigit;
          score = Math.round(differs.winProbability);
          rationale = `Win Shield target #${recommendedTarget} (${differs.digitFrequency.toFixed(1)}% observed frequency, delay ${differs.delay} ticks)`;
"""
s = one(s, old, new, 'bulk differs')
old = """        } else if (config.strategy === 'MATCHES_SNIPER_WAVE') {
          const hottest = item.digitStats.reduce((max, cur) => (cur.percentage > max.percentage ? cur : max), item.digitStats[0]);
          recommendedContract = 'MATCHES';
          recommendedTarget = hottest ? hottest.digit : item.hotDigit;
          score = hottest ? Math.round(hottest.percentage * 4.5 + 20) : 60;
          rationale = `Hot cluster digit #${recommendedTarget} (~9.5x payout sniper)`;
        }
"""
new = """        } else if (config.strategy === 'MATCHES_SNIPER_WAVE') {
          const signal = findBestAutoMatchesTarget(
            item.symbol,
            item.displayName,
            marketTicks[item.symbol]?.digits || [],
            item.digitStats,
            item.lastDigit,
          );
          recommendedContract = 'MATCHES';
          recommendedTarget = signal.targetDigit;
          score = Math.round(signal.probabilityScore);
          rationale = signal.rationale;
        }
"""
s = one(s, old, new, 'bulk matches')
write(p, s)

print('full ZIP WIN/MATCHES wiring applied')
