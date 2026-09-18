function requestOrigin(req) {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${protoHeader || 'https'}://${hostHeader}`;
}

function clearCookie(name, secure) {
  const attrs = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configured = String(process.env.DERIV_APP_URL || process.env.APP_URL || '').trim();
  const origin = configured || requestOrigin(req);
  const secure = origin.startsWith('https://');
  res.setHeader('Set-Cookie', [
    clearCookie('deriv_oauth_access_token', secure),
    clearCookie('deriv_oauth_state', secure),
    clearCookie('deriv_oauth_verifier', secure),
    clearCookie('deriv_oauth_return', secure),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
