import { upsertPeer, getPeers, pullSignals } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'POST') {
    const { roomId, peerId, state } = req.body || {};
    if (!roomId || !peerId || !state) {
      res.status(400).json({ error: 'roomId, peerId, state required' });
      return;
    }
    const lobby = upsertPeer(roomId, peerId, state);
    res.status(200).json({ ok: true, lobby });
    return;
  }

  if (req.method === 'GET') {
    const roomId = req.query.roomId;
    const peerId = req.query.peerId || '';
    const since = Number(req.query.since || 0);
    if (!roomId) {
      res.status(400).json({ error: 'roomId required' });
      return;
    }
    const { key, peers, count } = getPeers(roomId, peerId);
    const signals = pullSignals(roomId, peerId, since);
    res.status(200).json({ lobby: key, peers, count, signals, ts: Date.now() });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}