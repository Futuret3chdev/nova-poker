import {
  connectPhantom, connectSolflare, disconnectSolana,
  getCasinoBalance, setCasinoBalance, addCasinoBalance,
  fetchWalletMtBalance, shortAddress
} from './solana-wallet.js';

const STORAGE_KEY = 'mt-poker-wallet';

const DEFAULTS = {
  freeChips: 10000,
  walletConnected: false,
  walletAddress: '',
  walletType: '',
  lastDailyBonus: '',
  handsPlayed: 0,
  handsWon: 0,
  screenName: 'Player1'
};

export function loadWallet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const w = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    w.mtBalance = w.walletAddress ? getCasinoBalance(w.walletAddress) : 0;
    return w;
  } catch {
    return { ...DEFAULTS, mtBalance: 0 };
  }
}

export function saveWallet(data) {
  const { mtBalance, ...rest } = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  if (data.walletAddress && mtBalance != null) {
    setCasinoBalance(data.walletAddress, mtBalance);
  }
}

export async function connectWalletProvider(type) {
  const session = type === 'solflare' ? await connectSolflare() : await connectPhantom();
  const w = loadWallet();
  w.walletConnected = true;
  w.walletAddress = session.publicKey;
  w.walletType = session.walletType;
  w.mtBalance = getCasinoBalance(session.publicKey);
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
  saveWallet(w);
  return w;
}

export async function refreshMtBalance(wallet) {
  const w = { ...wallet };
  if (!w.walletAddress) {
    w.mtBalance = 0;
    return w;
  }
  w.mtBalance = getCasinoBalance(w.walletAddress);
  const onChain = await fetchWalletMtBalance(w.walletAddress);
  w.walletMtOnChain = onChain;
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
    w.mtBalance -= buyIn;
    setCasinoBalance(w.walletAddress, w.mtBalance);
  } else {
    w.freeChips -= buyIn;
  }
  saveWallet(w);
  return w;
}

export function creditWinnings(wallet, mode, amount, won) {
  const w = { ...wallet };
  w.handsPlayed += 1;
  if (won) w.handsWon += 1;
  saveWallet(w);
  return w;
}

export function cashOutMt(wallet, chips) {
  const w = { ...wallet };
  if (w.walletAddress && chips > 0) {
    w.mtBalance = getCasinoBalance(w.walletAddress) + chips;
    setCasinoBalance(w.walletAddress, w.mtBalance);
  }
  saveWallet(w);
  return w;
}

export function creditDeposit(wallet, amount) {
  const w = { ...wallet };
  if (w.walletAddress) {
    addCasinoBalance(w.walletAddress, amount);
    w.mtBalance = getCasinoBalance(w.walletAddress);
  }
  saveWallet(w);
  return w;
}

export { shortAddress };