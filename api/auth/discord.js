import { appUrl, buildAuthRedirect, exchangeCode, signToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  const base = appUrl(req);
  const { action, code, state, error, error_description: desc } = req.query;

  if (error) {
    const msg = encodeURIComponent(desc || error);
    res.redirect(302, `/?auth_error=${msg}`);
    return;
  }

  if (action === 'callback' && code) {
    try {
      const redirect = state
        ? JSON.parse(Buffer.from(state, 'base64url').toString()).redirect || '/'
        : '/';
      const callback = `${base}/api/auth/discord?action=callback`;
      const user = await exchangeCode('discord', code, callback);
      const token = signToken(user);
      const sep = redirect.includes('?') ? '&' : '?';
      res.redirect(302, `${redirect}${sep}auth_token=${encodeURIComponent(token)}`);
    } catch (err) {
      res.redirect(302, `/?auth_error=${encodeURIComponent(err.message)}`);
    }
    return;
  }

  try {
    const redirect = req.query.redirect || '/';
    res.redirect(302, buildAuthRedirect('discord', redirect, base));
  } catch (err) {
    res.redirect(302, `/?auth_error=${encodeURIComponent(err.message)}`);
  }
}