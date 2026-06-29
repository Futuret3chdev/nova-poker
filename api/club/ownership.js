import { getOwner, setOwner, allOwners } from './_store.js';

const TREASURY = '35hMAzLD99oag1RUjBTNUoJuwqso4xvKEYsWHsvjskqD';
const MT_MINT = 'ELywDcVX2WumHm4xEfqF8NdEKaeGCAaq9JmwtjE8pump';
const RPC = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=61a3cb76-ffd8-4dde-bb49-35cae29566c8';
const MIN_MT = 500;
const DECIMALS = 6;

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

function keyAt(keys, idx) {
  const k = keys[idx];
  if (!k) return '';
  return typeof k === 'string' ? k : (k.pubkey || '');
}

function parseMemo(tx, wallet) {
  const keys = tx.transaction?.message?.accountKeys || [];
  const instructions = tx.transaction?.message?.instructions || [];
  const inner = (tx.meta?.innerInstructions || []).flatMap((i) => i.instructions || []);
  const all = [...instructions, ...inner];

  let memo = '';
  let mtRaw = 0n;

  const logs = tx.meta?.logMessages || [];
  for (const line of logs) {
    const m = line.match(/Memo.*?:\s*"?([^"]+)"?$/);
    if (m) memo = m[1].trim();
  }

  for (const ix of all) {
    const prog = keyAt(keys, ix.programIdIndex);
    if (prog !== 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' || !ix.data) continue;
    try {
      const decoded = Buffer.from(ix.data, 'base64').toString('utf8');
      if (decoded.includes('nova-club:')) memo = decoded;
    } catch (_) {}
  }

  const pre = tx.meta?.preTokenBalances || [];
  const post = tx.meta?.postTokenBalances || [];
  for (const p of post) {
    if (p.mint !== MT_MINT) continue;
    const owner = p.owner;
    if (owner === TREASURY) {
      const preBal = pre.find((b) => b.accountIndex === p.accountIndex);
      const before = BigInt(preBal?.uiTokenAmount?.amount || '0');
      const after = BigInt(p.uiTokenAmount?.amount || '0');
      if (after > before) mtRaw += after - before;
    }
  }

  const minRaw = BigInt(MIN_MT) * 10n ** BigInt(DECIMALS);
  const memoOk = memo.includes('nova-club:');
  const payerOk = keyAt(keys, 0) === wallet;

  return { memo, mtRaw, minRaw, memoOk, payerOk, valid: memoOk && payerOk && mtRaw >= minRaw };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const roomId = req.query.roomId;
    if (roomId) {
      const owner = getOwner(roomId);
      res.status(200).json({ roomId, owner, priceMt: MIN_MT });
      return;
    }
    res.status(200).json({ owners: allOwners(), priceMt: MIN_MT });
    return;
  }

  if (req.method === 'POST') {
    const { roomId, wallet, signature } = req.body || {};
    if (!roomId || !wallet || !signature) {
      res.status(400).json({ error: 'roomId, wallet, signature required' });
      return;
    }

    const existing = getOwner(roomId);
    if (existing?.wallet && existing.wallet !== wallet) {
      res.status(409).json({ error: 'Room already owned', owner: existing });
      return;
    }

    try {
      const tx = await rpc('getTransaction', [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }]);
      if (!tx) {
        res.status(400).json({ error: 'Transaction not found — wait for confirmation' });
        return;
      }
      const check = parseMemo(tx, wallet);
      if (!check.valid) {
        res.status(400).json({ error: 'Invalid purchase — need 500+ $MT with memo nova-club:' + roomId, check });
        return;
      }
      const roomFromMemo = (check.memo.match(/nova-club:([a-z]+)/) || [])[1];
      if (roomFromMemo && roomFromMemo !== roomId) {
        res.status(400).json({ error: 'Memo room mismatch' });
        return;
      }
      const owner = setOwner(roomId, wallet, { signature, purchasedAt: Date.now() });
      res.status(200).json({ ok: true, owner, priceMt: MIN_MT });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Verification failed' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}