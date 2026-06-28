const RANK_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', 'Royal Flush'
];

function rankCounts(cards) {
  const m = new Map();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}

function isFlush(cards) {
  const suit = cards[0].suit;
  return cards.every((c) => c.suit === suit);
}

function straightHigh(ranks) {
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniq.length < 5) return 0;
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 1; j < 5; j++) {
      if (uniq[i] - j !== uniq[i + j]) { ok = false; break; }
    }
    if (ok) return uniq[i];
  }
  if (uniq.includes(14) && uniq.includes(5) && uniq.includes(4) && uniq.includes(3) && uniq.includes(2)) {
    return 5;
  }
  return 0;
}

function evaluate5(cards) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const counts = rankCounts(cards);
  const flush = isFlush(cards);
  const straight = straightHigh(ranks);

  if (flush && straight) {
    const hi = straight === 5 ? 5 : straight;
    if (hi === 14) return { score: [9, 14], name: 'Royal Flush' };
    return { score: [8, hi], name: 'Straight Flush' };
  }

  if (counts[0][1] === 4) {
    const quad = counts[0][0];
    const kicker = counts[1][0];
    return { score: [7, quad, kicker], name: 'Four of a Kind' };
  }

  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return { score: [6, counts[0][0], counts[1][0]], name: 'Full House' };
  }

  if (flush) {
    return { score: [5, ...ranks], name: 'Flush' };
  }

  if (straight) {
    return { score: [4, straight], name: 'Straight' };
  }

  if (counts[0][1] === 3) {
    const kickers = counts.slice(1).map(([r]) => r);
    return { score: [3, counts[0][0], ...kickers], name: 'Three of a Kind' };
  }

  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const hi = Math.max(counts[0][0], counts[1][0]);
    const lo = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return { score: [2, hi, lo, kicker], name: 'Two Pair' };
  }

  if (counts[0][1] === 2) {
    const kickers = counts.slice(1).map(([r]) => r);
    return { score: [1, counts[0][0], ...kickers], name: 'One Pair' };
  }

  return { score: [0, ...ranks], name: 'High Card' };
}

function compareScores(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function combos7(cards, k, start, cur, out) {
  if (cur.length === k) {
    out.push([...cur]);
    return;
  }
  for (let i = start; i < cards.length; i++) {
    cur.push(cards[i]);
    combos7(cards, k, i + 1, cur, out);
    cur.pop();
  }
}

export function evaluateHand(hole, community) {
  const all = [...hole, ...community];
  if (all.length < 5) return { score: [0], name: 'High Card', best: all };

  const combos = [];
  combos7(all, 5, 0, [], combos);

  let best = null;
  for (const five of combos) {
    const ev = evaluate5(five);
    if (!best || compareScores(ev.score, best.score) > 0) {
      best = { ...ev, best: five };
    }
  }
  return best;
}

export function compareHands(holeA, holeB, community) {
  const a = evaluateHand(holeA, community);
  const b = evaluateHand(holeB, community);
  return compareScores(a.score, b.score);
}

export function handRankName(score) {
  if (!score || score[0] == null) return 'High Card';
  if (score[0] === 9) return 'Royal Flush';
  if (score[0] === 8) return 'Straight Flush';
  return RANK_NAMES[score[0]] || 'High Card';
}