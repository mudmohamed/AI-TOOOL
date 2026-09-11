import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Star,
  Square,
  ArrowDownLeft,
  ArrowUpRight,
  User,
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
  onOpenCashierDeposit,
  onOpenCashierWithdraw,
  onOpenAuth,
  userProfile,
  accountInfo,
  onToggleAccountMode,
  activeBot,
  onStopActiveBot,
}) => {
  const isPositive = priceChange >= 0;
  const currentSymbolObj = symbols.find((s) => s.symbol === currentSymbol);
  const actualMode: AccountMode = accountInfo?.isAuthorized
    ? accountInfo.isVirtual
      ? 'DEMO'
      : 'REAL'
    : 'REAL';
  const displayBalance = accountInfo?.isAuthorized && accountInfo.balance !== undefined
    ? accountInfo.balance.toFixed(2)
    : '—';

  const selectTradingMode = React.useCallback((requested: AccountMode) => {
    if (accountInfo?.isAuthorized) {
      const currentIsRequested = requested === actualMode;
      const linked = accountInfo.accountsList || [];
      const match = linked.find((account) => requested === 'DEMO' ? account.is_virtual : !account.is_virtual);
      if (currentIsRequested || match) {
        onToggleAccountMode(requested);
        return;
      }
    }

    try {
      localStorage.setItem('deriv_requested_mode', requested);
    } catch {}
    window.location.assign(derivService.getOAuthRedirectUrl());
  }, [accountInfo, actualMode, onToggleAccountMode]);

  React.useEffect(() => {
    if (!accountInfo?.isAuthorized) return;

    let requested: AccountMode | null = null;
    try {
      const saved = localStorage.getItem('deriv_requested_mode');
      requested = saved === 'DEMO' || saved === 'REAL' ? saved : null;
    } catch {}
    if (!requested) return;

    if (requested === actualMode) {
      try { localStorage.removeItem('deriv_requested_mode'); } catch {}
      return;
    }

    const linked = accountInfo.accountsList || [];
    const match = linked.find((account) => requested === 'DEMO' ? account.is_virtual : !account.is_virtual);
    if (match) onToggleAccountMode(requested);
    try { localStorage.removeItem('deriv_requested_mode'); } catch {}
  }, [accountInfo?.isAuthorized, accountInfo?.loginId, accountInfo?.accountsList, actualMode, onToggleAccountMode]);

  const getActiveBotLabel = () => {
    switch (activeBot) {
      case 'BULK_AUTO': return 'Bulk Multi-Market Bot';
      case 'STRONGEST_WIN': return 'Strongest Signal Bot';
      case 'AUTO_MATCHES': return 'Auto-Matches Bot';
      case 'SUPER_RECOVERY': return 'Recovery Engine';
      default: return 'Idle';
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-3 lg:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                DERIV MATRIX
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border ${connected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}`}>
                  {connected ? 'LIVE FEED' : 'OFFLINE'}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
                <span>Deriv WebSocket market data</span><span>•</span><span>{totalTicksReceived.toLocaleString()} ticks received</span>
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono ${activeBot !== 'NONE' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${activeBot !== 'NONE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="font-bold text-[11px]">{getActiveBotLabel()}</span>
            {activeBot !== 'NONE' && onStopActiveBot && (
              <button onClick={onStopActiveBot} className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300" title="Stop bot">
                <Square className="w-3 h-3 fill-rose-300" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <PWAInstallButton />

          <button onClick={onOpenCashierDeposit} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition font-mono">
            <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
          </button>
          <button onClick={onOpenCashierWithdraw} className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition font-mono">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Withdraw
          </button>

          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <div className="font-mono text-xs min-w-[118px]">
              <div className="font-extrabold text-white truncate max-w-[145px]">
                {accountInfo?.isAuthorized ? accountInfo.loginId : 'Choose account'}
              </div>
              <div className="text-[10px] text-slate-400">Balance: <span className="text-emerald-400 font-bold">{displayBalance} {accountInfo?.currency || ''}</span>{latency > 0 ? ` • ${latency}ms` : ''}</div>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => selectTradingMode('DEMO')}
                className={`px-2 py-1 rounded-md text-[9px] font-black font-mono transition ${accountInfo?.isAuthorized && actualMode === 'DEMO' ? 'bg-amber-400 text-slate-950' : 'text-amber-300 hover:bg-amber-400/15'}`}
                title="Use your Deriv demo account"
              >
                DEMO
              </button>
              <button
                type="button"
                onClick={() => selectTradingMode('REAL')}
                className={`px-2 py-1 rounded-md text-[9px] font-black font-mono transition ${accountInfo?.isAuthorized && actualMode === 'REAL' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-300 hover:bg-emerald-500/15'}`}
                title="Use your Deriv real account"
              >
                REAL
              </button>
            </div>

            {accountInfo?.isAuthorized && (
              <button onClick={() => derivService.logout()} className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Sign out of Deriv account">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button onClick={onOpenAuth} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-200 transition">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline truncate max-w-[90px]">{userProfile?.isLoggedIn ? userProfile.fullName.split(' ')[0] : 'Profile'}</span>
          </button>

          {onOpenWatchlist && (
            <button onClick={onOpenWatchlist} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition">
              <Star className={`w-3.5 h-3.5 ${watchlistCount > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
              <span className="text-[10px] font-mono">{watchlistCount}</span>
            </button>
          )}

          <select
            value={currentSymbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            className="bg-slate-900 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {symbols.map((sym) => <option key={sym.symbol} value={sym.symbol}>{sym.name}</option>)}
          </select>

          <div className="flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-right">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider truncate max-w-[100px]">{currentSymbolObj?.name || currentSymbol}</div>
              <div className="flex items-baseline gap-0.5 font-mono">
                <span className="text-sm font-bold text-white">{currentPrice > 0 ? currentPrice.toFixed(pip).slice(0, -1) : '—'}</span>
                <span className="text-base font-extrabold text-amber-400 bg-amber-400/10 px-1 rounded">{currentPrice > 0 ? lastDigit : '—'}</span>
              </div>
            </div>
            <div className={`flex flex-col items-end text-[10px] font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <div className="flex items-center gap-0.5">{isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}<span>{currentPrice > 0 ? `${isPositive ? '+' : ''}${priceChange.toFixed(pip)}` : '—'}</span></div>
              <span className="text-slate-400">{currentPrice > 0 ? `${isPositive ? '+' : ''}${priceChangePct.toFixed(2)}%` : '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
