/** Real-time multiplayer — Nova Mirage dedicated signaling (replaces PeerJS). */

import { lobbyIdForRoom } from './club-rooms.js?v=36';

const API_SYNC = '/api/club/sync';
const API_SIGNAL = '/api/club/signal';
const POLL_MS = 180;

function makePeerId() {
  const s = sessionStorage.getItem('nm-club-peer');
  if (s) return s;
  const id = `p_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem('nm-club-peer', id);
  return id;
}

export class ClubMultiplayer {
  constructor({ roomId, profile, onPeerState, onPeerJoin, onPeerLeave, onSignal }) {
    this.roomId = roomId;
    this.profile = profile;
    this.onPeerState = onPeerState || (() => {});
    this.onPeerJoin = onPeerJoin || (() => {});
    this.onPeerLeave = onPeerLeave || (() => {});
    this.onSignal = onSignal || (() => {});
    this.lobbyId = lobbyIdForRoom(roomId);
    this.peerId = makePeerId();
    this.role = 'connected';
    this.peers = new Map();
    this._pollTimer = null;
    this._pushTimer = null;
    this._signalSince = 0;
    this._alive = false;
    this.getLocalState = () => ({});
  }

  async connect() {
    this._alive = true;
    await this.pushState();
    this._pushTimer = setInterval(() => this.pushState(), 100);
    this._pollTimer = setInterval(() => this.poll(), POLL_MS);
    await this.poll();
    return this;
  }

  buildPayload() {
    return {
      ...this.getLocalState(),
      name: this.profile?.displayName || 'Player',
      avatarUrl: this.profile?.clubAvatarUrl || '',
      avatarPreset: this.profile?.clubAvatarPreset || 'hostess'
    };
  }

  async pushState() {
    if (!this._alive) return;
    try {
      await fetch(API_SYNC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          peerId: this.peerId,
          state: this.buildPayload()
        })
      });
    } catch (_) {}
  }

  async poll() {
    if (!this._alive) return;
    try {
      const url = `${API_SYNC}?roomId=${encodeURIComponent(this.roomId)}&peerId=${encodeURIComponent(this.peerId)}&since=${this._signalSince}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.lobby) this.lobbyId = data.lobby;

      const seen = new Set();
      for (const p of data.peers || []) {
        seen.add(p.id);
        if (!this.peers.has(p.id)) {
          this.peers.set(p.id, { id: p.id, ...p });
          this.onPeerJoin(p.id);
        } else {
          this.peers.set(p.id, { id: p.id, ...p });
        }
        this.onPeerState(p.id, p);
      }
      for (const id of [...this.peers.keys()]) {
        if (!seen.has(id)) {
          this.peers.delete(id);
          this.onPeerLeave(id);
        }
      }

      for (const sig of data.signals || []) {
        this._signalSince = Math.max(this._signalSince, sig.ts);
        if (sig.from !== this.peerId) this.onSignal(sig);
      }
    } catch (_) {}
  }

  async sendSignal(to, type, payload) {
    try {
      await fetch(API_SIGNAL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          from: this.peerId,
          to,
          type,
          payload
        })
      });
    } catch (_) {}
  }

  setLocalStateGetter(fn) {
    this.getLocalState = fn;
  }

  getPeerIds() {
    return [...this.peers.keys()];
  }

  getPeer(id) {
    return this.peers.get(id);
  }

  get myId() {
    return this.peerId;
  }

  destroy() {
    this._alive = false;
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._pushTimer) clearInterval(this._pushTimer);
    this.peers.clear();
  }
}