import crypto from 'node:crypto';

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function requestOrigin(req) {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = protoHeader || 'https';
  return `${proto}://${hostHeader}`;
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = String(
    process.env.DERIV_CLIENT_ID ||
      process.env.DERIV_OAUTH_CLIENT_ID ||
      process.env.DERIV_APP_ID ||
      '',
  ).trim();

  if (!clientId) {
    return res.status(500).json({
      error: 'Deriv OAuth is not configured. Set DERIV_CLIENT_ID in the deployment environment.',
    });
  }

  const origin = appOrigin(req);
  const redirectUri = `${origin}/api/deriv/oauth-callback`;
  const state = base64Url(crypto.randomBytes(32));
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  const returnTo = safeReturnTo(req.query?.return_to);
  const secure = origin.startsWith('https://');

  res.setHeader('Set-Cookie', [
    cookie('deriv_oauth_state', state, 600, secure),
    cookie('deriv_oauth_verifier', verifier, 600, secure),
    cookie('deriv_oauth_return', returnTo, 600, secure),
  ]);
  res.setHeader('Cache-Control', 'no-store');

  const authUrl = new URL('https://auth.deriv.com/oauth2/auth');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'trade');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const legacyAppId = String(process.env.DERIV_LEGACY_APP_ID || '').trim();
  if (legacyAppId) authUrl.searchParams.set('app_id', legacyAppId);

  return res.redirect(302, authUrl.toString());
}
