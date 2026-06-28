import {
  CHIP_VALUES, TABLE_ROWS,
  spinResult, resolveBets, betLabel, isRed
} from './roulette.js';
import { RouletteWheelCanvas } from './roulette-wheel.js';
import { casinoSound } from './sounds.js?v=28';
import { celebrateWin, winTier } from './celebration.js?v=28';

export class RouletteUI {
  constructor({ onBalanceChange, getBalance }) {
    this.onBalanceChange = onBalanceChange;
    this.getBalance = getBalance;
    this.chipValue = CHIP_VALUES[1];
    this.bets = [];
    this.spinning = false;
    this.wheelDeg = 0;
    this.history = [];
    this.tickTimer = null;
    this.wheelRenderer = null;
    this.cacheEls();
    this.wheelRenderer = new RouletteWheelCanvas(this.els.wheelWrap);
    this.buildTable();
    this.buildChips();
    this.bind();
    this.renderBalance();
    this.updateSummary();
  }

  cacheEls() {
    this.els = {
      wheelWrap: document.getElementById('roulette-wheel-wrap'),
      result: document.getElementById('roulette-result'),
      history: document.getElementById('roulette-history'),
      chips: document.getElementById('roulette-chips'),
      chipSelect: document.getElementById('chip-select'),
      mat: document.getElementById('roulette-mat'),
      summary: document.getElementById('roulette-bets-summary'),
      btnSpin: document.getElementById('btn-roulette-spin'),
      btnClear: document.getElementById('btn-roulette-clear'),
      message: document.getElementById('roulette-message')
    };
  }

  betKey(type, value) {
    return `${type}:${value ?? ''}`;
  }

  spot(type, value, label, extra = '') {
    const v = value !== undefined ? ` data-bet-value="${value}"` : '';
    return `<button type="button" class="rl-spot ${extra}" data-bet-type="${type}"${v}>
      <span class="rl-spot-label">${label}</span>
      <span class="rl-spot-chips"></span>
    </button>`;
  }

  buildChips() {
    this.els.chipSelect.innerHTML = CHIP_VALUES.map((v) => `
      <button type="button" class="rl-chip-pick${v === this.chipValue ? ' on' : ''}" data-chip="${v}">
        <span class="rl-chip-disc"></span>
        <span class="rl-chip-amt">${v}</span>
      </button>
    `).join('');
  }

  buildTable() {
    let html = '<div class="rl-mat-inner">';
    html += `<div class="rl-zero-col">${this.spot('straight', 0, '0', 'rl-zero')}</div>`;
    html += '<div class="rl-num-grid">';
    for (let col = 0; col < 12; col++) {
      html += '<div class="rl-num-col">';
      for (let row = 2; row >= 0; row--) {
        const n = TABLE_ROWS[row][col];
        const cls = isRed(n) ? 'rl-red' : 'rl-black';
        html += this.spot('straight', n, n, cls);
      }
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="rl-col-bets">';
    [3, 2, 1].forEach((c) => {
      html += this.spot('column', c, '2:1', 'rl-col-btn');
    });
    html += '</div></div>';

    html += '<div class="rl-dozen-row">';
    [1, 2, 3].forEach((d) => {
      html += this.spot('dozen', d, d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12', 'rl-dozen');
    });
    html += '</div>';

    html += '<div class="rl-outside-row">';
    html += this.spot('low', undefined, '1–18', 'rl-out');
    html += this.spot('even', undefined, 'EVEN', 'rl-out');
    html += this.spot('red', undefined, 'RED', 'rl-out rl-diamond rl-diamond-red');
    html += this.spot('black', undefined, 'BLACK', 'rl-out rl-diamond rl-diamond-black');
    html += this.spot('odd', undefined, 'ODD', 'rl-out');
    html += this.spot('high', undefined, '19–36', 'rl-out');
    html += '</div>';

    this.els.mat.innerHTML = html;
  }

  findSpot(type, value) {
    const sel = type === 'straight' || type === 'dozen' || type === 'column'
      ? `[data-bet-type="${type}"][data-bet-value="${value}"]`
      : `[data-bet-type="${type}"]`;
    return this.els.mat?.querySelector(sel);
  }

  renderChipMarkers() {
    const totals = {};
    for (const b of this.bets) {
      const key = this.betKey(b.type, b.value);
      totals[key] = (totals[key] || 0) + b.amount;
    }

    this.els.mat?.querySelectorAll('.rl-spot').forEach((el) => {
      el.classList.remove('has-chips');
      const c = el.querySelector('.rl-spot-chips');
      if (c) c.innerHTML = '';
    });

    const seen = new Set();
    for (const b of this.bets) {
      const key = this.betKey(b.type, b.value);
      if (seen.has(key)) continue;
      seen.add(key);
      const el = this.findSpot(b.type, b.value);
      const chips = el?.querySelector('.rl-spot-chips');
      if (!el || !chips) continue;
      el.classList.add('has-chips');
      chips.innerHTML = `<span class="rl-chip-on-felt"><em>${fmtAmt(totals[key])}</em></span>`;
    }
  }

  renderHistory() {
    if (!this.els.history) return;
    this.els.history.innerHTML = this.history.slice(0, 10).map((n) => {
      const c = n === 0 ? 'g' : isRed(n) ? 'r' : 'b';
      return `<span class="rl-hist-pill ${c}">${n}</span>`;
    }).join('');
  }

  bind() {
    this.els.chipSelect?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chip]');
      if (!btn) return;
      this.chipValue = Number(btn.dataset.chip);
      casinoSound.chip();
      this.els.chipSelect.querySelectorAll('.rl-chip-pick').forEach((b) => {
        b.classList.toggle('on', Number(b.dataset.chip) === this.chipValue);
      });
    });

    const place = (type, value) => {
      if (this.spinning) return;
      if (this.getBalance() < this.chipValue) {
        this.setMessage('Not enough chips!');
        casinoSound.lose();
        return;
      }
      this.bets.push({ type, value, amount: this.chipValue });
      this.onBalanceChange(-this.chipValue);
      casinoSound.chip();
      this.renderBalance();
      this.updateSummary();
      this.renderChipMarkers();
    };

    this.els.mat?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bet-type]');
      if (!btn) return;
      const type = btn.dataset.betType;
      const value = ['straight', 'dozen', 'column'].includes(type)
        ? Number(btn.dataset.betValue) : undefined;
      place(type, value);
    });

    this.els.btnClear?.addEventListener('click', () => this.clearBets());
    this.els.btnSpin?.addEventListener('click', () => this.spin());
  }

  clearBets(refund = true) {
    if (this.spinning) return;
    if (refund && this.bets.length) {
      this.onBalanceChange(this.bets.reduce((s, b) => s + b.amount, 0));
      this.renderBalance();
    }
    this.bets = [];
    this.renderChipMarkers();
    this.updateSummary();
    this.setMessage('Place your bets');
  }

  renderBalance() {
    if (this.els.chips) {
      this.els.chips.textContent = this.getBalance().toLocaleString();
    }
  }

  updateSummary() {
    if (!this.els.summary) return;
    if (!this.bets.length) {
      this.els.summary.textContent = '';
      return;
    }
    const total = this.bets.reduce((s, b) => s + b.amount, 0);
    this.els.summary.textContent = `Bets: ₵${total.toLocaleString()}`;
  }

  setMessage(msg) {
    if (this.els.message) this.els.message.textContent = msg;
  }

  startTicks() {
    this.stopTicks();
    let ms = 100;
    const tick = () => {
      casinoSound.wheelTick();
      ms = Math.min(380, ms + 6);
      this.tickTimer = setTimeout(tick, ms);
    };
    tick();
  }

  stopTicks() {
    if (this.tickTimer) { clearTimeout(this.tickTimer); this.tickTimer = null; }
  }

  async spin() {
    if (this.spinning || !this.bets.length) {
      if (!this.bets.length) this.setMessage('Place a bet on the table');
      return;
    }

    this.spinning = true;
    this.els.btnSpin.disabled = true;
    this.els.btnClear.disabled = true;
    this.setMessage('Rien ne va plus…');
    casinoSound.spinStart();
    this.startTicks();

    const result = spinResult();
    this.els.result?.classList.remove('show');
    this.wheelDeg = await this.wheelRenderer.animateTo(result, this.wheelDeg);
    this.stopTicks();

    const { totalReturn } = resolveBets(this.bets, result);
    const staked = this.bets.reduce((s, b) => s + b.amount, 0);
    if (totalReturn > 0) this.onBalanceChange(totalReturn);

    const color = result === 0 ? 'g' : isRed(result) ? 'r' : 'b';
    this.els.result.innerHTML = `<span class="rl-win-num ${color}">${result}</span>`;
    this.els.result.classList.add('show');

    this.history.unshift(result);
    this.renderHistory();

    if (totalReturn > staked) {
      const profit = totalReturn - staked;
      const tier = winTier(profit, staked);
      if (tier === 'big' || tier === 'jackpot') casinoSound.bigWin();
      else casinoSound.win();
      celebrateWin({
        amount: profit,
        staked,
        label: 'WINNER!',
        subtitle: `Lucky ${result}`,
        symbol: '₵'
      });
      this.setMessage(`Winner! +₵${profit.toLocaleString()}`);
    } else if (totalReturn > 0) {
      casinoSound.call();
      this.setMessage(`₵${totalReturn.toLocaleString()} returned`);
    } else {
      casinoSound.lose();
      this.setMessage(`No win — ${result}`);
    }

    this.bets = [];
    this.renderChipMarkers();
    this.updateSummary();
    this.renderBalance();
    this.spinning = false;
    this.els.btnSpin.disabled = false;
    this.els.btnClear.disabled = false;
  }

  destroy() {
    this.stopTicks();
    this.clearBets(false);
  }
}

function fmtAmt(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}