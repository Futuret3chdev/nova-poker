import { MEMETORRENT } from './config.js';

let activeProvider = null;
let activeType = '';

export function detectWallets() {
  return {
    phantom: !!(window.phantom?.solana?.isPhantom),
    solflare: !!window.solflare,
    backpack: !!window.backpack
  };
}

export function getProvider() {
  return activeProvider;
}

export function shortAddress(addr) {
  if (!addr) return 'Not connected';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

async function extractPublicKey(provider, resp) {
  for (let i = 0; i < 5; i++) {
    const pk = resp?.publicKey || provider?.publicKey;
    if (pk) return typeof pk.toString === 'function' ? pk.toString() : String(pk);
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export async function connectWalletType(type) {
  let provider = null;

  if (type === 'phantom') {
    provider = window.phantom?.solana;
    if (!provider?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      throw new Error('Open Phantom app, then use its browser to visit MT Poker');
    }
  } else if (type === 'solflare') {
    provider = window.solflare;
    if (!provider) {
      window.open('https://solflare.com/', '_blank');
      throw new Error('Open Solflare app, then use its browser to visit MT Poker');
    }
  } else if (type === 'backpack') {
    provider = window.backpack;
    if (!provider) {
      window.open('https://backpack.app/', '_blank');
      throw new Error('Backpack not installed');
    }
  }

  if (!provider) throw new Error('Wallet not found');

  let resp;
  try {
    resp = await provider.connect();
  } catch (_) { /* retry pk */ }

  const publicKey = await extractPublicKey(provider, resp);
  if (!publicKey) {
    throw new Error(`Failed to get public key from ${type}. Try again or use Phantom.`);
  }

  activeProvider = provider;
  activeType = type;

  if (provider.on) {
    provider.on('accountChanged', (pk) => {
      if (!pk) disconnectSolana();
    });
    provider.on('disconnect', () => disconnectSolana());
  }

  return { provider, publicKey, walletType: type };
}

export async function disconnectSolana() {
  try {
    if (activeProvider?.disconnect) await activeProvider.disconnect();
  } catch (_) { /* ok */ }
  activeProvider = null;
  activeType = '';
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

export async function sendMTToTreasury(amount) {
  if (!activeProvider?.publicKey) throw new Error('Connect wallet first');

  const sol = await fetchSolBalance(activeProvider.publicKey.toString());
  if (sol < MEMETORRENT.minSolForFees) {
    throw new Error(`Need ~${MEMETORRENT.minSolForFees} SOL for network fees`);
  }

  const { Connection, PublicKey, Transaction } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const { getAssociatedTokenAddress, createTransferInstruction } = await import('https://esm.sh/@solana/spl-token@0.4.9');

  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
  const user = new PublicKey(activeProvider.publicKey.toString());
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

  const signed = await activeProvider.signAndSendTransaction(tx);
  const sig = signed.signature || signed;
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return sig;
}

export function walletInstallUrl(type) {
  if (type === 'phantom') return 'https://phantom.app/';
  if (type === 'solflare') return 'https://solflare.com/';
  return 'https://backpack.app/';
}