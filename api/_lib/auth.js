import crypto from 'crypto';

const PROVIDERS = {
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userUrl: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    clientId: () => process.env.DISCORD_CLIENT_ID,
    clientSecret: () => process.env.DISCORD_CLIENT_SECRET,
    mapUser: (u) => ({
      provider: 'discord',
      id: u.id,
      name: u.global_name || u.username,
      email: u.email,
      avatarUrl: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`
        : null
    })
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
    scope: 'public_profile,email',
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    mapUser: (u) => ({
      provider: 'facebook',
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.picture?.data?.url || null
    })
  }
};

export function appUrl(req) {
  return process.env.APP_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

export function signToken(payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not configured');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function getProvider(name) {
  return PROVIDERS[name] || null;
}

export async function exchangeCode(provider, code, redirectUri) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error('Unknown provider');

  const clientId = cfg.clientId();
  const clientSecret = cfg.clientSecret();
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth not configured`);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!tokenRes.ok) throw new Error('Token exchange failed');
  const tokens = await tokenRes.json();

  const userRes = await fetch(
    provider === 'facebook'
      ? `${cfg.userUrl}&access_token=${tokens.access_token}`
      : cfg.userUrl,
    provider === 'facebook' ? {} : { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!userRes.ok) throw new Error('Could not fetch user profile');
  const user = await userRes.json();
  return cfg.mapUser(user);
}

export function buildAuthRedirect(provider, redirect, base) {
  const cfg = PROVIDERS[provider];
  const clientId = cfg?.clientId();
  if (!cfg || !clientId) throw new Error(`${provider} OAuth not configured`);

  const callback = `${base}/api/auth/${provider}?action=callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    scope: cfg.scope,
    state: Buffer.from(JSON.stringify({ redirect })).toString('base64url')
  });

  return `${cfg.authUrl}?${params}`;
}

export function verifyTelegramAuth(data, botToken) {
  const check = { ...data };
  const hash = check.hash;
  delete check.hash;
  const pairs = Object.keys(check).sort().map((k) => `${k}=${check[k]}`);
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  if (hmac !== hash) return false;
  if (Date.now() / 1000 - Number(data.auth_date) > 86400) return false;
  return true;
}