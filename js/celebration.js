/** Full-screen win celebrations — confetti, fireworks, gold burst. */

const COLORS = ['#ffc107', '#ff6f00', '#e53935', '#7c4dff', '#00e676', '#ff4081', '#fff176'];
const COIN_CHARS = ['₵', '♦', '★', '●'];

let cleanupTimer = null;
let confettiTimer = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function winTier(amount = 0, staked = 0) {
  const profit = Math.max(0, Number(amount) || 0);
  const base = Math.max(1, Number(staked) || 0);
  const ratio = profit / base;
  if (profit >= 2000 || ratio >= 12) return 'jackpot';
  if (profit >= 500 || ratio >= 5) return 'big';
  if (profit >= 80 || ratio >= 1.5) return 'win';
  return 'small';
}

function formatAmount(amount, symbol = '₵') {
  const n = Math.round(Number(amount) || 0);
  if (symbol === 'MT' || symbol === '$MEMETORRENT') {
    return `+${n.toLocaleString()} MT`;
  }
  return `+${symbol}${n.toLocaleString()}`;
}

function layer() {
  let el = document.getElementById('celebration-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'celebration-layer';
    el.className = 'celebration-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function clearCelebration() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  if (confettiTimer) {
    clearInterval(confettiTimer);
    confettiTimer = null;
  }
  const el = document.getElementById('celebration-layer');
  if (el) {
    el.classList.remove('active', 'tier-small', 'tier-win', 'tier-big', 'tier-jackpot');
    el.innerHTML = '';
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
  }
}

function spawnConfetti(root, count, spread = 1) {
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'cel-confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty('--cel-color', COLORS[i % COLORS.length]);
    piece.style.setProperty('--cel-delay', `${Math.random() * 0.6}s`);
    piece.style.setProperty('--cel-dur', `${1.8 + Math.random() * 1.4}s`);
    piece.style.setProperty('--cel-drift', `${(Math.random() - 0.5) * 120 * spread}px`);
    piece.style.setProperty('--cel-rot', `${Math.random() * 720 - 360}deg`);
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${4 + Math.random() * 6}px`;
    root.appendChild(piece);
  }
}

function spawnCoins(root, count) {
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('span');
    coin.className = 'cel-coin';
    coin.textContent = COIN_CHARS[i % COIN_CHARS.length];
    coin.style.left = `${Math.random() * 100}%`;
    coin.style.setProperty('--cel-delay', `${Math.random() * 0.8}s`);
    coin.style.setProperty('--cel-dur', `${2 + Math.random() * 1.5}s`);
    coin.style.setProperty('--cel-drift', `${(Math.random() - 0.5) * 80}px`);
    root.appendChild(coin);
  }
}

function spawnFireworks(root, count) {
  for (let i = 0; i < count; i++) {
    const fw = document.createElement('div');
    fw.className = 'cel-firework';
    fw.style.left = `${15 + Math.random() * 70}%`;
    fw.style.top = `${10 + Math.random() * 45}%`;
    fw.style.setProperty('--cel-color', COLORS[Math.floor(Math.random() * COLORS.length)]);
    fw.style.setProperty('--cel-delay', `${0.2 + Math.random() * 1.2}s`);
    root.appendChild(fw);
  }
}

function burstConfetti(root, tier) {
  const batches = { small: 2, win: 4, big: 6, jackpot: 8 }[tier] || 3;
  const perBatch = { small: 18, win: 28, big: 36, jackpot: 48 }[tier] || 24;
  let n = 0;
  spawnConfetti(root, perBatch, tier === 'jackpot' ? 1.4 : 1);
  confettiTimer = setInterval(() => {
    n += 1;
    if (n >= batches) {
      clearInterval(confettiTimer);
      confettiTimer = null;
      return;
    }
    spawnConfetti(root, Math.floor(perBatch * 0.7), 1);
  }, 450);
}

/**
 * @param {{ amount?: number, staked?: number, label?: string, subtitle?: string, tier?: string, symbol?: string }} opts
 */
export function celebrateWin(opts = {}) {
  const {
    amount = 0,
    staked = 0,
    label = 'WINNER!',
    subtitle = '',
    symbol = '₵'
  } = opts;
  const tier = opts.tier || winTier(amount, staked);
  const durations = { small: 2800, win: 3800, big: 5200, jackpot: 6500 };
  const duration = durations[tier] || 3500;

  clearCelebration();
  const el = layer();
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  el.className = `celebration-layer active tier-${tier}`;

  const flash = document.createElement('div');
  flash.className = 'cel-flash';
  el.appendChild(flash);

  const rays = document.createElement('div');
  rays.className = 'cel-rays';
  el.appendChild(rays);

  const particles = document.createElement('div');
  particles.className = 'cel-particles';
  el.appendChild(particles);

  if (!prefersReducedMotion()) {
    burstConfetti(particles, tier);
    if (tier === 'big' || tier === 'jackpot') {
      spawnCoins(particles, tier === 'jackpot' ? 24 : 14);
      spawnFireworks(particles, tier === 'jackpot' ? 7 : 4);
    }
  }

  const banner = document.createElement('div');
  banner.className = 'cel-banner';
  banner.innerHTML = `
    <div class="cel-sparkle cel-sparkle-l" aria-hidden="true">✦</div>
    <div class="cel-sparkle cel-sparkle-r" aria-hidden="true">✦</div>
    <p class="cel-eyebrow">${tier === 'jackpot' ? '★ JACKPOT ★' : tier === 'big' ? '★ BIG WIN ★' : '★ YOU WON ★'}</p>
    <h2 class="cel-title">${label}</h2>
    ${subtitle ? `<p class="cel-sub">${subtitle}</p>` : ''}
    ${amount > 0 ? `<p class="cel-amount">${formatAmount(amount, symbol)}</p>` : ''}
    <div class="cel-shine" aria-hidden="true"></div>
  `;
  el.appendChild(banner);

  cleanupTimer = setTimeout(clearCelebration, duration);
}

export function dismissCelebration() {
  clearCelebration();
}