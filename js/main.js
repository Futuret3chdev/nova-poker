import { PokerGame } from './game.js?v=1';
import { PokerUI } from './ui.js?v=1';

let game = null;
let ui = null;

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(`${name}-screen`)?.classList.add('active');
}

function startGame() {
  const name = document.getElementById('player-name')?.value?.trim() || 'You';
  showScreen('game');
  ui = new PokerUI(document.getElementById('game-screen'));
  game = new PokerGame({
    onUpdate: (state) => ui.render(state),
    onMessage: (msg) => {
      const el = document.getElementById('game-message');
      if (el) el.textContent = msg;
    }
  });

  ui.bindActions({
    fold: () => game.humanFold(),
    check: () => game.humanCheck(),
    call: () => game.humanCall(),
    raise: () => game.humanRaise(ui.getRaiseAmount()),
    allin: () => game.humanAllIn(),
    nextHand: () => game.nextHand()
  });

  game.initTable(name);
}

document.getElementById('btn-play')?.addEventListener('click', startGame);
document.getElementById('btn-lobby')?.addEventListener('click', () => showScreen('title'));

showScreen('title');