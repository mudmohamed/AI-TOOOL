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

function requestOrigin(req) {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${protoHeader || 'https'}://${hostHeader}`;
}

function appOrigin(req) {
  const configured = String(process.env.DERIV_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '');
  return configured || requestOrigin(req);
}

function safeReturnTo(value) {
  const candidate = typeof value === 'string' ? value : '/matrix-bridge.html?mode=real';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/matrix-bridge.html?mode=real';
  return candidate;
}

function cookie(name, value, maxAge, secure) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

function clearCookie(name, secure) {
  return cookie(name, '', 0, secure);
}

function redirectWithError(res, returnTo, message) {
  const url = new URL(returnTo, 'https://local.invalid');
  url.searchParams.set('oauth_error', message);
  const target = `${url.pathname}${url.search}${url.hash}`;
  return res.redirect(302, target);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req);
  const origin = appOrigin(req);
  const secure = origin.startsWith('https://');
  const returnTo = safeReturnTo(cookies.deriv_oauth_return);
  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  const state = typeof req.query?.state === 'string' ? req.query.state : '';
  const providerError = typeof req.query?.error_description === 'string'
    ? req.query.error_description
    : typeof req.query?.error === 'string'
      ? req.query.error
      : '';

  if (providerError) {
    res.setHeader('Set-Cookie', [
      clearCookie('deriv_oauth_state', secure),
      clearCookie('deriv_oauth_verifier', secure),
      clearCookie('deriv_oauth_return', secure),
    ]);
    return redirectWithError(res, returnTo, providerError);
  }

  if (!code || !state || !cookies.deriv_oauth_state || state !== cookies.deriv_oauth_state) {
    return redirectWithError(res, returnTo, 'Deriv sign-in state validation failed. Please try again.');
  }

  const verifier = cookies.deriv_oauth_verifier;
  if (!verifier) {
    return redirectWithError(res, returnTo, 'Deriv sign-in verifier expired. Please try again.');
  }

  const clientId = String(
    process.env.DERIV_CLIENT_ID ||
      process.env.DERIV_OAUTH_CLIENT_ID ||
      process.env.DERIV_APP_ID ||
      '',
  ).trim();
  if (!clientId) {
    return redirectWithError(res, returnTo, 'Deriv OAuth client is not configured on the server.');
  }

  const redirectUri = `${origin}/api/deriv/oauth-callback`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });

  try {
    const tokenResponse = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenData.access_token) {
      const message = tokenData?.error_description || tokenData?.error || 'Deriv token exchange failed.';
      return redirectWithError(res, returnTo, message);
    }

    const expiresIn = Math.max(60, Math.min(Number(tokenData.expires_in) || 3600, 3600));
    res.setHeader('Set-Cookie', [
      cookie('deriv_oauth_access_token', tokenData.access_token, expiresIn, secure),
      clearCookie('deriv_oauth_state', secure),
      clearCookie('deriv_oauth_verifier', secure),
      clearCookie('deriv_oauth_return', secure),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, returnTo);
  } catch (error) {
    return redirectWithError(
      res,
      returnTo,
      error instanceof Error ? error.message : 'Could not complete Deriv sign-in.',
    );
  }
}
