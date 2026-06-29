import { pushSignal } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { roomId, from, to, type, payload } = req.body || {};
  if (!roomId || !from || !to || !type) {
    res.status(400).json({ error: 'roomId, from, to, type required' });
    return;
  }

  const msg = pushSignal(roomId, from, to, type, payload || {});
  res.status(200).json({ ok: true, id: msg.id, ts: msg.ts });
}