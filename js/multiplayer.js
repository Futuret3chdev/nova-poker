import { FAKE_PLAYER_NAMES } from './modes.js';

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const MATCH_STEPS = [
  'Connecting to MemeTorrent network…',
  'Finding open table…',
  'Matching players…',
  'Securing $MT escrow…',
  'Dealing seats…'
];

export function simulateMatchmaking(mode, onProgress, onComplete) {
  const filtered = mode.currency === 'mt'
    ? MATCH_STEPS
    : MATCH_STEPS.filter((s) => !s.includes('$MT') && !s.includes('escrow'));

  let i = 0;
  const tick = () => {
    if (i < filtered.length) {
      onProgress(filtered[i], (i + 1) / filtered.length);
      i++;
      setTimeout(tick, 700 + Math.random() * 600);
    } else {
      const count = 3 + Math.floor(Math.random() * 3);
      const names = shuffleNames(count);
      onComplete(names);
    }
  };
  tick();
}

function shuffleNames(n) {
  const pool = [...FAKE_PLAYER_NAMES];
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function fillMultiplayerSeats(humanName, opponentNames) {
  return opponentNames.map((name, i) => ({
    id: i + 1,
    name,
    isHuman: false,
    isMultiplayer: true
  }));
}