import { evaluateHand } from './hand-evaluator.js';

function handStrength(hole, community) {
  if (community.length === 0) {
    const [a, b] = hole.map((c) => c.rank).sort((x, y) => y - x);
    const suited = hole[0].suit === hole[1].suit;
    const paired = a === b;
    if (paired && a >= 10) return 0.92;
    if (paired) return 0.7 + a / 40;
    if (a >= 13 && b >= 10) return 0.82 + (suited ? 0.05 : 0);
    if (a >= 12 && b >= 10) return 0.68;
    if (suited && a - b <= 4 && a >= 9) return 0.55;
    return 0.2 + a / 30;
  }
  const ev = evaluateHand(hole, community);
  const cat = ev.score[0];
  const strength = [0.15, 0.35, 0.5, 0.62, 0.72, 0.8, 0.88, 0.94, 0.98, 1][cat] || 0.15;
  return strength + (Math.random() * 0.08 - 0.04);
}

export function decideAction(player, game) {
  const toCall = game.currentBet - player.betThisRound;
  const potOdds = toCall / (game.pot + toCall + 1);
  const str = handStrength(player.hole, game.community);
  const aggression = 0.35 + Math.random() * 0.4;
  const stackPressure = player.chips < game.bigBlind * 8;

  if (player.chips <= 0) return { action: 'check' };

  if (toCall === 0) {
    if (str > 0.75 && Math.random() < aggression) {
      const raise = Math.min(
        player.chips,
        Math.max(game.bigBlind * 2, Math.floor(game.pot * (0.4 + str * 0.5)))
      );
      return { action: 'raise', amount: player.betThisRound + raise };
    }
    return { action: 'check' };
  }

  if (str < 0.28 && toCall > game.bigBlind) {
    return { action: 'fold' };
  }

  if (str < potOdds + 0.1 && toCall > game.bigBlind * 2) {
    return { action: 'fold' };
  }

  if (str > 0.82 && Math.random() < aggression + 0.2) {
    const raiseExtra = Math.min(
      player.chips - toCall,
      Math.max(game.bigBlind * 3, Math.floor(game.pot * str))
    );
    if (raiseExtra > game.minRaise) {
      return { action: 'raise', amount: game.currentBet + game.minRaise + Math.floor(raiseExtra * 0.6) };
    }
  }

  if (toCall >= player.chips || (stackPressure && str > 0.55)) {
    return { action: 'allin' };
  }

  return { action: 'call' };
}

export const BOT_NAMES = [
  'AceHunter', 'BluffKing', 'ChipShark', 'RiverRat', 'NeonDealer'
];