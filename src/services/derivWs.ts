import { DerivAccountInfo } from '../types';

type MessageHandler = (data: any) => void;

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
  private appId = '1089';
  private apiToken = '';
  private readonly url = 'wss://ws.derivws.com/websockets/v3';
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private isConnected = false;
  private latency = 0;
  private lastPingTime = 0;
  private subscribedSymbols = new Set<string>();
  private proposalMeta = new Map<string, any>();
  private accountInfo: DerivAccountInfo = {
    isAuthorized: false,
    appId: '1089',
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
    this.parseOAuthCallback();

    try {
      const savedAppId = localStorage.getItem('deriv_app_id');
      const savedToken = sessionStorage.getItem('deriv_api_token');
      if (savedAppId) this.appId = savedAppId;
      if (savedToken) this.apiToken = savedToken;
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    this.connect();
  }

  private getPassthrough(data: any): any {
    return data?.echo_req?.passthrough || data?.passthrough || null;
  }

  public parseOAuthCallback(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      let queryString = '';
      if (window.location.search?.includes('token')) {
        queryString = window.location.search.replace(/^\?/, '');
      } else if (window.location.hash?.includes('token')) {
        queryString = window.location.hash.replace(/^#/, '');
        if (queryString.includes('?')) queryString = queryString.split('?')[1];
      }

      if (!queryString) return false;

      const params = new URLSearchParams(queryString);
      const accountsList: Array<{
        loginid: string;
        currency: string;
        is_virtual: boolean;
        token?: string;
      }> = [];
      let primaryToken = '';
      let index = 1;

      while (params.has(`acct${index}`) && params.has(`token${index}`)) {
        const loginid = params.get(`acct${index}`) || '';
        const token = params.get(`token${index}`) || '';
        const currency = params.get(`cur${index}`) || 'USD';
        const is_virtual = loginid.startsWith('VRTC') || loginid.startsWith('VR');
        if (token) {
          accountsList.push({ loginid, currency, is_virtual, token });
          if (!primaryToken) primaryToken = token;
        }
        index += 1;
      }

      if (accountsList.length === 0 && params.has('token')) {
        const token = params.get('token') || '';
        const loginid = params.get('acct') || '';
        if (token) {
          primaryToken = token;
          accountsList.push({
            loginid,
            currency: params.get('cur') || 'USD',
            is_virtual: loginid.startsWith('VRTC') || loginid.startsWith('VR'),
            token,
          });
        }
      }

      if (!primaryToken) return false;

      this.apiToken = primaryToken;
      sessionStorage.setItem('deriv_api_token', primaryToken);
      sessionStorage.setItem('deriv_accounts_list', JSON.stringify(accountsList));

      const cleanUrl = `${window.location.pathname}${window.location.hash && !window.location.hash.includes('token') ? window.location.hash : ''}`;
      window.history.replaceState({}, document.title, cleanUrl || '/');
      return true;
    } catch (error) {
      console.warn('Unable to parse Deriv OAuth callback:', error);
      return false;
    }
  }

  public getOAuthRedirectUrl(customAppId?: string): string {
    const id = customAppId?.trim() || this.appId;
    return `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(id)}&l=EN&brand=deriv`;
  }

  public switchAccount(loginId: string): void {
    try {
      const saved = sessionStorage.getItem('deriv_accounts_list');
      if (!saved) return;
      const list = JSON.parse(saved);
      const match = Array.isArray(list) ? list.find((a: any) => a.loginid === loginId) : null;
      if (match?.token) this.authorize(match.token);
    } catch (error) {
      console.warn('Unable to switch Deriv account:', error);
    }
  }

  public connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      this.ws = new WebSocket(`${this.url}?app_id=${encodeURIComponent(this.appId)}`);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyHandlers({ msg_type: 'connection_status', connected: true });
        this.startHeartbeat();
        if (this.apiToken) this.authorize(this.apiToken);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const passthrough = this.getPassthrough(data);
          const clientTradeId = passthrough?.clientTradeId as string | undefined;

          if (data.msg_type === 'ping') {
            this.latency = this.lastPingTime ? Date.now() - this.lastPingTime : 0;
            this.notifyHandlers({ msg_type: 'latency_update', latency: this.latency });
            return;
          }

          if (data.error) {
            this.notifyHandlers({
              msg_type: 'deriv_error',
              error: data.error.message || 'Deriv API error',
              code: data.error.code,
              orig_msg_type: data.msg_type,
              clientTradeId,
              stage: passthrough?.stage,
              echo_req: data.echo_req,
            });

            if (clientTradeId && (data.echo_req?.proposal || data.echo_req?.buy)) {
              this.notifyHandlers({
                msg_type: 'trade_error',
                clientTradeId,
                stage: passthrough?.stage || (data.echo_req?.proposal ? 'proposal' : 'buy'),
                error: data.error.message || 'Trade request rejected by Deriv',
                code: data.error.code,
              });
            }
          }

          if (data.msg_type === 'authorize') {
            if (data.authorize) {
              const mappedAccounts = Array.isArray(data.authorize.account_list)
                ? data.authorize.account_list.map((acc: any) => ({
                    loginid: acc.loginid,
                    currency: acc.currency,
                    is_virtual: Boolean(acc.is_virtual),
                  }))
                : undefined;

              this.accountInfo = {
                isAuthorized: true,
                appId: this.appId,
                loginId: data.authorize.loginid,
                email: data.authorize.email,
                currency: data.authorize.currency,
                balance: Number(data.authorize.balance || 0),
                isVirtual: Boolean(data.authorize.is_virtual),
                accountsList: mappedAccounts,
              };
              this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
              this.send({ balance: 1, subscribe: 1 });
            } else if (data.error) {
              this.accountInfo = { isAuthorized: false, appId: this.appId };
              this.notifyHandlers({
                msg_type: 'auth_error',
                error: data.error.message || 'Authorization failed',
              });
            }
          }

          if (data.msg_type === 'balance' && data.balance) {
            this.accountInfo = {
              ...this.accountInfo,
              balance: Number(data.balance.balance || 0),
              currency: data.balance.currency || this.accountInfo.currency,
            };
            this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
          }

          if (data.msg_type === 'proposal' && data.proposal) {
            if (clientTradeId) {
              this.proposalMeta.set(clientTradeId, data.proposal);
            }

            this.notifyHandlers({
              msg_type: 'proposal_success',
              clientTradeId,
              proposal: data.proposal,
            });

            if (clientTradeId && passthrough?.autoBuy === true && data.proposal.id) {
              const askPrice = Number(data.proposal.ask_price);
              if (!Number.isFinite(askPrice) || askPrice <= 0) {
                this.notifyHandlers({
                  msg_type: 'trade_error',
                  clientTradeId,
                  stage: 'proposal',
                  error: 'Deriv returned an invalid proposal ask price.',
                });
              } else {
                this.send({
                  buy: data.proposal.id,
                  price: askPrice,
                  passthrough: {
                    clientTradeId,
                    stage: 'buy',
                  },
                });
              }
            }
          }

          if (data.msg_type === 'buy' && data.buy) {
            const proposal = clientTradeId ? this.proposalMeta.get(clientTradeId) : undefined;
            this.notifyHandlers({
              msg_type: 'buy_success',
              clientTradeId,
              buy: data.buy,
              proposal,
            });

            if (clientTradeId) this.proposalMeta.delete(clientTradeId);

            if (data.buy.contract_id !== undefined) {
              this.send({
                proposal_open_contract: 1,
                contract_id: data.buy.contract_id,
                subscribe: 1,
              });
            }
          }

          if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
            this.notifyHandlers({
              msg_type: 'contract_update',
              contract: data.proposal_open_contract,
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
          console.error('Error parsing Deriv WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        this.isConnected = false;
        this.notifyHandlers({ msg_type: 'connection_status', connected: false });
        console.warn('Deriv WebSocket connection error:', error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.notifyHandlers({ msg_type: 'connection_status', connected: false });

        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 3000);
        }
      };
    } catch (error) {
      this.isConnected = false;
      this.notifyHandlers({ msg_type: 'connection_status', connected: false });
      console.error('Failed to initiate Deriv WebSocket connection:', error);
    }
  }

  public authorize(token: string): void {
    this.apiToken = token.trim();
    try {
      if (this.apiToken) sessionStorage.setItem('deriv_api_token', this.apiToken);
      else sessionStorage.removeItem('deriv_api_token');
    } catch {}
    if (this.apiToken) this.send({ authorize: this.apiToken });
  }

  public logout(): void {
    this.apiToken = '';
    this.proposalMeta.clear();
    this.accountInfo = { isAuthorized: false, appId: this.appId };
    try {
      sessionStorage.removeItem('deriv_api_token');
      sessionStorage.removeItem('deriv_accounts_list');
    } catch {}
    this.notifyHandlers({ msg_type: 'account_update', account: this.accountInfo });
    this.reconnect(this.appId, '');
  }

  public connectPublicStream(): void {
    this.reconnect(this.appId, '');
  }

  public reconnect(newAppId?: string, newToken?: string): void {
    if (newAppId?.trim()) {
      this.appId = newAppId.trim();
      try {
        localStorage.setItem('deriv_app_id', this.appId);
      } catch {}
    }

    if (newToken !== undefined) {
      this.apiToken = newToken.trim();
      try {
        if (this.apiToken) sessionStorage.setItem('deriv_api_token', this.apiToken);
        else sessionStorage.removeItem('deriv_api_token');
      } catch {}
    }

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

  public placeContract(params: PlaceContractParams): boolean {
    if (!this.accountInfo.isAuthorized || !this.isConnected) {
      this.notifyHandlers({
        msg_type: 'trade_error',
        clientTradeId: params.clientTradeId,
        stage: 'preflight',
        error: 'Connect and authorize a Deriv account before placing a contract.',
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

    const proposalRequest: any = {
      proposal: 1,
      amount,
      basis: 'stake',
      contract_type: params.contract_type,
      currency: this.accountInfo.currency || 'USD',
      duration: params.duration || 1,
      duration_unit: params.duration_unit || 't',
      symbol: params.symbol,
      passthrough: {
        clientTradeId: params.clientTradeId,
        stage: 'proposal',
        autoBuy: true,
      },
    };

    if (params.barrier !== undefined && params.barrier !== '') {
      proposalRequest.barrier = String(params.barrier);
    }

    return this.send(proposalRequest);
  }

  // Compatibility alias used by existing UI components. It now always performs
  // the real Deriv proposal -> buy flow instead of sending a local/simulated order.
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
