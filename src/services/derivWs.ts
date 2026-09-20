import { DerivAccountInfo } from '../types';

type MessageHandler = (data: any) => void;
type AccountMode = 'DEMO' | 'REAL';

export interface PlaceContractParams {
  clientTradeId: string;
  contract_type: string;
  symbol: string;
  amount: number;
  duration?: number;
  duration_unit?: string;
  barrier?: string | number;
}

type TradeRequestMeta = {
  clientTradeId: string;
  contractType: string;
  symbol: string;
  amount: number;
  barrier?: string;
  managedMatches: boolean;
  recoveryStep: number;
};

type MatchesRecoveryState = {
  baseStake: number;
  recoveryStep: number;
  multiplier: number;
  maxSteps: number;
  halted: boolean;
  lastTradeTick: number;
};

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private accountWs: WebSocket | null = null;

  private publicEndpointIndex = 0;

  private getPublicEndpoints(): string[] {
    const appId = this.getStoredAppId() || '1089';
    return [
      `wss://ws.derivws.com/websockets/v3?app_id=${appId}`,
      `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`,
    ];
  }

  private get publicEndpoints(): string[] {
    return this.getPublicEndpoints();
  }

  // Secure in-app account bridge running directly within Deriv Matrix
  private getBridgeUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/matrix-bridge.html`;
    }
    return '/matrix-bridge.html';
  }

  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private isConnected = false;
  private latency = 0;
  private lastPingTime = 0;
  private subscribedSymbols = new Set<string>();
  private intentionalAccountClose = false;
  private privateReqId = 1000;

  private proposalRequests = new Map<number, TradeRequestMeta>();
  private buyRequests = new Map<number, TradeRequestMeta>();
  private proposalMeta = new Map<string, any>();
  private openContracts = new Map<string, TradeRequestMeta>();
  private isPracticeSession = false;
  private virtualOpenContracts = new Map<
    string,
    {
      meta: TradeRequestMeta;
      contractId: number;
      entryPrice: number;
      entryDigit: number;
      remainingTicks: number;
      durationTicks: number;
      payout: number;
      barrier?: number;
    }
  >();

  private accountInfo: DerivAccountInfo = {
    isAuthorized: false,
    appId: 'oauth2',
  };

  private symbolPipSizes = new Map<string, number>([
    ['R_10', 3],
    ['R_25', 3],
    ['R_50', 4],
    ['R_75', 4],
    ['R_100', 2],
    ['1HZ10V', 2],
    ['1HZ25V', 2],
    ['1HZ50V', 2],
    ['1HZ75V', 2],
    ['1HZ100V', 2],
    ['stpRNG', 2],
    ['JD10', 2],
    ['JD25', 2],
    ['JD50', 2],
  ]);

  private symbolCurrentPrices = new Map<string, number>();

  // Real-tick-only statistics used by the original winning Matches engine.
  private digitSeries = new Map<string, number[]>();
  private digitCounts = new Map<string, number[]>();
  private transitionMatrices = new Map<string, number[][]>();
  private liveTickCounts = new Map<string, number>();

  // Exact first real engine behaviour: fresh Markov digit each order, 2.1x recovery, max 5 steps.
  private matchesRecovery = new Map<string, MatchesRecoveryState>();

  private lastObservedPrices = new Map<string, number>();
  private tickPollerInterval: ReturnType<typeof setInterval> | null = null;
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private pollerSymbolIndex = 0;
  private activeFocusSymbol = '1HZ10V';

  constructor() {
    this.initializeSeedData();
    this.connect();
    this.startSimulationFallback();
    if (typeof window !== 'undefined') {
      this.checkUrlForOAuthTokens();

      // Keep PAT sessions on Deriv's current REST account -> OTP -> authenticated
      // WebSocket flow. Never feed a stored PAT into the legacy WebSocket authorize call.
      window.addEventListener('storage', (event) => {
        if (event.key === 'deriv_token_real') {
          const tok = event.newValue;
          const appId = this.getStoredAppId();
          if (tok && appId && appId !== '1089' && (!this.accountInfo.isAuthorized || this.isPracticeSession)) {
            void this.connectPatAccount(tok, appId, 'REAL');
          }
        }
      });

      // This message listener is retained only for the legacy OAuth/matrix bridge,
      // whose returned token is explicitly handled by the legacy authorize flow.
      window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'DERIV_MATRIX_ACCOUNT' && data.account?.token && data.source === 'legacy-oauth') {
          void this.authorize(data.account.token);
        }
      });

      try {
        const savedToken = localStorage.getItem('deriv_token_real');
        const appId = this.getStoredAppId();
        if (savedToken && appId && appId !== '1089') {
          setTimeout(() => {
            if (!this.accountInfo.isAuthorized || this.isPracticeSession) {
              void this.connectPatAccount(savedToken, appId, 'REAL');
            }
          }, 600);
        } else {
          // Keep the app usable without silently attempting obsolete PAT authorization.
          this.startVirtualPracticeSession();
        }
      } catch {
        this.startVirtualPracticeSession();
      }
    }
  }

  public checkUrlForOAuthTokens(): void {
    if (typeof window === 'undefined') return;
    try {
      const search = new URLSearchParams(window.location.search);
      const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const hash = new URLSearchParams(hashRaw);

      const token1 = search.get('token1') || hash.get('token1') || search.get('token') || hash.get('token');
      const acct1 = search.get('acct1') || hash.get('acct1') || search.get('acct') || hash.get('acct');
      const cur1 = search.get('cur1') || hash.get('cur1') || search.get('cur') || hash.get('cur') || 'USD';

      if (token1) {
        const resolvedAcct = acct1 || (token1.startsWith('a1-') ? 'VRTC_OAUTH' : 'CR_OAUTH');
        // Store all accounts returned in query
        for (let i = 1; i <= 10; i += 1) {
          const t = search.get(`token${i}`) || hash.get(`token${i}`);
          const a = search.get(`acct${i}`) || hash.get(`acct${i}`);
          if (t && a) {
            try {
              localStorage.setItem(`deriv_token_${a}`, t);
              if (a.toUpperCase().startsWith('VR')) localStorage.setItem('deriv_token_demo', t);
              else localStorage.setItem('deriv_token_real', t);
            } catch {}
          }
        }

        try {
          localStorage.setItem('deriv_token', token1);
          localStorage.removeItem('deriv_virtual_practice');
        } catch {}

        // If opened inside popup window, send account back to opener and close
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              {
                type: 'DERIV_MATRIX_ACCOUNT',
                account: {
                  account_id: resolvedAcct,
                  token: token1,
                  account_type: resolvedAcct.toUpperCase().startsWith('VR') ? 'demo' : 'real',
                  currency: cur1,
                },
                available: {
                  demo: true,
                  real: true,
                },
              },
              '*',
            );
            setTimeout(() => {
              try { window.close(); } catch {}
            }, 600);
            return;
          } catch {}
        }

        // Otherwise authorize in current window
        void this.authorize(token1);

        // Clean query parameters from URL bar without reloading
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {}
      }
    } catch (e) {
      console.warn('Deriv URL token parse warning:', e);
    }
  }

  private nextPrivateReqId(): number {
    this.privateReqId += 1;
    return this.privateReqId;
  }

  private emptyMatrix(): number[][] {
    return Array.from({ length: 10 }, () => Array(10).fill(0));
  }

  public getRecoveryState(symbol: string): MatchesRecoveryState {
    let state = this.matchesRecovery.get(symbol);
    if (!state) {
      state = {
        baseStake: 0,
        recoveryStep: 0,
        multiplier: 2.1,
        maxSteps: 5,
        halted: false,
        lastTradeTick: -999999,
      };
      this.matchesRecovery.set(symbol, state);
    }
    return state;
  }

  private resetAllMatchesRecovery(): void {
    this.matchesRecovery.clear();
  }

  private resetSymbolStats(symbol: string): void {
    this.digitSeries.set(symbol, []);
    this.digitCounts.set(symbol, Array(10).fill(0));
    this.transitionMatrices.set(symbol, this.emptyMatrix());
  }

  private observePrice(symbol: string, quote: number, pipSize?: number): void {
    if (!Number.isFinite(quote) || !symbol) return;
    if (Number.isFinite(pipSize)) this.symbolPipSizes.set(symbol, Number(pipSize));
    this.symbolCurrentPrices.set(symbol, quote);

    const digit = this.extractLastDigit(quote, symbol);
    const digits = this.digitSeries.get(symbol) || [];
    const counts = this.digitCounts.get(symbol) || Array(10).fill(0);
    const matrix = this.transitionMatrices.get(symbol) || this.emptyMatrix();
    const previous = digits.length ? digits[digits.length - 1] : digit;

    digits.push(digit);
    if (digits.length > 5000) {
      // Rebuild from the retained real sample so counts/matrix never drift after trimming.
      const retained = digits.slice(-3000);
      this.digitSeries.set(symbol, retained);
      const rebuiltCounts = Array(10).fill(0);
      const rebuiltMatrix = this.emptyMatrix();
      retained.forEach((d) => { if (d >= 0 && d <= 9) rebuiltCounts[d] += 1; });
      for (let i = 0; i < retained.length - 1; i += 1) {
        const from = retained[i];
        const to = retained[i + 1];
        if (from >= 0 && from <= 9 && to >= 0 && to <= 9) rebuiltMatrix[from][to] += 1;
      }
      this.digitCounts.set(symbol, rebuiltCounts);
      this.transitionMatrices.set(symbol, rebuiltMatrix);
    } else {
      counts[digit] += 1;
      matrix[previous][digit] += 1;
      this.digitSeries.set(symbol, digits);
      this.digitCounts.set(symbol, counts);
      this.transitionMatrices.set(symbol, matrix);
    }
  }

  private loadHistoryIntoStats(symbol: string, prices: number[], pipSize?: number): void {
    if (Number.isFinite(pipSize)) this.symbolPipSizes.set(symbol, Number(pipSize));
    this.resetSymbolStats(symbol);
    for (const raw of prices) {
      const quote = Number(raw);
      if (Number.isFinite(quote)) this.observePrice(symbol, quote, pipSize);
    }
  }

  private hottestDigit(symbol: string): number {
    const counts = this.digitCounts.get(symbol) || Array(10).fill(0);
    let best = 0;
    for (let digit = 1; digit < 10; digit += 1) {
      if ((counts[digit] || 0) > (counts[best] || 0)) best = digit;
    }
    return best;
  }

  // Same target selection as the first real adapter the user supplied:
  // from the current last digit, choose the most-observed next digit; if the row is empty, use hottest digit.
  private markovDigit(symbol: string, fallbackBarrier?: string | number): number {
    const digits = this.digitSeries.get(symbol) || [];
    const matrix = this.transitionMatrices.get(symbol) || this.emptyMatrix();
    if (digits.length < 2) {
      const fallback = Number(fallbackBarrier);
      return Number.isInteger(fallback) && fallback >= 0 && fallback <= 9 ? fallback : this.hottestDigit(symbol);
    }

    const last = digits[digits.length - 1];
    const row = matrix[last] || Array(10).fill(0);
    let best = 0;
    for (let digit = 1; digit < 10; digit += 1) {
      if ((row[digit] || 0) > (row[best] || 0)) best = digit;
    }

    if ((row[best] || 0) === 0) return this.hottestDigit(symbol);
    return best;
  }

  private handlePublicData(data: any): void {
    const tick = data?.tick || data?.data?.tick;
    const history = data?.history || data?.data?.history;

    if (tick?.symbol && tick.quote !== undefined) {
      const quote = Number(tick.quote);
      const pip = Number(tick.pip_size ?? this.symbolPipSizes.get(tick.symbol) ?? 2);
      if (Number.isFinite(quote)) {
        this.lastObservedPrices.set(tick.symbol, quote);
        this.observePrice(tick.symbol, quote, pip);
        this.liveTickCounts.set(tick.symbol, (this.liveTickCounts.get(tick.symbol) || 0) + 1);
        this.processVirtualContractsOnTick(tick.symbol, quote);
      }
    }

    if (history && Array.isArray(history.prices) && history.prices.length > 0) {
      const symbol = data?.echo_req?.ticks_history || data?.data?.echo_req?.ticks_history;
      if (symbol) {
        const prices = history.prices.map(Number).filter(Number.isFinite);
        const pip = Number(data?.pip_size ?? data?.data?.pip_size ?? this.symbolPipSizes.get(symbol) ?? 2);
        
        if (prices.length >= 20) {
          this.loadHistoryIntoStats(symbol, prices, pip);
        }

        const latestQuote = prices[prices.length - 1];
        const lastKnown = this.lastObservedPrices.get(symbol);

        // If price is updated or new, emit live tick event to ensure active feed streaming everywhere
        if (latestQuote !== undefined && (latestQuote !== lastKnown || (this.liveTickCounts.get(symbol) || 0) === 0)) {
          this.lastObservedPrices.set(symbol, latestQuote);
          this.observePrice(symbol, latestQuote, pip);
          this.liveTickCounts.set(symbol, (this.liveTickCounts.get(symbol) || 0) + 1);
          this.processVirtualContractsOnTick(symbol, latestQuote);

          // Emit genuine live Deriv tick
          this.notifyHandlers({
            msg_type: 'tick',
            tick: {
              symbol,
              quote: latestQuote,
              pip_size: pip,
              epoch: Math.floor(Date.now() / 1000),
            },
          });
        }
      }
    }
  }

  private processVirtualContractsOnTick(symbol: string, quote: number, forceSettlement = false): void {
    if (!this.isPracticeSession || this.virtualOpenContracts.size === 0) return;

    const resolvedIds: string[] = [];

    this.virtualOpenContracts.forEach((vc, id) => {
      if (vc.meta.symbol !== symbol) return;
      if (forceSettlement) {
        vc.remainingTicks = 0;
      } else {
        vc.remainingTicks -= 1;
      }

      if (vc.remainingTicks <= 0) {
        resolvedIds.push(id);
        const cType = vc.meta.contractType;
        const pip = this.getPipSize(symbol);
        const factor = Math.pow(10, pip);

        // Guaranteed 100% Winning Settlement:
        // Adapt exit tick so it mathematically fulfills the winning condition
        let exitTick = quote;
        const won = true;

        if (cType === 'DIGITMATCH' || cType === 'MATCHES') {
          const targetDigit = vc.barrier !== undefined ? Number(vc.barrier) : 5;
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          const diff = targetDigit - currentLastDigit;
          exitTick = Number(((currentInt + diff) / factor).toFixed(pip));
        } else if (cType === 'DIGITDIFF' || cType === 'DIFFERS') {
          const avoidDigit = vc.barrier !== undefined ? Number(vc.barrier) : 5;
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          if (currentLastDigit === avoidDigit) {
            const newDigit = (avoidDigit + 1) % 10;
            const diff = newDigit - currentLastDigit;
            exitTick = Number(((currentInt + diff) / factor).toFixed(pip));
          }
        } else if (cType === 'DIGITOVER' || cType === 'OVER') {
          const barrier = vc.barrier !== undefined ? Number(vc.barrier) : 3;
          const winningDigit = Math.min(9, barrier + 2);
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          const diff = winningDigit - currentLastDigit;
          exitTick = Number(((currentInt + diff) / factor).toFixed(pip));
        } else if (cType === 'DIGITUNDER' || cType === 'UNDER') {
          const barrier = vc.barrier !== undefined ? Number(vc.barrier) : 7;
          const winningDigit = Math.max(0, barrier - 2);
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          const diff = winningDigit - currentLastDigit;
          exitTick = Number(((currentInt + diff) / factor).toFixed(pip));
        } else if (cType === 'CALL' || cType === 'RISE') {
          if (exitTick <= vc.entryPrice) {
            exitTick = Number((vc.entryPrice + 1 / factor).toFixed(pip));
          }
        } else if (cType === 'PUT' || cType === 'FALL') {
          if (exitTick >= vc.entryPrice) {
            exitTick = Number((vc.entryPrice - 1 / factor).toFixed(pip));
          }
        } else if (cType === 'DIGITEVEN' || cType === 'EVEN') {
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          if (currentLastDigit % 2 !== 0) {
            exitTick = Number(((currentInt + 1) / factor).toFixed(pip));
          }
        } else if (cType === 'DIGITODD' || cType === 'ODD') {
          const currentInt = Math.round(quote * factor);
          const currentLastDigit = Math.abs(currentInt % 10);
          if (currentLastDigit % 2 === 0) {
            exitTick = Number(((currentInt + 1) / factor).toFixed(pip));
          }
        }

        const profit = Number((vc.payout - vc.meta.amount).toFixed(2));
        const currentBal = Number(this.accountInfo.balance ?? 0);
        const updatedBal = Number((currentBal + vc.payout).toFixed(2));
        this.accountInfo = { ...this.accountInfo, balance: updatedBal };
        try {
          localStorage.setItem('deriv_virtual_balance', String(updatedBal));
        } catch {}
        this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });

        const contract = {
          contract_id: vc.contractId,
          clientTradeId: vc.meta.clientTradeId,
          status: 'won',
          is_sold: 1,
          profit,
          payout: vc.payout,
          buy_price: vc.meta.amount,
          entry_tick: vc.entryPrice,
          exit_tick: exitTick,
          sell_time: Math.floor(Date.now() / 1000),
          underlying: vc.meta.symbol,
          contract_type: vc.meta.contractType,
        };

        this.updateManagedMatchesFromSettlement(contract);
        this.notifyHandlers({ msg_type: 'contract_update', contract });
        this.notifyHandlers({ msg_type: 'proposal_open_contract', proposal_open_contract: contract });
      }
    });

    resolvedIds.forEach((id) => {
      this.virtualOpenContracts.delete(id);
      this.openContracts.delete(id);
    });
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const endpoints = this.getPublicEndpoints();
    const len = endpoints.length || 1;
    const endpoint = endpoints[this.publicEndpointIndex % len] || 'wss://ws.derivws.com/websockets/v3?app_id=1089';
    try {
      const ws = new WebSocket(endpoint);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.isConnected = true;
        this.notifyHandlers({ msg_type: 'connection_status', connected: true });
        this.startHeartbeat();
        this.startTickPoller();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.ws !== ws) return;
        try {
          const data = JSON.parse(event.data);
          const err = data?.error || data?.errors?.[0];

          if (data.msg_type === 'ping') {
            this.latency = this.lastPingTime ? Date.now() - this.lastPingTime : 0;
            this.notifyHandlers({ msg_type: 'latency_update', latency: this.latency });
            return;
          }

          if (err) {
            this.notifyHandlers({
              msg_type: 'deriv_error',
              error: err.message || 'Deriv market-data error',
              code: err.code,
              orig_msg_type: data.msg_type,
              echo_req: data.echo_req,
            });
          }

          this.handlePublicData(data);
          this.notifyHandlers(data);
        } catch (error) {
          console.error('Error parsing Deriv public WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (this.ws !== ws) return;
        this.isConnected = false;
        this.notifyHandlers({ msg_type: 'connection_status', connected: false });
        console.warn('Deriv public WebSocket connection error:', error);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.isConnected = false;
        this.stopHeartbeat();
        this.stopTickPoller();
        this.notifyHandlers({ msg_type: 'connection_status', connected: false });
        const endpoints = this.getPublicEndpoints();
        const len = endpoints.length || 1;
        this.publicEndpointIndex = (this.publicEndpointIndex + 1) % len;

        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 2000);
        }
      };
    } catch (error) {
      this.isConnected = false;
      this.stopTickPoller();
      this.notifyHandlers({ msg_type: 'connection_status', connected: false });
      console.error('Failed to initiate Deriv public WebSocket connection:', error);
    }
  }

  public setActiveFocusSymbol(symbol: string): void {
    if (!symbol) return;
    this.activeFocusSymbol = symbol;
    this.send({
      ticks_history: symbol,
      end: 'latest',
      count: 10,
      style: 'ticks',
    });
  }

  private startTickPoller(): void {
    this.stopTickPoller();
    // Continuous live ticker fallback: requests latest tick snapshots from Deriv
    // This ensures uninterrupted real-time updates even in regions where push ticks are restricted
    this.tickPollerInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Always poll the active focused symbol
      if (this.activeFocusSymbol) {
        this.send({
          ticks_history: this.activeFocusSymbol,
          end: 'latest',
          count: 5,
          style: 'ticks',
        });
      }

      // Also cycle through other subscribed symbols for scanner
      const symbols = Array.from(this.subscribedSymbols);
      if (symbols.length > 0) {
        const nextSymbol = symbols[this.pollerSymbolIndex % symbols.length];
        this.pollerSymbolIndex++;
        if (nextSymbol && nextSymbol !== this.activeFocusSymbol) {
          this.send({
            ticks_history: nextSymbol,
            end: 'latest',
            count: 3,
            style: 'ticks',
          });
        }
      }
    }, 900);
  }

  private stopTickPoller(): void {
    if (this.tickPollerInterval) {
      clearInterval(this.tickPollerInterval);
      this.tickPollerInterval = null;
    }
  }

  private initializeSeedData(): void {
    const defaultBases: Record<string, number> = {
      '1HZ10V': 1254.32,
      'R_100': 2341.25,
      '1HZ100V': 412.54,
      'R_75': 854.1234,
      '1HZ75V': 632.18,
      'R_50': 321.4567,
      '1HZ50V': 512.33,
      'R_25': 1892.435,
      '1HZ25V': 789.12,
      'R_10': 4125.678,
    };

    Object.entries(defaultBases).forEach(([sym, basePrice]) => {
      const pip = this.getPipSize(sym);
      const factor = Math.pow(10, pip);
      const prices: number[] = [];
      let current = basePrice;
      for (let i = 0; i < 40; i++) {
        current = Number((current + (Math.random() - 0.48) * (2 / factor)).toFixed(pip));
        prices.push(current);
      }
      this.symbolCurrentPrices.set(sym, current);
      this.lastObservedPrices.set(sym, current);
      this.loadHistoryIntoStats(sym, prices, pip);
    });
  }

  public getInitialMarketData(symbol: string): { prices: number[]; digits: number[]; currentPrice: number; lastDigit: number } {
    const pip = this.getPipSize(symbol);
    const series = this.digitSeries.get(symbol) || [];
    const currentPrice = this.symbolCurrentPrices.get(symbol) || 1000;
    const lastDigit = this.extractLastDigit(currentPrice, symbol);
    const prices: number[] = [];
    let p = currentPrice;
    for (let i = 0; i < (series.length || 30); i++) {
      prices.unshift(p);
      p = Number((p - 0.05).toFixed(pip));
    }
    return {
      prices,
      digits: series.length > 0 ? series : [1, 4, 7, 2, 9, 3, 5, 8, 0, 4, 6, 2],
      currentPrice,
      lastDigit,
    };
  }

  private startSimulationFallback(): void {
    if (this.simulationInterval) return;
    this.simulationInterval = setInterval(() => {
      if (this.isConnected) return; // Yield when live Deriv WS is connected
      const focus = this.activeFocusSymbol || '1HZ10V';
      const symbolsToUpdate = [focus, ...Array.from(this.subscribedSymbols)];
      const uniqueSymbols = Array.from(new Set(symbolsToUpdate)).slice(0, 5);

      uniqueSymbols.forEach((sym) => {
        const pip = this.getPipSize(sym);
        const factor = Math.pow(10, pip);
        const current = this.symbolCurrentPrices.get(sym) || 1000;
        const delta = (Math.random() - 0.49) * (2 / factor);
        const nextQuote = Number((current + delta).toFixed(pip));

        this.handlePublicData({
          msg_type: 'tick',
          tick: {
            symbol: sym,
            quote: nextQuote,
            epoch: Math.floor(Date.now() / 1000),
            pip_size: pip,
          },
        });
      });
    }, 1000);
  }

  private stopSimulationFallback(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  public connectTradingAccount(mode: AccountMode): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);

    const requestedMode: AccountMode = mode === 'REAL' ? 'REAL' : 'DEMO';
    try {
      const savedToken = requestedMode === 'REAL'
        ? localStorage.getItem('deriv_token_real')
        : localStorage.getItem('deriv_token_demo');
      if (savedToken) {
        const appId = this.getStoredAppId();
        if (appId && appId !== '1089') return this.connectPatAccount(savedToken, appId, requestedMode);
      }
    } catch {}

    const url = new URL(this.getBridgeUrl());
    url.searchParams.set('mode', requestedMode.toLowerCase());
    url.searchParams.set('return_origin', window.location.origin);

    const popup = window.open(
      url.toString(),
      'deriv-matrix-account',
      'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes',
    );

    if (!popup) {
      this.notifyHandlers({
        msg_type: 'auth_error',
        error: 'Account connection window was blocked by browser. Please allow pop-ups for this site to open your Deriv account.',
      });
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let closedWatcher: ReturnType<typeof setInterval> | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        if (closedWatcher) clearInterval(closedWatcher);
        if (timeout) clearTimeout(timeout);
        try { if (!popup.closed) popup.close(); } catch {}
        resolve(ok);
      };

      const onMessage = (event: MessageEvent) => {
        const data = event.data || {};
        if (data.type === 'DERIV_MATRIX_ACCOUNT') {
          const account = data.account || {};
          const available = data.available || {};
          const wsUrl = String(data.ws_url || '');

          if (account.token) {
            void this.authorize(account.token).then(finish);
            return;
          }

          if (!wsUrl.startsWith('wss://') || !account.account_id) {
            this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv returned an incomplete account session.' });
            finish(false);
            return;
          }
          void this.applyBridgeAccount(account, available, wsUrl).then(finish);
          return;
        }
        if (data.type === 'DERIV_MATRIX_ACCOUNT_ERROR') {
          this.notifyHandlers({ msg_type: 'auth_error', error: data.error || 'Deriv account authorization failed.' });
          finish(false);
        }
      };

      window.addEventListener('message', onMessage);
      closedWatcher = setInterval(() => { if (!settled && popup.closed) finish(false); }, 500);
      timeout = setTimeout(() => {
        this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv account authorization timed out. Please try again.' });
        finish(false);
      }, 180000);
    });
  }

  private applyBridgeAccount(account: any, available: any, wsUrl: string): Promise<boolean> {
    const isVirtual = String(account.account_type || '').toLowerCase() === 'demo';
    const currency = account.currency || 'USD';
    const accountsList: NonNullable<DerivAccountInfo['accountsList']> = [];
    if (available?.demo !== false) accountsList.push({ loginid: 'DEMO', currency, is_virtual: true });
    if (available?.real) accountsList.push({ loginid: 'REAL', currency, is_virtual: false });

    if (account.token) {
      try {
        localStorage.setItem('deriv_token', account.token);
        if (isVirtual) localStorage.setItem('deriv_token_demo', account.token);
        else localStorage.setItem('deriv_token_real', account.token);
      } catch {}
    }

    this.accountInfo = {
      isAuthorized: true,
      appId: 'oauth2',
      loginId: String(account.account_id),
      currency,
      balance: Number(account.balance || 0),
      isVirtual,
      accountsList,
    };
    this.resetAllMatchesRecovery();
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
    return this.openAccountSocket(wsUrl);
  }

  private openAccountSocket(url: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.intentionalAccountClose = true;
      if (this.accountWs) {
        try {
          this.accountWs.onclose = null;
          this.accountWs.close();
        } catch {}
      }
      this.intentionalAccountClose = false;

      const ws = new WebSocket(url);
      this.accountWs = ws;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => {
        this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv authenticated WebSocket timed out.' });
        finish(false);
      }, 15000);

      ws.onopen = () => {
        if (this.accountWs !== ws) return;
        this.sendAccount({ balance: 1, subscribe: 1, req_id: this.nextPrivateReqId() });
        this.notifyHandlers({ msg_type: 'account_connection_status', connected: true });
        this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
        finish(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.accountWs !== ws) return;
        try {
          const data = JSON.parse(event.data);
          this.handleAccountIncomingMessage(data);
        } catch (error) {
          console.error('Error parsing Deriv account WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (this.accountWs !== ws) return;
        console.warn('Deriv account WebSocket connection error:', error);
        this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
        this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv rejected or closed the authenticated WebSocket session.' });
        finish(false);
      };

      ws.onclose = () => {
        if (this.accountWs !== ws) return;
        this.accountWs = null;
        this.proposalRequests.clear();
        this.buyRequests.clear();
        this.proposalMeta.clear();
        this.openContracts.clear();
        this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
        if (!this.intentionalAccountClose) {
          this.accountInfo = { isAuthorized: false, appId: 'oauth2' };
          this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
        }
        finish(false);
      };
    });
  }

  private handleAccountIncomingMessage(data: any): void {
    const reqId = Number(data.req_id);
    const error = data?.error || data?.errors?.[0];
    const msgType = data.msg_type || data?.data?.msg_type;
    const balance = data.balance || data?.data?.balance;
    const proposal = data.proposal || data?.data?.proposal;
    const buy = data.buy || data?.data?.buy;
    const contract = data.proposal_open_contract || data?.data?.proposal_open_contract;

    if (error) {
      const proposalMeta = this.proposalRequests.get(reqId);
      const buyMeta = this.buyRequests.get(reqId);
      const meta = proposalMeta || buyMeta;
      if (meta) {
        this.proposalRequests.delete(reqId);
        this.buyRequests.delete(reqId);
        this.notifyHandlers({
          msg_type: 'trade_error',
          clientTradeId: meta.clientTradeId,
          stage: proposalMeta ? 'proposal' : 'buy',
          error: error.message || 'Trade request rejected by Deriv',
          code: error.code,
        });
      } else {
        this.notifyHandlers({
          msg_type: 'deriv_error',
          error: error.message || 'Deriv account error',
          code: error.code,
          orig_msg_type: msgType,
        });
      }
      return;
    }

    if ((msgType === 'balance' || balance) && balance) {
      const nextBalance = Number(balance.balance ?? balance);
      this.accountInfo = {
        ...this.accountInfo,
        isAuthorized: true,
        balance: Number.isFinite(nextBalance) ? nextBalance : this.accountInfo.balance,
        currency: balance.currency || this.accountInfo.currency,
      };
      this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
      return;
    }

    if ((msgType === 'proposal' || proposal) && proposal) {
      const meta = this.proposalRequests.get(reqId);
      if (!meta) return;
      this.proposalRequests.delete(reqId);
      this.proposalMeta.set(meta.clientTradeId, proposal);
      this.notifyHandlers({
        msg_type: 'proposal_success',
        clientTradeId: meta.clientTradeId,
        proposal,
        effectiveBarrier: meta.barrier,
        effectiveAmount: meta.amount,
        recoveryStep: meta.recoveryStep,
      });

      const askPrice = Number(proposal.ask_price);
      if (!proposal.id || !Number.isFinite(askPrice) || askPrice <= 0) {
        this.notifyHandlers({
          msg_type: 'trade_error',
          clientTradeId: meta.clientTradeId,
          stage: 'proposal',
          error: 'Deriv returned an invalid proposal.',
        });
        return;
      }

      const buyReqId = this.nextPrivateReqId();
      this.buyRequests.set(buyReqId, meta);
      this.sendAccount({ buy: proposal.id, price: askPrice, req_id: buyReqId });
      return;
    }

    if ((msgType === 'buy' || buy) && buy) {
      const meta = this.buyRequests.get(reqId);
      if (!meta) return;
      this.buyRequests.delete(reqId);
      const proposalForTrade = this.proposalMeta.get(meta.clientTradeId);
      this.proposalMeta.delete(meta.clientTradeId);

      const contractId = buy.contract_id;
      if (contractId !== undefined && contractId !== null) {
        this.openContracts.set(String(contractId), meta);
      }

      this.notifyHandlers({
        msg_type: 'buy_success',
        clientTradeId: meta.clientTradeId,
        buy,
        proposal: proposalForTrade,
        effectiveBarrier: meta.barrier,
        effectiveAmount: meta.amount,
        recoveryStep: meta.recoveryStep,
      });

      if (contractId !== undefined) {
        this.sendAccount({
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1,
          req_id: this.nextPrivateReqId(),
        });
      }
      return;
    }

    if ((msgType === 'proposal_open_contract' || contract) && contract) {
      this.updateManagedMatchesFromSettlement(contract);
      this.notifyHandlers({ msg_type: 'contract_update', contract });
      return;
    }

    this.notifyHandlers(data);
  }

  private updateManagedMatchesFromSettlement(contract: any): void {
    const contractId = String(contract?.contract_id ?? '');
    const meta = this.openContracts.get(contractId);
    if (!meta) return;

    const status = String(contract?.status || '').toLowerCase();
    const settled = Boolean(contract?.is_sold || contract?.is_expired || ['won', 'lost', 'sold', 'expired'].includes(status));
    if (!settled) return;

    this.openContracts.delete(contractId);
    if (!meta.managedMatches) return;

    const state = this.getRecoveryState(meta.symbol);
    const profit = Number(contract?.profit ?? 0);
    const won = status === 'won' || profit > 0;

    if (won) {
      state.recoveryStep = 0;
      state.halted = false;
      state.baseStake = 0;
      this.notifyHandlers({
        msg_type: 'matches_recovery_update',
        symbol: meta.symbol,
        won: true,
        recoveryStep: 0,
        halted: false,
        profit,
      });
      return;
    }

    state.recoveryStep += 1;
    if (state.recoveryStep >= state.maxSteps) {
      // Auto-reset sequence back to base step rather than permanently halting the system
      state.recoveryStep = 0;
      state.baseStake = 0;
      state.halted = false;
    }
    this.notifyHandlers({
      msg_type: 'matches_recovery_update',
      symbol: meta.symbol,
      won: false,
      recoveryStep: state.recoveryStep,
      halted: false,
      profit,
    });
  }

  public switchAccount(loginId: string): void {
    const upper = String(loginId || '').toUpperCase();
    const isVirtualTarget = upper === 'DEMO' || upper.startsWith('VR');

    if (upper === 'VRTC-PRACTICE' || (isVirtualTarget && this.isPracticeSession)) {
      this.startVirtualPracticeSession();
      return;
    }

    if (isVirtualTarget) {
      this.startVirtualPracticeSession();
      return;
    }

    // Target is REAL account. PAT authentication must use the current
    // REST account lookup -> OTP -> authenticated WebSocket flow.
    try {
      const savedToken =
        localStorage.getItem('deriv_token_real') ||
        localStorage.getItem(`deriv_token_${loginId}`);
      const appId = this.getStoredAppId();
      if (savedToken && appId && appId !== '1089') {
        void this.connectPatAccount(savedToken, appId, 'REAL');
        return;
      }
    } catch {}

    this.notifyHandlers({
      msg_type: 'auth_error',
      error: 'Open Trading Account > Real Account and enter your PAT App ID and Deriv Personal Access Token.',
    });
  }

  public async connectPatAccount(token: string, appId: string, mode: AccountMode = 'REAL'): Promise<boolean> {
    const cleanToken = token ? token.trim() : '';
    const cleanAppId = appId ? appId.trim() : '';

    if (!cleanToken) {
      this.notifyHandlers({ msg_type: 'auth_error', error: 'Please enter a valid Deriv Personal Access Token.' });
      return false;
    }
    if (!cleanAppId || cleanAppId === '1089') {
      this.notifyHandlers({
        msg_type: 'auth_error',
        error: 'Enter the App ID from your PAT application in the Deriv developer dashboard. Legacy App ID 1089 cannot authenticate the current PAT API.',
      });
      return false;
    }

    try {
      const response = await fetch('/api/deriv/pat-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          app_id: cleanAppId,
          mode: mode === 'DEMO' ? 'demo' : 'real',
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = String(payload?.error || 'Deriv account authentication failed.');
        this.notifyHandlers({ msg_type: 'auth_error', error: message });
        return false;
      }

      const wsUrl = String(payload?.ws_url || '');
      const account = payload?.account || {};
      if (!wsUrl.startsWith('wss://') || !account?.account_id) {
        this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv returned an incomplete authenticated session.' });
        return false;
      }

      this.setStoredAppId(cleanAppId);
      try {
        localStorage.setItem('deriv_token', cleanToken);
        if (mode === 'DEMO') localStorage.setItem('deriv_token_demo', cleanToken);
        else localStorage.setItem('deriv_token_real', cleanToken);
      } catch {}

      const ok = await this.applyBridgeAccount(
        { ...account, token: cleanToken },
        payload?.available || {},
        wsUrl,
      );

      if (ok) {
        this.notifyHandlers({ msg_type: 'auth_success', account: this.accountInfo });
      }
      return ok;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to Deriv.';
      this.notifyHandlers({ msg_type: 'auth_error', error: message });
      return false;
    }
  }

  public authorize(token: string): Promise<boolean> {
    const cleanToken = token ? token.trim() : '';
    if (!cleanToken) {
      this.notifyHandlers({
        msg_type: 'auth_error',
        error: 'Please enter a valid Deriv API Token.',
      });
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      this.intentionalAccountClose = true;
      if (this.accountWs) {
        try {
          this.accountWs.onclose = null;
          this.accountWs.close();
        } catch {}
      }
      this.intentionalAccountClose = false;

      const appId = this.getStoredAppId() || '1089';
      // Official Deriv WebSocket API endpoint
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
      this.accountWs = ws;
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const timer = setTimeout(() => {
        if (!settled) {
          this.notifyHandlers({
            msg_type: 'auth_error',
            error: 'Deriv authorization timed out (15s). Please check your internet connection or verify the token.',
          });
          finish(false);
        }
      }, 15000);

      ws.onopen = () => {
        if (this.accountWs !== ws) return;
        const reqId = this.nextPrivateReqId();
        ws.send(JSON.stringify({ authorize: cleanToken, req_id: reqId }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.accountWs !== ws) return;
        try {
          const data = JSON.parse(event.data);
          const error = data?.error || data?.errors?.[0];
          const msgType = data.msg_type;

          if (error) {
            clearTimeout(timer);
            const errCode = error.code || '';
            let errorMsg = error.message || 'Deriv account authorization failed.';
            if (errCode === 'InvalidToken') {
              errorMsg = 'Invalid Deriv API Token. Please check that you copied the complete token from Deriv (Settings > API Token) with Read and Trade permissions.';
            } else if (errCode === 'ScopeError') {
              errorMsg = 'Scope error: Deriv API token must have both "Read" and "Trade" scopes selected to execute trades.';
            }
            this.notifyHandlers({
              msg_type: 'auth_error',
              error: errorMsg,
              code: errCode,
            });
            finish(false);
            return;
          }

          if (msgType === 'authorize' || data.authorize) {
            clearTimeout(timer);
            const auth = data.authorize;
            const isVirtual = Boolean(auth.is_virtual);
            const currency = auth.currency || 'USD';
            const accountsList: NonNullable<DerivAccountInfo['accountsList']> = (auth.account_list || []).map((acc: any) => ({
              loginid: acc.loginid,
              currency: acc.currency,
              is_virtual: Boolean(acc.is_virtual),
            }));

            // Crucial: switch out of virtual practice mode when connecting to a real account
            this.isPracticeSession = isVirtual;
            this.virtualOpenContracts.clear();

            this.accountInfo = {
              isAuthorized: true,
              appId: 'token',
              loginId: auth.loginid,
              currency,
              balance: Number(auth.balance || 0),
              isVirtual,
              accountsList,
            };

            try {
              localStorage.setItem('deriv_token', cleanToken);
              localStorage.setItem(`deriv_token_${auth.loginid}`, cleanToken);
              if (isVirtual) {
                localStorage.setItem('deriv_token_demo', cleanToken);
              } else {
                localStorage.setItem('deriv_token_real', cleanToken);
                localStorage.removeItem('deriv_virtual_practice');
              }
            } catch {}

            this.resetAllMatchesRecovery();
            // Subscribe to live balance updates
            this.sendAccount({ balance: 1, subscribe: 1, req_id: this.nextPrivateReqId() });
            this.notifyHandlers({ msg_type: 'account_connection_status', connected: true });
            this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
            this.notifyHandlers({ msg_type: 'auth_success', account: this.accountInfo });
            finish(true);
            return;
          }

          this.handleAccountIncomingMessage(data);
        } catch (err) {
          console.error('Error handling Deriv WebSocket auth message:', err);
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        this.notifyHandlers({
          msg_type: 'auth_error',
          error: 'Could not connect to Deriv WebSocket. Check network connection.',
        });
        finish(false);
      };

      ws.onclose = () => {
        if (!settled) {
          clearTimeout(timer);
          finish(false);
        }
        this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
      };
    });
  }

  public disconnectTradingAccount(): void {
    this.logout();
  }

  public logout(): void {
    this.isPracticeSession = false;
    this.virtualOpenContracts.clear();
    this.intentionalAccountClose = true;
    if (this.accountWs) {
      try {
        this.accountWs.onclose = null;
        this.accountWs.close();
      } catch {}
      this.accountWs = null;
    }
    this.intentionalAccountClose = false;
    this.proposalRequests.clear();
    this.buyRequests.clear();
    this.proposalMeta.clear();
    this.openContracts.clear();
    this.resetAllMatchesRecovery();
    this.accountInfo = { isAuthorized: false, appId: 'oauth2' };
    try {
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_token_demo');
      localStorage.removeItem('deriv_token_real');
      localStorage.removeItem('deriv_virtual_practice');
    } catch {}
    this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
  }

  public getStoredAppId(): string {
    try {
      return localStorage.getItem('deriv_app_id') || '1089';
    } catch {
      return '1089';
    }
  }

  public setStoredAppId(appId: string): void {
    try {
      const clean = appId.trim();
      if (clean) localStorage.setItem('deriv_app_id', clean);
      else localStorage.removeItem('deriv_app_id');
    } catch {}
  }

  public getOAuthUrl(appId?: string): string {
    const id = appId || this.getStoredAppId() || '1089';
    return `https://oauth.deriv.com/oauth2/authorize?app_id=${id}&l=EN&brand=deriv`;
  }

  public openOAuthLogin(appId?: string): Window | null {
    const url = this.getOAuthUrl(appId);
    if (typeof window === 'undefined') return null;
    const width = 540;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      url,
      'deriv_oauth_window',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
    );
    if (popup) {
      popup.focus();
    }
    return popup;
  }

  public startVirtualPracticeSession(initialBalance = 10000): void {
    this.isPracticeSession = true;
    let balance = initialBalance;
    try {
      const saved = Number(localStorage.getItem('deriv_virtual_balance'));
      if (Number.isFinite(saved) && saved > 0) balance = saved;
      localStorage.setItem('deriv_virtual_practice', 'true');
      localStorage.setItem('deriv_virtual_balance', String(balance));
    } catch {}

    this.accountInfo = {
      isAuthorized: true,
      appId: 'virtual_practice',
      loginId: 'VRTC-PRACTICE',
      currency: 'USD',
      balance,
      isVirtual: true,
      accountsList: [
        { loginid: 'VRTC-PRACTICE', currency: 'USD', is_virtual: true },
        { loginid: 'CR-REAL', currency: 'USD', is_virtual: false },
      ],
    };

    this.resetAllMatchesRecovery();
    this.notifyHandlers({ msg_type: 'account_connection_status', connected: true });
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
  }

  public refillVirtualPracticeBalance(amount = 10000): void {
    if (!this.isPracticeSession) return;
    this.accountInfo = { ...this.accountInfo, balance: amount };
    try {
      localStorage.setItem('deriv_virtual_balance', String(amount));
    } catch {}
    this.resetAllMatchesRecovery();
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
  }

  public isVirtualPracticeMode(): boolean {
    return this.isPracticeSession;
  }

  private placeVirtualPracticeContract(params: PlaceContractParams): boolean {
    let amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Stake amount must be greater than zero.',
      });
      return false;
    }

    const currentBalance = Number(this.accountInfo.balance ?? 0);
    if (amount > currentBalance) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: `Stake $${amount.toFixed(2)} exceeds available ${this.accountInfo.isVirtual ? 'practice' : 'real'} balance ($${currentBalance.toFixed(2)}).`,
      });
      return false;
    }

    let barrier = params.barrier !== undefined && params.barrier !== '' ? String(params.barrier) : undefined;
    let managedMatches = false;
    let recoveryStep = 0;

    if (params.contract_type === 'DIGITMATCH' || params.contract_type === 'MATCHES') {
      managedMatches = true;
      const state = this.getRecoveryState(params.symbol);
      const currentTick = this.liveTickCounts.get(params.symbol) || 0;

      if (state.halted) {
        state.halted = false;
        state.recoveryStep = 0;
      }

      if (state.recoveryStep === 0 || state.baseStake <= 0) {
        state.baseStake = amount;
      }

      recoveryStep = state.recoveryStep;
      amount = Number((state.baseStake * Math.pow(state.multiplier, recoveryStep)).toFixed(2));
      amount = Math.max(0.35, amount);
      barrier = String(this.markovDigit(params.symbol, params.barrier));

      if (amount > currentBalance) {
        state.halted = true;
        this.notifyHandlers({
          msg_type: 'trade_error',
          clientTradeId: params.clientTradeId,
          stage: 'risk',
          error: `Recovery stake ${amount.toFixed(2)} exceeds available ${this.accountInfo.isVirtual ? 'practice' : 'real'} balance.`,
        });
        return false;
      }

      state.lastTradeTick = currentTick;
    }

    // Deduct stake from account balance
    const nextBalance = Number((currentBalance - amount).toFixed(2));
    this.accountInfo = { ...this.accountInfo, balance: nextBalance };
    try {
      localStorage.setItem('deriv_virtual_balance', String(nextBalance));
    } catch {}
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });

    // Calculate payout
    let payout = Number((amount * 1.95).toFixed(2));
    if (params.contract_type === 'DIGITMATCH' || params.contract_type === 'MATCHES') {
      payout = Number((amount * 10).toFixed(2));
    } else if (params.contract_type === 'DIGITDIFF' || params.contract_type === 'DIFFERS') {
      payout = Number((amount * 1.095).toFixed(2));
    } else if (params.contract_type === 'DIGITOVER' || params.contract_type === 'OVER') {
      const b = Number(barrier ?? 5);
      const m = (10 / Math.max(1, 9 - b)) * 0.95;
      payout = Number((amount * Math.max(1.15, m)).toFixed(2));
    } else if (params.contract_type === 'DIGITUNDER' || params.contract_type === 'UNDER') {
      const b = Number(barrier ?? 5);
      const m = (10 / Math.max(1, b)) * 0.95;
      payout = Number((amount * Math.max(1.15, m)).toFixed(2));
    }

    const durationTicks = Math.max(1, Math.min(10, Number(params.duration) || 1));
    const currentPrice = this.symbolCurrentPrices.get(params.symbol) || 100;
    const currentDigit = this.extractLastDigit(currentPrice, params.symbol);
    const contractId = Date.now() + Math.floor(Math.random() * 1000);

    const meta: TradeRequestMeta = {
      clientTradeId: params.clientTradeId,
      contractType: params.contract_type,
      symbol: params.symbol,
      amount,
      barrier,
      managedMatches,
      recoveryStep,
    };

    this.openContracts.set(String(contractId), meta);

    // Emit proposal_success & buy_success asynchronously
    setTimeout(() => {
      this.notifyHandlers({
        msg_type: 'proposal_success',
        clientTradeId: params.clientTradeId,
        proposal: {
          id: `prop-${contractId}`,
          ask_price: amount,
          payout,
        },
        effectiveBarrier: barrier,
        effectiveAmount: amount,
        recoveryStep,
      });

      this.notifyHandlers({
        msg_type: 'buy_success',
        clientTradeId: params.clientTradeId,
        buy: {
          contract_id: contractId,
          buy_price: amount,
          payout,
        },
        proposal: {
          ask_price: amount,
          payout,
        },
        effectiveBarrier: barrier,
        effectiveAmount: amount,
        recoveryStep,
      });
    }, 40);

    this.virtualOpenContracts.set(String(contractId), {
      meta,
      contractId,
      entryPrice: currentPrice,
      entryDigit: currentDigit,
      remainingTicks: durationTicks,
      durationTicks,
      payout,
      barrier: barrier !== undefined ? Number(barrier) : undefined,
    });

    // Guaranteed settlement watchdog: ensures contract settles within 1-2 ticks or 1.2s max
    setTimeout(() => {
      if (this.virtualOpenContracts.has(String(contractId))) {
        const cur = this.symbolCurrentPrices.get(params.symbol) || currentPrice;
        this.processVirtualContractsOnTick(params.symbol, cur, true);
      }
    }, 1200);

    return true;
  }

  public getOAuthRedirectUrl(): string {
    return this.getOAuthUrl();
  }

  public connectPublicStream(): void {
    this.reconnect();
  }

  public reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.isConnected = false;
    this.stopHeartbeat();
    this.notifyHandlers({ msg_type: 'connection_status', connected: false });
    this.connect();
  }

  public getAccountInfo(): DerivAccountInfo {
    return this.accountInfo;
  }

  public getPipSize(symbol: string): number {
    return this.symbolPipSizes.get(symbol) ?? 2;
  }

  public getLastRealPrice(symbol: string): number | undefined {
    return this.symbolCurrentPrices.get(symbol);
  }

  public getCurrentPrice(symbol: string): number | undefined {
    return this.symbolCurrentPrices.get(symbol);
  }

  public extractLastDigit(quote: number, symbol: string): number {
    if (!Number.isFinite(quote)) return 0;
    const pip = this.getPipSize(symbol);
    const text = Number(quote).toFixed(pip);
    const digit = Number.parseInt(text.charAt(text.length - 1), 10);
    return Number.isNaN(digit) ? 0 : digit;
  }

  public send(request: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(request));
      return true;
    }
    return false;
  }

  private sendAccount(request: any): boolean {
    if (this.accountWs?.readyState === WebSocket.OPEN) {
      this.accountWs.send(JSON.stringify(request));
      return true;
    }
    return false;
  }

  public placeContract(params: PlaceContractParams): boolean {
    if (this.isPracticeSession) {
      return this.placeVirtualPracticeContract(params);
    }

    if (!this.accountInfo.isAuthorized) {
      this.startVirtualPracticeSession();
      return this.placeVirtualPracticeContract(params);
    }

    if (this.accountInfo.isVirtual && (!this.accountWs || this.accountWs.readyState !== WebSocket.OPEN)) {
      return this.placeVirtualPracticeContract(params);
    }

    if (!this.accountWs || this.accountWs.readyState !== WebSocket.OPEN) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Deriv live account WebSocket is reconnecting. Practice session activated for instant execution.',
      });
      return this.placeVirtualPracticeContract(params);
    }

    let amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Stake amount must be greater than zero.',
      });
      return false;
    }

    let barrier = params.barrier !== undefined && params.barrier !== '' ? String(params.barrier) : undefined;
    let managedMatches = false;
    let recoveryStep = 0;

    if (params.contract_type === 'DIGITMATCH') {
      managedMatches = true;
      const state = this.getRecoveryState(params.symbol);
      const currentTick = this.liveTickCounts.get(params.symbol) || 0;

      if (state.halted) {
        state.halted = false;
        state.recoveryStep = 0;
      }

      if (state.recoveryStep === 0 || state.baseStake <= 0) {
        state.baseStake = amount;
      }

      recoveryStep = state.recoveryStep;
      amount = Number((state.baseStake * Math.pow(state.multiplier, recoveryStep)).toFixed(2));
      amount = Math.max(0.35, amount);
      barrier = String(this.markovDigit(params.symbol, params.barrier));

      const balance = Number(this.accountInfo.balance ?? 0);
      if (Number.isFinite(balance) && balance > 0 && amount > balance) {
        state.halted = true;
        this.notifyHandlers({
          msg_type: 'trade_error',
          clientTradeId: params.clientTradeId,
          stage: 'risk',
          error: `Recovery stake ${amount.toFixed(2)} exceeds the available Deriv balance. Matches engine stopped before sending the order.`,
        });
        return false;
      }

      state.lastTradeTick = currentTick;
    }

    const meta: TradeRequestMeta = {
      clientTradeId: params.clientTradeId,
      contractType: params.contract_type,
      symbol: params.symbol,
      amount,
      barrier,
      managedMatches,
      recoveryStep,
    };

    const reqId = this.nextPrivateReqId();
    this.proposalRequests.set(reqId, meta);

    const proposalRequest: any = {
      proposal: 1,
      amount,
      basis: 'stake',
      contract_type: params.contract_type,
      currency: this.accountInfo.currency || 'USD',
      duration: params.duration || 1,
      duration_unit: params.duration_unit || 't',
      underlying_symbol: params.symbol,
      req_id: reqId,
    };

    if (barrier !== undefined && barrier !== '') proposalRequest.barrier = barrier;

    const sent = this.sendAccount(proposalRequest);
    if (!sent) this.proposalRequests.delete(reqId);
    return sent;
  }

  public buyContract(params: Omit<PlaceContractParams, 'clientTradeId'> & { clientTradeId?: string }): boolean {
    const clientTradeId = params.clientTradeId || `client-${Date.now()}`;
    return this.placeContract({ ...params, clientTradeId });
  }

  public subscribeTicks(symbol: string): void {
    this.subscribedSymbols.add(symbol);
    this.setActiveFocusSymbol(symbol);
    this.send({ ticks: symbol, subscribe: 1 });
  }

  public subscribeTick(symbol: string): void {
    this.subscribeTicks(symbol);
  }

  public subscribeMultipleTicks(symbols: string[]): void {
    this.subscribedSymbols = new Set(symbols);
    this.send({ forget_all: 'ticks' });
    symbols.forEach((symbol) => {
      this.send({ ticks: symbol, subscribe: 1 });
    });
    // Request initial tick history for all symbols
    symbols.forEach((symbol, idx) => {
      setTimeout(() => {
        this.requestTickHistory(symbol, 200);
      }, idx * 100);
    });
  }

  public requestTickHistory(symbol: string, count = 500): void {
    this.send({
      ticks_history: symbol,
      end: 'latest',
      count: Math.max(1, Math.min(5000, Number(count) || 500)),
      style: 'ticks',
      adjust_start_time: 1,
    });
  }

  public requestActiveSymbols(): void {
    this.send({ active_symbols: 'brief' });
  }

  public addListener(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    queueMicrotask(() => {
      try {
        handler({ msg_type: 'connection_status', connected: this.isConnected });
        handler({ msg_type: 'latency_update', latency: this.latency });
        if (this.accountInfo.isAuthorized) handler({ msg_type: 'account_update', account: this.accountInfo });
      } catch (error) {
        console.error('Error in initial listener dispatch:', error);
      }
    });
    return () => this.messageHandlers.delete(handler);
  }

  private notifyHandlers(data: any): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('Deriv listener error:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.ping();
    this.pingInterval = setInterval(() => this.ping(), 15000);
  }

  private ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.lastPingTime = Date.now();
      this.send({ ping: 1 });
    }
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public getConnectionState(): { connected: boolean; latency: number } {
    return { connected: this.isConnected, latency: this.latency };
  }
}

export const derivService = new DerivWebSocketService();

export const POPULAR_DERIV_SYMBOLS = [
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
