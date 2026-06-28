import { MEMETORRENT } from './config.js';

let activeProvider = null;

export function detectWallets() {
  return {
    phantom: !!(window.phantom?.solana?.isPhantom),
    solflare: !!(window.solflare?.isSolflare)
  };
}

export function getProvider() {
  return activeProvider;
}

export async function connectPhantom() {
  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not found — install at phantom.app');
  }
  const res = await provider.connect();
  activeProvider = provider;
  return {
    provider,
    publicKey: res.publicKey.toString(),
    walletType: 'phantom'
  };
}

export async function connectSolflare() {
  const provider = window.solflare;
  if (!provider?.isSolflare) {
    throw new Error('Solflare wallet not found — install at solflare.com');
  }
  await provider.connect();
  activeProvider = provider;
  return {
    provider,
    publicKey: provider.publicKey.toString(),
    walletType: 'solflare'
  };
}

export async function disconnectSolana() {
  try {
    if (activeProvider?.disconnect) await activeProvider.disconnect();
  } catch (_) { /* ok */ }
  activeProvider = null;
}

export function shortAddress(addr) {
  if (!addr) return 'Not connected';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function casinoKey(pubkey) {
  return `mt_casino_${pubkey}`;
}

export function getCasinoBalance(pubkey) {
  if (!pubkey) return 0;
  try {
    const v = localStorage.getItem(casinoKey(pubkey));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export function setCasinoBalance(pubkey, amount) {
  if (!pubkey) return;
  localStorage.setItem(casinoKey(pubkey), String(Math.max(0, Math.floor(amount))));
}

export function addCasinoBalance(pubkey, amount) {
  setCasinoBalance(pubkey, getCasinoBalance(pubkey) + amount);
}

export async function fetchWalletMtBalance(pubkey) {
  if (!MEMETORRENT.mtMint || !pubkey) return null;
  try {
    const { Connection, PublicKey } = await import('https://esm.sh/@solana/web3.js@1.95.4');
    const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
    const accounts = await conn.getParsedTokenAccountsByOwner(
      new PublicKey(pubkey),
      { mint: new PublicKey(MEMETORRENT.mtMint) }
    );
    let total = 0;
    for (const { account } of accounts.value) {
      const info = account.data.parsed?.info;
      if (info?.tokenAmount?.uiAmount != null) total += info.tokenAmount.uiAmount;
    }
    return total;
  } catch {
    return null;
  }
}

export async function depositMtToCasino(amount) {
  if (!activeProvider?.publicKey) throw new Error('Connect Phantom or Solflare first');
  if (!MEMETORRENT.mtMint || !MEMETORRENT.vaultAddress) {
    throw new Error('$MT deposits not live yet — MemeTorrent mint/vault pending');
  }
  if (amount < MEMETORRENT.minDeposit) {
    throw new Error(`Minimum deposit is ${MEMETORRENT.minDeposit} MT`);
  }

  const {
    Connection, PublicKey, Transaction
  } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const {
    getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
    createTransferInstruction, getAccount
  } = await import('https://esm.sh/@solana/spl-token@0.4.9');

  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
  const payer = new PublicKey(activeProvider.publicKey.toString());
  const mint = new PublicKey(MEMETORRENT.mtMint);
  const vault = new PublicKey(MEMETORRENT.vaultAddress);
  const rawAmount = BigInt(Math.floor(amount * 10 ** MEMETORRENT.decimals));

  const fromAta = await getAssociatedTokenAddress(mint, payer);
  const toAta = await getAssociatedTokenAddress(mint, vault);

  const tx = new Transaction();
  try {
    await getAccount(conn, toAta);
  } catch {
    tx.add(createAssociatedTokenAccountInstruction(payer, toAta, vault, mint));
  }
  tx.add(createTransferInstruction(fromAta, toAta, payer, rawAmount));

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  const signed = await activeProvider.signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

  const pubkey = payer.toString();
  addCasinoBalance(pubkey, amount);
  return { signature: sig, amount, pubkey };
}

export function walletInstallUrl(type) {
  return type === 'phantom' ? 'https://phantom.app/' : 'https://solflare.com/';
}