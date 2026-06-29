/** Blackjack engine — standard rules, 6-deck shoe. */

import { createDeck, shuffle, cardLabel } from './deck.js';

const DECKS = 6;

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (!c) continue;
    if (c.rank === 14) { aces++; total += 11; }
    else if (c.rank >= 10) total += 10;
    else total += c.rank;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

export function isBust(cards) {
  return handValue(cards) > 21;
}

export function canDouble(cards) {
  return cards.length === 2;
}

export function canSplit(cards) {
  if (cards.length !== 2) return false;
  const a = cards[0].rank >= 10 ? 10 : cards[0].rank;
  const b = cards[1].rank >= 10 ? 10 : cards[1].rank;
  return a === b;
}

export function createShoe() {
  let shoe = [];
  for (let i = 0; i < DECKS; i++) shoe = shoe.concat(createDeck());
  return shuffle(shoe);
}

export function draw(shoe) {
  if (shoe.length < 15) return { shoe: createShoe(), card: null };
  const card = shoe.pop();
  return { shoe, card };
}

export function describeHand(cards) {
  const v = handValue(cards);
  const soft = cards.some((c) => c.rank === 14) && v <= 21 && v + 10 > 21 === false;
  const hasAce = cards.some((c) => c.rank === 14);
  const isSoft = hasAce && cards.reduce((s, c) => s + (c.rank === 14 ? 1 : Math.min(c.rank, 10)), 0) + 10 <= 21 && v !== 21;
  if (isBust(cards)) return `${v} BUST`;
  if (isBlackjack(cards)) return 'BLACKJACK';
  if (hasAce && v <= 21) {
    const hard = cards.reduce((s, c) => {
      if (c.rank === 14) return s + 1;
      return s + (c.rank >= 10 ? 10 : c.rank);
    }, 0);
    if (hard + 10 <= 21 && v !== hard) return `Soft ${v}`;
  }
  return String(v);
}

export function dealerShouldHit(cards) {
  const v = handValue(cards);
  if (v < 17) return true;
  if (v === 17) {
    const soft17 = cards.some((c) => c.rank === 14) && cards.reduce((s, c) => {
      if (c.rank === 14) return s + 11;
      return s + (c.rank >= 10 ? 10 : c.rank);
    }, 0) === 17;
    return soft17;
  }
  return false;
}

export function resolveRound({ player, dealer, bet, doubled }) {
  const pb = isBlackjack(player);
  const db = isBlackjack(dealer);
  const pVal = handValue(player);
  const dVal = handValue(dealer);
  const stake = bet * (doubled ? 2 : 1);

  if (pb && db) return { outcome: 'push', payout: 0, message: 'Both blackjack — push' };
  if (pb) return { outcome: 'blackjack', payout: Math.floor(stake * 2.5), message: 'BLACKJACK! 3:2 payout' };
  if (db) return { outcome: 'lose', payout: -stake, message: 'Dealer blackjack' };
  if (isBust(player)) return { outcome: 'lose', payout: -stake, message: 'Bust — you lose' };
  if (isBust(dealer)) return { outcome: 'win', payout: stake, message: 'Dealer busts — you win!' };
  if (pVal > dVal) return { outcome: 'win', payout: stake, message: `You win ${pVal} vs ${dVal}` };
  if (pVal < dVal) return { outcome: 'lose', payout: -stake, message: `Dealer wins ${dVal} vs ${pVal}` };
  return { outcome: 'push', payout: 0, message: `Push at ${pVal}` };
}

export { cardLabel };