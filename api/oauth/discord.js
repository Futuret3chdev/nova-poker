export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const code = String(body.code || '').trim();
  const redirectUri = String(body.redirect_uri || '').trim();
  const codeVerifier = String(body.code_verifier || '').trim();
  const clientId = process.env.DISCORD_CLIENT_ID || '1348440616442265641';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';

  if (!code || !redirectUri || !codeVerifier) {
    res.status(400).json({ error: 'Missing code, redirect_uri, or code_verifier' });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers,
      body: params
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({
        error: data.error_description || data.error || 'Discord token failed'
      });
      return;
    }

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const me = await meRes.json();
    if (!meRes.ok || !me?.id) {
      res.status(502).json({ error: 'Could not load Discord profile' });
      return;
    }

    res.status(200).json({ access_token: data.access_token, user: me });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Discord token request failed' });
  }
}