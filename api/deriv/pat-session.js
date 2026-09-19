export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = String(req.body?.token || '').trim();
  const appId = String(req.body?.app_id || '').trim();
  const mode = String(req.body?.mode || 'real').toLowerCase() === 'demo' ? 'demo' : 'real';

  if (!token) return res.status(400).json({ error: 'Deriv Personal Access Token is required.' });
  if (!appId) return res.status(400).json({ error: 'Deriv PAT App ID is required.' });
  if (token.length > 4096 || appId.length > 128) {
    return res.status(400).json({ error: 'Invalid authentication input.' });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Deriv-App-ID': appId,
    Accept: 'application/json',
  };

  const derivError = (payload, fallback) => {
    const first = Array.isArray(payload?.errors) ? payload.errors[0] : null;
    return first?.detail?.message || first?.message || payload?.error?.message || payload?.message || fallback;
  };

  const accountIdOf = (account) =>
    String(account?.account_id || account?.loginid || account?.login_id || account?.id || '').trim();

  const isDemoAccount = (account) => {
    const type = String(account?.account_type || account?.type || account?.accountType || '').toLowerCase();
    const id = accountIdOf(account).toUpperCase();
    return Boolean(account?.is_virtual) || type === 'demo' || type === 'virtual' || id.startsWith('VRTC');
  };

  try {
    const accountsResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      method: 'GET',
      headers,
    });
    const accountsPayload = await accountsResponse.json().catch(() => ({}));

    if (!accountsResponse.ok) {
      return res.status(accountsResponse.status).json({
        error: derivError(accountsPayload, 'Deriv rejected the token or App ID.'),
      });
    }

    const raw =
      (Array.isArray(accountsPayload?.data) && accountsPayload.data) ||
      (Array.isArray(accountsPayload?.data?.accounts) && accountsPayload.data.accounts) ||
      (Array.isArray(accountsPayload?.accounts) && accountsPayload.accounts) ||
      [];

    const accounts = raw.filter((account) => accountIdOf(account));
    const realAccounts = accounts.filter((account) => !isDemoAccount(account));
    const demoAccounts = accounts.filter((account) => isDemoAccount(account));
    const selected = mode === 'real' ? realAccounts[0] : demoAccounts[0];

    if (!selected) {
      return res.status(404).json({
        error: mode === 'real'
          ? 'No Deriv real Options account was found for this token.'
          : 'No Deriv demo Options account was found for this token.',
      });
    }

    const accountId = accountIdOf(selected);
    const otpResponse = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
      { method: 'POST', headers },
    );
    const otpPayload = await otpResponse.json().catch(() => ({}));

    if (!otpResponse.ok) {
      return res.status(otpResponse.status).json({
        error: derivError(otpPayload, 'Deriv could not create the authenticated WebSocket session.'),
      });
    }

    const wsUrl = String(
      otpPayload?.data?.url ||
      otpPayload?.data?.ws_url ||
      otpPayload?.url ||
      otpPayload?.ws_url ||
      '',
    );

    if (!wsUrl.startsWith('wss://api.derivws.com/')) {
      return res.status(502).json({ error: 'Deriv returned an invalid authenticated WebSocket URL.' });
    }

    const balanceValue =
      typeof selected?.balance === 'object'
        ? selected.balance?.balance ?? selected.balance?.amount
        : selected?.balance;

    return res.status(200).json({
      account: {
        account_id: accountId,
        account_type: isDemoAccount(selected) ? 'demo' : 'real',
        currency: selected?.currency || 'USD',
        balance: Number(balanceValue || 0),
      },
      available: {
        demo: demoAccounts.length > 0,
        real: realAccounts.length > 0,
      },
      ws_url: wsUrl,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to reach Deriv.',
    });
  }
}
