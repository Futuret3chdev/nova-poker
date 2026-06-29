/** Starfall Spins — 5×3 reel math & paytable. */

export const SYMBOLS = [
  { id: 'seven', icon: '7', label: 'Lucky 7', tier: 'jackpot' },
  { id: 'diamond', icon: '💎', label: 'Diamond', tier: 'high' },
  { id: 'bell', icon: '🔔', label: 'Bell', tier: 'high' },
  { id: 'moon', icon: '🌙', label: 'Moon', tier: 'mid' },
  { id: 'star', icon: '⭐', label: 'Star', tier: 'mid' },
  { id: 'cherry', icon: '🍒', label: 'Cherry', tier: 'low' }
];

export const PAYTABLE = {
  seven: { 3: 10, 4: 25, 5: 80 },
  diamond: { 3: 8, 4: 20, 5: 50 },
  bell: { 3: 6, 4: 15, 5: 35 },
  moon: { 3: 5, 4: 12, 5: 25 },
  star: { 3: 4, 4: 10, 5: 20 },
  cherry: { 3: 2, 4: 5, 5: 12 }
};

export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2]
];

export const BET_STEPS = [10, 25, 50, 100, 250, 500];

export function randomSymbol() {
  const weights = [2, 6, 8, 12, 14, 22];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= weights[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

export function spinGrid() {
  const grid = [];
  for (let row = 0; row < 3; row++) {
    const line = [];
    for (let col = 0; col < 5; col++) line.push(randomSymbol());
    grid.push(line);
  }
  return grid;
}

/** Weighted tease — occasional near-miss 7s on line 1 */
export function spinGridTease() {
  const grid = spinGrid();
  if (Math.random() < 0.12) {
    grid[1][0] = SYMBOLS[0];
    grid[1][1] = SYMBOLS[0];
    grid[1][2] = randomSymbol();
  }
  return grid;
}

export function evaluate(grid, betPerLine) {
  const wins = [];
  let total = 0;

  LINES.forEach((line, lineIdx) => {
    const symbols = line.map((row, col) => grid[row][col]);
    const first = symbols[0].id;
    let count = 1;
    for (let i = 1; i < symbols.length; i++) {
      if (symbols[i].id === first) count++;
      else break;
    }
    if (count >= 3) {
      const mult = PAYTABLE[first]?.[count] || 0;
      const payout = mult * betPerLine;
      if (payout > 0) {
        wins.push({ line: lineIdx, symbol: first, count, payout, cells: line.map((row, col) => ({ row, col })).slice(0, count) });
        total += payout;
      }
    }
  });

  return { wins, total };
}