const SUITS = ['h', 'd', 'c', 's'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SUIT_SYM = { h: '♥', d: '♦', c: '♣', s: '♠' };
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

export function cardColor(suit) {
  return suit === 'h' || suit === 'd' ? 'red' : 'black';
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function cardHTML(card, faceDown = false) {
  if (faceDown || !card) {
    return `<div class="card card-back"><div class="card-pattern"></div></div>`;
  }
  const color = cardColor(card.suit);
  const label = cardLabel(card.rank);
  return `<div class="card card-${color}">
    <span class="card-rank">${label}</span>
    <span class="card-suit">${SUIT_SYM[card.suit]}</span>
  </div>`;
}