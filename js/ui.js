import { cardHTML } from './deck.js';
import { evaluateHand } from './hand-evaluator.js';

const SEAT_POSITIONS = [
  { x: 50, y: 72 },
  { x: 12, y: 58 },
  { x: 8, y: 30 },
  { x: 50, y: 10 },
  { x: 92, y: 30 },
  { x: 88, y: 58 }
];

export class PokerUI {
  constructor(root, mode = {}) {
    this.root = root;
    this.mode = mode;
    this.raiseAmount = 0;
    this.cacheEls();
  }

  cacheEls() {
    this.els = {
      table: document.getElementById('poker-table'),
      seats: document.getElementById('seats'),
      community: document.getElementById('community-cards'),
      pot: document.getElementById('pot-amount'),
      phase: document.getElementById('phase-label'),
      message: document.getElementById('game-message'),
      actions: document.getElementById('action-panel'),
      btnFold: document.getElementById('btn-fold'),
      btnCheck: document.getElementById('btn-check'),
      btnCall: document.getElementById('btn-call'),
      btnRaise: document.getElementById('btn-raise'),
      btnAllIn: document.getElementById('btn-allin'),
      raiseSlider: document.getElementById('raise-slider'),
      raiseValue: document.getElementById('raise-value'),
      handStrength: document.getElementById('hand-strength'),
      btnNext: document.getElementById('btn-next-hand'),
      modeBadge: document.getElementById('mode-badge'),
      walletHud: document.getElementById('wallet-hud'),
      turnIndicator: document.getElementById('turn-indicator')
    };
  }

  formatChips(n, state) {
    const sym = state?.mode?.symbol || this.mode?.symbol || '₵';
    if (sym === 'MT' || sym === '$MEMETORRENT') {
      const v = Number(n);
      return v < 1 ? `${v.toFixed(2)} MT` : `${v.toLocaleString()} MT`;
    }
    if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
    return `${sym}${n}`;
  }

  render(state) {
    if (state.mode) this.mode = state.mode;
    this.renderSeats(state);
    this.renderCommunity(state);
    this.els.pot.textContent = this.formatChips(state.pot, state);
    this.els.phase.textContent = this.phaseLabel(state.phase);
    if (this.els.modeBadge) {
      this.els.modeBadge.textContent = state.mode?.badge || 'PLAY';
      this.els.modeBadge.className = `mode-badge badge-${state.mode?.currency || 'free'}`;
    }
    if (state.lastAction) this.els.message.textContent = state.lastAction;
    this.renderTurnIndicator(state);

    const human = state.players[0];
    if (human?.hole?.length && state.community.length) {
      const ev = evaluateHand(human.hole, state.community);
      this.els.handStrength.textContent = ev.name;
      this.els.handStrength.classList.add('visible');
    } else if (human?.hole?.length === 2) {
      const hi = Math.max(human.hole[0].rank, human.hole[1].rank);
      const paired = human.hole[0].rank === human.hole[1].rank;
      this.els.handStrength.textContent = paired ? 'Pocket Pair' : hi >= 12 ? 'Strong Hand' : '';
      this.els.handStrength.classList.toggle('visible', paired || hi >= 12);
    } else {
      this.els.handStrength.classList.remove('visible');
    }

    this.renderActions(state);
    this.els.btnNext.classList.toggle('visible', state.phase === 'showdown');
  }

  phaseLabel(phase) {
    const map = {
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown',
      waiting: 'Waiting'
    };
    return map[phase] || phase;
  }

  renderSeats(state) {
    this.els.seats.innerHTML = '';
    state.players.forEach((p, i) => {
      const pos = SEAT_POSITIONS[i];
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.style.left = `${pos.x}%`;
      seat.style.top = `${pos.y}%`;

      const isActive = state.actionIndex === p.id && state.phase !== 'showdown';
      const isWinner = state.winners.includes(p.id);
      if (isActive) seat.classList.add('active');
      if (p.folded) seat.classList.add('folded');
      if (isWinner) seat.classList.add('winner');
      if (p.isHuman) seat.classList.add('human');

      const showCards = p.isHuman || state.phase === 'showdown';
      const cards = (p.hole || []).map((c) => cardHTML(c, !showCards || p.folded)).join('');
      const badges = [
        p.isDealer ? '<span class="badge dealer">D</span>' : '',
        p.isSB ? '<span class="badge sb">SB</span>' : '',
        p.isBB ? '<span class="badge bb">BB</span>' : ''
      ].join('');

      const bet = p.betThisRound > 0 ? `<div class="seat-bet">${this.formatChips(p.betThisRound, state)}</div>` : '';
      const status = p.allIn ? '<span class="status allin">ALL-IN</span>' : p.folded ? '<span class="status fold">FOLD</span>' : '';
      const handName = state.phase === 'showdown' && !p.folded && p.handName
        ? `<div class="hand-name">${p.handName}</div>` : '';
      const turnTag = isActive
        ? `<div class="turn-tag">${p.isHuman ? 'YOUR TURN' : 'ACTING'}</div>` : '';

      seat.innerHTML = `
        ${turnTag}
        <div class="seat-cards">${cards || '<div class="card-slot"></div>'}</div>
        <div class="seat-info">
          <div class="avatar ${p.isHuman ? 'avatar-you' : ''}">${p.name.charAt(0)}</div>
          <div class="seat-meta">
            <span class="seat-name">${p.name}</span>
            <span class="seat-chips">${this.formatChips(p.chips, state)}</span>
          </div>
          ${badges}
          ${status}
        </div>
        ${bet}
        ${handName}
      `;
      this.els.seats.appendChild(seat);
    });
  }

  renderCommunity(state) {
    const slots = 5;
    let html = '';
    for (let i = 0; i < slots; i++) {
      html += state.community[i] ? cardHTML(state.community[i]) : '<div class="card card-empty"></div>';
    }
    this.els.community.innerHTML = html;
  }

  renderTurnIndicator(state) {
    const el = this.els.turnIndicator;
    if (!el) return;

    if (state.phase === 'showdown') {
      el.textContent = 'Showdown — review hands';
      el.className = 'turn-indicator showdown';
      return;
    }

    const actor = state.players[state.actionIndex];
    if (!actor) {
      el.textContent = 'Dealing…';
      el.className = 'turn-indicator';
      return;
    }

    if (actor.isHuman) {
      el.textContent = '▶ YOUR TURN — choose an action';
      el.className = 'turn-indicator your-turn';
    } else if (actor.folded) {
      el.textContent = 'Hand continuing…';
      el.className = 'turn-indicator';
    } else {
      el.textContent = `▶ ${actor.name}'s turn`;
      el.className = 'turn-indicator their-turn';
    }
  }

  renderActions(state) {
    const human = state.players[0];
    const turn = state.humanTurn;
    this.els.actions.classList.toggle('visible', turn);

    if (!turn || !human) return;

    const toCall = state.currentBet - human.betThisRound;
    const minRaise = state.currentBet + Math.max(state.minRaise, state.bigBlind);
    const maxRaise = human.betThisRound + human.chips;

    this.els.btnCheck.style.display = toCall === 0 ? '' : 'none';
    this.els.btnCall.style.display = toCall > 0 ? '' : 'none';
    this.els.btnCall.textContent = toCall >= human.chips
      ? `Call All-In ${this.formatChips(human.chips, state)}`
      : `Call ${this.formatChips(toCall, state)}`;

    const canRaise = human.chips > toCall && maxRaise > minRaise;
    this.els.btnRaise.style.display = canRaise ? '' : 'none';
    this.els.btnAllIn.style.display = human.chips > 0 ? '' : 'none';

    if (canRaise) {
      this.els.raiseSlider.min = minRaise;
      this.els.raiseSlider.max = maxRaise;
      this.els.raiseSlider.step = Math.max(state.bigBlind, 0.01);
      if (!this.raiseAmount || this.raiseAmount < minRaise) {
        this.raiseAmount = minRaise;
      }
      this.raiseAmount = Math.min(Math.max(this.raiseAmount, minRaise), maxRaise);
      this.els.raiseSlider.value = this.raiseAmount;
      this.els.raiseValue.textContent = this.formatChips(this.raiseAmount, state);
    }
  }

  getRaiseAmount() {
    return Number(this.els.raiseSlider?.value || 0);
  }

  bindActions(handlers) {
    this.els.btnFold?.addEventListener('click', handlers.fold);
    this.els.btnCheck?.addEventListener('click', handlers.check);
    this.els.btnCall?.addEventListener('click', handlers.call);
    this.els.btnRaise?.addEventListener('click', handlers.raise);
    this.els.btnAllIn?.addEventListener('click', handlers.allin);
    this.els.btnNext?.addEventListener('click', handlers.nextHand);
    this.els.raiseSlider?.addEventListener('input', (e) => {
      this.raiseAmount = Number(e.target.value);
      this.els.raiseValue.textContent = this.formatChips(this.raiseAmount, this.mode);
    });
  }
}