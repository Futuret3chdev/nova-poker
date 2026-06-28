import { createDeck, shuffle } from './deck.js';
import { evaluateHand, compareHands } from './hand-evaluator.js';
import { decideAction, BOT_NAMES } from './ai.js';

const PHASES = ['preflop', 'flop', 'turn', 'river', 'showdown'];

export class PokerGame {
  constructor(opts = {}) {
    this.mode = opts.mode || { currency: 'free', symbol: '₵' };
    this.smallBlind = opts.smallBlind || 25;
    this.bigBlind = opts.bigBlind || 50;
    this.startingChips = opts.startingChips || 5000;
    this.onUpdate = opts.onUpdate || (() => {});
    this.onMessage = opts.onMessage || (() => {});
    this.onHandEnd = opts.onHandEnd || (() => {});
    this.opponentNames = opts.opponentNames || null;
    this.players = [];
    this.deck = [];
    this.community = [];
    this.pot = 0;
    this.phase = 'waiting';
    this.dealerIndex = 0;
    this.currentBet = 0;
    this.minRaise = 0;
    this.actionIndex = 0;
    this.lastRaiser = -1;
    this.handNumber = 0;
    this.winners = [];
    this.lastAction = '';
    this.actedThisRound = new Set();
  }

  initTable(humanName = 'You', humanProfile = {}) {
    const sym = this.mode.symbol || '₵';
    const botNames = this.opponentNames || BOT_NAMES;
    this.players = [
      {
        id: 0, name: humanName, isHuman: true,
        avatarUrl: humanProfile.avatarUrl || null,
        character: humanProfile.character || null,
        chips: this.startingChips, hole: [], betThisRound: 0, totalBet: 0,
        folded: false, allIn: false, isDealer: false, isSB: false, isBB: false
      },
      ...botNames.map((name, i) => ({
        id: i + 1, name, isHuman: false, chips: this.startingChips,
        hole: [], betThisRound: 0, totalBet: 0, folded: false, allIn: false,
        isDealer: false, isSB: false, isBB: false
      }))
    ];
    this.dealerIndex = 0;
    const label = this.mode.multiplayer ? 'Live table' : 'AI table';
    this.onMessage(`${label} — ${this.formatAmt(this.startingChips)} buy-in`);
    this.startHand();
  }

  formatAmt(n) {
    const sym = this.mode.symbol || '₵';
    if (sym === 'MT' || sym === '$MEMETORRENT') {
      const v = Number(n);
      return v < 1 ? `${v.toFixed(2)} MT` : `${v.toLocaleString()} MT`;
    }
    if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
    return `${sym}${n}`;
  }

  activePlayers() {
    return this.players.filter((p) => p.chips > 0 || p.allIn);
  }

  inHandPlayers() {
    return this.players.filter((p) => !p.folded && (p.chips > 0 || p.allIn || p.hole.length));
  }

  seatOrder(from) {
    const n = this.players.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push((from + i) % n);
    return order;
  }

  nextActive(from) {
    const order = this.seatOrder(from + 1);
    for (const idx of order) {
      const p = this.players[idx];
      if (!p.folded && !p.allIn && p.chips > 0) return idx;
    }
    return -1;
  }

  bettingComplete() {
    const active = this.players.filter((p) => !p.folded && !p.allIn);
    if (active.length <= 1) return true;
    if (!active.every((p) => p.betThisRound === this.currentBet)) return false;
    return active.every((p) => this.actedThisRound.has(p.id));
  }

  startHand() {
    const seated = this.players.filter((p) => p.chips > 0);
    if (seated.length < 2) {
      this.phase = 'gameover';
      this.onMessage('Game over — not enough chips');
      this.emit();
      return;
    }

    this.handNumber++;
    this.deck = shuffle(createDeck());
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.winners = [];
    this.lastAction = '';

    this.players.forEach((p) => {
      p.hole = [];
      p.betThisRound = 0;
      p.totalBet = 0;
      p.folded = p.chips <= 0;
      p.allIn = false;
      p.isDealer = false;
      p.isSB = false;
      p.isBB = false;
      if (p.chips <= 0) p.folded = true;
    });

    while (this.players[this.dealerIndex].chips <= 0) {
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    }
    this.players[this.dealerIndex].isDealer = true;

    const n = this.players.length;
    const sbIdx = this.nextActive(this.dealerIndex);
    const bbIdx = this.nextActive(sbIdx);
    this.players[sbIdx].isSB = true;
    this.players[bbIdx].isBB = true;

    this.postBlind(sbIdx, this.smallBlind);
    this.postBlind(bbIdx, this.bigBlind);
    this.currentBet = this.bigBlind;

    for (const p of this.players) {
      if (!p.folded) {
        p.hole.push(this.deck.pop(), this.deck.pop());
      }
    }

    this.phase = 'preflop';
    this.actedThisRound = new Set([sbIdx, bbIdx]);
    this.actionIndex = this.nextActive(bbIdx);
    this.lastRaiser = bbIdx;
    this.onMessage(`Hand #${this.handNumber} — blinds posted`);
    this.emit();

    this.runBotTurns();
  }

  postBlind(idx, amount) {
    const p = this.players[idx];
    const pay = Math.min(amount, p.chips);
    p.chips -= pay;
    p.betThisRound += pay;
    p.totalBet += pay;
    this.pot += pay;
    if (p.chips === 0) p.allIn = true;
  }

  getHuman() {
    return this.players.find((p) => p.isHuman);
  }

  humanTurn() {
    const p = this.getHuman();
    if (!p || p.folded || p.allIn) return false;
    return this.actionIndex === p.id && this.phase !== 'showdown' && this.phase !== 'waiting';
  }

  callAmount(player) {
    return Math.min(this.currentBet - player.betThisRound, player.chips);
  }

  applyAction(playerIdx, action, raiseTo = 0) {
    const p = this.players[playerIdx];
    if (!p || p.folded || p.allIn) return;

    let msg = '';
    if (action === 'fold') {
      p.folded = true;
      msg = `${p.name} folds`;
    } else if (action === 'check') {
      if (this.currentBet > p.betThisRound) return;
      msg = `${p.name} checks`;
    } else if (action === 'call') {
      const pay = this.callAmount(p);
      p.chips -= pay;
      p.betThisRound += pay;
      p.totalBet += pay;
      this.pot += pay;
      if (p.chips === 0) p.allIn = true;
      msg = `${p.name} calls ${this.formatAmt(pay)}`;
    } else if (action === 'raise' || action === 'allin') {
      let target = action === 'allin' ? p.betThisRound + p.chips : raiseTo;
      target = Math.min(target, p.betThisRound + p.chips);
      const add = target - p.betThisRound;
      const raiseSize = target - this.currentBet;
      if (raiseSize >= this.minRaise || action === 'allin') {
        this.minRaise = Math.max(this.minRaise, raiseSize);
        this.lastRaiser = playerIdx;
      }
      p.chips -= add;
      p.betThisRound = target;
      p.totalBet += add;
      this.pot += add;
      this.currentBet = Math.max(this.currentBet, target);
      if (p.chips === 0) p.allIn = true;
      msg = action === 'allin' ? `${p.name} is ALL-IN ${this.formatAmt(add)}` : `${p.name} raises to ${this.formatAmt(target)}`;
    }

    this.actedThisRound.add(playerIdx);
    this.lastAction = msg;
    this.onMessage(msg);
    this.advanceAfterAction();
  }

  advanceAfterAction() {
    const alive = this.players.filter((p) => !p.folded);
    if (alive.length === 1) {
      this.awardPot([alive[0]]);
      return;
    }

    if (this.bettingComplete()) {
      this.nextPhase();
      return;
    }

    this.actionIndex = this.nextActive(this.actionIndex);
    if (this.actionIndex < 0) this.nextPhase();
    else {
      this.emit();
      this.runBotTurns();
    }
  }

  nextPhase() {
    this.players.forEach((p) => { p.betThisRound = 0; });
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.actedThisRound = new Set();

    const stillIn = this.players.filter((p) => !p.folded);
    const canBet = stillIn.filter((p) => !p.allIn && p.chips > 0);

    if (stillIn.length === 1 || canBet.length === 0) {
      while (this.phase !== 'showdown') this.dealCommunityStep();
      this.showdown();
      return;
    }

    if (this.phase === 'preflop') {
      this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.phase = 'flop';
      this.onMessage('The flop');
    } else if (this.phase === 'flop') {
      this.community.push(this.deck.pop());
      this.phase = 'turn';
      this.onMessage('The turn');
    } else if (this.phase === 'turn') {
      this.community.push(this.deck.pop());
      this.phase = 'river';
      this.onMessage('The river');
    } else if (this.phase === 'river') {
      this.showdown();
      return;
    }

    this.actionIndex = this.nextActive(this.dealerIndex);
    this.lastRaiser = -1;
    this.emit();
    this.runBotTurns();
  }

  dealCommunityStep() {
    if (this.phase === 'preflop') {
      this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.phase = 'flop';
    } else if (this.phase === 'flop') {
      this.community.push(this.deck.pop());
      this.phase = 'turn';
    } else if (this.phase === 'turn') {
      this.community.push(this.deck.pop());
      this.phase = 'river';
    } else {
      this.phase = 'showdown';
    }
  }

  showdown() {
    this.phase = 'showdown';
    const contenders = this.players.filter((p) => !p.folded);
    if (contenders.length === 1) {
      this.awardPot(contenders);
      return;
    }

    let best = [];
    for (const p of contenders) {
      const ev = evaluateHand(p.hole, this.community);
      p.handName = ev.name;
      p.handScore = ev.score;
      if (best.length === 0) {
        best = [p];
      } else {
        const cmp = compareHands(p.hole, best[0].hole, this.community);
        if (cmp > 0) best = [p];
        else if (cmp === 0) best.push(p);
      }
    }
    this.awardPot(best);
  }

  awardPot(winners) {
    const totalPot = this.pot;
    const share = Math.floor(totalPot / winners.length);
    const names = winners.map((w) => w.name).join(', ');
    const handInfo = winners[0].handName ? ` with ${winners[0].handName}` : '';
    winners.forEach((w) => { w.chips += share; });
    this.winners = winners.map((w) => w.id);
    const humanWon = winners.some((w) => w.isHuman);
    this.onMessage(`${names} wins ${this.formatAmt(totalPot)}${handInfo}`);
    this.onHandEnd({ winners, pot: totalPot, humanWon, humanChips: this.players[0]?.chips || 0 });
    this.pot = 0;
    this.phase = 'showdown';
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.emit();
  }

  runBotTurns() {
    if (this.phase === 'showdown' || this.phase === 'waiting') return;
    const tick = () => {
      if (this.humanTurn() || this.phase === 'showdown') return;
      const p = this.players[this.actionIndex];
      if (!p || p.isHuman || p.folded || p.allIn) return;
      const decision = decideAction(p, this);
      if (decision.action === 'raise') {
        this.applyAction(p.id, 'raise', decision.amount);
      } else if (decision.action === 'allin') {
        this.applyAction(p.id, 'allin');
      } else {
        this.applyAction(p.id, decision.action);
      }
      if (!this.humanTurn() && this.phase !== 'showdown') {
        setTimeout(tick, 600 + Math.random() * 500);
      }
    };
    setTimeout(tick, 500);
  }

  humanFold() { if (this.humanTurn()) this.applyAction(0, 'fold'); }
  humanCheck() { if (this.humanTurn()) this.applyAction(0, 'check'); }
  humanCall() { if (this.humanTurn()) this.applyAction(0, 'call'); }
  humanRaise(amount) { if (this.humanTurn()) this.applyAction(0, 'raise', amount); }
  humanAllIn() { if (this.humanTurn()) this.applyAction(0, 'allin'); }

  nextHand() {
    if (this.phase === 'showdown') this.startHand();
  }

  emit() {
    this.onUpdate(this.snapshot());
  }

  snapshot() {
    return {
      players: this.players.map((p) => ({
        ...p,
        hole: p.hole.map((c) => ({ ...c }))
      })),
      community: this.community.map((c) => ({ ...c })),
      pot: this.pot,
      phase: this.phase,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      actionIndex: this.actionIndex,
      handNumber: this.handNumber,
      winners: this.winners,
      lastAction: this.lastAction,
      humanTurn: this.humanTurn(),
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      mode: this.mode
    };
  }
}