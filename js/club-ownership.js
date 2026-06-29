/** On-chain club ownership — 500 $MT to treasury with memo. */

import { MEMETORRENT } from './config.js?v=35';
import { getProvider, walletSignAndSend, fetchWalletMtBalance } from './solana-wallet.js?v=35';

export const CLUB_OWNERSHIP_PRICE = 500;
const API = '/api/club/ownership';
const MEMO_PROG = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export async function fetchClubOwner(roomId) {
  try {
    const res = await fetch(`${API}?roomId=${encodeURIComponent(roomId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.owner || null;
  } catch {
    return null;
  }
}

export async function registerClubPurchase(roomId, wallet, signature) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, wallet, signature })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ownership registration failed');
  return data.owner;
}

export async function buyClubOwnership(roomId) {
  const provider = getProvider();
  if (!provider?.publicKey) throw new Error('Connect wallet first');

  const pubkey = provider.publicKey.toString();
  const balance = await fetchWalletMtBalance(pubkey);
  if (balance < CLUB_OWNERSHIP_PRICE) {
    throw new Error(`Need ${CLUB_OWNERSHIP_PRICE} $MEMETORRENT — buy on Jupiter`);
  }

  await import('https://esm.sh/buffer@6.0.3').then((m) => {
    globalThis.Buffer = m.Buffer;
  });

  const { Connection, PublicKey, Transaction, TransactionInstruction } = await import('https://esm.sh/@solana/web3.js@1.95.4');
  const { getAssociatedTokenAddress, createTransferInstruction } = await import('https://esm.sh/@solana/spl-token@0.4.9');

  const conn = new Connection(MEMETORRENT.rpcUrl, 'confirmed');
  const user = new PublicKey(pubkey);
  const mint = new PublicKey(MEMETORRENT.mtMint);
  const treasury = new PublicKey(MEMETORRENT.treasury);
  const raw = BigInt(Math.floor(CLUB_OWNERSHIP_PRICE * 10 ** MEMETORRENT.decimals));

  const userAta = await getAssociatedTokenAddress(mint, user);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);

  const memo = `nova-club:${roomId}`;
  const tx = new Transaction()
    .add(
      createTransferInstruction(userAta, treasuryAta, user, raw)
    )
    .add(
      new TransactionInstruction({
        keys: [{ pubkey: user, isSigner: true, isWritable: true }],
        programId: new PublicKey(MEMO_PROG),
        data: Buffer.from(memo, 'utf8')
      })
    );

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = user;

  const sig = await walletSignAndSend(tx);
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

  const owner = await registerClubPurchase(roomId, pubkey, sig);
  return { signature: sig, owner };
}

export function shortWallet(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}