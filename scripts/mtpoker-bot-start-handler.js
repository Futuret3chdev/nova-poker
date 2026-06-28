/**
 * Add this to your mod_futuret3ch_bot /start handler (alongside mtepop handler).
 * When a user opens t.me/mod_futuret3ch_bot?start=mtpoker_<code>_<sig>
 * this calls MT Poker and replies with a finish-login link.
 *
 * Env vars on your bot server:
 *   MTEPOP_WEBHOOK_SECRET  — same value as TELEGRAM_WEBHOOK_SECRET on Vercel
 */

async function handleMtPokerStart(ctx, startPayload) {
  const parsed = /^mtpoker_([a-f0-9]+)_([a-f0-9]+)$/i.exec(startPayload || '');
  if (!parsed) return false;

  const [, code, sig] = parsed;
  const from = ctx.from || ctx.message?.from;
  if (!from?.id) return false;

  const secret = process.env.MTEPOP_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    await ctx.reply('MT Poker sign-in is not configured on the bot yet.');
    return true;
  }

  try {
    const res = await fetch('https://poker-stars-wheat.vercel.app/api/telegram/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-secret': secret
      },
      body: JSON.stringify({
        code,
        sig,
        id: from.id,
        username: from.username || '',
        first_name: from.first_name || '',
        last_name: from.last_name || ''
      })
    });

    const data = await res.json();
    if (!res.ok || !data.loginUrl) {
      await ctx.reply('Could not link MT Poker. Try again from the game.');
      return true;
    }

    await ctx.reply(data.message || 'MT Poker linked!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Finish MT Poker sign-in', url: data.loginUrl }]]
      }
    });
  } catch (err) {
    console.error('MT Poker link failed:', err);
    await ctx.reply('Could not reach MT Poker. Try again in a moment.');
  }

  return true;
}

module.exports = { handleMtPokerStart };