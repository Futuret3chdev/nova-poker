import { verifyTelegramAuth } from '../_lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(503).json({ error: 'Telegram auth not configured' });
    return;
  }

  const data = req.body;
  if (!verifyTelegramAuth(data, botToken)) {
    res.status(401).json({ error: 'Invalid Telegram auth' });
    return;
  }

  res.status(200).json({
    provider: 'telegram',
    id: String(data.id),
    name: [data.first_name, data.last_name].filter(Boolean).join(' '),
    email: data.username ? `${data.username}@telegram.user` : null,
    avatarUrl: data.photo_url || null
  });
}