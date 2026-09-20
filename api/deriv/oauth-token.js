export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const body = req.body || {};
  const code = String(body.code || '').trim();
  const clientId = String(body.clientId || '').trim();
  const codeVerifier = String(body.codeVerifier || '').trim();
  const redirectUri = String(body.redirectUri || '').trim();

  if (!code || !clientId || !codeVerifier || !redirectUri) {
    res.status(400).json({ error: 'Missing OAuth callback parameters.' });
    return;
  }

  try {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const expectedOrigin = host ? `${proto}://${host}` : '';

    const redirect = new URL(redirectUri);
    if (redirect.protocol !== 'https:' || (expectedOrigin && redirect.origin !== expectedOrigin)) {
      res.status(400).json({ error: 'Invalid redirect URI.' });
      return;
    }

    const form = new URLSearchParams();
    form.set('grant_type', 'authorization_code');
    form.set('client_id', clientId);
    form.set('code', code);
    form.set('code_verifier', codeVerifier);
    form.set('redirect_uri', redirectUri);

    const tokenResponse = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    const payload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      res.status(tokenResponse.status).json({
        error: payload?.error || 'oauth_exchange_failed',
        error_description:
          payload?.error_description ||
          payload?.message ||
          'Deriv rejected the OAuth authorization code.',
      });
      return;
    }

    res.status(200).json({
      access_token: payload.access_token,
      token_type: payload.token_type || 'Bearer',
      expires_in: payload.expires_in || 3600,
    });
  } catch (error) {
    res.status(500).json({
      error: 'oauth_exchange_failed',
      error_description: error instanceof Error ? error.message : 'OAuth exchange failed.',
    });
  }
}
