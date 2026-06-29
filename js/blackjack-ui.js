/** Blackjack table — premium animated deals, chips, FX. */

import {
  createShoe, draw, isBlackjack, isBust, canDouble,
  dealerShouldHit, resolveRound, describeHand
} from './blackjack.js';
import { cardLabel, cardColor } from './deck.js';
import { casinoSound } from './sounds.js';
import { celebrateWin, winTier } from './celebration.js?v=42';
import { spawnAmbient, burstAt, showBanner } from './game-fx.js?v=42';

const CHIPS = [10, 25, 50, 100, 500];
const SUIT_SYM = { h: '♥', d: '♦', c: '♣', s: '♠' };

function renderBjCard(card, faceDown = false) {
  if (faceDown || !card) {
    return `<div class="bj-card bj-card-back"><div class="bj-card-back-pattern"></div></div>`;
  }
  const color = cardColor(card.suit);
  const label = cardLabel(card.rank);
  const sym = SUIT_SYM[card.suit];
  return `<div class="bj-card bj-card-${color}">
    <span class="bj-card-corner tl"><span>${label}</span><span>${sym}</span></span>
    <span class="bj-card-face">${sym}</span>
    <span class="bj-card-corner br"><span>${label}</span><span>${sym}</span></span>
  </div>`;
}

export class BlackjackUI {
  constructor({ getBalance, onBalanceChange }) {
    this.getBalance = getBalance;
    this.onBalanceChange = onBalanceChange;
    this.shoe = createShoe();
    this.bet = 0;
    this.chipStack = [];
    this.chip = CHIPS[1];
    this.phase = 'bet';
    this.player = [];
    this.dealer = [];
    this.dealerHidden = true;
    this.doubled = false;
    this.cacheEls();
    this.buildChips();
    this.bind();
    this.renderBalance();
    this.renderChipStack();
    this.setPhase('bet');
    this.setMessage('Tap felt to place chips — then DEAL');
    this._stopAmbient = spawnAmbient(this.els.wrap, 'gold', 14);
  }

  cacheEls() {
    this.els = {
      balance: document.getElementById('bj-balance'),
      bet: document.getElementById('bj-bet-amt'),
      player: document.getElementById('bj-player-cards'),
      dealer: document.getElementById('bj-dealer-cards'),
      pVal: document.getElementById('bj-player-val'),
      dVal: document.getElementById('bj-dealer-val'),
      msg: document.getElementById('bj-message'),
      chips: document.getElementById('bj-chip-tray'),
      deal: document.getElementById('btn-bj-deal'),
      hit: document.getElementById('btn-bj-hit'),
      stand: document.getElementById('btn-bj-stand'),
      double: document.getElementById('btn-bj-double'),
      clear: document.getElementById('btn-bj-clear'),
      table: document.getElementById('bj-table'),
      felt: document.querySelector('.bj-felt'),
      wrap: document.getElementById('bj-table-wrap'),
      betSpot: document.getElementById('bj-bet-spot'),
      chipStack: document.getElementById('bj-chip-stack'),
      shoe: document.getElementById('bj-shoe')
    };
  }

  buildChips() {
    if (!this.els.chips) return;
    this.els.chips.innerHTML = CHIPS.map((v) => `
      <button type="button" class="bj-chip${v === this.chip ? ' on' : ''}" data-chip="${v}">
        <span>₵${v}</span>
      </button>
    `).join('');
    this.els.chips.querySelectorAll('[data-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.chip = Number(btn.dataset.chip);
        this.els.chips.querySelectorAll('.bj-chip').forEach((b) => b.classList.toggle('on', b === btn));
        casinoSound.chip();
      });
    });
  }

  bind() {
    this.els.deal?.addEventListener('click', () => this.dealHand());
    this.els.hit?.addEventListener('click', () => this.hit());
    this.els.stand?.addEventListener('click', () => this.stand());
    this.els.double?.addEventListener('click', () => this.doubleDown());
    this.els.clear?.addEventListener('click', () => this.clearBet());
    this.els.felt?.addEventListener('click', () => {
      if (this.phase === 'bet') this.addBet();
    });
  }

  renderBalance() {
    const bal = this.getBalance();
    if (this.els.balance) this.els.balance.textContent = bal.toLocaleString();
    if (this.els.bet) this.els.bet.textContent = this.bet.toLocaleString();
  }

  renderChipStack() {
    if (!this.els.chipStack) return;
    this.els.chipStack.innerHTML = this.chipStack.map((v, i) => `
      <span class="bj-stack-chip" data-v="${v}" style="--i:${i}">₵${v}</span>
    `).join('');
    this.els.betSpot?.classList.toggle('has-chips', this.bet > 0);
  }

  setMessage(msg, type = '') {
    if (this.els.msg) {
      this.els.msg.textContent = msg;
      this.els.msg.className = `bj-message${type ? ` bj-msg-${type}` : ''}`;
    }
  }

  setPhase(phase) {
    this.phase = phase;
    this.els.table?.setAttribute('data-phase', phase);
    const betting = phase === 'bet';
    this.els.deal.disabled = !betting || this.bet < 10;
    this.els.hit.disabled = phase !== 'play';
    this.els.stand.disabled = phase !== 'play';
    this.els.double.disabled = phase !== 'play' || !canDouble(this.player) || this.getBalance() < this.bet;
    this.els.clear.disabled = !betting || this.bet === 0;
  }

  addBet() {
    if (this.phase !== 'bet') return;
    if (this.getBalance() < this.chip) {
      this.setMessage('Not enough chips', 'lose');
      return;
    }
    if (this.bet + this.chip > 5000) {
      this.setMessage('Table max bet ₵5,000', 'lose');
      return;
    }
    this.bet += this.chip;
    this.chipStack.push(this.chip);
    this.onBalanceChange(-this.chip);
    this.renderBalance();
    this.renderChipStack();
    casinoSound.chip();
    this.spawnChipAnim();
    this.setPhase('bet');
  }

  clearBet() {
    if (this.bet > 0) {
      this.onBalanceChange(this.bet);
      this.bet = 0;
      this.chipStack = [];
      this.renderBalance();
      this.renderChipStack();
    }
  }

  spawnChipAnim() {
    const chip = document.createElement('span');
    chip.className = 'bj-chip-fly';
    chip.dataset.v = this.chip;
    chip.textContent = `₵${this.chip}`;
    chip.style.background = `radial-gradient(circle at 30% 30%, #fff, var(--chip-color, #ffc107))`;
    this.els.felt?.appendChild(chip);
    setTimeout(() => chip.remove(), 750);
  }

  pulseShoe() {
    this.els.shoe?.classList.add('bj-shoe-deal');
    setTimeout(() => this.els.shoe?.classList.remove('bj-shoe-deal'), 300);
  }

  async dealHand() {
    if (this.bet < 10 || this.phase !== 'bet') return;
    this.player = [];
    this.dealer = [];
    this.doubled = false;
    this.dealerHidden = true;
    this.chipStack = [];
    this.renderChipStack();
    this.els.table?.removeAttribute('data-outcome');
    this.setPhase('dealing');
    this.setMessage('Dealing from the shoe…');
    this.renderHands();

    await this.dealCard('player', 0);
    await this.dealCard('dealer', 0);
    await this.dealCard('player', 1);
    await this.dealCard('dealer', 1, true);

    if (isBlackjack(this.player)) {
      await this.revealDealer();
      this.finishRound();
      return;
    }
    this.setPhase('play');
    this.setMessage('Hit, stand, or double down');
    this.updateValues();
  }

  async dealCard(who, index, hidden = false) {
    this.pulseShoe();
    const pulled = draw(this.shoe);
    this.shoe = pulled.shoe;
    const card = pulled.card;
    if (who === 'player') this.player.push(card);
    else this.dealer.push(card);

    const el = who === 'player' ? this.els.player : this.els.dealer;
    const wrap = document.createElement('div');
    wrap.className = 'bj-card-slot';
    wrap.style.setProperty('--deal-i', index);
    wrap.style.setProperty('--from-x', '100px');
    wrap.style.setProperty('--from-y', '-90px');
    wrap.innerHTML = hidden ? renderBjCard(null, true) : renderBjCard(card);
    if (hidden) wrap.dataset.hidden = '1';
    el?.appendChild(wrap);
    casinoSound.deal();
    await this.wait(280);
  }

  renderHands() {
    if (this.els.player) this.els.player.innerHTML = '';
    if (this.els.dealer) this.els.dealer.innerHTML = '';
    this.updateValues();
  }

  updateValues() {
    if (this.els.pVal) {
      this.els.pVal.textContent = this.player.length ? describeHand(this.player) : '';
    }
    if (this.els.dVal) {
      if (this.dealerHidden && this.dealer.length) {
        const up = this.dealer[0];
        const v = up.rank >= 10 ? 10 : (up.rank === 14 ? 11 : up.rank);
        this.els.dVal.textContent = `${Math.min(v, 10)} + ?`;
      } else {
        this.els.dVal.textContent = this.dealer.length ? describeHand(this.dealer) : '';
      }
    }
  }

  async hit() {
    if (this.phase !== 'play') return;
    this.setPhase('dealing');
    await this.dealCard('player', this.player.length);
    this.updateValues();
    if (isBust(this.player)) {
      await this.revealDealer();
      this.finishRound();
      return;
    }
    this.setPhase('play');
  }

  async stand() {
    if (this.phase !== 'play') return;
    await this.playDealer();
    this.finishRound();
  }

  async doubleDown() {
    if (this.phase !== 'play' || !canDouble(this.player)) return;
    if (this.getBalance() < this.bet) return;
    this.onBalanceChange(-this.bet);
    this.bet *= 2;
    this.doubled = true;
    this.renderBalance();
    casinoSound.raise();
    burstAt(this.els.betSpot, 'coins', 10);
    this.setPhase('dealing');
    await this.dealCard('player', this.player.length);
    this.updateValues();
    if (isBust(this.player)) {
      await this.revealDealer();
      this.finishRound();
      return;
    }
    await this.playDealer();
    this.finishRound();
  }

  async playDealer() {
    await this.revealDealer();
    this.setPhase('dealer');
    this.setMessage('Dealer reveals…');
    while (dealerShouldHit(this.dealer)) {
      await this.wait(380);
      await this.dealCard('dealer', this.dealer.length);
      this.updateValues();
    }
  }

  async revealDealer() {
    if (!this.dealerHidden) return;
    this.dealerHidden = false;
    const hiddenSlot = this.els.dealer?.querySelector('[data-hidden="1"]');
    if (hiddenSlot) {
      hiddenSlot.classList.add('bj-flip');
      casinoSound.chip();
      await this.wait(180);
      hiddenSlot.innerHTML = renderBjCard(this.dealer[1]);
      hiddenSlot.removeAttribute('data-hidden');
      await this.wait(320);
    }
    this.updateValues();
  }

  finishRound() {
    const result = resolveRound({
      player: this.player,
      dealer: this.dealer,
      bet: this.bet / (this.doubled ? 2 : 1),
      doubled: this.doubled
    });
    const baseBet = this.bet;
    const outcome = result.outcome === 'blackjack' ? 'blackjack' : result.outcome;

    this.els.table?.setAttribute('data-outcome', outcome);

    if (result.payout > 0) {
      this.onBalanceChange(baseBet + result.payout);
      casinoSound.win();
      if (result.outcome === 'blackjack') casinoSound.bigWin();
      const tier = winTier(result.payout, baseBet);
      if (tier !== 'small') celebrateWin(result.payout, tier, '₵');
      burstAt(this.els.felt, 'coins', 18);
      showBanner(this.els.wrap, result.outcome === 'blackjack' ? 'BLACKJACK!' : 'YOU WIN', outcome === 'blackjack' ? 'blackjack' : 'win');
    } else if (result.payout < 0) {
      casinoSound.lose();
      showBanner(this.els.wrap, 'DEALER WINS', 'lose');
    } else if (result.outcome === 'push') {
      this.onBalanceChange(baseBet);
      showBanner(this.els.wrap, 'PUSH', 'win');
    }

    const msgType = result.outcome === 'blackjack' ? 'blackjack' : result.outcome;
    this.setMessage(result.message, msgType);
    this.els.table?.classList.add('bj-round-end');
    setTimeout(() => {
      this.els.table?.classList.remove('bj-round-end');
      this.els.table?.removeAttribute('data-outcome');
    }, 1400);

    this.bet = 0;
    this.chipStack = [];
    this.renderBalance();
    this.renderChipStack();
    this.setPhase('bet');
    setTimeout(() => this.setMessage(`${result.message} — place your next bet`), 1000);
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  destroy() {
    this._stopAmbient?.();
    this.els.table?.removeAttribute('data-phase');
    this.els.table?.removeAttribute('data-outcome');
  }
}