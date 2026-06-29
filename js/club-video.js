/** Bar video chat — WebRTC via Nova Mirage signaling. */

import { ClubWebRTC } from './club-webrtc.js?v=36';

export class BarVideoChat {
  constructor({ multiplayer, videoGrid }) {
    this.mp = multiplayer;
    this.grid = videoGrid;
    this.rtc = new ClubWebRTC({
      multiplayer: this.mp,
      mediaMode: 'av',
      onRemoteStream: (id, stream) => this.addRemote(id, stream)
    });
    this.active = false;
  }

  async enable() {
    if (this.active) return true;
    try {
      await this.rtc.enable();
      this.active = true;
      this.renderLocal();
      this.rtc.connectAll();
      return true;
    } catch (err) {
      console.warn('Bar cam:', err);
      return false;
    }
  }

  disable() {
    this.active = false;
    this.rtc.disable();
    if (this.grid) this.grid.innerHTML = '';
    this.grid?.setAttribute('hidden', '');
  }

  connectToPeers() {
    if (this.active) this.rtc.connectAll();
  }

  renderLocal() {
    const stream = this.rtc.localStream;
    if (!this.grid || !stream) return;
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
    tile.querySelector('video').srcObject = stream;
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

  onPeerLeave(id) {
    this.grid?.querySelector(`[data-peer="${id}"]`)?.remove();
    this.rtc.hangup(id);
  }
}