/** Real-time multiplayer — PeerJS lobby per room. */

import { lobbyIdForRoom } from './club-rooms.js?v=34';

export class ClubMultiplayer {
  constructor({ roomId, profile, onPeerState, onPeerJoin, onPeerLeave }) {
    this.roomId = roomId;
    this.profile = profile;
    this.onPeerState = onPeerState || (() => {});
    this.onPeerJoin = onPeerJoin || (() => {});
    this.onPeerLeave = onPeerLeave || (() => {});
    this.lobbyId = lobbyIdForRoom(roomId);
    this.peer = null;
    this.role = 'solo';
    this.conns = new Map();
    this.peers = new Map();
    this._syncTimer = null;
    this.getLocalState = () => ({});
  }

  async connect() {
    const Peer = await loadPeer();
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };

      const tryHost = () => {
        this.peer = new Peer(this.lobbyId, { debug: 1 });
        this.peer.on('open', () => {
          this.role = 'host';
          this.bindPeer();
          done(this);
        });
        this.peer.on('error', (err) => {
          if (err.type === 'unavailable-id' || err.type === 'network') {
            tryGuest();
          } else if (!settled) {
            reject(err);
          }
        });
      };

      const tryGuest = () => {
        this.peer?.destroy();
        this.peer = new Peer({ debug: 1 });
        this.peer.on('open', () => {
          this.role = 'guest';
          const conn = this.peer.connect(this.lobbyId, { reliable: false });
          conn.on('open', () => {
            this.conns.set('host', conn);
            this.bindConn(conn, 'host');
            this.bindPeer();
            done(this);
          });
          conn.on('error', () => tryHost());
        });
        this.peer.on('error', () => {
          if (!settled) tryHost();
        });
      };

      tryHost();
      setTimeout(() => {
        if (!settled && this.peer) done(this);
      }, 4000);
    });
  }

  bindPeer() {
    this.peer.on('connection', (conn) => {
      const id = conn.peer;
      this.conns.set(id, conn);
      this.bindConn(conn, id);
    });
    this.peer.on('call', (call) => {
      this.onIncomingCall?.(call);
    });
    this._syncTimer = setInterval(() => this.broadcast(), 100);
  }

  bindConn(conn, id) {
    conn.on('open', () => {
      this.peers.set(id, { id, name: 'Guest', ...this.defaultRemote() });
      this.onPeerJoin(id);
      this.sendState(conn);
    });
    conn.on('data', (data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        if (msg.type === 'state') {
          this.peers.set(id, { id, ...msg.payload });
          this.onPeerState(id, msg.payload);
        }
      } catch (_) {}
    });
    conn.on('close', () => {
      this.conns.delete(id);
      this.peers.delete(id);
      this.onPeerLeave(id);
    });
  }

  defaultRemote() {
    return { x: 0, z: 2, rot: 0, name: 'Player', avatarUrl: '', dancing: false };
  }

  setLocalStateGetter(fn) {
    this.getLocalState = fn;
  }

  sendState(conn) {
    const payload = {
      type: 'state',
      payload: {
        ...this.getLocalState(),
        name: this.profile?.displayName || 'Player',
        avatarUrl: this.profile?.clubAvatarUrl || '',
        avatarPreset: this.profile?.clubAvatarPreset || 'hostess'
      }
    };
    try { conn.send(payload); } catch (_) {}
  }

  broadcast() {
    const payload = {
      type: 'state',
      payload: {
        ...this.getLocalState(),
        name: this.profile?.displayName || 'Player',
        avatarUrl: this.profile?.clubAvatarUrl || '',
        avatarPreset: this.profile?.clubAvatarPreset || 'hostess'
      }
    };
    this.conns.forEach((conn) => {
      if (conn.open) {
        try { conn.send(payload); } catch (_) {}
      }
    });
  }

  getPeerIds() {
    return [...this.peers.keys()];
  }

  getPeer(id) {
    return this.peers.get(id);
  }

  callPeer(peerId, stream) {
    if (!this.peer) return null;
    return this.peer.call(peerId, stream);
  }

  destroy() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    this.conns.clear();
    this.peers.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

let peerPromise = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerPromise) {
    peerPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = () => resolve(window.Peer);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return peerPromise;
}