import { PokerGame } from './game.js?v=3';
import { PokerUI } from './ui.js?v=3';
import { TABLE_MODES, MENU_SECTIONS, MULTIPLAYER_ROOMS } from './modes.js?v=3';
import {
  loadWallet, saveWallet, connectWalletProvider, disconnectWallet,
  claimDailyBonus, canAffordBuyIn, deductBuyIn, creditWinnings,
  cashOutMt, refreshMtBalance, shortAddress
} from './wallet.js?v=3';
import { generateRoomCode, simulateMatchmaking } from './multiplayer.js?v=3';
import { detectWallets, depositMtToCasino, walletInstallUrl } from './solana-wallet.js?v=3';
import { MEMETORRENT } from './config.js?v=3';

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
  setTimeout(() => el.classList.remove('show'), 3800);
}

function openModal(id) {
  document.getElementById(id)?.removeAttribute('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.setAttribute('hidden', '');
}

async function updateWalletUI() {
  if (wallet.walletConnected) wallet = await refreshMtBalance(wallet);

  const name = wallet.screenName || 'Player1';
  const nameInput = document.getElementById('player-name');
  if (nameInput && !nameInput.matches(':focus')) nameInput.value = name;

  document.getElementById('hud-mt')?.replaceChildren(
    document.createTextNode((wallet.mtBalance || 0).toLocaleString())
  );
  document.getElementById('hud-chips')?.replaceChildren(
    document.createTextNode(wallet.freeChips.toLocaleString())
  );
  document.getElementById('hud-wins')?.replaceChildren(
    document.createTextNode(String(wallet.handsWon))
  );

  const addrEl = document.getElementById('wallet-address');
  if (addrEl) {
    if (wallet.walletConnected) {
      const type = wallet.walletType === 'solflare' ? 'Solflare' : 'Phantom';
      addrEl.textContent = `${type}: ${shortAddress(wallet.walletAddress)}`;
    } else {
      addrEl.textContent = 'Connect Phantom or Solflare to play $MT';
    }
  }

  const connectBtn = document.getElementById('btn-connect');
  if (connectBtn) {
    connectBtn.textContent = wallet.walletConnected ? 'Disconnect' : 'Connect Wallet';
    connectBtn.classList.toggle('connected', wallet.walletConnected);
  }

  const loadBtn = document.getElementById('btn-load-mt');
  if (loadBtn) loadBtn.disabled = !wallet.walletConnected;

  const bonusBtn = document.getElementById('btn-daily');
  const today = new Date().toISOString().slice(0, 10);
  if (bonusBtn) {
    bonusBtn.disabled = wallet.lastDailyBonus === today;
    bonusBtn.title = 'Free play chips only — no $MT';
  }
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
  if (mode.currency === 'mt' && !wallet.walletConnected) {
    toast('Connect Phantom or Solflare first');
    openModal('wallet-modal');
    return;
  }
  if (mode.currency === 'mt' && mode.buyIn > 0 && wallet.mtBalance < mode.buyIn) {
    toast(`Load $MT first — need ${mode.buyIn} MT buy-in`);
    openLoadModal();
    return;
  }

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
      mtWarn.textContent = 'Connect Phantom or Solflare to play $MT';
    } else if (mode.currency === 'mt' && !canAffordBuyIn(wallet, mode, mode.buyIn)) {
      mtWarn.textContent = `Load ${mode.buyIn} MT — casino balance: ${wallet.mtBalance} MT`;
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

function openLoadModal() {
  if (!wallet.walletConnected) {
    openModal('wallet-modal');
    return;
  }
  document.getElementById('load-wallet-addr').textContent = shortAddress(wallet.walletAddress);
  const hint = document.getElementById('load-hint');
  if (hint) {
    if (MEMETORRENT.mtMint && MEMETORRENT.vaultAddress) {
      hint.textContent = `Min deposit ${MEMETORRENT.minDeposit} MT. You approve the transfer in your wallet.`;
    } else {
      hint.textContent = 'MemeTorrent $MT mint launching soon — vault address will be enabled.';
    }
  }
  openModal('load-modal');
}

async function handleConnect(type) {
  const detected = detectWallets();
  if (!detected[type]) {
    toast(`Install ${type === 'phantom' ? 'Phantom' : 'Solflare'} first`);
    window.open(walletInstallUrl(type), '_blank');
    return;
  }
  try {
    wallet = await connectWalletProvider(type);
    closeModal('wallet-modal');
    toast(`${type === 'phantom' ? 'Phantom' : 'Solflare'} connected — load $MT to play stakes`);
    await updateWalletUI();
  } catch (err) {
    toast(err.message || 'Wallet connection failed');
  }
}

async function handleDeposit() {
  const amount = Number(document.getElementById('load-amount')?.value || 0);
  if (!amount || amount < MEMETORRENT.minDeposit) {
    toast(`Minimum load is ${MEMETORRENT.minDeposit} MT`);
    return;
  }
  const btn = document.getElementById('btn-confirm-load');
  if (btn) { btn.disabled = true; btn.textContent = 'Approve in wallet…'; }
  try {
    const res = await depositMtToCasino(amount);
    wallet = await refreshMtBalance(wallet);
    closeModal('load-modal');
    toast(`Loaded ${res.amount.toLocaleString()} MT — ready to play`);
    await updateWalletUI();
  } catch (err) {
    toast(err.message || 'Deposit failed');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Load'; }
  }
}

function launchGame() {
  const mode = pendingMode || TABLE_MODES['free-ai'];
  const name = document.getElementById('player-name')?.value?.trim() || wallet.screenName || 'Player1';
  wallet.screenName = name;
  saveWallet(wallet);

  if (mode.currency === 'mt') {
    if (!wallet.walletConnected) {
      toast('Connect Phantom or Solflare first');
      openModal('wallet-modal');
      return;
    }
    if (mode.buyIn > 0 && !canAffordBuyIn(wallet, mode, mode.buyIn)) {
      toast(`Load $MT first — need ${mode.buyIn} MT`);
      openLoadModal();
      return;
    }
    if (mode.buyIn > 0) {
      wallet = deductBuyIn(wallet, mode, mode.buyIn);
      mode.startingChips = mode.buyIn;
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

async function stopGame() {
  if (game && currentMode?.currency === 'mt') {
    const chips = game.players?.[0]?.chips || 0;
    if (chips > 0) {
      wallet = cashOutMt(wallet, chips);
      toast(`Cashed out ${chips.toLocaleString()} MT to casino balance`);
    }
  }
  game = null;
  ui = null;
  currentMode = null;
  pendingMode = null;
  await updateWalletUI();
  showScreen('menu');
}

// ── Event bindings ──
document.getElementById('btn-enter')?.addEventListener('click', async () => {
  await updateWalletUI();
  renderMenu();
  renderRooms();
  showScreen('menu');
});

document.getElementById('btn-launch')?.addEventListener('click', launchGame);
document.getElementById('btn-setup-back')?.addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-lobby')?.addEventListener('click', stopGame);
document.getElementById('btn-menu-back')?.addEventListener('click', () => showScreen('title'));

document.getElementById('btn-connect')?.addEventListener('click', async () => {
  if (wallet.walletConnected) {
    wallet = await disconnectWallet();
    toast('Wallet disconnected');
    await updateWalletUI();
  } else {
    openModal('wallet-modal');
  }
});

document.getElementById('btn-phantom')?.addEventListener('click', () => handleConnect('phantom'));
document.getElementById('btn-solflare')?.addEventListener('click', () => handleConnect('solflare'));
document.getElementById('btn-wallet-cancel')?.addEventListener('click', () => closeModal('wallet-modal'));
document.getElementById('wallet-modal-backdrop')?.addEventListener('click', () => closeModal('wallet-modal'));

document.getElementById('btn-load-mt')?.addEventListener('click', openLoadModal);
document.getElementById('btn-confirm-load')?.addEventListener('click', handleDeposit);
document.getElementById('btn-load-cancel')?.addEventListener('click', () => closeModal('load-modal'));
document.getElementById('load-modal-backdrop')?.addEventListener('click', () => closeModal('load-modal'));

document.getElementById('btn-daily')?.addEventListener('click', () => {
  const res = claimDailyBonus();
  if (res.ok) toast(`Free chips bonus: +${res.bonus.chips.toLocaleString()} ₵ (play money only)`);
  else toast('Free chips bonus already claimed today');
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