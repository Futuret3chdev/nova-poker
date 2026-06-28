import { PokerGame } from './game.js?v=6';
import { PokerUI } from './ui.js?v=6';
import { TABLE_MODES, MENU_SECTIONS, MULTIPLAYER_ROOMS, CASINO_GAMES } from './modes.js?v=6';
import {
  loadWallet, saveWallet, connectWalletProvider, disconnectWallet,
  claimDailyBonus, canAffordBuyIn, deductBuyIn, creditWinnings,
  refreshMtBalance, shortAddress
} from './wallet.js?v=6';
import { generateRoomCode, simulateMatchmaking } from './multiplayer.js?v=6';
import { detectWallets, sendMTToTreasury, walletInstallUrl } from './solana-wallet.js?v=6';
import { MEMETORRENT, LUCKY_REELS_URL } from './config.js?v=6';

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');
}

function setupInstallHint() {
  const hint = document.getElementById('install-hint');
  const close = document.getElementById('install-hint-close');
  if (!hint) return;

  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const dismissed = localStorage.getItem('mt-poker-install-hint') === '1';

  if (mobile && !isStandaloneApp() && !dismissed) {
    hint.hidden = false;
  }

  close?.addEventListener('click', () => {
    hint.hidden = true;
    localStorage.setItem('mt-poker-install-hint', '1');
  });
}

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

function formatMt(n) {
  const v = Number(n) || 0;
  return v < 1 ? v.toFixed(2) : v.toLocaleString();
}

async function updateWalletUI() {
  if (wallet.walletConnected) wallet = await refreshMtBalance(wallet);

  const nameInput = document.getElementById('player-name');
  if (nameInput && !nameInput.matches(':focus')) {
    nameInput.value = wallet.screenName || 'Player1';
  }

  document.getElementById('hud-mt')?.replaceChildren(
    document.createTextNode(formatMt(wallet.mtBalance))
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
      const type = (wallet.walletType || 'wallet').charAt(0).toUpperCase() + (wallet.walletType || '').slice(1);
      addrEl.textContent = `${type}: ${shortAddress(wallet.walletAddress)} · SOL ${(wallet.solBalance || 0).toFixed(3)}`;
    } else {
      addrEl.textContent = 'Connect Phantom, Solflare or Backpack';
    }
  }

  const connectBtn = document.getElementById('btn-connect');
  if (connectBtn) {
    connectBtn.textContent = wallet.walletConnected ? 'Disconnect' : 'Connect Wallet';
    connectBtn.classList.toggle('connected', wallet.walletConnected);
  }

  const buyBtn = document.getElementById('btn-buy-mt');
  if (buyBtn) buyBtn.href = MEMETORRENT.jupiterBuy;

  const bonusBtn = document.getElementById('btn-daily');
  const today = new Date().toISOString().slice(0, 10);
  if (bonusBtn) bonusBtn.disabled = wallet.lastDailyBonus === today;
}

function renderCasinoGames() {
  const el = document.getElementById('menu-games');
  if (!el) return;
  el.innerHTML = `<h3>Casino Games</h3><div class="mode-grid" id="games-grid"></div>`;
  const grid = document.getElementById('games-grid');

  CASINO_GAMES.forEach((g) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mode-card mode-slots';
    card.innerHTML = `
      <span class="mode-icon">${g.icon}</span>
      <span class="mode-badge-sm">${g.badge}</span>
      <span class="mode-title">${g.title}</span>
      <span class="mode-desc">${g.subtitle}</span>
      <span class="mode-stakes">Live on-chain · Lucky Reels</span>
    `;
    card.addEventListener('click', () => openLuckyReels());
    grid.appendChild(card);
  });
}

function openLuckyReels() {
  const frame = document.getElementById('reels-frame');
  if (frame) frame.src = LUCKY_REELS_URL;
  document.getElementById('btn-reels-open')?.setAttribute('href', LUCKY_REELS_URL);
  showScreen('reels');
}

function renderMenu() {
  renderCasinoGames();
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
        <span class="mode-stakes">Blinds ${mode.smallBlind}/${mode.bigBlind} ${mode.symbol === '$MEMETORRENT' ? 'MT' : mode.symbol}</span>
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
    toast('Connect wallet first — same as Lucky Reels');
    openModal('wallet-modal');
    return;
  }
  if (mode.currency === 'mt' && mode.buyIn > 0 && wallet.mtBalance < mode.buyIn) {
    toast(`Need ${mode.buyIn} $MEMETORRENT — buy on Jupiter`);
    window.open(MEMETORRENT.jupiterBuy, '_blank');
    return;
  }

  pendingMode = { ...mode, roomName };
  const sym = mode.symbol === '$MEMETORRENT' ? 'MT' : mode.symbol;
  const buyInText = mode.buyIn > 0 ? `${mode.buyIn} ${sym}` : 'Free';

  document.getElementById('setup-title').textContent = mode.title;
  document.getElementById('setup-desc').textContent = roomName || mode.subtitle;
  document.getElementById('setup-buyin').textContent = buyInText;
  document.getElementById('setup-blinds').textContent = `${mode.smallBlind} / ${mode.bigBlind} ${sym}`;
  document.getElementById('setup-stack').textContent = `${mode.startingChips} ${sym}`;

  const mtWarn = document.getElementById('setup-mt-warn');
  if (mtWarn) {
    if (mode.currency === 'mt') {
      mtWarn.style.display = '';
      mtWarn.textContent = `Buy-in sends ${mode.buyIn} MT to MT Treasury (on-chain, like Lucky Reels spins)`;
    } else {
      mtWarn.style.display = 'none';
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

async function launchGame() {
  let mode = pendingMode || TABLE_MODES['free-ai'];
  const name = document.getElementById('player-name')?.value?.trim() || wallet.screenName || 'Player1';
  wallet.screenName = name;
  saveWallet(wallet);

  const launchBtn = document.getElementById('btn-launch');
  if (launchBtn) { launchBtn.disabled = true; launchBtn.textContent = 'Please wait…'; }

  try {
    if (mode.currency === 'mt') {
      if (!wallet.walletConnected) {
        toast('Connect wallet first');
        openModal('wallet-modal');
        return;
      }
      wallet = await refreshMtBalance(wallet);
      if (mode.buyIn > 0 && wallet.mtBalance < mode.buyIn) {
        toast(`Need ${mode.buyIn} $MEMETORRENT in wallet`);
        window.open(MEMETORRENT.jupiterBuy, '_blank');
        return;
      }
      if (mode.buyIn > 0) {
        toast(`Approve ${mode.buyIn} MT buy-in in your wallet…`);
        const sig = await sendMTToTreasury(mode.buyIn);
        wallet = await refreshMtBalance(wallet);
        toast(`Buy-in confirmed — tx ${String(sig).slice(0, 8)}…`);
        mode = { ...mode, startingChips: mode.buyIn };
        pendingMode = mode;
        currentMode = mode;
      }
    }

    currentMode = mode;
    showScreen('game');
    ui = new PokerUI(document.getElementById('game-screen'), mode);

    game = new PokerGame({
      mode,
      smallBlind: mode.smallBlind,
      bigBlind: mode.bigBlind,
      startingChips: mode.startingChips,
      opponentNames: mode.opponents || null,
      onUpdate: (state) => {
        ui.render(state);
        const hud = document.getElementById('wallet-hud');
        if (hud) {
          const human = state.players[0];
          const sym = mode.symbol === '$MEMETORRENT' ? 'MT' : mode.symbol;
          hud.textContent = human ? `${human.chips} ${sym}` : '';
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
  } catch (err) {
    toast(err.message || 'Could not start table');
  } finally {
    if (launchBtn) { launchBtn.disabled = false; launchBtn.textContent = 'Take a Seat'; }
  }
}

async function stopGame() {
  game = null;
  ui = null;
  currentMode = null;
  pendingMode = null;
  await updateWalletUI();
  showScreen('menu');
}

async function handleConnect(type) {
  if (!detectWallets()[type]) {
    toast(`Install ${type} wallet`);
    window.open(walletInstallUrl(type), '_blank');
    return;
  }
  try {
    wallet = await connectWalletProvider(type);
    closeModal('wallet-modal');
    toast(`Connected — ${formatMt(wallet.mtBalance)} $MEMETORRENT on-chain`);
    await updateWalletUI();
  } catch (err) {
    toast(err.message || 'Connection failed');
  }
}

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
document.getElementById('btn-reels-back')?.addEventListener('click', () => {
  document.getElementById('reels-frame')?.setAttribute('src', 'about:blank');
  showScreen('menu');
});

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
document.getElementById('btn-backpack')?.addEventListener('click', () => handleConnect('backpack'));
document.getElementById('btn-wallet-cancel')?.addEventListener('click', () => closeModal('wallet-modal'));
document.getElementById('wallet-modal-backdrop')?.addEventListener('click', () => closeModal('wallet-modal'));

document.getElementById('btn-refresh-mt')?.addEventListener('click', async () => {
  if (!wallet.walletConnected) {
    toast('Connect wallet first');
    return;
  }
  wallet = await refreshMtBalance(wallet);
  toast(`Balance: ${formatMt(wallet.mtBalance)} $MEMETORRENT`);
  await updateWalletUI();
});

document.getElementById('btn-daily')?.addEventListener('click', () => {
  const res = claimDailyBonus();
  if (res.ok) toast(`+${res.bonus.chips.toLocaleString()} free chips (play money only)`);
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

setupInstallHint();
updateWalletUI();
renderMenu();
showScreen('title');