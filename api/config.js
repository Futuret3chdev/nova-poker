export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    facebookAppId: process.env.FACEBOOK_APP_ID || null,
    telegramBot: process.env.TELEGRAM_BOT_USERNAME || null,
    discordEnabled: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    appUrl: process.env.APP_URL || null
  });
}