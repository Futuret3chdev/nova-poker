import crypto from 'crypto';

function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (calculated !== hash) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN not configured on Vercel' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const initData = String(body.initData || '').trim();
  if (!initData) {
    res.status(400).json({ error: 'Missing initData' });
    return;
  }

  const user = verifyInitData(initData, botToken);
  if (!user?.id) {
    res.status(401).json({ error: 'Invalid Telegram data' });
    return;
  }

  res.status(200).json({
    id: user.id,
    username: user.username || '',
    first_name: user.first_name || '',
    last_name: user.last_name || ''
  });
}