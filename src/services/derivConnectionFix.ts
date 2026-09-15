import { derivService } from './derivWs';

const BRIDGE_URL = 'https://fasterpro-analyzer.vercel.app/matrix-bridge.html';

type AccountMode = 'DEMO' | 'REAL';

function decodeBase64UrlJson(value: string): any {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function cleanBridgeHash(): void {
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}

function consumeBridgeReturn(): void {
  if (typeof window === 'undefined' || !window.location.hash) return;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const encodedSession = params.get('deriv_session');
  const error = params.get('deriv_error');
  if (!encodedSession && !error) return;

  cleanBridgeHash();

  if (error) {
    try {
      (derivService as any).notifyHandlers?.({
        msg_type: 'auth_error',
        error: decodeURIComponent(error),
      });
    } catch {}
    return;
  }

  try {
    const payload = decodeBase64UrlJson(encodedSession || '');
    const account = payload?.account || {};
    const available = payload?.available || {};
    const wsUrl = String(payload?.ws_url || '');

    if (!wsUrl.startsWith('wss://') || !account.account_id) {
      throw new Error('Deriv returned an incomplete authenticated account session.');
    }

    // This is deliberately connection-only. It reuses the existing Matrix service's
    // balance, proposal, buy, contract-id and proposal_open_contract handling.
    (derivService as any).applyBridgeAccount(account, available, wsUrl);
  } catch (err: any) {
    console.error('Could not restore the Deriv account session:', err);
    try {
      (derivService as any).notifyHandlers?.({
        msg_type: 'auth_error',
        error: err?.message || 'Could not restore the Deriv account session.',
      });
    } catch {}
  }
}

export function installDerivConnectionFix(): void {
  if (typeof window === 'undefined') return;

  // Consume the OAuth/OTP result before React mounts so App receives the real
  // account via derivService.getAccountInfo() / the normal account listener.
  consumeBridgeReturn();

  const service = derivService as any;

  service.connectTradingAccount = (mode: AccountMode): Promise<boolean> => {
    const requestedMode: AccountMode = mode === 'REAL' ? 'REAL' : 'DEMO';
    const bridge = new URL(BRIDGE_URL);
    const returnTo = new URL(window.location.href);
    returnTo.hash = '';

    bridge.searchParams.set('mode', requestedMode.toLowerCase());
    bridge.searchParams.set('return_origin', window.location.origin);
    bridge.searchParams.set('return_to', returnTo.toString());

    // Full-page OAuth is intentional. Cross-origin OAuth providers can sever a
    // popup's window.opener via COOP; returning through the URL fragment avoids
    // that failure while keeping the authenticated ws_url out of HTTP requests.
    window.location.assign(bridge.toString());
    return Promise.resolve(true);
  };

  service.getOAuthRedirectUrl = (): string => {
    const bridge = new URL(BRIDGE_URL);
    const returnTo = new URL(window.location.href);
    returnTo.hash = '';
    bridge.searchParams.set('return_origin', window.location.origin);
    bridge.searchParams.set('return_to', returnTo.toString());
    return bridge.toString();
  };
}
