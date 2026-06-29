/** Bar video chat — WebRTC via PeerJS when at the VIP bar. */

export class BarVideoChat {
  constructor({ multiplayer, videoGrid }) {
    this.mp = multiplayer;
    this.grid = videoGrid;
    this.localStream = null;
    this.calls = new Map();
    this.active = false;
  }

  async enable() {
    if (this.active) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: true
      });
      this.active = true;
      this.renderLocal();
      this.mp.onIncomingCall = (call) => this.answer(call);
      this.connectToPeers();
      return true;
    } catch (err) {
      console.warn('Bar cam:', err);
      return false;
    }
  }

  disable() {
    this.active = false;
    this.calls.forEach((c) => c.close());
    this.calls.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.grid) this.grid.innerHTML = '';
    this.grid?.setAttribute('hidden', '');
  }

  connectToPeers() {
    if (!this.localStream || !this.mp?.peer) return;
    this.mp.getPeerIds().forEach((id) => {
      if (id === 'host' || this.calls.has(id)) return;
      const call = this.mp.callPeer(id, this.localStream);
      if (!call) return;
      this.calls.set(id, call);
      call.on('stream', (stream) => this.addRemote(id, stream));
      call.on('close', () => this.removeRemote(id));
    });
  }

  answer(call) {
    if (!this.localStream) return;
    call.answer(this.localStream);
    const id = call.peer;
    this.calls.set(id, call);
    call.on('stream', (stream) => this.addRemote(id, stream));
    call.on('close', () => this.removeRemote(id));
  }

  renderLocal() {
    if (!this.grid || !this.localStream) return;
    this.grid.removeAttribute('hidden');
    let tile = this.grid.querySelector('.bar-cam-local');
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'bar-cam-tile bar-cam-local';
      tile.innerHTML = '<span class="bar-cam-label">You</span>';
      const v = document.createElement('video');
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.className = 'bar-cam-video';
      tile.appendChild(v);
      this.grid.prepend(tile);
    }
    tile.querySelector('video').srcObject = this.localStream;
  }

  addRemote(id, stream) {
    if (!this.grid) return;
    let tile = this.grid.querySelector(`[data-peer="${id}"]`);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'bar-cam-tile';
      tile.dataset.peer = id;
      tile.innerHTML = `<span class="bar-cam-label">${this.mp.getPeer(id)?.name || 'Guest'}</span>`;
      const v = document.createElement('video');
      v.autoplay = true;
      v.playsInline = true;
      v.className = 'bar-cam-video';
      tile.appendChild(v);
      this.grid.appendChild(tile);
    }
    tile.querySelector('video').srcObject = stream;
  }

  removeRemote(id) {
    this.grid?.querySelector(`[data-peer="${id}"]`)?.remove();
    this.calls.delete(id);
  }
}