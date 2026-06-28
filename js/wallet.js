const STORAGE_KEY = 'mt-poker-wallet';

const DEFAULTS = {
  mtBalance: 2500,
  freeChips: 10000,
  walletConnected: false,
  walletAddress: '',
  lastDailyBonus: '',
  handsPlayed: 0,
  handsWon: 0,
  mtWon: 0,
  screenName: 'Player1'
};

export function loadWallet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveWallet(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function connectWallet() {
  const w = loadWallet();
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  w.walletConnected = true;
  w.walletAddress = `0xMT${hex}...torrent`;
  if (w.mtBalance < 1000) w.mtBalance = 5000;
  saveWallet(w);
  return w;
}

export function disconnectWallet() {
  const w = loadWallet();
  w.walletConnected = false;
  w.walletAddress = '';
  saveWallet(w);
  return w;
}

export function claimDailyBonus() {
  const w = loadWallet();
  const today = new Date().toISOString().slice(0, 10);
  if (w.lastDailyBonus === today) return { ok: false, wallet: w };
  w.lastDailyBonus = today;
  w.freeChips += 5000;
  w.mtBalance += 250;
  saveWallet(w);
  return { ok: true, wallet: w, bonus: { chips: 5000, mt: 250 } };
}

export function canAffordBuyIn(wallet, mode, buyIn) {
  if (mode.currency === 'mt') return wallet.mtBalance >= buyIn;
  return wallet.freeChips >= buyIn;
}

export function deductBuyIn(wallet, mode, buyIn) {
  const w = { ...wallet };
  if (mode.currency === 'mt') w.mtBalance -= buyIn;
  else w.freeChips -= buyIn;
  saveWallet(w);
  return w;
}

export function creditWinnings(wallet, mode, amount, won) {
  const w = { ...wallet };
  w.handsPlayed += 1;
  if (won) {
    w.handsWon += 1;
    if (mode.currency === 'mt') {
      w.mtBalance += amount;
      w.mtWon += amount;
    } else {
      w.freeChips += amount;
    }
  }
  saveWallet(w);
  return w;
}

export function shortAddress(addr) {
  if (!addr) return 'Not connected';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}