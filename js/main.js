import { PokerGame } from './game.js?v=2';
import { PokerUI } from './ui.js?v=2';
import { TABLE_MODES, MENU_SECTIONS, MULTIPLAYER_ROOMS } from './modes.js?v=2';
import {
  loadWallet, saveWallet, connectWallet, disconnectWallet,
  claimDailyBonus, canAffordBuyIn, deductBuyIn, creditWinnings, shortAddress
} from './wallet.js?v=2';
import { generateRoomCode, simulateMatchmaking } from './multiplayer.js?v=2';

let game = null;
let ui = null;
let wallet = loadWallet();
let currentMode = null;
let pendingMode = null;

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(`${name}-screen`)?.classList.add('active');
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function updateWalletUI() {
  wallet = loadWallet();
  const name = wallet.screenName || 'Player1';
  const nameInput = document.getElementById('player-name');
  if (nameInput && !nameInput.matches(':focus')) nameInput.value = name;

  document.getElementById('hud-mt')?.replaceChildren(document.createTextNode(wallet.mtBalance.toLocaleString()));
  document.getElementById('hud-chips')?.replaceChildren(document.createTextNode(wallet.freeChips.toLocaleString()));
  document.getElementById('hud-wins')?.replaceChildren(document.createTextNode(String(wallet.handsWon)));
  const addrEl = document.getElementById('wallet-address');
  if (addrEl) addrEl.textContent = wallet.walletConnected ? shortAddress(wallet.walletAddress) : 'Connect wallet to play $MT';

  const connectBtn = document.getElementById('btn-connect');
  if (connectBtn) {
    connectBtn.textContent = wallet.walletConnected ? 'Disconnect' : 'Connect Wallet';
    connectBtn.classList.toggle('connected', wallet.walletConnected);
  }

  const bonusBtn = document.getElementById('btn-daily');
  const today = new Date().toISOString().slice(0, 10);
  if (bonusBtn) bonusBtn.disabled = wallet.lastDailyBonus === today;
}

function renderMenu() {
  const container = document.getElementById('menu-modes');
  if (!container) return;
  container.innerHTML = '';

  MENU_SECTIONS.forEach((section) => {
    const sec = document.createElement('div');
    sec.className = 'menu-section';
    sec.innerHTML = `<h3>${section.title}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'mode-grid';

    section.items.forEach((id) => {
      const mode = TABLE_MODES[id];
      if (!mode) return;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `mode-card mode-${mode.currency}`;
      card.innerHTML = `
        <span class="mode-icon">${mode.icon}</span>
        <span class="mode-badge-sm">${mode.badge}</span>
        <span class="mode-title">${mode.title}</span>
        <span class="mode-desc">${mode.subtitle}</span>
        <span class="mode-stakes">Blinds ${mode.smallBlind}/${mode.bigBlind} ${mode.symbol}</span>
      `;
      card.addEventListener('click', () => selectMode(mode));
      grid.appendChild(card);
    });

    sec.appendChild(grid);
    container.appendChild(sec);
  });
}

function renderRooms() {
  const list = document.getElementById('room-list');
  if (!list) return;
  list.innerHTML = MULTIPLAYER_ROOMS.map((r) => `
    <button type="button" class="room-card" data-room="${r.id}">
      <div class="room-top">
        <span class="room-name">${r.name}</span>
        <span class="room-badge ${r.currency}">${r.currency === 'mt' ? '$MT' : 'FREE'}</span>
      </div>
      <div class="room-meta">
        <span>${r.stakes}</span>
        <span>${r.players}/${r.max} players</span>
      </div>
    </button>
  `).join('');

  list.querySelectorAll('.room-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const room = MULTIPLAYER_ROOMS.find((r) => r.id === btn.dataset.room);
      const modeId = room.currency === 'mt' ? 'mt-multi' : 'free-multi';
      selectMode(TABLE_MODES[modeId], room.name);
    });
  });
}

function selectMode(mode, roomName = '') {
  pendingMode = { ...mode, roomName };
  const sym = mode.symbol;
  const buyInText = mode.buyIn > 0 ? `${mode.buyIn.toLocaleString()} ${sym}` : 'Free';

  document.getElementById('setup-title').textContent = mode.title;
  document.getElementById('setup-desc').textContent = roomName || mode.subtitle;
  document.getElementById('setup-buyin').textContent = buyInText;
  document.getElementById('setup-blinds').textContent = `${mode.smallBlind} / ${mode.bigBlind} ${sym}`;
  document.getElementById('setup-stack').textContent = `${mode.startingChips.toLocaleString()} ${sym}`;

  const mtWarn = document.getElementById('setup-mt-warn');
  if (mtWarn) {
    mtWarn.style.display = mode.currency === 'mt' ? '' : 'none';
    if (mode.currency === 'mt' && !wallet.walletConnected) {
      mtWarn.textContent = 'Connect your wallet to play for $MT';
    } else if (mode.currency === 'mt' && !canAffordBuyIn(wallet, mode, mode.buyIn)) {
      mtWarn.textContent = `Need ${mode.buyIn} MT — balance: ${wallet.mtBalance} MT`;
    } else {
      mtWarn.textContent = '';
    }
  }

  if (mode.multiplayer) {
    showScreen('multiplayer');
    startMatchmaking(mode);
  } else {
    showScreen('setup');
  }
}

function startMatchmaking(mode) {
  const status = document.getElementById('match-status');
  const bar = document.getElementById('match-bar');
  const roomCode = document.getElementById('room-code');
  if (roomCode) roomCode.textContent = generateRoomCode();

  simulateMatchmaking(mode, (msg, pct) => {
    if (status) status.textContent = msg;
    if (bar) bar.style.width = `${pct * 100}%`;
  }, (opponents) => {
    pendingMode = { ...mode, opponents };
    if (status) status.textContent = `Table ready — ${opponents.length + 1} players seated`;
    if (bar) bar.style.width = '100%';
    setTimeout(() => showScreen('setup'), 800);
  });
}

function launchGame() {
  const mode = pendingMode || TABLE_MODES['free-ai'];
  const name = document.getElementById('player-name')?.value?.trim() || wallet.screenName || 'Player1';
  wallet.screenName = name;
  saveWallet(wallet);

  if (mode.currency === 'mt') {
    if (!wallet.walletConnected) {
      toast('Connect wallet first to play $MT tables');
      showScreen('menu');
      return;
    }
    if (mode.buyIn > 0 && !canAffordBuyIn(wallet, mode, mode.buyIn)) {
      toast(`Not enough $MT — need ${mode.buyIn} MT`);
      return;
    }
    if (mode.buyIn > 0) {
      wallet = deductBuyIn(wallet, mode, mode.buyIn);
      mode = { ...mode, startingChips: mode.buyIn };
      pendingMode = mode;
      currentMode = mode;
    }
  }

  currentMode = mode;
  showScreen('game');
  ui = new PokerUI(document.getElementById('game-screen'), mode);

  const opponentNames = mode.opponents || null;
  game = new PokerGame({
    mode,
    smallBlind: mode.smallBlind,
    bigBlind: mode.bigBlind,
    startingChips: mode.startingChips,
    opponentNames,
    onUpdate: (state) => {
      ui.render(state);
      const sym = mode.symbol;
      const hud = document.getElementById('wallet-hud');
      if (hud) {
        const human = state.players[0];
        hud.textContent = human ? `${human.chips.toLocaleString()} ${sym}` : '';
      }
    },
    onMessage: (msg) => {
      const el = document.getElementById('game-message');
      if (el) el.textContent = msg;
    },
    onHandEnd: ({ humanWon }) => {
      wallet = creditWinnings(wallet, mode, 0, humanWon);
      updateWalletUI();
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
  document.getElementById('table-brand').textContent = mode.currency === 'mt' ? '$MT' : 'MT';
}

function stopGame() {
  if (game && currentMode?.currency === 'mt') {
    const chips = game.players?.[0]?.chips || 0;
    if (chips > 0) {
      wallet.mtBalance += chips;
      saveWallet(wallet);
      toast(`Cashed out ${chips.toLocaleString()} MT`);
    }
  }
  game = null;
  ui = null;
  currentMode = null;
  pendingMode = null;
  updateWalletUI();
  showScreen('menu');
}

// ── Event bindings ──
document.getElementById('btn-enter')?.addEventListener('click', () => {
  updateWalletUI();
  renderMenu();
  renderRooms();
  showScreen('menu');
});

document.getElementById('btn-launch')?.addEventListener('click', launchGame);
document.getElementById('btn-setup-back')?.addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-lobby')?.addEventListener('click', stopGame);
document.getElementById('btn-menu-back')?.addEventListener('click', () => showScreen('title'));

document.getElementById('btn-connect')?.addEventListener('click', () => {
  if (wallet.walletConnected) wallet = disconnectWallet();
  else {
    wallet = connectWallet();
    toast('Wallet connected — MemeTorrent $MT ready');
  }
  updateWalletUI();
});

document.getElementById('btn-daily')?.addEventListener('click', () => {
  const res = claimDailyBonus();
  if (res.ok) toast(`Daily bonus: +${res.bonus.chips} chips & +${res.bonus.mt} MT`);
  else toast('Daily bonus already claimed');
  updateWalletUI();
});

document.getElementById('btn-create-room')?.addEventListener('click', () => {
  selectMode(TABLE_MODES['free-multi']);
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
  const code = document.getElementById('join-code')?.value?.trim().toUpperCase();
  if (!code || code.length < 4) {
    toast('Enter a valid room code');
    return;
  }
  selectMode(TABLE_MODES['mt-multi'], `Room ${code}`);
});

document.getElementById('btn-multi-back')?.addEventListener('click', () => showScreen('menu'));

updateWalletUI();
renderMenu();
showScreen('title');