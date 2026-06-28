import { MEMETORRENT } from './config.js';

let activeProvider = null;
let activeType = '';

// Solflare transaction signing needs Buffer (same fix as Lucky Reels)
let bufferReady = null;
async function ensureBuffer() {
  if (globalThis.Buffer) return;
  if (!bufferReady) {
    bufferReady = import('https://esm.sh/buffer@6.0.3').then((m) => {
      globalThis.Buffer = m.Buffer;
    });
  }
  await bufferReady;
}

export function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');
}

export function detectWallets() {
  const sf = window.solflare;
  return {
    phantom: !!(window.phantom?.solana?.isPhantom),
    solflare: !!(sf?.isSolflare || sf?.connect || sf?.publicKey),
    backpack: !!window.backpack
  };
}

export function getProvider() {
  return activeProvider;
}

export function getWalletType() {
  return activeType;
}

export function shortAddress(addr) {
  if (!addr) return 'Not connected';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function pageUrl() {
  return window.location.href.split('#')[0];
}

export function openWalletDeepLink(type) {
  const url = pageUrl();
  sessionStorage.setItem('mt-pending-wallet', type);

  if (type === 'phantom') {
    window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(url)}`;
  } else if (type === 'solflare') {
    // Solflare requires v1/browse — old /ul/browse/ breaks with "method not recognised"
    window.location.href = `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent('https://poker-stars-wheat.vercel.app')}`;
  } else if (type === 'backpack') {
    window.location.href = `https://backpack.app/ul/browse/${encodeURIComponent(url)}`;
  }
}

function getProviderForType(type) {
  if (type === 'phantom') {
    const p = window.phantom?.solana;
    return p?.isPhantom ? p : null;
  }
  if (type === 'solflare') {
    const sf = window.solflare;
    if (!sf) return null;
    return sf;
  }
  if (type === 'backpack') return window.backpack || null;
  return null;
}

async function extractPublicKey(provider, resp, type) {
  const attempts = type === 'solflare' ? 12 : 5;
  const delay = type === 'solflare' ? 400 : 250;

  for (let i = 0; i < attempts; i++) {
    const pk = resp?.publicKey || provider?.publicKey;
    if (pk) return typeof pk.toString === 'function' ? pk.toString() : String(pk);
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

async function invokeConnect(provider, type) {
  await ensureBuffer();

  if (type === 'solflare') {
    // Solflare mobile — only call connect(); avoid extra options Phantom uses
    if (typeof provider.connect !== 'function') {
      throw new Error('Solflare connect not available — open site inside Solflare app browser');
    }
    try {
      return await provider.connect();
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('user rejected') || err?.code === 4001) throw err;
      // Retry once after brief pause (Solflare mobile is slow to inject)
      await new Promise((r) => setTimeout(r, 600));
      return await provider.connect();
    }
  }

  try {
    return await provider.connect();
  } catch (_) {
    return null;
  }
}

function bindProviderEvents(provider, type) {
  // Solflare mobile does not support Phantom-style .on() — causes "method not recognised"
  if (type === 'solflare') return;
  if (typeof provider?.on !== 'function') return;
  try {
    provider.on('accountChanged', (pk) => {
      if (!pk) disconnectSolana();
    });
    provider.on('disconnect', () => disconnectSolana());
  } catch (_) { /* wallet-specific */ }
}

export async function connectWalletType(type) {
  let provider = getProviderForType(type);
  const mobile = isMobileDevice();
  const standalone = isStandaloneApp();

  if (!provider) {
    if (mobile || standalone) {
      openWalletDeepLink(type);
      throw new Error(`Opening ${type} app…`);
    }
    window.open(walletInstallUrl(type), '_blank');
    throw new Error(`Install ${type} wallet`);
  }

  const resp = await invokeConnect(provider, type);
  const publicKey = await extractPublicKey(provider, resp, type);

  if (!publicKey) {
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    throw new Error(`${name}: tap Connect again inside the wallet browser`);
  }

  activeProvider = provider;
  activeType = type;
  sessionStorage.removeItem('mt-pending-wallet');
  bindProviderEvents(provider, type);

  return { provider, publicKey, walletType: type };
}

export async function disconnectSolana() {
  try {
    if (activeProvider?.disconnect) await activeProvider.disconnect();
  } catch (_) { /* ok */ }
  activeProvider = null;
  activeType = '';
  sessionStorage.removeItem('mt-pending-wallet');
}

export async function fetchSolBalance(pubkey) {
  const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
  const lamports = await conn.getBalance(new PublicKey(pubkey));
  return lamports / LAMPORTS_PER_SOL;
}

export async function fetchWalletMtBalance(pubkey) {
  if (!pubkey) return 0;
  try {
    const { Connection, PublicKey } = await import('https://esm.sh/@solana/web3.js@1.95.4');
    const { getAssociatedTokenAddress } = await import('https://esm.sh/@solana/spl-token@0.4.9');
    const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
    const owner = new PublicKey(pubkey);
    const mint = new PublicKey(MEMETORRENT.mtMint);
    const ata = await getAssociatedTokenAddress(mint, owner);
    const info = await conn.getParsedAccountInfo(ata);
    if (info.value && 'parsed' in info.value.data) {
      return info.value.data.parsed.info.tokenAmount.uiAmount || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Sign + send — Phantom returns {signature}, Solflare may return string; fallback signTransaction+send */
export async function walletSignAndSend(transaction) {
  await ensureBuffer();
  if (!activeProvider) throw new Error('Connect wallet first');

  const { Connection } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');

  if (typeof activeProvider.signAndSendTransaction === 'function') {
    try {
      const result = await activeProvider.signAndSendTransaction(transaction);
      if (typeof result === 'string') return result;
      return result?.signature || result;
    } catch (err) {
      const msg = err?.message || '';
      if (activeType !== 'solflare' || !msg.toLowerCase().includes('method')) throw err;
    }
  }

  if (typeof activeProvider.signTransaction === 'function') {
    const signed = await activeProvider.signTransaction(transaction);
    const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    return sig;
  }

  throw new Error('Wallet cannot sign transactions — try Phantom or update Solflare');
}

export async function sendMTToTreasury(amount) {
  if (!activeProvider?.publicKey) throw new Error('Connect wallet first');

  const pubkey = activeProvider.publicKey.toString();
  const sol = await fetchSolBalance(pubkey);
  if (sol < MEMETORRENT.minSolForFees) {
    throw new Error(`Need ~${MEMETORRENT.minSolForFees} SOL for network fees`);
  }

  const { Connection, PublicKey, Transaction } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const { getAssociatedTokenAddress, createTransferInstruction } = await import('https://esm.sh/@solana/spl-token@0.4.9');

  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
  const user = new PublicKey(pubkey);
  const mint = new PublicKey(MEMETORRENT.mtMint);
  const treasury = new PublicKey(MEMETORRENT.treasury);
  const raw = BigInt(Math.floor(amount * 10 ** MEMETORRENT.decimals));

  const userAta = await getAssociatedTokenAddress(mint, user);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);

  const tx = new Transaction().add(
    createTransferInstruction(userAta, treasuryAta, user, raw)
  );

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = user;

  const sig = await walletSignAndSend(tx);
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return sig;
}

export function walletInstallUrl(type) {
  if (type === 'phantom') return 'https://phantom.app/';
  if (type === 'solflare') return 'https://solflare.com/';
  return 'https://backpack.app/';
}