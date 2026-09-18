function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function normalizeAccounts(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  if (Array.isArray(payload)) return payload;
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  return [];
}

function accountType(account) {
  return String(account?.account_type || account?.type || '').toLowerCase();
}

function accountId(account) {
  return String(account?.account_id || account?.id || account?.loginid || '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  const token = parseCookies(req).deriv_oauth_access_token;
  if (!token) return res.status(401).json({ error: 'No active Deriv OAuth session.' });

  const requestedMode = String(req.query?.mode || 'real').toLowerCase() === 'demo' ? 'demo' : 'real';

  try {
    const accountsResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const accountsPayload = await accountsResponse.json().catch(() => ({}));
    if (!accountsResponse.ok) {
      const message = accountsPayload?.errors?.[0]?.message || accountsPayload?.error || 'Could not load Deriv accounts.';
      return res.status(accountsResponse.status).json({ error: message });
    }

    const accounts = normalizeAccounts(accountsPayload).filter((account) => accountId(account));
    const available = {
      demo: accounts.some((account) => accountType(account) === 'demo'),
      real: accounts.some((account) => accountType(account) === 'real'),
    };
    const selected =
      accounts.find((account) => accountType(account) === requestedMode) ||
      accounts.find((account) => requestedMode === 'real' && accountType(account) !== 'demo') ||
      accounts[0];

    if (!selected) {
      return res.status(404).json({ error: `No Deriv ${requestedMode.toUpperCase()} Options account was found.` });
    }

    const id = accountId(selected);
    const otpResponse = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(id)}/otp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );
    const otpPayload = await otpResponse.json().catch(() => ({}));
    const wsUrl = otpPayload?.data?.url || otpPayload?.url || '';
    if (!otpResponse.ok || !String(wsUrl).startsWith('wss://')) {
      const message = otpPayload?.errors?.[0]?.message || otpPayload?.error || 'Deriv did not return an authenticated WebSocket URL.';
      return res.status(otpResponse.status || 502).json({ error: message });
    }

    return res.status(200).json({
      account: {
        account_id: id,
        account_type: accountType(selected) || requestedMode,
        currency: selected.currency || 'USD',
        balance: Number(selected.balance || 0),
      },
      available,
      ws_url: wsUrl,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Could not establish a Deriv account session.',
    });
  }
}
