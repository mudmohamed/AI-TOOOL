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

  // Current Deriv public Options WebSocket first. Legacy public WebSocket is a real-data fallback only.
  private readonly publicEndpoints = [
    'wss://api.derivws.com/trading/v1/options/ws/public',
    'wss://ws.binaryws.com/websockets/v3',
  ];
  private publicEndpointIndex = 0;

  // Secure account bridge uses Deriv OAuth/PAT -> OTP server-side and returns a ready authenticated WS URL.
  private readonly bridgeUrl = 'https://fasterpro-analyzer.vercel.app/matrix-bridge.html';
  private readonly bridgeOrigin = 'https://fasterpro-analyzer.vercel.app';

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

  constructor() {
    this.connect();
  }

  private nextPrivateReqId(): number {
    this.privateReqId += 1;
    return this.privateReqId;
  }

  private emptyMatrix(): number[][] {
    return Array.from({ length: 10 }, () => Array(10).fill(0));
  }

  private getRecoveryState(symbol: string): MatchesRecoveryState {
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
        this.observePrice(tick.symbol, quote, pip);
        this.liveTickCounts.set(tick.symbol, (this.liveTickCounts.get(tick.symbol) || 0) + 1);
      }
    }

    if (history && Array.isArray(history.prices)) {
      const symbol = data?.echo_req?.ticks_history || data?.data?.echo_req?.ticks_history;
      if (symbol) {
        const prices = history.prices.map(Number).filter(Number.isFinite);
        const pip = Number(data?.pip_size ?? data?.data?.pip_size ?? this.symbolPipSizes.get(symbol) ?? 2);
        this.loadHistoryIntoStats(symbol, prices, pip);
      }
    }
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const endpoint = this.publicEndpoints[this.publicEndpointIndex % this.publicEndpoints.length];
    try {
      const ws = new WebSocket(endpoint);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.isConnected = true;
        this.notifyHandlers({ msg_type: 'connection_status', connected: true });
        this.startHeartbeat();
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
        this.notifyHandlers({ msg_type: 'connection_status', connected: false });
        this.publicEndpointIndex = (this.publicEndpointIndex + 1) % this.publicEndpoints.length;

        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 2000);
        }
      };
    } catch (error) {
      this.isConnected = false;
      this.notifyHandlers({ msg_type: 'connection_status', connected: false });
      console.error('Failed to initiate Deriv public WebSocket connection:', error);
    }
  }

  public connectTradingAccount(mode: AccountMode): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);

    const requestedMode: AccountMode = mode === 'REAL' ? 'REAL' : 'DEMO';
    const url = new URL(this.bridgeUrl);
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
        error: 'The secure account window was blocked. Allow pop-ups for this site and try again.',
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
        if (event.origin !== this.bridgeOrigin) return;
        const data = event.data || {};
        if (data.type === 'DERIV_MATRIX_ACCOUNT') {
          const account = data.account || {};
          const available = data.available || {};
          const wsUrl = String(data.ws_url || '');
          if (!wsUrl.startsWith('wss://') || !account.account_id) {
            this.notifyHandlers({ msg_type: 'auth_error', error: 'Deriv returned an incomplete account session.' });
            finish(false);
            return;
          }
          this.applyBridgeAccount(account, available, wsUrl);
          finish(true);
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

  private applyBridgeAccount(account: any, available: any, wsUrl: string): void {
    const isVirtual = String(account.account_type || '').toLowerCase() === 'demo';
    const currency = account.currency || 'USD';
    const accountsList: NonNullable<DerivAccountInfo['accountsList']> = [];
    if (available?.demo !== false) accountsList.push({ loginid: 'DEMO', currency, is_virtual: true });
    if (available?.real) accountsList.push({ loginid: 'REAL', currency, is_virtual: false });

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
    this.openAccountSocket(wsUrl);
  }

  private openAccountSocket(url: string): void {
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

    ws.onopen = () => {
      if (this.accountWs !== ws) return;
      this.sendAccount({ balance: 1, subscribe: 1, req_id: this.nextPrivateReqId() });
      this.notifyHandlers({ msg_type: 'account_connection_status', connected: true });
      this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.accountWs !== ws) return;
      try {
        const data = JSON.parse(event.data);
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
          if (askPrice > meta.amount + 0.000001) {
            this.notifyHandlers({ msg_type: 'trade_error', clientTradeId: meta.clientTradeId, stage: 'proposal', error: `Deriv proposal price ${askPrice.toFixed(2)} exceeds selected stake ${meta.amount.toFixed(2)}. Order blocked.` });
            this.proposalMeta.delete(meta.clientTradeId);
            return;
          }
          this.sendAccount({ buy: proposal.id, price: meta.amount, req_id: buyReqId });
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
      } catch (error) {
        console.error('Error parsing Deriv account WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      if (this.accountWs !== ws) return;
      console.warn('Deriv account WebSocket connection error:', error);
      this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
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
    };
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
    if (state.recoveryStep >= state.maxSteps) state.halted = true;
    this.notifyHandlers({
      msg_type: 'matches_recovery_update',
      symbol: meta.symbol,
      won: false,
      recoveryStep: state.recoveryStep,
      halted: state.halted,
      profit,
    });
  }

  public switchAccount(loginId: string): void {
    const upper = String(loginId || '').toUpperCase();
    if (upper === 'DEMO') {
      void this.connectTradingAccount('DEMO');
      return;
    }
    if (upper === 'REAL') {
      void this.connectTradingAccount('REAL');
      return;
    }

    const match = this.accountInfo.accountsList?.find((account) => account.loginid === loginId);
    if (match) void this.connectTradingAccount(match.is_virtual ? 'DEMO' : 'REAL');
  }

  public authorize(_token: string): void {
    this.notifyHandlers({
      msg_type: 'auth_error',
      error: 'Manual browser tokens are disabled in this build. Use the DEMO / REAL account selector.',
    });
  }

  public logout(): void {
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
    this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
  }

  public getOAuthRedirectUrl(): string {
    const url = new URL(this.bridgeUrl);
    if (typeof window !== 'undefined') url.searchParams.set('return_origin', window.location.origin);
    return url.toString();
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
    if (!this.accountInfo.isAuthorized || this.accountWs?.readyState !== WebSocket.OPEN) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Select a live Deriv DEMO or REAL account before placing a contract.',
      });
      return false;
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

    // Preserve exactly what the original strategy selected.
    const barrier = params.barrier !== undefined && params.barrier !== '' ? String(params.barrier) : undefined;
    const managedMatches = false;
    const recoveryStep = 0;

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
    this.send({ ticks: symbol, subscribe: 1 });
  }

  public subscribeTick(symbol: string): void {
    this.subscribeTicks(symbol);
  }

  public subscribeMultipleTicks(symbols: string[]): void {
    this.subscribedSymbols = new Set(symbols);
    this.send({ forget_all: 'ticks' });
    symbols.forEach((symbol) => this.send({ ticks: symbol, subscribe: 1 }));
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
