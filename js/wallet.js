import {
  connectWalletType, disconnectSolana,
  fetchWalletMtBalance, fetchSolBalance, shortAddress
} from './solana-wallet.js?v=35';

const STORAGE_KEY = 'mt-poker-wallet';

const DEFAULTS = {
  freeChips: 10000,
  walletConnected: false,
  walletAddress: '',
  walletType: '',
  solBalance: 0,
  lastDailyBonus: '',
  handsPlayed: 0,
  handsWon: 0,
  screenName: 'Player1'
};

export function loadWallet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw), mtBalance: 0 } : { ...DEFAULTS, mtBalance: 0 };
  } catch {
    return { ...DEFAULTS, mtBalance: 0 };
  }
}

export function saveWallet(data) {
  const { mtBalance, solBalance, ...rest } = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

export async function connectWalletProvider(type) {
  const session = await connectWalletType(type);
  const w = loadWallet();
  w.walletConnected = true;
  w.walletAddress = session.publicKey;
  w.walletType = session.walletType;
  w.mtBalance = await fetchWalletMtBalance(session.publicKey);
  w.solBalance = await fetchSolBalance(session.publicKey);
  saveWallet(w);
  return w;
}

export async function disconnectWallet() {
  await disconnectSolana();
  const w = loadWallet();
  w.walletConnected = false;
  w.walletAddress = '';
  w.walletType = '';
  w.mtBalance = 0;
  w.solBalance = 0;
  saveWallet(w);
  return w;
}

export async function refreshMtBalance(wallet) {
  const w = { ...wallet };
  if (!w.walletAddress) {
    w.mtBalance = 0;
    w.solBalance = 0;
    return w;
  }
  w.mtBalance = await fetchWalletMtBalance(w.walletAddress);
  w.solBalance = await fetchSolBalance(w.walletAddress);
  return w;
}

export function claimDailyBonus() {
  const w = loadWallet();
  const today = new Date().toISOString().slice(0, 10);
  if (w.lastDailyBonus === today) return { ok: false, wallet: w };
  w.lastDailyBonus = today;
  w.freeChips += 5000;
  saveWallet(w);
  return { ok: true, wallet: w, bonus: { chips: 5000 } };
}

export function canAffordBuyIn(wallet, mode, buyIn) {
  if (mode.currency === 'mt') {
    if (!wallet.walletConnected) return false;
    return wallet.mtBalance >= buyIn;
  }
  return wallet.freeChips >= buyIn;
}

export function deductBuyIn(wallet, mode, buyIn) {
  const w = { ...wallet };
  if (mode.currency === 'mt') {
    w.mtBalance = Math.max(0, w.mtBalance - buyIn);
  } else {
    w.freeChips -= buyIn;
  }
  saveWallet(w);
  return w;
}

export function creditWinnings(wallet, mode, _amount, won) {
  const w = { ...wallet };
  w.handsPlayed += 1;
  if (won) w.handsWon += 1;
  saveWallet(w);
  return w;
}

export function adjustFreeChips(wallet, delta) {
  const w = { ...wallet };
  w.freeChips = Math.max(0, w.freeChips + delta);
  saveWallet(w);
  return w;
}

export { shortAddress };