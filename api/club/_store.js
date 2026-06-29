/** In-memory club room store — warm-instance persistence on Vercel. */

const PEER_TTL_MS = 45000;
const MSG_TTL_MS = 120000;
const OWNER_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function getStore() {
  if (!globalThis.__nmClubStore) {
    globalThis.__nmClubStore = {
      rooms: new Map(),
      owners: new Map(),
      boot: Date.now()
    };
  }
  return globalThis.__nmClubStore;
}

function roomBucket(roomId) {
  return Math.floor(Date.now() / 300000);
}

export function lobbyKey(roomId) {
  return `nova-${roomId}-${roomBucket(roomId)}`;
}

function getRoom(key) {
  const store = getStore();
  if (!store.rooms.has(key)) {
    store.rooms.set(key, { peers: new Map(), signals: [] });
  }
  return store.rooms.get(key);
}

function pruneRoom(room) {
  const now = Date.now();
  for (const [id, peer] of room.peers) {
    if (now - peer.ts > PEER_TTL_MS) room.peers.delete(id);
  }
  room.signals = room.signals.filter((m) => now - m.ts < MSG_TTL_MS);
}

export function upsertPeer(roomId, peerId, state) {
  const key = lobbyKey(roomId);
  const room = getRoom(key);
  pruneRoom(room);
  room.peers.set(peerId, { id: peerId, state, ts: Date.now() });
  return key;
}

export function getPeers(roomId, selfId) {
  const key = lobbyKey(roomId);
  const room = getRoom(key);
  pruneRoom(room);
  const peers = [];
  for (const [id, peer] of room.peers) {
    if (id !== selfId) peers.push({ id, ...peer.state, ts: peer.ts });
  }
  return { key, peers, count: room.peers.size };
}

export function pushSignal(roomId, from, to, type, payload) {
  const key = lobbyKey(roomId);
  const room = getRoom(key);
  pruneRoom(room);
  const msg = { id: `${from}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from, to, type, payload, ts: Date.now() };
  room.signals.push(msg);
  return msg;
}

export function pullSignals(roomId, peerId, since = 0) {
  const key = lobbyKey(roomId);
  const room = getRoom(key);
  pruneRoom(room);
  return room.signals.filter((m) => m.ts > since && (m.to === peerId || m.to === '*'));
}

export function setOwner(roomId, wallet, meta = {}) {
  const store = getStore();
  store.owners.set(roomId, { wallet, ...meta, ts: Date.now() });
  return store.owners.get(roomId);
}

export function getOwner(roomId) {
  const store = getStore();
  const o = store.owners.get(roomId);
  if (!o) return null;
  if (Date.now() - o.ts > OWNER_TTL_MS) {
    store.owners.delete(roomId);
    return null;
  }
  return o;
}

export function allOwners() {
  const store = getStore();
  const out = {};
  for (const [roomId, o] of store.owners) out[roomId] = o;
  return out;
}