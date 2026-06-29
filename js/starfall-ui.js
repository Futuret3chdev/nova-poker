/** Starfall Spins — cinematic reel animations & win FX. */

import {
  SYMBOLS, BET_STEPS, LINES, PAYTABLE, spinGridTease, evaluate
} from './starfall.js';
import { casinoSound, unlockAudio } from './sounds.js?v=37';
import { celebrateWin, winTier } from './celebration.js?v=37';

const ROW_H = 88;
const REEL_SYMBOLS = 12;

export class StarfallUI {
  constructor({ getBalance, onBalanceChange }) {
    this.getBalance = getBalance;
    this.onBalanceChange = onBalanceChange;
    this.betIdx = 1;
    this.spinning = false;
    this.grid = null;
    this.cacheEls();
    this.buildReels();
    this.bind();
    this.renderBalance();
    this.setMessage('Match 3+ on a payline — 5 lines active');
  }

  cacheEls() {
    this.els = {
      balance: document.getElementById('sf-balance'),
      bet: document.getElementById('sf-bet'),
      win: document.getElementById('sf-last-win'),
      msg: document.getElementById('sf-message'),
      reels: document.getElementById('sf-reels'),
      lines: document.getElementById('sf-line-overlay'),
      spin: document.getElementById('btn-sf-spin'),
      betDown: document.getElementById('btn-sf-bet-down'),
      betUp: document.getElementById('btn-sf-bet-up'),
      machine: document.getElementById('sf-machine'),
      paytable: document.getElementById('sf-paytable')
    };
  }

  get betPerLine() {
    return BET_STEPS[this.betIdx];
  }

  get totalBet() {
    return this.betPerLine * LINES.length;
  }

  buildReels() {
    if (!this.els.reels) return;
    this.els.reels.innerHTML = '';
    for (let col = 0; col < 5; col++) {
      const reel = document.createElement('div');
      reel.className = 'sf-reel';
      reel.dataset.col = col;
      const strip = document.createElement('div');
      strip.className = 'sf-strip';
      for (let i = 0; i < REEL_SYMBOLS; i++) {
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        strip.appendChild(this.symbolCell(sym, i));
      }
      reel.appendChild(strip);
      this.els.reels.appendChild(reel);
    }
    this.renderPaytable();
  }

  symbolCell(sym, row) {
    const cell = document.createElement('div');
    cell.className = `sf-cell sf-tier-${sym.tier}`;
    cell.dataset.sym = sym.id;
    cell.innerHTML = `<span class="sf-icon">${sym.icon}</span>`;
    cell.style.setProperty('--row', row);
    return cell;
  }

  renderPaytable() {
    if (!this.els.paytable) return;
    this.els.paytable.innerHTML = SYMBOLS.slice(0, 4).map((s) => `
      <span class="sf-pay-item"><b>${s.icon}</b> ×5 = ${PAYTABLE[s.id]?.[5] || 0}×</span>
    `).join('');
  }

  bind() {
    this.els.spin?.addEventListener('click', () => this.spin());
    this.els.betDown?.addEventListener('click', () => this.adjustBet(-1));
    this.els.betUp?.addEventListener('click', () => this.adjustBet(1));
  }

  adjustBet(dir) {
    if (this.spinning) return;
    this.betIdx = Math.max(0, Math.min(BET_STEPS.length - 1, this.betIdx + dir));
    this.renderBalance();
    casinoSound.chip();
  }

  renderBalance() {
    if (this.els.balance) this.els.balance.textContent = this.getBalance().toLocaleString();
    if (this.els.bet) this.els.bet.textContent = this.totalBet.toLocaleString();
  }

  setMessage(msg, type = '') {
    if (this.els.msg) {
      this.els.msg.textContent = msg;
      this.els.msg.className = `sf-message${type ? ` sf-msg-${type}` : ''}`;
    }
  }

  async spin() {
    if (this.spinning) return;
    const cost = this.totalBet;
    if (this.getBalance() < cost) {
      this.setMessage('Not enough chips', 'lose');
      return;
    }

    unlockAudio();
    this.spinning = true;
    this.els.spin.disabled = true;
    this.els.machine?.classList.remove('sf-win-flash', 'sf-jackpot');
    this.clearWinFX();

    this.onBalanceChange(-cost);
    this.renderBalance();
    casinoSound.spinStart();
    this.setMessage('Spinning…');

    this.grid = spinGridTease();
    const results = evaluate(this.grid, this.betPerLine);

    await this.animateReels(this.grid);

    if (results.total > 0) {
      this.onBalanceChange(results.total);
      if (this.els.win) this.els.win.textContent = `+₵${results.total.toLocaleString()}`;
      const tier = winTier(results.total, cost);
      this.showWinFX(results, tier);
      if (tier === 'jackpot' || tier === 'big') casinoSound.bigWin();
      else casinoSound.win();
      celebrateWin(results.total, tier, '₵');
      this.setMessage(`WIN ₵${results.total.toLocaleString()}!`, 'win');
    } else {
      if (this.els.win) this.els.win.textContent = '—';
      casinoSound.lose();
      this.setMessage('No line hit — spin again', 'lose');
    }

    this.renderBalance();
    this.spinning = false;
    this.els.spin.disabled = false;
  }

  async animateReels(grid) {
    const reels = [...this.els.reels.querySelectorAll('.sf-reel')];
    const stops = [];

    for (let col = 0; col < 5; col++) {
      const strip = reels[col].querySelector('.sf-strip');
      strip.innerHTML = '';
      const padding = [];
      for (let i = 0; i < 8; i++) padding.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      const finalRows = [grid[0][col], grid[1][col], grid[2][col]];
      [...padding, ...finalRows, ...padding.slice(0, 2)].forEach((sym, i) => {
        strip.appendChild(this.symbolCell(sym, i));
      });
      const offset = (padding.length) * ROW_H;
      stops.push({ strip, offset, col });
    }

    const promises = stops.map(({ strip, offset, col }, i) => new Promise((resolve) => {
      strip.classList.add('sf-spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      void strip.offsetWidth;
      const dur = 1.1 + col * 0.22 + Math.random() * 0.15;
      strip.style.transition = `transform ${dur}s cubic-bezier(0.12, 0.8, 0.2, 1)`;
      strip.style.transform = `translateY(-${offset}px)`;
      setTimeout(() => {
        casinoSound.reelStop(col);
        strip.classList.remove('sf-spinning');
        resolve();
      }, dur * 1000 + 40);
    }));

    await Promise.all(promises);
  }

  showWinFX(results, tier) {
    this.els.machine?.classList.add('sf-win-flash');
    if (tier === 'jackpot') this.els.machine?.classList.add('sf-jackpot');

    results.wins.forEach((win) => {
      win.cells.forEach(({ row, col }) => {
        const reel = this.els.reels?.querySelector(`[data-col="${col}"]`);
        const cells = reel?.querySelectorAll('.sf-cell');
        const idx = 8 + row;
        cells?.[idx]?.classList.add('sf-cell-win');
      });
      this.drawWinLine(win.line);
    });
  }

  drawWinLine(lineIdx) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sf-win-line');
    svg.setAttribute('viewBox', '0 0 500 264');
    const y = [44, 132, 220][LINES[lineIdx][0]] || 132;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const points = LINES[lineIdx].map((row, col) => {
      const x = 50 + col * 100;
      const py = 44 + row * 88;
      return `${col === 0 ? 'M' : 'L'}${x},${py}`;
    }).join(' ');
    path.setAttribute('d', points);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'url(#sf-line-grad)');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linecap', 'round');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `<linearGradient id="sf-line-grad" x1="0%" y1="0%" x2="100%"><stop offset="0%" stop-color="#ffc107"/><stop offset="50%" stop-color="#fff"/><stop offset="100%" stop-color="#ff4081"/></linearGradient>`;
    svg.appendChild(defs);
    svg.appendChild(path);
    this.els.lines?.appendChild(svg);
  }

  clearWinFX() {
    this.els.lines && (this.els.lines.innerHTML = '');
    this.els.reels?.querySelectorAll('.sf-cell-win').forEach((c) => c.classList.remove('sf-cell-win'));
  }

  destroy() {
    this.clearWinFX();
  }
}