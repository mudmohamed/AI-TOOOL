/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Square,
  Zap,
  Target,
  ShieldCheck,
  Key,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Settings,
  Bot,
  Radio,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AutoMatchesConfig, DerivAccountInfo, TradeRecord } from '../types';

type ExtendedAutoMatchesConfig = AutoMatchesConfig & {
  stopConditionMode?: 'ONLY_MANUAL_OR_TARGET' | 'STOP_ON_MAX_LOSS';
  profitShieldActive?: boolean;
  profitLockEnabled?: boolean;
  profitLockTarget?: number;
  fixedStakeMode?: boolean;
  maxStakeCap?: number;
  maxAllowedLosses?: number;
  contractMode?: 'DIFFERS' | 'OVER_UNDER' | 'MATCHES';
  onlyWhenSignalConfirmed?: boolean;
};

interface SessionStats {
  totalTrades: number;
  wins: number;
  losses: number;
  netProfit: number;
  consecutiveLosses: number;
  cumulativeLoss: number;
  peakDrawdown: number;
}

interface AutoTradingSystemHeroProps {
  isRunning: boolean;
  onToggleRun: (running: boolean) => void;
  config: ExtendedAutoMatchesConfig;
  onConfigChange: (config: ExtendedAutoMatchesConfig) => void;
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  symbols: { symbol: string; name: string }[];
  currentPrice: number;
  lastDigit: number;
  pip: number;
  targetDigit?: number;
  accountInfo: DerivAccountInfo;
  sessionStats: SessionStats;
  tradeHistory: TradeRecord[];
  onOpenSafetyModal: () => void;
  onOpenConnectModal: () => void;
  onResetSession: () => void;
  onVaultWonProfit?: () => void;
}

export const AutoTradingSystemHero: React.FC<AutoTradingSystemHeroProps> = ({
  isRunning,
  onToggleRun,
  config,
  onConfigChange,
  currentSymbol,
  onSelectSymbol,
  symbols,
  currentPrice,
  lastDigit,
  pip,
  targetDigit,
  accountInfo,
  sessionStats,
  tradeHistory,
  onOpenSafetyModal,
  onOpenConnectModal,
  onResetSession,
  onVaultWonProfit,
}) => {
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);

  const tpTarget = config.expectedProfit || 10000;
  const currentNetProfit = sessionStats.netProfit || 0;
  const tpProgressPct = Math.min(100, Math.max(0, Number(((currentNetProfit / tpTarget) * 100).toFixed(1))));
  const is247NonStop = (config.stopConditionMode || 'ONLY_MANUAL_OR_TARGET') === 'ONLY_MANUAL_OR_TARGET';
  const isAuthorized = Boolean(accountInfo.isAuthorized);
  const isRealAccount = isAuthorized && !accountInfo.isVirtual && accountInfo.loginId !== 'VRTC-PRACTICE';

  const handleSwitchToDemo = () => {
    setTokenNotice('Choose DEMO in the secure Deriv account selector.');
    onOpenConnectModal();
  };

  const handleQuickStakeChange = (stakeVal: number) => {
    onConfigChange({
      ...config,
      stake: stakeVal,
      winAmount: stakeVal,
    });
  };

  const handleQuickTpChange = (targetVal: number) => {
    onConfigChange({
      ...config,
      expectedProfit: targetVal,
    });
  };

  const winRate = sessionStats.totalTrades > 0
    ? ((sessionStats.wins / sessionStats.totalTrades) * 100).toFixed(1)
    : '0.0';

  return (
    <section
      id="auto-trading-system-hero"
      className="rounded-3xl border-2 border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-5 sm:p-7 shadow-2xl relative overflow-hidden"
    >
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Main Header & Live System Status Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800 relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-black flex items-center gap-1.5 tracking-wider uppercase shadow-inner">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              DERIV 24/7 AUTO-TRADING SYSTEM
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-black flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-emerald-500 text-slate-950 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-slate-950' : 'bg-amber-400'}`} />
              {isRunning ? 'SYSTEM RUNNING 24/7 (NON-STOP)' : 'SYSTEM IDLE / READY'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold">
              TP TARGET: ${tpTarget.toLocaleString()} USD
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Auto-Matches & Recovery Trading System
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Continuously executes high-probability Matches & Differs contracts on Deriv Volatility Indices.
            Engineered to run continuously tick-after-tick until stopped by you or when reaching your $10,000 profit goal.
          </p>
        </div>

        {/* Primary START / STOP Large Action Button */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              id="system-stop-btn"
              type="button"
              onClick={() => onToggleRun(false)}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl transition cursor-pointer border-2 border-rose-400"
            >
              <Square className="w-5 h-5 fill-white" />
              <span>STOP SYSTEM NOW</span>
            </button>
          ) : (
            <button
              id="system-start-btn"
              type="button"
              onClick={() => onToggleRun(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:shadow-[0_0_35px_rgba(16,185,129,0.65)] transition cursor-pointer border-2 border-emerald-300"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>START SYSTEM (RUN 24/7)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSafetyModal}
            className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-emerald-500/50 transition cursor-pointer"
            title="Configure System Targets & 24/7 Rules"
          >
            <Settings className="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Account Verification & 100% Real Live Connection Strip */}
      <div className="mt-4 p4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-4 relative z-h10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isRealAccount
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                : isAuthorized
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-rose-500/20 border-rose-500/50 text-rose-400'
              }`}
            >
              {isRealAccount ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <Key className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-mono font-bold flex items-center gap-2">
                <span className="text-slate-400 uppercase tracking-wider">Trading Mode:</span>
                <span
                  className={`font-black ${
                    isRealAccount
                      ? 'text-emerald-400'
                      : isAuthorized
                      ? 'text-cyan-300'
                      : 'text-rose-400'
                  }`}
                >
                  {isRealAccount
                    ? `ðŸŸ 100% REAL LIVE ACCOUNT (${accountInfo.loginId})`
                    : isAuthorized
                    ? `PRACTICE DEMO (${accountInfo.loginId})`
                    : 'NO REAL ACCOUNT CONNECTED'}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono flex items-center gap-2 mt-0.5">
                <span>
                  Real Deriv Balance: {'}
                  <strong className="text-white font-bold">
                    {accountInfo.balance !== undefined ? `${accountInfo.balance.toFixed(2)} ${accountInfo.currency || 'USD'}` : 'â€•'}
                  </strong>
                </span>
                <span>â€¢</span>
                <span className="text-slate-400">
                  {isRealAccount
                    ? 'Connected directly to Deriv live matching engine'
                    : 'Use the secure Deriv account selector to connect REAL or DEMO'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isRealAccount ? (Bˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\Lˆ‚ˆÜ[ˆÛ\ÜÓ˜[YOHœLÈKLKH›Ý[™Y^™ËY[Y\˜[MLÌŒ›Ü™\ˆ›Ü™\‹Y[Y\˜[MLÍŒ^Y[Y\˜[LÌ^^È›Û[[Û›È›ÛX›Û›^][\ËXÙ[\ˆØ\LKH‚ˆÚXÚÐÚ\˜ÛLˆÛ\ÜÓ˜[YOHËLËHLËH^Y[Y\˜[MˆÏ‚ˆÜ[ŒL	H‘PSU‘H‘PQOÜÜ[‚ˆÜÜ[‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ú[™TÝÚ]ÚÑ[[ßBˆÛ\ÜÓ˜[YOHœLÈKLKH›Ý[™Y^™Ë\Û]KNÝ™\Ž˜™Ë\Û]KMÌ^\Û]KLÌ^^È›Û[[Û›È˜[œÚ][ÛˆÝ\œÛÜ‹\Ú[\ˆ‚ˆ‚ˆÝÚ]ÚÈ[[ÂˆØ]Û‚ˆÙ]‚ˆ
Hˆ
ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ú[™TÝÚ]ÚÑ[[ßBˆÛ\ÜÓ˜[YOHœLÈKLKH›Ý[™Y^™ËXÞX[‹NMLÍŒ›Ü™\ˆ›Ü™\‹XÞX[‹MLÍ^XÞX[‹LÌÝ™\Ž˜™ËXÞX[‹NLÍŒ^^È›Û[[Û›È˜[œÚ][ÛˆÝ\œÛÜ‹\Ú[\ˆ‚ˆ‚ˆ\ÙH˜XÝXÙH[[È
	LÊBˆØ]Û‚ˆ
_B‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^ÛÛ“Ü[ÛÛ›™XÝ[Ù[BˆÛ\ÜÓ˜[YOHœLÈKLKH›Ý[™Y^™Ë\Û]KNÝ™\Ž˜™Ë\Û]KMÌ^\Û]KLÌ›Ü™\ˆ›Ü™\‹\Û]KMÌ^^È›Û[[Û›È˜[œÚ][Ûˆ›^][\ËXÙ[\ˆØ\LKHÝ\œÛÜ‹\Ú[\ˆ‚ˆ‚ˆÙ][™ÜÈÛ\ÜÓ˜[YOHËLËHLËH^Y[Y\˜[MˆÏ‚ˆÜ[ÛÛ›™XÝ[ÛˆÙ][™ÜÏÜÜ[‚ˆØ]Û‚ˆÙ]‚ˆÙ]‚‚ˆËÊˆÙXÝ\™H\š]ˆXØÛÝ[Ù[XÝÜŽˆÙY\ÈÜ™Y[X[ÈÝ]ÙˆHœ›ÝÜÙ\ˆRKˆ
‹ßBˆÈZ\Ô™X[XØÛÝ[	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOHœLÈ›Ü™\‹]›Ü™\‹\Û]KNÎ›^›^XÛÛÛN™›^\›ÝÈØ\L‹H][\Ë\Ý™]ÚÛNš][\ËXÙ[\ˆ‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ê
HOˆÂˆÙ]ÚÙ[“›ÝXÙJ	ÓÜ[ˆHÙXÝ\™H\š]ˆÙ[XÝÜˆ[™ÚÛÜÙH‘PSÜˆSSË‰ÊNÂˆÛ“Ü[ÛÛ›™XÝ[Ù[

NÂˆ_BˆÛ\ÜÓ˜[YOHœMHKL‹H›Ý[™Y^™ËY[Y\˜[MLÝ™\Ž˜™ËY[Y\˜[M^\Û]KNML›ÛX›XÚÈ^^È›Û[[Û›È˜[œÚ][Ûˆ›^][\ËXÙ[\ˆ\ÝYžKXÙ[\ˆØ\LˆÝ\œÛÜ‹\Ú[\ˆÚYÝË[ÈÚYÝËY[Y\˜[MLÌH‚ˆ‚ˆÚY[ÚXÚÈÛ\ÜÓ˜[YOHËMMˆÏ‚ˆÜ[ÓÓ“‘PÕT’Uˆ‘PSÈSSÏÜÜ[‚ˆØ]Û‚ˆÜ[ˆÛ\ÜÓ˜[YOH^VÌL\H^\Û]KM›Û[[Û›È”ÙXÝ\™HXØÛÝ[›ÝÈ8 %›ÈTHÚÙ[ˆ\ÈÝÜ™Y[ˆ\È\Ú›Ø\™ÜÜ[‚ˆÙ]‚ˆ
_BˆÙ]‚‚ˆÝÚÙ[“›ÝXÙH	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH›]LˆL‹H›Ý[™Y^™ËY[Y\˜[NMLÍŒ›Ü™\ˆ›Ü™\‹Y[Y\˜[MLÍ^YÈ›Û[[Û›È^Y[Y\˜[LÌ›^][\ËXÙ[\ˆØ\Lˆ‚ˆ˜\Û\ÜÓ˜[YOHËLËHLËH^Y[Y\˜[MÚš[šËLˆÏ‚ˆÜ[žÝÚÙ[“›ÝXÙ_OÜÜ[‚ˆÙ]‚ˆ
_B‚ˆËÊˆZÙH›Ùš]	L\™Ù]›ÙÜ™\ÜÈ˜\ˆ	ˆ]™HÝ]ÈÜšY
‹ßBˆ]ˆÛ\ÜÓ˜[YOH›]MHÜšYÜšYXÛÛËLHÛN™ÜšYXÛÛËLˆÎ™ÜšYXÛÛËMØ\LÈ™[]]™H‹LL‚ˆËÊˆY]šXÈNˆZÙH›Ùš]ÛØ[
	L
H
‹ßBˆ]ˆÛ\ÜÓ˜[YOHœM›Ý[™YLž™Ë\Û]KNLÎ›Ü™\ˆ›Ü™\‹\Û]KNÜXÙK^KLˆ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ^^È^\Û]KM›Û[[Û›È‚ˆÜ[•RÑH“Ñ’UÓÐSÜÜ[‚ˆÜ[ˆÛ\ÜÓ˜[YOH^XÞX[‹M›ÛX›ÛžÝ›ÙÜ™\ÜÔÝIOÜÜ[‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^Lž›ÛX›XÚÈ^]Ú]H›Û[[Û›È›^][\ËX˜\Ù[[™HØ\LH‚ˆÜ[‰Ý\™Ù]ÓØØ[TÝš[™Ê
_OÜÜ[‚ˆÜ[ˆÛ\ÜÓ˜[YOH^^È^\Û]KM›Û[›Ü›X[•TÑÜÜ[‚ˆÙ]‚ˆËÊˆ›ÙÜ™\ÜÈ˜\ˆ
‹ßBˆ]ˆÛ\ÜÓ˜[YOHËY[Lˆ›Ý[™YY[™Ë\Û]KNÝ™\™›ÝËZY[ˆ‚ˆ]‚ˆÛ\ÜÓ˜[YOHšY[™ËYÜ˜YY[]Ë\ˆœ›ÛKXÞX[‹MLËY[Y\˜[M˜[œÚ][Û‹X[\˜][Û‹ML‚ˆÝ[O^ÞÈÚYˆ	ÓX]›X^
‹›ÙÜ™\ÜÔÝ
_IX_BˆÏ‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^VÌL\H^\Û]KM›Û[[Û›È›^\ÝYžKX™]ÙY[ˆ‚ˆÜ[“™]ˆÝ›Û™ÈÛ\ÜÓ˜[YO^ØÝ\œ™[™]›Ùš]HÈ	Ý^Y[Y\˜[M	Èˆ	Ý^\›ÜÙKM	ßO‰ØÝ\œ™[™]›Ùš]Ñš^Y
Š_OÜÝ›Û™ÏÜÜ[‚ˆÜ[•\™Ù]ˆ	Ý\™Ù]ÓØØ[TÝš[™Ê
_OÜÜ[‚ˆÙ]‚ˆÙ]‚‚ˆËÊˆY]šXÈŽˆÝÜ[ÙH	ˆ[H
‹ßBˆ]ˆÛ\ÜÓ˜[YOHœM›Ý[™YLž™Ë\Û]KNLÎ›Ü™\ˆ›Ü™\‹\Û]KNÜXÙK^KLˆ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ^^È^\Û]KM›Û[[Û›È‚ˆÜ[”ÖTÕSH•SˆSÑOÜÜ[‚ˆÚY[ÚXÚÈÛ\ÜÓ˜[YOHËLËHLËH^Y[Y\˜[MˆÏ‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^X˜\ÙH›ÛX›XÚÈ^Y[Y\˜[LÌ›Û[[Û›ÈXY[™Ë]YÚ‚ˆÚ\ÌÓ›Û”ÝÜÈ	ÌÍÈ“Ó‹TÕÔ	Èˆ	ÔÐQ‘UH“ÕS‘Q	ßBˆÙ]‚ˆÛ\ÜÓ˜[YOH^VÌL\H^\Û]KM›Û[[Û›ÈXY[™Ë]YÚ‚ˆÚ[›ÝÝÜÛˆÜÜÙ\Ëˆ[œÈÛÛ[[Ý\ÛH[[X[X[ÕÔÜˆ	L‚ˆÜ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\LKHLH‚ˆÜ[ˆÛ\ÜÓ˜[YOHËLˆLˆ›Ý[™YY[™ËY[Y\˜[M[š[X]K\[™ÈˆÏ‚ˆÜ[ˆÛ\ÜÓ˜[YOH^VÌLH^Y[Y\˜[M›Û[[Û›È›ÛX›Û\\˜Ø\ÙHÛÛ[[Ý\ÈÛÜXÝ]™OÜÜ[‚ˆÙ]‚ˆÙ]‚‚ˆËÊˆY]šXÈÎˆ]™HX\šÙ]	ˆ\™Ù]YÚ]
‹ßBˆ]ˆÛ\ÜÓ˜[YOHœM›Ý[™YLž™Ë\Û]KNLÎ›Ü™\ˆ›Ü™\‹\Û]KNÜXÙK^KLˆ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ^^È^\Û]KM›Û[[Û›È‚ˆÜ[PÕU‘HPT’ÑU	ˆQÒUÜÜ[‚ˆ\™Ù]Û\ÜÓ˜[YOHËLËHLËH^X[X™\‹MˆÏ‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ‚ˆ]‚ˆ]ˆÛ\ÜÓ˜[YOH^X˜\ÙH›ÛX›XÚÈ^]Ú]H›Û[[Û›ÈžØÝ\œ™[Þ[X›ÛOÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^^È^\Û]KM›Û[[Û›È‚ˆ][ÝNˆÜ[ˆÛ\ÜÓ˜[YOH^\Û]KLŒžØÝ\œ™[šXÙHˆÈÝ\œ™[šXÙKÑš^Y
\
Hˆ	ø %	ßOÜÜ[‚ˆÙ]‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^\šYÚ‚ˆ]ˆÛ\ÜÓ˜[YOH^VÌLH^\Û]KM›Û[[Û›È•T‘ÑUQÒUÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^Lž›ÛX›XÚÈ^X[X™\‹M›Û[[Û›È™ËX[X™\‹MÌLL‹HKLH›Ý[™Y[È›Ü™\ˆ›Ü™\‹X[X™\‹MÌÌ‚ˆÝ\™Ù]YÚ]OOH[™Yš[™YÈ\™Ù]YÚ]ˆ\ÝYÚ]BˆÙ]‚ˆÙ]‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^VÌL\H^\Û]KM›Û[[Û›È›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ‚ˆÜ[“\ÝYÚ]ˆÝ›Û™ÈÛ\ÜÓ˜[YOH^X[X™\‹LÌ›Û[[Û›È^^ÈžÛ\ÝYÚ]OÜÝ›Û™ÏÜÜ[‚ˆÜ[ˆÛ\ÜÓ˜[YOH^Y[Y\˜[M›ÛX›Û“X]Ú\ËÑY™™\œÏÜÜ[‚ˆÙ]‚ˆÙ]‚‚ˆËÊˆY]šXÈˆÙ\ÜÚ[Ûˆ^XÝ][Ûˆ™XÛÜ™
‹ßBˆ]ˆÛ\ÜÓ˜[YOHœM›Ý[™YLž™Ë\Û]KNLÎ›Ü™\ˆ›Ü™\‹\Û]KNÜXÙK^KLˆ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆ^^È^\Û]KM›Û[[Û›È‚ˆÜ[”ÑTÔÒSÓˆT‘“Ô“PSÑOÜÜ[‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^ÛÛ”™\Ù]Ù\ÜÚ[ÛŸBˆÛ\ÜÓ˜[YOH^\Û]KMLÝ™\Ž^\Û]KLÌ˜[œÚ][ÛˆÝ\œÛÜ‹\Ú[\ˆLH‚ˆ]OH”™\Ù]Ù\ÜÚ[ÛˆÝ]È‚ˆ‚ˆ›Ý]PØÝÈÛ\ÜÓ˜[YOHËLËHLËHˆÏ‚ˆØ]Û‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËX˜\Ù[[™H\ÝYžKX™]ÙY[ˆ‚ˆ]ˆÛ\ÜÓ˜[YOH^^›ÛX›XÚÈ^]Ú]H›Û[[Û›È‚ˆÜÙ\ÜÚ[Û”Ý]ËÚ[œßUÈÜ[ˆÛ\ÜÓ˜[YOH^\Û]KML‹ÏÜÜ[ˆÜÙ\ÜÚ[Û”Ý]Ë›ÜÜÙ\ßSˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^^È›Û[[Û›È›ÛX›Û^Y[Y\˜[M‚ˆÝÚ[”˜]_IHÚ[‚ˆÙ]‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH^VÌL\H^\Û]KM›Û[[Û›È›^\ÝYžKX™]ÙY[ˆ‚ˆÜ[•˜Y\ÎˆÝ›Û™ÏžÜÙ\ÜÚ[Û”Ý]ËÝ[˜Y\ßOÜÝ›Û™ÏÜÜ[‚ˆÜ[”Ý™XZÎˆÝ›Û™ÈÛ\ÜÓ˜[YOH^]Ú]HžÜÙ\ÜÚ[Û”Ý]Ë˜ÛÛœÙXÝ]]™SÜÜÙ\ßHÜÜÏÜÝ›Û™ÏÜÜ[‚ˆÙ]‚ˆØÝ\œ™[™]›Ùš]ˆ	‰ˆÛ•˜][ÛÛ”›Ùš]	‰ˆ
ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^ÛÛ•˜][ÛÛ”›Ùš]BˆÛ\ÜÓ˜[YOHËY[]LHKLH›Ý[™Y™ËY[Y\˜[MLÌŒÝ™\Ž˜™ËY[Y\˜[MLÌÌ^Y[Y\˜[LÌ^VÌLH›Û[[Û›È›ÛX›Û›Ü™\ˆ›Ü™\‹Y[Y\˜[MLÍ›^][\ËXÙ[\ˆ\ÝYžKXÙ[\ˆØ\LHÝ\œÛÜ‹\Ú[\ˆ˜[œÚ][Ûˆ‚ˆ‚ˆØÚÈÛ\ÜÓ˜[YOHËL‹HL‹H^Y[Y\˜[MˆÏ‚ˆÜ[•˜][›Ùš]

ÉØÝ\œ™[™]›Ùš]Ñš^Y
Š_JOÜÜ[‚ˆØ]Û‚ˆ
_BˆÙ]‚ˆÙ]‚‚ˆËÊˆ]ZXÚÈÙ][™ÜÈ	ˆ™\Ù]˜\œÈ
‹ßBˆ]ˆÛ\ÜÓ˜[YOH›]MM›Ü™\‹]›Ü™\‹\Û]KNÎ›^›^]Ü˜\][\ËXÙ[\ˆ\ÝYžKX™]ÙY[ˆØ\LÈ^^È›Û[[Û›È^\Û]KLÌ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\LÈ›^]Ü˜\‚ˆÜ[ˆÛ\ÜÓ˜[YOH^\Û]KM”]ZXÚÈÝZÙNÜÜ[‚ˆÖÌŒÍKKK‹WK›X\

˜[
HOˆ
ˆ]Û‚ˆÙ^O^Ý˜[Bˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ê
HOˆ[™T]ZXÚÔÝZÙPÚ[™ÙJ˜[
_BˆÛ\ÜÓ˜[YO^ØL‹HKLH›Ý[™Y[È›Ü™\ˆÝ\œÛÜ‹\Ú[\ˆ˜[œÚ][Ûˆ	Âˆ
ÛÛ™šYËœÝZÙHŒÍJHOOH˜[ˆÈ	Ø™ËY[Y\˜[ML^\Û]KNML›ÛX›Û›Ü™\‹Y[Y\˜[M	Âˆˆ	Ø™Ë\Û]KNLÝ™\Ž˜™Ë\Û]KN^\Û]KLÌ›Ü™\‹\Û]KMÌ	ÂˆXBˆ‚ˆ	Ý˜[BˆØ]Û‚ˆ
J_B‚ˆÜ[ˆÛ\ÜÓ˜[YOH^\Û]KM[Lˆ”]ZXÚÈÜÜ[‚ˆÖÌLLLŒK›X\

˜[
HOˆ
ˆ]Û‚ˆÙ^O^Ý˜[Bˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ê
HOˆ[™T]ZXÚÕÚ[™ÙJ˜[
_BˆÛ\ÜÓ˜[YO^ØL‹HKLH›Ý[™Y[È›Ü™\ˆÝ\œÛÜ‹\Ú[\ˆ˜[œÚ][Ûˆ	Âˆ\™Ù]OOH˜[ˆÈ	Ø™ËXÞX[‹ML^\Û]KNML›ÛX›Û›Ü™\‹XÞX[‹M	Âˆˆ	Ø™Ë\Û]KNLÝ™\Ž˜™Ë\Û]KN^\Û]KLÌ›Ü™\‹\Û]KMÌ	ÂˆXBˆ‚ˆ	Ý˜[ÓØØ[TÝš[™Ê
_BˆØ]Û‚ˆ
J_BˆÙ]‚‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\Lˆ‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^ÛÛ“Ü[”ØY™]S[Ù[BˆÛ\ÜÓ˜[YOH^Y[Y\˜[MÝ™\Ž[™\›[™H›^][\ËXÙ[\ˆØ\LH^^ÈÝ\œÛÜ‹\Ú[\ˆ›ÛX›Û‚ˆ‚ˆÜ[Y˜[˜ÙYØY™]H	ˆX\[™Ø[HÙ][™ÜÏÜÜ[‚ˆ\œ›ÝÔšYÚÛ\ÜÓ˜[YOHËLÈLÈˆÏ‚ˆØ]Û‚ˆÙ]‚ˆÙ]‚ˆÜÙXÝ[Û‚ˆ
NÂŸNÂ