import { MT_POKER_CONFIG } from './config.js';
import { applyAuthUser, clearAuth } from './profile.js';
import {
  createPkce, openPopup, exchangeDiscordCode, discordAvatarUrl,
  discordAuthorizeUrl, randomString
} from './oauth.js';

function allowDemo() {
  if (MT_POKER_CONFIG.demoAuth) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function accountToProfile(account) {
  return applyAuthUser({
    provider: account.provider,
    id: account.id,
    name: account.name,
    email: account.email || null,
    avatarUrl: account.avatarUrl || null
  });
}

function demoSignIn(provider) {
  if (!allowDemo()) return { ok: false, error: `${provider} sign-in is not configured yet` };
  const names = {
    google: 'Google Player',
    facebook: 'Facebook Player',
    discord: 'Discord Player',
    telegram: 'Telegram Player'
  };
  const profile = accountToProfile({
    id: `${provider}_${Date.now()}`,
    provider,
    name: names[provider] || 'Player'
  });
  return { ok: true, profile };
}

export function isProviderConfigured(provider) {
  const cfg = MT_POKER_CONFIG;
  switch (provider) {
    case 'google': return !!cfg.googleClientId;
    case 'facebook': return !!cfg.facebookAppId;
    case 'discord': return !!cfg.discordClientId || allowDemo();
    case 'telegram': return !!cfg.telegramBotUsername;
    default: return false;
  }
}

export function getAuthLabel(profile) {
  if (!profile?.authProvider) return 'Guest';
  const labels = { google: 'Google', discord: 'Discord', facebook: 'Facebook', telegram: 'Telegram' };
  return labels[profile.authProvider] || profile.authProvider;
}

export function signOut() {
  return clearAuth();
}

function initGoogle(onSuccess, onError) {
  const clientId = MT_POKER_CONFIG.googleClientId;
  if (!clientId || !window.google?.accounts?.id) return;

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const profile = accountToProfile({
          id: `google_${payload.sub}`,
          provider: 'google',
          name: payload.name || payload.given_name || 'Google Player',
          email: payload.email,
          avatarUrl: payload.picture
        });
        onSuccess?.(profile);
      } catch (err) {
        onError?.(err);
      }
    },
    auto_select: false
  });
}

export function renderGoogleButton(container, onSuccess, onError) {
  if (!container) return;
  const clientId = MT_POKER_CONFIG.googleClientId;
  if (!clientId) {
    container.innerHTML = '<button type="button" class="auth-btn google" disabled>Gmail (not configured)</button>';
    return;
  }
  if (window.google?.accounts?.id) {
    container.innerHTML = '';
    initGoogle(onSuccess, onError);
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 280
    });
  }
}

function initFacebook() {
  const appId = MT_POKER_CONFIG.facebookAppId;
  if (!appId || !window.FB) return;
  FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
}

export async function signInFacebook(onSuccess, onError) {
  const appId = MT_POKER_CONFIG.facebookAppId;
  if (!appId || !window.FB) {
    const demo = demoSignIn('facebook');
    if (demo.ok) { onSuccess?.(demo.profile); return demo.profile; }
    throw new Error(demo.error);
  }

  return new Promise((resolve, reject) => {
    FB.login((response) => {
      if (!response.authResponse) {
        const err = new Error('Facebook sign-in cancelled');
        onError?.(err);
        reject(err);
        return;
      }
      FB.api('/me', { fields: 'id,name,email,picture.type(large)' }, (me) => {
        if (!me?.id) {
          const err = new Error('Could not load Facebook profile');
          onError?.(err);
          reject(err);
          return;
        }
        const profile = accountToProfile({
          id: `facebook_${me.id}`,
          provider: 'facebook',
          name: me.name || 'Facebook Player',
          email: me.email,
          avatarUrl: me.picture?.data?.url
        });
        onSuccess?.(profile);
        resolve(profile);
      });
    }, { scope: 'public_profile,email' });
  });
}

export async function signInDiscord(onSuccess, onError) {
  const clientId = MT_POKER_CONFIG.discordClientId;
  if (!clientId) {
    const demo = demoSignIn('discord');
    if (demo.ok) { onSuccess?.(demo.profile); return demo.profile; }
    throw new Error(demo.error);
  }

  try {
    const { verifier, challenge } = await createPkce();
    const state = randomString(16);
    sessionStorage.setItem('mtpoker_oauth_provider', 'discord');
    sessionStorage.setItem(`mtpoker_pkce_${state}`, verifier);

    const url = discordAuthorizeUrl(clientId, state, challenge);
    const result = await openPopup(url, state);
    const verifierStored = sessionStorage.getItem(`mtpoker_pkce_${state}`);
    sessionStorage.removeItem(`mtpoker_pkce_${state}`);

    const data = await exchangeDiscordCode(result.code, verifierStored);
    const me = data.user;
    if (!me?.id) throw new Error('Could not load Discord profile');

    const profile = accountToProfile({
      id: `discord_${me.id}`,
      provider: 'discord',
      name: me.global_name || me.username || 'Discord Player',
      avatarUrl: discordAvatarUrl(me)
    });
    onSuccess?.(profile);
    return profile;
  } catch (err) {
    const hint = err.message?.includes('redirect')
      ? `${err.message}. Discord redirect must be: ${MT_POKER_CONFIG.appUrl}/auth/callback`
      : err.message;
    onError?.(new Error(hint || 'Discord sign-in failed'));
    throw err;
  }
}

function signInTelegramUser(tgUser, onSuccess) {
  if (!tgUser?.id) return { ok: false, error: 'Invalid Telegram user' };
  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')
    || tgUser.username || 'Telegram Player';
  const profile = accountToProfile({
    id: `telegram_${tgUser.id}`,
    provider: 'telegram',
    name,
    avatarUrl: tgUser.photo_url || null
  });
  onSuccess?.(profile);
  return { ok: true, profile };
}

export function renderTelegramWidget(container, onSuccess, onError) {
  if (!container) return;
  const bot = MT_POKER_CONFIG.telegramBotUsername;
  const mode = MT_POKER_CONFIG.telegramAuthMode || 'deeplink';

  if (!bot) {
    container.innerHTML = '';
    return;
  }

  if (mode === 'deeplink') {
    container.innerHTML = `<button type="button" class="auth-btn telegram" id="btn-telegram-deeplink">
      <span class="auth-icon">✈️</span> Telegram
    </button>`;
    container.querySelector('#btn-telegram-deeplink')?.addEventListener('click', async () => {
      try {
        await startTelegramDeepLink(onSuccess, onError);
      } catch (err) {
        onError?.(err);
      }
    });
    return;
  }

  window.onTelegramAuth = (user) => {
    const result = signInTelegramUser(user, onSuccess);
    if (!result.ok) onError?.(new Error(result.error));
  };

  container.innerHTML = '';
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', bot.replace('@', ''));
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '8');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  script.setAttribute('data-request-access', 'write');
  container.appendChild(script);
}

export async function startTelegramDeepLink(onSuccess, onError) {
  const bot = MT_POKER_CONFIG.telegramBotUsername?.replace('@', '');
  if (!bot) throw new Error('Telegram bot not configured');

  const res = await fetch('/api/telegram/session', { method: 'POST' });
  if (!res.ok) throw new Error('Could not start Telegram sign-in');
  const { deepLink } = await res.json();
  if (!deepLink) throw new Error('Could not start Telegram sign-in');

  window.open(deepLink, '_blank');
  onError?.(new Error(`Open @${bot} in Telegram and tap Start, then use the finish link`));
  return deepLink;
}

export async function exchangeTelegramLoginToken(token, onSuccess) {
  const res = await fetch(`/api/telegram/exchange?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error('Could not finish Telegram sign-in');
  const user = await res.json();
  return signInTelegramUser(user, onSuccess);
}

export async function handleAuthCallback(onSuccess) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('tg_auth');
  if (!token) return null;

  window.history.replaceState({}, '', window.location.pathname);
  const result = await exchangeTelegramLoginToken(token, onSuccess);
  return result.profile;
}

export function bootAuthProviders(onSuccess, onError) {
  if (MT_POKER_CONFIG.googleClientId) {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initGoogle(onSuccess, onError);
      renderGoogleButton(document.getElementById('google-signin-btn'), onSuccess, onError);
    };
    document.head.appendChild(script);
  }

  if (MT_POKER_CONFIG.facebookAppId) {
    window.fbAsyncInit = initFacebook;
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    document.head.appendChild(script);
  }
}