import { PokerGame } from './game.js?v=18';
import { PokerUI } from './ui.js?v=18';
import { TABLE_MODES, MENU_SECTIONS, MULTIPLAYER_ROOMS, CASINO_GAMES } from './modes.js?v=18';
import {
  loadWallet, saveWallet, connectWalletProvider, disconnectWallet,
  claimDailyBonus, canAffordBuyIn, deductBuyIn, creditWinnings,
  refreshMtBalance, shortAddress
} from './wallet.js?v=18';
import { generateRoomCode, simulateMatchmaking } from './multiplayer.js?v=18';
import { detectWallets, sendMTToTreasury } from './solana-wallet.js?v=18';
import { MEMETORRENT, LUCKY_REELS_URL } from './config.js?v=18';
import {
  loadProfile, updateProfile, uploadAvatarFile, removeAvatar,
  CHARACTER_PRESETS, getDisplayName, isSignedIn
} from './profile.js?v=18';
import { renderAvatarHTML } from './avatar.js?v=18';
import {
  handleAuthCallback, bootAuthProviders, signInDiscord, signInFacebook,
  signInGoogle, signInTelegram, renderGoogleButton, signOut, getAuthLabel
} from './auth.js?v=18';

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
let profile = loadProfile();
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
  const displayName = getDisplayName(profile) || wallet.screenName || 'Player1';
  if (nameInput && !nameInput.matches(':focus')) {
    nameInput.value = displayName;
  }

  renderSetupAvatarPreview();
  updateMenuPlayerBar();

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

function renderSetupAvatarPreview() {
  const el = document.getElementById('setup-avatar-preview');
  if (!el) return;
  const name = getDisplayName(profile);
  el.innerHTML = renderAvatarHTML(
    { name, avatarUrl: profile.avatarUrl, character: profile.character, isHuman: true },
    { size: 'large', preferCharacter: !profile.avatarUrl }
  );
}

function renderProfilePreview() {
  const name = document.getElementById('profile-name')?.value?.trim() || getDisplayName(profile);
  const character = {
    skinTone: document.querySelector('#skin-swatches .active')?.dataset.value || profile.character.skinTone,
    hairStyle: document.getElementById('profile-hair-style')?.value || profile.character.hairStyle,
    hairColor: document.querySelector('#hair-swatches .active')?.dataset.value || profile.character.hairColor,
    frameColor: document.querySelector('#frame-swatches .active')?.dataset.value || profile.character.frameColor,
    accessory: document.getElementById('profile-accessory')?.value || profile.character.accessory
  };
  const avatarUrl = profile.avatarUrl;
  const html = renderAvatarHTML(
    { name, avatarUrl, character, isHuman: true },
    { size: 'large', preferCharacter: !avatarUrl }
  );
  ['profile-avatar-preview', 'settings-avatar-preview'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  const nameEl = document.getElementById('settings-display-name');
  if (nameEl) nameEl.textContent = name;
}

function updateMenuPlayerBar() {
  const name = getDisplayName(profile);
  const avatarEl = document.getElementById('menu-player-avatar');
  const nameEl = document.getElementById('menu-player-name');
  if (avatarEl) {
    avatarEl.innerHTML = renderAvatarHTML(
      { name, avatarUrl: profile.avatarUrl, character: profile.character, isHuman: true },
      { size: 'preview', preferCharacter: !profile.avatarUrl }
    );
  }
  if (nameEl) nameEl.textContent = name;
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.settings-panel').forEach((panel) => {
    const isActive = panel.id === `settings-panel-${tab}`;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
}

function buildSwatches(containerId, values, selected, onPick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = values.map((v) =>
    `<button type="button" class="swatch ${v === selected ? 'active' : ''}" data-value="${v}" style="--swatch:${v}" aria-label="Colour"></button>`
  ).join('');
  el.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.swatch').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick?.(btn.dataset.value);
      renderProfilePreview();
    });
  });
}

function fillSelect(id, options, selected) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = options.map((o) => {
    const val = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

function onAuthSuccess(p, label) {
  profile = p;
  syncProfileToWallet();
  renderProfileScreen();
  toast(`Signed in with ${label || getAuthLabel(p)}`);
}

function openSettingsScreen(tab = 'account') {
  profile = loadProfile();
  document.getElementById('profile-name').value = getDisplayName(profile);
  fillSelect('profile-hair-style', CHARACTER_PRESETS.hairStyles, profile.character.hairStyle);
  fillSelect('profile-accessory', CHARACTER_PRESETS.accessories.map((a) => ({
    value: a,
    label: a.charAt(0).toUpperCase() + a.slice(1)
  })), profile.character.accessory);

  buildSwatches('skin-swatches', CHARACTER_PRESETS.skinTones, profile.character.skinTone, () => {});
  buildSwatches('hair-swatches', CHARACTER_PRESETS.hairColors, profile.character.hairColor, () => {});
  buildSwatches('frame-swatches', CHARACTER_PRESETS.frames, profile.character.frameColor, () => {});

  renderProfileScreen();
  switchSettingsTab(tab);
  showScreen('settings');

  renderGoogleButton(
    document.getElementById('google-signin-btn'),
    (p) => onAuthSuccess(p, 'Gmail'),
    (err) => toast(err.message)
  );
}

function renderProfileScreen() {
  profile = loadProfile();
  document.getElementById('profile-name').value = getDisplayName(profile);
  const badge = document.getElementById('profile-auth-badge');
  const signout = document.getElementById('btn-auth-signout');
  if (badge) badge.textContent = isSignedIn(profile) ? getAuthLabel(profile) : 'Guest';
  if (signout) signout.hidden = !isSignedIn(profile);
  renderProfilePreview();
  updateWalletUI();
}

function syncProfileToWallet() {
  wallet.screenName = getDisplayName(profile);
  saveWallet(wallet);
}

function saveProfileFromForm() {
  profile = captureProfileFromForm();
  syncProfileToWallet();
  return profile;
}

function captureProfileFromForm() {
  const nameEl = document.getElementById('profile-name');
  if (!nameEl) return loadProfile();
  return updateProfile({
    displayName: nameEl.value?.trim() || getDisplayName(profile),
    character: {
      skinTone: document.querySelector('#skin-swatches .active')?.dataset.value || profile.character.skinTone,
      hairStyle: document.getElementById('profile-hair-style')?.value || profile.character.hairStyle,
      hairColor: document.querySelector('#hair-swatches .active')?.dataset.value || profile.character.hairColor,
      frameColor: document.querySelector('#frame-swatches .active')?.dataset.value || profile.character.frameColor,
      accessory: document.getElementById('profile-accessory')?.value || profile.character.accessory
    }
  });
}

async function launchGame() {
  let mode = pendingMode || TABLE_MODES['free-ai'];
  profile = captureProfileFromForm();
  const name = document.getElementById('player-name')?.value?.trim() || getDisplayName(profile) || 'Player1';
  profile = updateProfile({ displayName: name });
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

    game.initTable(name, {
      avatarUrl: profile.avatarUrl,
      character: profile.character
    });
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
  try {
    wallet = await connectWalletProvider(type);
    closeModal('wallet-modal');
    toast(`Connected — ${formatMt(wallet.mtBalance)} $MEMETORRENT on-chain`);
    await updateWalletUI();
  } catch (err) {
    const msg = err.message || 'Connection failed';
    if (msg.includes('Opening') && msg.includes('app')) {
      toast(msg);
      closeModal('wallet-modal');
    } else {
      toast(msg);
    }
  }
}

async function resumeWalletIfNeeded() {
  const pending = sessionStorage.getItem('mt-pending-wallet');
  if (!pending || !detectWallets()[pending]) return;
  // Solflare SDK iframe needs time after v1/browse opens
  const delays = pending === 'solflare' ? [0, 1500, 3500, 6000] : [0];
  for (const ms of delays) {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    if (!detectWallets()[pending]) continue;
    try {
      wallet = await connectWalletProvider(pending);
      closeModal('wallet-modal');
      toast(`Connected — ${formatMt(wallet.mtBalance)} $MEMETORRENT`);
      await updateWalletUI();
      return;
    } catch (_) { /* retry */ }
  }
}

document.getElementById('btn-enter')?.addEventListener('click', async () => {
  try {
    const p = await handleAuthCallback((prof) => onAuthSuccess(prof, 'Telegram'));
    if (p) profile = p;
    else profile = loadProfile();
    syncProfileToWallet();
  } catch (err) {
    toast(err.message);
  }
  await updateWalletUI();
  renderMenu();
  renderRooms();
  showScreen('menu');
});

document.getElementById('btn-settings')?.addEventListener('click', () => openSettingsScreen('account'));
document.getElementById('btn-settings-back')?.addEventListener('click', () => {
  saveProfileFromForm();
  showScreen('menu');
  updateWalletUI();
});

document.querySelectorAll('.settings-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchSettingsTab(btn.dataset.tab));
});

document.getElementById('btn-settings-save')?.addEventListener('click', () => {
  saveProfileFromForm();
  toast('Profile saved');
  showScreen('menu');
  updateWalletUI();
});

document.getElementById('avatar-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    profile = await uploadAvatarFile(file);
    renderProfilePreview();
    toast('Photo uploaded — shows at the table');
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
});

document.getElementById('btn-avatar-remove')?.addEventListener('click', () => {
  profile = removeAvatar();
  renderProfilePreview();
  toast('Photo removed');
});

document.getElementById('btn-auth-google')?.addEventListener('click', async () => {
  try {
    await signInGoogle(
      (p) => onAuthSuccess(p, 'Gmail'),
      (err) => toast(err.message)
    );
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-auth-telegram')?.addEventListener('click', async () => {
  try {
    await signInTelegram(
      (p) => onAuthSuccess(p, 'Telegram'),
      (err) => {
        if (err.message?.includes('Open @')) toast('Telegram opened — tap Start in the bot, then finish sign-in');
        else toast(err.message);
      }
    );
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-auth-discord')?.addEventListener('click', async () => {
  try {
    await signInDiscord(
      (p) => onAuthSuccess(p, 'Discord'),
      (err) => toast(err.message)
    );
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-auth-facebook')?.addEventListener('click', async () => {
  try {
    await signInFacebook(
      (p) => onAuthSuccess(p, 'Facebook'),
      (err) => toast(err.message)
    );
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('btn-auth-signout')?.addEventListener('click', () => {
  profile = signOut();
  renderProfileScreen();
  toast('Signed out');
});

['profile-hair-style', 'profile-accessory'].forEach((id) => {
  document.getElementById(id)?.addEventListener('change', renderProfilePreview);
});
document.getElementById('profile-name')?.addEventListener('input', renderProfilePreview);

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
bootAuthProviders(
  (p) => { profile = p; syncProfileToWallet(); updateWalletUI(); },
  (err) => console.warn('Auth:', err.message)
);
handleAuthCallback((p) => onAuthSuccess(p, 'Telegram')).then((p) => {
  if (p) profile = p;
}).catch((err) => toast(err.message));
resumeWalletIfNeeded();
updateWalletUI();
renderMenu();
showScreen('title');