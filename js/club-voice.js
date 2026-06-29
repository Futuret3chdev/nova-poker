/** Proximity voice on the dance floor — distance-based volume. */

import { ClubWebRTC } from './club-webrtc.js?v=35';

const VOICE_RADIUS = 9;
const FADE_RADIUS = 14;
const DANCE_ZONE = { x: 0, z: 2, r: 10 };

export class DanceFloorVoice {
  constructor({ multiplayer, getLocalPos, getPeerPos }) {
    this.mp = multiplayer;
    this.getLocalPos = getLocalPos || (() => ({ x: 0, z: 0 }));
    this.getPeerPos = getPeerPos || (() => null);
    this.rtc = new ClubWebRTC({
      multiplayer: this.mp,
      mediaMode: 'audio',
      onRemoteStream: (id, stream) => this.onStream(id, stream)
    });
    this.audioEls = new Map();
    this.active = false;
    this.muted = false;
    this._tick = null;
  }

  isOnDanceFloor(pos) {
    return Math.hypot(pos.x - DANCE_ZONE.x, pos.z - DANCE_ZONE.z) < DANCE_ZONE.r;
  }

  async enable() {
    if (this.active) return true;
    try {
      await this.rtc.enable();
      this.active = true;
      this._tick = setInterval(() => this.updateVolumes(), 120);
      this.updateVolumes();
      return true;
    } catch (err) {
      console.warn('Dance voice:', err);
      return false;
    }
  }

  disable() {
    this.active = false;
    if (this._tick) clearInterval(this._tick);
    this.rtc.disable();
    this.audioEls.forEach((el) => el.remove());
    this.audioEls.clear();
  }

  setMuted(on) {
    this.muted = !!on;
    this.rtc.localStream?.getAudioTracks().forEach((t) => { t.enabled = !this.muted; });
  }

  onStream(peerId, stream) {
    let el = this.audioEls.get(peerId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      el.dataset.peer = peerId;
      el.className = 'club-voice-audio';
      document.body.appendChild(el);
      this.audioEls.set(peerId, el);
    }
    el.srcObject = stream;
    this.updateVolumes();
  }

  removePeer(peerId) {
    this.rtc.hangup(peerId);
    this.audioEls.get(peerId)?.remove();
    this.audioEls.delete(peerId);
  }

  updateVolumes() {
    if (!this.active) return;
    const me = this.getLocalPos();
    const onFloor = this.isOnDanceFloor(me);

    this.audioEls.forEach((el, peerId) => {
      const them = this.getPeerPos(peerId);
      if (!them) {
        el.volume = 0;
        return;
      }
      const dist = Math.hypot(me.x - them.x, me.z - them.z);
      const themOnFloor = this.isOnDanceFloor(them);
      let vol = 0;
      if (onFloor && themOnFloor) {
        if (dist <= VOICE_RADIUS) vol = 1;
        else if (dist < FADE_RADIUS) vol = 1 - (dist - VOICE_RADIUS) / (FADE_RADIUS - VOICE_RADIUS);
      }
      el.volume = this.muted ? 0 : Math.max(0, Math.min(1, vol));
    });

    if (onFloor) this.rtc.connectAll();
  }

  onPeerJoin() {
    if (this.active) this.rtc.connectAll();
  }

  onPeerLeave(peerId) {
    this.removePeer(peerId);
  }
}