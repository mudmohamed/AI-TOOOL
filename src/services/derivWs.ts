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

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private accountWs: WebSocket | null = null;
  private readonly publicUrl = 'wss://api.derivws.com/trading/v1/options/ws/public';
  private readonly bridgeUrl = 'https://fasterpro-analyzer.vercel.app/matrix-bridge.html';
  private readonly bridgeOrigin = 'https://fasterpro-analyzer.vercel.app';
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private isConnected = false;
  private latency = 0;
  private lastPingTime = 0;
  private subscribedSymbols = new Set<string>();
  private proposalMeta = new Map<string, any>();
  private privateReqId = 1000;
  private proposalRequests = new Map<number, string>();
  private buyRequests = new Map<number, string>();
  private intentionalAccountClose = false;
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

  constructor() {
    this.connect();
  }

  private nextPrivateReqId(): number {
    this.privateReqId += 1;
    return this.privateReqId;
  }

  public connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const ws = new WebSocket(this.publicUrl);
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

          if (data.msg_type === 'ping') {
            this.latency = this.lastPingTime ? Date.now() - this.lastPingTime : 0;
            this.notifyHandlers({ msg_type: 'latency_update', latency: this.latency });
            return;
          }

          if (data.error) {
            this.notifyHandlers({
              msg_type: 'deriv_error',
              error: data.error.message || 'Deriv market-data error',
              code: data.error.code,
              orig_msg_type: data.msg_type,
              echo_req: data.echo_req,
            });
          }

          if (data.tick?.pip_size !== undefined && data.tick?.symbol) {
            this.symbolPipSizes.set(data.tick.symbol, Number(data.tick.pip_size));
          }

          if (data.msg_type === 'tick' && data.tick) {
            const quote = Number(data.tick.quote);
            if (data.tick.symbol && Number.isFinite(quote)) {
              this.symbolCurrentPrices.set(data.tick.symbol, quote);
            }
          }

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

        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 2500);
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

      closedWatcher = setInterval(() => {
        if (!settled && popup.closed) finish(false);
      }, 500);

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

        if (data.error) {
          const wasProposal = this.proposalRequests.has(reqId);
          const clientTradeId = this.proposalRequests.get(reqId) || this.buyRequests.get(reqId);
          if (clientTradeId) {
            this.proposalRequests.delete(reqId);
            this.buyRequests.delete(reqId);
            this.notifyHandlers({
              msg_type: 'trade_error',
              clientTradeId,
              stage: wasProposal ? 'proposal' : 'buy',
              error: data.error.message || 'Trade request rejected by Deriv',
              code: data.error.code,
            });
          } else {
            this.notifyHandlers({
              msg_type: 'deriv_error',
              error: data.error.message || 'Deriv account error',
              code: data.error.code,
              orig_msg_type: data.msg_type,
            });
          }
          return;
        }

        if (data.msg_type === 'balance' && data.balance) {
          this.accountInfo = {
            ...this.accountInfo,
            isAuthorized: true,
            balance: Number(data.balance.balance || 0),
            currency: data.balance.currency || this.accountInfo.currency,
          };
          this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
          return;
        }

        if (data.msg_type === 'proposal' && data.proposal) {
          const clientTradeId = this.proposalRequests.get(reqId);
          if (!clientTradeId) return;
          this.proposalRequests.delete(reqId);
          this.proposalMeta.set(clientTradeId, data.proposal);
          this.notifyHandlers({ msg_type: 'proposal_success', clientTradeId, proposal: data.proposal });

          const askPrice = Number(data.proposal.ask_price);
          if (!data.proposal.id || !Number.isFinite(askPrice) || askPrice <= 0) {
            this.notifyHandlers({
              msg_type: 'trade_error',
              clientTradeId,
              stage: 'proposal',
              error: 'Deriv returned an invalid proposal.',
            });
            return;
          }

          const buyReqId = this.nextPrivateReqId();
          this.buyRequests.set(buyReqId, clientTradeId);
          this.sendAccount({ buy: data.proposal.id, price: askPrice, req_id: buyReqId });
          return;
        }

        if (data.msg_type === 'buy' && data.buy) {
          const clientTradeId = this.buyRequests.get(reqId);
          if (!clientTradeId) return;
          this.buyRequests.delete(reqId);
          const proposal = this.proposalMeta.get(clientTradeId);
          this.proposalMeta.delete(clientTradeId);
          this.notifyHandlers({ msg_type: 'buy_success', clientTradeId, buy: data.buy, proposal });

          if (data.buy.contract_id !== undefined) {
            this.sendAccount({
              proposal_open_contract: 1,
              contract_id: data.buy.contract_id,
              subscribe: 1,
              req_id: this.nextPrivateReqId(),
            });
          }
          return;
        }

        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          this.notifyHandlers({ msg_type: 'contract_update', contract: data.proposal_open_contract });
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
      this.notifyHandlers({ msg_type: 'account_connection_status', connected: false });
      if (!this.intentionalAccountClose) {
        this.accountInfo = { isAuthorized: false, appId: 'oauth2' };
        this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
      }
    };
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
    const quoteStr = Number(quote).toFixed(pip);
    const digit = Number.parseInt(quoteStr.charAt(quoteStr.length - 1), 10);
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

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Stake amount must be greater than zero.',
      });
      return false;
    }

    const reqId = this.nextPrivateReqId();
    this.proposalRequests.set(reqId, params.clientTradeId);

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

    if (params.barrier !== undefined && params.barrier !== '') {
      proposalRequest.barrier = String(params.barrier);
    }

    const sent = this.sendAccount(proposalRequest);
    if (!sent) this.proposalRequests.delete(reqId);
    return sent;
  }

  public buyContract(params: Omit<PlaceContractParams, 'clientTradeId'> & { clientTradeId?: string }): boolean {
    const clientTradeId = params.clientTradeId || `client-${Date.now()}`;
    return this.placeContract({ ...params, clientTradeId });
  }

  public subscribeTicks(symbol: string): void {
    this.subscribedSymbols.clear();
    this.subscribedSymbols.add(symbol);
    this.send({ forget_all: 'ticks' });
    this.send({ ticks: symbol, subscribe: 1 });
  }

  public subscribeTick(symbol: string): void {
    this.subscribedSymbols.add(symbol);
    this.send({ ticks: symbol, subscribe: 1 });
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
      count,
      style: 'ticks',
      adjust_start_time: 1,
    });
  }

  public requestActiveSymbols(): void {
    this.send({ active_symbols: 'brief', product_type: 'basic' });
  }

  public addListener(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    queueMicrotask(() => {
      try {
        handler({ msg_type: 'connection_status', connected: this.isConnected });
        handler({ msg_type: 'latency_update', latency: this.latency });
        if (this.accountInfo.isAuthorized) {
          handler({ msg_type: 'account_update', account: this.accountInfo });
        }
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
