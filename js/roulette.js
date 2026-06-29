/** European roulette — wheel order clockwise from 0 at top. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const RED_NUMS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export const CHIP_VALUES = [10, 25, 50, 100, 500];

export function isRed(n) {
  return RED_NUMS.has(n);
}

export function spinResult() {
  return WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];
}

export function wheelIndex(num) {
  return WHEEL_ORDER.indexOf(num);
}

/** Rotation degrees to land `num` under the top pointer (plus extra full spins). */
export function spinRotation(num, currentDeg = 0, extraSpins = 6) {
  const idx = wheelIndex(num);
  const seg = 360 / WHEEL_ORDER.length;
  const target = -(idx * seg) - seg / 2;
  const base = currentDeg % 360;
  const delta = target - base;
  const adjust = delta > 0 ? delta - 360 : delta;
  return currentDeg + adjust - extraSpins * 360;
}

/**
 * @param {Array<{type:string, value?:number|string, amount:number}>} bets
 * @param {number} result
 */
export function resolveBets(bets, result) {
  let totalReturn = 0;
  const wins = [];

  for (const bet of bets) {
    const win = payoutForBet(bet, result);
    if (win > 0) {
      totalReturn += win;
      wins.push({ ...bet, payout: win });
    }
  }

  return { totalReturn, wins, result };
}

function payoutForBet(bet, result) {
  const { type, value, amount } = bet;
  if (!amount || amount <= 0) return 0;

  switch (type) {
    case 'straight':
      return result === value ? amount * 36 : 0;
    case 'red':
      return result !== 0 && isRed(result) ? amount * 2 : 0;
    case 'black':
      return result !== 0 && !isRed(result) ? amount * 2 : 0;
    case 'odd':
      return result !== 0 && result % 2 === 1 ? amount * 2 : 0;
    case 'even':
      return result !== 0 && result % 2 === 0 ? amount * 2 : 0;
    case 'low':
      return result >= 1 && result <= 18 ? amount * 2 : 0;
    case 'high':
      return result >= 19 && result <= 36 ? amount * 2 : 0;
    case 'dozen': {
      const d = Number(value);
      const min = (d - 1) * 12 + 1;
      const max = d * 12;
      return result >= min && result <= max ? amount * 3 : 0;
    }
    case 'column': {
      const c = Number(value);
      if (result === 0) return 0;
      const col = ((result - 1) % 3) + 1;
      return col === c ? amount * 3 : 0;
    }
    case 'split': {
      const nums = parseSplitValue(value);
      return nums.includes(result) ? amount * 18 : 0;
    }
    case 'street': {
      const nums = numbersForStreet(value);
      return nums.includes(result) ? amount * 12 : 0;
    }
    case 'corner': {
      const nums = numbersForCorner(value);
      return nums.includes(result) ? amount * 9 : 0;
    }
    case 'sixline': {
      const nums = numbersForSixLine(value);
      return nums.includes(result) ? amount * 6 : 0;
    }
    default:
      return 0;
  }
}

export function splitPair(a, b) {
  return [Math.min(a, b), Math.max(a, b)].join('-');
}

export function parseSplitValue(value) {
  if (typeof value === 'string' && value.includes('-')) {
    return value.split('-').map(Number).filter((n) => !Number.isNaN(n));
  }
  return [];
}

export function streetNumbers(col) {
  return [TABLE_ROWS[2][col], TABLE_ROWS[1][col], TABLE_ROWS[0][col]];
}

export function streetAnchor(col) {
  return Math.min(...streetNumbers(col));
}

export function cornerNumbers(row, col) {
  return [
    TABLE_ROWS[row][col],
    TABLE_ROWS[row][col + 1],
    TABLE_ROWS[row + 1][col],
    TABLE_ROWS[row + 1][col + 1]
  ];
}

export function cornerAnchor(row, col) {
  return Math.min(...cornerNumbers(row, col));
}

export function sixLineNumbers(col) {
  return [...streetNumbers(col), ...streetNumbers(col + 1)];
}

export function sixLineAnchor(col) {
  return streetAnchor(col);
}

export function numbersForStreet(anchor) {
  for (let c = 0; c < 12; c++) {
    if (streetAnchor(c) === Number(anchor)) return streetNumbers(c);
  }
  return [];
}

export function numbersForCorner(anchor) {
  const a = Number(anchor);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 11; c++) {
      if (cornerAnchor(r, c) === a) return cornerNumbers(r, c);
    }
  }
  return [];
}

export function numbersForSixLine(anchor) {
  const a = Number(anchor);
  for (let c = 0; c < 11; c++) {
    if (sixLineAnchor(c) === a) return sixLineNumbers(c);
  }
  return [];
}

export function betLabel(bet) {
  const labels = {
    straight: `#${bet.value}`,
    red: 'Red',
    black: 'Black',
    odd: 'Odd',
    even: 'Even',
    low: '1–18',
    high: '19–36',
    dozen: `${bet.value === 1 ? '1st' : bet.value === 2 ? '2nd' : '3rd'} 12`,
    column: `Col ${bet.value}`,
    split: `Split ${bet.value}`,
    street: `Street ${bet.value}`,
    corner: `Corner ${bet.value}`,
    sixline: `Line ${bet.value}`
  };
  return labels[bet.type] || bet.type;
}

/** Table layout: row 0 = top (3,6,9...), row 2 = bottom (1,4,7...) */
export const TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
];