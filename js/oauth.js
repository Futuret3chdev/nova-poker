import { MT_POKER_CONFIG } from './config.js';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const OAUTH_MSG = 'mtpoker_oauth';

function redirectUri() {
  const appUrl = (MT_POKER_CONFIG.appUrl || 'https://poker-stars-wheat.vercel.app').replace(/\/$/, '');
  const origin = window.location.origin;
  const isLocal = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
  if (isLocal) return `${origin}/auth/callback`;
  return `${appUrl}/auth/callback`;
}

function randomString(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARSET[b % CHARSET.length]).join('');
}

async function sha256Base64Url(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createPkce() {
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

export function openPopup(url, state) {
  return new Promise((resolve, reject) => {
    const w = 520;
    const h = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(
      url,
      'mtpoker_oauth',
      `width=${w},height=${h},left=${left},top=${top},noopener=no`
    );

    if (!popup) {
      reject(new Error('Popup blocked — allow popups for this site'));
      return;
    }

    const cleanup = () => {
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
    };

    const poll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Sign-in cancelled'));
      }
    }, 400);

    function onMessage(event) {
      const data = event.data;
      if (!data || data.type !== OAUTH_MSG) return;
      if (data.state !== state) return;

      const allowed = new Set([window.location.origin]);
      try {
        allowed.add(new URL(MT_POKER_CONFIG.appUrl).origin);
      } catch { /* noop */ }
      if (!allowed.has(event.origin) && event.origin !== '*') return;

      cleanup();
      try { popup.close(); } catch { /* noop */ }

      if (data.error) reject(new Error(data.error));
      else if (!data.code) reject(new Error('No authorization code received'));
      else resolve(data);
    }

    window.addEventListener('message', onMessage);
  });
}

export async function exchangeDiscordCode(code, verifier) {
  const redirect = redirectUri();
  const res = await fetch('/api/oauth/discord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirect_uri: redirect,
      code_verifier: verifier
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Discord token failed (${res.status})`);
  }
  return data;
}

export function discordAvatarUrl(me) {
  if (me.avatar) {
    const ext = me.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.${ext}?size=128`;
  }
  const index = me.discriminator && me.discriminator !== '0'
    ? parseInt(me.discriminator, 10) % 5
    : Number((BigInt(me.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function discordAuthorizeUrl(clientId, state, challenge) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export { redirectUri, randomString, OAUTH_MSG };