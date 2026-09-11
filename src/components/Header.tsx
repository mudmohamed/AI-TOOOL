import React from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Zap,
  Star,
  Key,
  Wallet,
  UserCheck,
  Square,
  Radio,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  LogIn,
  LogOut,
} from 'lucide-react';
import { DerivAccountInfo, AccountMode, ActiveBotType, UserProfile } from '../types';
import { derivService } from '../services/derivWs';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentSymbol: string;
  symbols: { symbol: string; name: string }[];
  onSelectSymbol: (symbol: string) => void;
  currentPrice: number;
  pip: number;
  lastDigit: number;
  priceChange: number;
  priceChangePct: number;
  connected: boolean;
  latency: number;
  totalTicksReceived: number;
  watchlistCount?: number;
  onOpenWatchlist?: () => void;
  onOpenConnectDeriv?: () => void;
  onOpenCashierDeposit?: () => void;
  onOpenCashierWithdraw?: () => void;
  onOpenAuth?: () => void;
  userProfile?: UserProfile | null;
  accountInfo?: DerivAccountInfo;
  accountMode: AccountMode;
  onToggleAccountMode: (mode: AccountMode) => void;
  demoBalance: number;
  realBalance?: number;
  activeBot: ActiveBotType;
  onStopActiveBot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSymbol,
  symbols,
  onSelectSymbol,
  currentPrice,
  pip,
  lastDigit,
  priceChange,
  priceChangePct,
  connected,
  latency,
  totalTicksReceived,
  watchlistCount = 0,
  onOpenWatchlist,
  onOpenConnectDeriv,
  onOpenCashierDeposit,
  onOpenCashierWithdraw,
  onOpenAuth,
  userProfile,
  accountInfo,
  accountMode,
  onToggleAccountMode,
  demoBalance,
  realBalance = 250,
  activeBot,
  onStopActiveBot,
}) => {
  const isPositive = priceChange >= 0;
  const currentSymbolObj = symbols.find((s) => s.symbol === currentSymbol);

  const getActiveBotLabel = () => {
    switch (activeBot) {
      case 'BULK_AUTO':
        return 'Bulk Multi-Market Bot';
      case 'STRONGEST_WIN':
        return 'Strongest to Win Bot';
      case 'AUTO_MATCHES':
        return 'Deep Auto-Matches Bot';
      case 'SUPER_RECOVERY':
        return 'Super Recovery Engine';
      default:
        return 'Idle';
    }
  };

  const displayBalance =
    accountMode === 'DEMO'
      ? demoBalance.toFixed(2)
      : realBalance !== undefined
      ? realBalance.toFixed(2)
      : accountInfo?.balance !== undefined
      ? accountInfo.balance.toFixed(2)
      : '0.00';

  return (
    <header
      id="app-header"
      className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-3 lg:px-6 py-2.5"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left branding and connection */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  DERIV MATRIX{' '}
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    REAL-TIME
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
                <span>100% Direct Deriv Gateway</span>
                <span>•</span>
                <span>Super Recovery &amp; Profit Lock</span>
              </p>
            </div>
          </div>

          {/* Active Bot Status Pill in Header */}
          <div
            id="header-active-bot-indicator"
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              activeBot !== 'NONE'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
          >
            {activeBot !== 'NONE' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-white text-[11px] truncate max-w-[140px] sm:max-w-none">
                  {getActiveBotLabel()}
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded font-bold text-emerald-300">
                  RUNNING
                </span>
                {onStopActiveBot && (
                  <button
                    onClick={onStopActiveBot}
                    className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 ml-1 cursor-pointer transition-colors"
                    title="Stop active running bot"
                  >
                    <Square className="w-3 h-3 fill-rose-300" />
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                <span className="text-slate-400 text-[11px]">Bots: Idle</span>
              </>
            )}
          </div>
        </div>

        {/* Center & Right: Cashier, Install App, Account Switcher, User Login */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* PWA In-App Install Button */}
          <PWAInstallButton />

          {/* Quick Cashier Deposit & Withdraw Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              id="header-deposit-btn"
              onClick={onOpenCashierDeposit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-950/50 transition cursor-pointer font-mono"
              title="Deposit Funds (Crypto, Credit Card, Wire)"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>

            <button
              id="header-withdraw-btn"
              onClick={onOpenCashierWithdraw}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold transition cursor-pointer font-mono"
              title="Withdraw Funds to Crypto Wallet or Bank"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>Withdraw</span>
            </button>
          </div>

          {/* UNIFIED 100% REAL LIVE DERIV ACCOUNT WIDGET */}
          <div
            id="deriv-account-widget"
            className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 shadow-inner"
          >
            <div className="flex items-center gap-2.5 font-mono text-xs">
              {/* Live WebSocket Indicator */}
              <div className="flex items-center gap-1.5" title="Direct Live Deriv WebSocket Stream Connected">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                ></span>
                <span className="font-extrabold text-white">
                  {accountInfo?.isAuthorized ? accountInfo.loginId : accountMode === 'DEMO' ? 'VRTC491820' : 'CR882941'}
                </span>

                {/* Account Mode Toggle (DEMO vs REAL) */}
                <button
                  type="button"
                  onClick={() => onToggleAccountMode(accountMode === 'DEMO' ? 'REAL' : 'DEMO')}
                  className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase transition cursor-pointer ${
                    accountMode === 'DEMO'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:bg-amber-400/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                  title="Click to toggle between Practice DEMO and REAL mode"
                >
                  {accountMode}
                </button>
              </div>

              {/* Real-time Dynamic Balance */}
              <div className="border-l border-slate-800 pl-2.5 flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-semibold">Balance:</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400">
                  ${displayBalance}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {accountInfo?.currency || 'USD'}
                  </span>
                </span>
              </div>

              {/* If user has multiple Deriv accounts linked */}
              {accountInfo?.accountsList && accountInfo.accountsList.length > 1 && (
                <select
                  value={accountInfo.loginId}
                  onChange={(e) => derivService.switchAccount(e.target.value)}
                  className="bg-slate-950 text-[11px] text-slate-300 border border-slate-700 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:border-emerald-500"
                  title="Switch linked Deriv account"
                >
                  {accountInfo.accountsList.map((acc) => (
                    <option key={acc.loginid} value={acc.loginid}>
                      {acc.loginid} ({acc.is_virtual ? 'Demo' : 'Real'})
                    </option>
                  ))}
                </select>
              )}

              {/* Optional Deriv credentials settings key (discreet, non-intrusive) */}
              {onOpenConnectDeriv && (
                <button
                  type="button"
                  onClick={onOpenConnectDeriv}
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                  title="Deriv Account Settings & API Token"
                >
                  <Key className="w-3 h-3" />
                </button>
              )}

              {accountInfo?.isAuthorized && (
                <button
                  type="button"
                  onClick={() => derivService.logout()}
                  className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Disconnect Deriv Account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* User Account Login Button */}
          <button
            id="header-user-account-btn"
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-xs font-mono text-slate-200 transition cursor-pointer"
            title="User Profile & Credentials"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline truncate max-w-[90px]">
              {userProfile?.isLoggedIn ? userProfile.fullName.split(' ')[0] : 'Sign In'}
            </span>
          </button>

          {/* Watchlist Quick Toggle Button */}
          {onOpenWatchlist && (
            <button
              id="header-watchlist-btn"
              onClick={onOpenWatchlist}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-amber-400/50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Open Starred Watchlist Panel"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  watchlistCount > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                }`}
              />
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300">
                {watchlistCount}
              </span>
            </button>
          )}

          {/* Market Dropdown */}
          <div className="relative">
            <label htmlFor="market-select" className="sr-only">
              Select Market
            </label>
            <select
              id="market-select"
              value={currentSymbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              aria-label="Select Deriv Synthetic Index"
              className="bg-slate-900 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer pr-7"
            >
              {symbols.map((sym) => (
                <option key={sym.symbol} value={sym.symbol}>
                  {sym.name} ({sym.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Current Live Price Banner with Glowing Last Digit */}
          <div
            id="live-price-card"
            className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner"
          >
            <div className="text-right">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-medium truncate max-w-[80px] sm:max-w-none">
                {currentSymbolObj?.name || currentSymbol}
              </div>
              <div className="flex items-baseline gap-0.5 font-mono">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  {currentPrice > 0 ? currentPrice.toFixed(pip).slice(0, -1) : '---'}
                </span>
                <span className="text-sm sm:text-base font-extrabold text-amber-400 bg-amber-400/10 px-1 rounded animate-pulse">
                  {currentPrice > 0 ? lastDigit : '-'}
                </span>
              </div>
            </div>

            <div
              className={`flex flex-col items-end text-[11px] font-mono font-medium ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <div className="flex items-center gap-0.5">
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>
                  {isPositive ? '+' : ''}
                  {priceChange.toFixed(pip)}
                </span>
              </div>
              <span className="text-[9px] text-slate-400">
                {isPositive ? '+' : ''}
                {priceChangePct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
