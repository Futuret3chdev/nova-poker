import {
  WHEEL_ORDER, RED_NUMS, CHIP_VALUES, TABLE_ROWS,
  spinResult, spinRotation, resolveBets, betLabel, isRed
} from './roulette.js';
import { casinoSound } from './sounds.js';

export class RouletteUI {
  constructor({ onBalanceChange, getBalance }) {
    this.onBalanceChange = onBalanceChange;
    this.getBalance = getBalance;
    this.chipValue = CHIP_VALUES[1];
    this.bets = [];
    this.spinning = false;
    this.rotation = 0;
    this.tickTimer = null;
    this.cacheEls();
    this.buildWheel();
    this.buildTable();
    this.bind();
    this.renderBalance();
    this.updateSummary();
  }

  cacheEls() {
    this.els = {
      wheel: document.getElementById('roulette-wheel'),
      result: document.getElementById('roulette-result'),
      chips: document.getElementById('roulette-chips'),
      chipSelect: document.getElementById('chip-select'),
      quickBets: document.getElementById('roulette-quick-bets'),
      table: document.getElementById('roulette-table'),
      summary: document.getElementById('roulette-bets-summary'),
      btnSpin: document.getElementById('btn-roulette-spin'),
      btnClear: document.getElementById('btn-roulette-clear'),
      message: document.getElementById('roulette-message')
    };
  }

  betKey(type, value) {
    return `${type}:${value ?? ''}`;
  }

  buildWheel() {
    const seg = 360 / WHEEL_ORDER.length;
    const r = 50;
    const cx = 50;
    const cy = 50;
    let paths = '';
    let nums = '';

    WHEEL_ORDER.forEach((num, i) => {
      const a0 = (i * seg - 90) * Math.PI / 180;
      const a1 = ((i + 1) * seg - 90) * Math.PI / 180;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const fill = num === 0 ? '#2e7d32' : isRed(num) ? '#c62828' : '#1a1a1a';
      paths += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z" fill="${fill}" stroke="#d4af37" stroke-width="0.15"/>`;
      const mid = ((i + 0.5) * seg - 90) * Math.PI / 180;
      const tx = cx + (r * 0.72) * Math.cos(mid);
      const ty = cy + (r * 0.72) * Math.sin(mid);
      nums += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="2.8" font-weight="700" font-family="Oswald,sans-serif">${num}</text>`;
    });

    this.els.wheel.innerHTML = `
      <svg viewBox="0 0 100 100" class="wheel-svg" aria-hidden="true">
        <circle cx="50" cy="50" r="49" fill="#1a1208" stroke="#d4af37" stroke-width="1.2"/>
        ${paths}
        <circle cx="50" cy="50" r="14" fill="#0d1117" stroke="#d4af37" stroke-width="0.8"/>
        <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="#ffc107" font-size="4" font-family="Oswald,sans-serif" font-weight="700">MT</text>
        ${nums}
      </svg>
    `;
  }

  betBtnHtml({ type, value, label, cls = '' }) {
    const valAttr = value !== undefined ? ` data-bet-value="${value}"` : '';
    return `<button type="button" class="roulette-bet-spot ${cls}" data-bet-type="${type}"${valAttr}>
      <span class="spot-label">${label}</span>
      <span class="spot-chips"></span>
    </button>`;
  }

  buildTable() {
    this.els.chipSelect.innerHTML = CHIP_VALUES.map((v) => `
      <button type="button" class="chip-btn${v === this.chipValue ? ' active' : ''}" data-chip="${v}">₵${v}</button>
    `).join('');

    const quick = [
      { type: 'red', label: 'Red', cls: 'bet-red' },
      { type: 'black', label: 'Black', cls: 'bet-black' },
      { type: 'odd', label: 'Odd', cls: '' },
      { type: 'even', label: 'Even', cls: '' },
      { type: 'low', label: '1–18', cls: '' },
      { type: 'high', label: '19–36', cls: '' }
    ];
    this.els.quickBets.innerHTML = quick.map((q) => this.betBtnHtml(q)).join('');

    let tableHtml = this.betBtnHtml({ type: 'straight', value: 0, label: '0', cls: 'roulette-zero' });
    tableHtml += '<div class="roulette-grid">';
    for (let col = 0; col < 12; col++) {
      tableHtml += '<div class="roulette-col">';
      for (let row = 0; row < 3; row++) {
        const n = TABLE_ROWS[row][col];
        const cls = isRed(n) ? 'num-red' : 'num-black';
        tableHtml += this.betBtnHtml({ type: 'straight', value: n, label: String(n), cls: `roulette-num ${cls}` });
      }
      tableHtml += '</div>';
    }
    tableHtml += '</div><div class="roulette-outside">';
    [1, 2, 3].forEach((d) => {
      tableHtml += this.betBtnHtml({
        type: 'dozen', value: d,
        label: d === 1 ? '1st' : d === 2 ? '2nd' : '3rd',
        cls: 'outside-btn'
      });
    });
    [1, 2, 3].forEach((c) => {
      tableHtml += this.betBtnHtml({ type: 'column', value: c, label: '2:1', cls: 'outside-btn' });
    });
    tableHtml += '</div>';
    this.els.table.innerHTML = tableHtml;
  }

  findBetSpot(type, value) {
    const sel = type === 'straight' || type === 'dozen' || type === 'column'
      ? `[data-bet-type="${type}"][data-bet-value="${value}"]`
      : `[data-bet-type="${type}"]`;
    return this.els.table?.querySelector(sel) || this.els.quickBets?.querySelector(sel);
  }

  renderChipMarkers() {
    const totals = {};
    for (const b of this.bets) {
      const key = this.betKey(b.type, b.value);
      totals[key] = (totals[key] || 0) + b.amount;
    }

    document.querySelectorAll('.roulette-bet-spot').forEach((el) => {
      el.classList.remove('has-chips');
      const chips = el.querySelector('.spot-chips');
      if (chips) chips.innerHTML = '';
    });

    const seen = new Set();
    for (const b of this.bets) {
      const key = this.betKey(b.type, b.value);
      if (seen.has(key)) continue;
      seen.add(key);
      const el = this.findBetSpot(b.type, b.value);
      if (!el) continue;
      const total = totals[key];
      const chips = el.querySelector('.spot-chips');
      if (!chips) continue;

      el.classList.add('has-chips');
      chips.innerHTML = `
        <span class="chip-on-table" aria-hidden="true"></span>
        <span class="chip-stack-total">${formatChipAmt(total)}</span>
      `;
    }
  }

  bind() {
    this.els.chipSelect?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chip]');
      if (!btn) return;
      this.chipValue = Number(btn.dataset.chip);
      casinoSound.chip();
      this.els.chipSelect.querySelectorAll('.chip-btn').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.chip) === this.chipValue);
      });
    });

    const placeBet = (type, value) => {
      if (this.spinning) return;
      const balance = this.getBalance();
      if (balance < this.chipValue) {
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
      const el = this.findBetSpot(type, value);
      el?.classList.add('chip-placed');
      setTimeout(() => el?.classList.remove('chip-placed'), 300);
    };

    this.els.quickBets?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bet-type]');
      if (!btn) return;
      placeBet(btn.dataset.betType);
    });

    this.els.table?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bet-type]');
      if (!btn) return;
      const type = btn.dataset.betType;
      const value = type === 'straight' || type === 'dozen' || type === 'column'
        ? Number(btn.dataset.betValue)
        : undefined;
      placeBet(type, value);
    });

    this.els.btnClear?.addEventListener('click', () => this.clearBets());
    this.els.btnSpin?.addEventListener('click', () => this.spin());
  }

  clearBets(refund = true) {
    if (this.spinning) return;
    if (refund && this.bets.length) {
      const total = this.bets.reduce((s, b) => s + b.amount, 0);
      this.onBalanceChange(total);
      this.renderBalance();
    }
    this.bets = [];
    this.renderChipMarkers();
    this.updateSummary();
    this.setMessage('');
  }

  renderBalance() {
    if (this.els.chips) {
      this.els.chips.textContent = `₵${this.getBalance().toLocaleString()}`;
    }
  }

  updateSummary() {
    if (!this.els.summary) return;
    if (!this.bets.length) {
      this.els.summary.textContent = 'Tap the table to place bets';
      return;
    }
    const total = this.bets.reduce((s, b) => s + b.amount, 0);
    const lines = this.bets.map((b) => `${betLabel(b)} ₵${b.amount}`).join(' · ');
    this.els.summary.textContent = `Total ₵${total} — ${lines}`;
  }

  setMessage(msg) {
    if (this.els.message) this.els.message.textContent = msg;
  }

  startWheelTicks() {
    this.stopWheelTicks();
    let interval = 120;
    const tick = () => {
      casinoSound.wheelTick();
      interval = Math.min(420, interval + 8);
      this.tickTimer = setTimeout(tick, interval);
    };
    tick();
  }

  stopWheelTicks() {
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  async spin() {
    if (this.spinning) return;
    if (!this.bets.length) {
      this.setMessage('Place a bet first!');
      return;
    }

    this.spinning = true;
    this.els.btnSpin.disabled = true;
    this.els.btnClear.disabled = true;
    this.setMessage('No more bets…');
    casinoSound.spinStart();
    this.startWheelTicks();

    const result = spinResult();
    const nextRot = spinRotation(result, this.rotation, 5 + Math.floor(Math.random() * 3));
    this.rotation = nextRot;

    this.els.wheel.style.transition = 'transform 4.2s cubic-bezier(0.15, 0.85, 0.2, 1)';
    this.els.wheel.style.transform = `rotate(${nextRot}deg)`;
    this.els.result?.classList.remove('show', 'win', 'lose');
    this.els.result.textContent = '';

    await new Promise((r) => setTimeout(r, 4300));
    this.stopWheelTicks();

    const { totalReturn } = resolveBets(this.bets, result);
    const staked = this.bets.reduce((s, b) => s + b.amount, 0);

    if (totalReturn > 0) this.onBalanceChange(totalReturn);

    const color = result === 0 ? 'green' : isRed(result) ? 'red' : 'black';
    this.els.result.innerHTML = `<span class="result-num ${color}">${result}</span>`;
    this.els.result.classList.add('show', totalReturn > staked ? 'win' : totalReturn > 0 ? 'win' : 'lose');

    if (totalReturn > staked) {
      casinoSound.win();
      this.setMessage(`Winner! +₵${(totalReturn - staked).toLocaleString()}`);
    } else if (totalReturn > 0) {
      casinoSound.call();
      this.setMessage(`Partial — ₵${totalReturn.toLocaleString()} back`);
    } else {
      casinoSound.lose();
      this.setMessage(`${result} ${color} — better luck next spin`);
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
    this.stopWheelTicks();
    this.clearBets(false);
    this.els.wheel.style.transition = '';
    this.els.wheel.style.transform = '';
  }
}

function formatChipAmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}