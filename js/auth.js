import { applyAuthUser, clearAuth, loadProfile } from './profile.js';

let authConfig = null;

export async function fetchAuthConfig() {
  if (authConfig) return authConfig;
  try {
    const res = await fetch('/api/config');
    if (res.ok) authConfig = await res.json();
  } catch (_) { /* offline */ }
  authConfig = authConfig || {
    googleClientId: null,
    facebookAppId: null,
    telegramBot: null,
    discordEnabled: false,
    appUrl: window.location.origin
  };
  return authConfig;
}

export function startOAuth(provider) {
  const redirect = `${window.location.origin}${window.location.pathname}`;
  window.location.href = `/api/auth/${provider}?redirect=${encodeURIComponent(redirect)}`;
}

export async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  const error = params.get('auth_error');

  if (error) {
    window.history.replaceState({}, '', window.location.pathname);
    throw new Error(decodeURIComponent(error));
  }

  if (!token) return null;

  try {
    const res = await fetch(`/api/auth/session?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error('Invalid session');
    const user = await res.json();
    const profile = applyAuthUser(user);
    window.history.replaceState({}, '', window.location.pathname);
    return profile;
  } catch (err) {
    window.history.replaceState({}, '', window.location.pathname);
    throw err;
  }
}

export async function initGoogleSignIn(buttonEl, onSuccess, onError) {
  const config = await fetchAuthConfig();
  if (!config.googleClientId) {
    buttonEl?.setAttribute('disabled', 'true');
    buttonEl?.setAttribute('title', 'Google sign-in not configured');
    return false;
  }

  await loadGoogleScript();
  google.accounts.id.initialize({
    client_id: config.googleClientId,
    callback: (response) => {
      try {
        const payload = parseJwt(response.credential);
        const profile = applyAuthUser({
          provider: 'google',
          id: payload.sub,
          name: payload.name,
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

  if (buttonEl) {
    google.accounts.id.renderButton(buttonEl, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 280
    });
  }
  return true;
}

export async function signInFacebook(onSuccess, onError) {
  const config = await fetchAuthConfig();
  if (!config.facebookAppId) throw new Error('Facebook sign-in not configured on server');

  await loadFacebookSdk(config.facebookAppId);
  return new Promise((resolve, reject) => {
    FB.login((response) => {
      if (response.authResponse) {
        FB.api('/me', { fields: 'id,name,email,picture.type(large)' }, (user) => {
          if (!user?.id) {
            const err = new Error('Facebook login failed');
            onError?.(err);
            reject(err);
            return;
          }
          const profile = applyAuthUser({
            provider: 'facebook',
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.picture?.data?.url
          });
          onSuccess?.(profile);
          resolve(profile);
        });
      } else {
        const err = new Error('Facebook login cancelled');
        onError?.(err);
        reject(err);
      }
    }, { scope: 'public_profile,email' });
  });
}

export async function signInDiscord() {
  startOAuth('discord');
}

export async function initTelegramWidget(containerEl, onSuccess, onError) {
  const config = await fetchAuthConfig();
  if (!config.telegramBot || !containerEl) return false;

  window.onTelegramAuth = async (user) => {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Telegram verification failed');
      const verified = await res.json();
      const profile = applyAuthUser(verified);
      onSuccess?.(profile);
    } catch (err) {
      onError?.(err);
    }
  };

  containerEl.innerHTML = '';
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', config.telegramBot);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-radius', '8');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  script.setAttribute('data-request-access', 'write');
  containerEl.appendChild(script);
  return true;
}

export function signOut() {
  return clearAuth();
}

export function getAuthLabel(profile) {
  if (!profile?.authProvider) return 'Guest';
  const labels = {
    google: 'Google',
    discord: 'Discord',
    facebook: 'Facebook',
    telegram: 'Telegram'
  };
  return labels[profile.authProvider] || profile.authProvider;
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map((c) =>
    `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`
  ).join('')));
}

function loadGoogleScript() {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve) => {
    window.fbAsyncInit = () => {
      FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    document.head.appendChild(s);
  });
}

export { loadProfile };