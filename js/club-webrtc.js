/** WebRTC helper — mesh calls via Nova Mirage signaling API. */

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export class ClubWebRTC {
  constructor({ multiplayer, onRemoteStream, mediaMode = 'av' }) {
    this.mp = multiplayer;
    this.onRemoteStream = onRemoteStream || (() => {});
    this.mediaMode = mediaMode;
    this.localStream = null;
    this.peers = new Map();
    this._boundSignal = (sig) => this.handleSignal(sig);
  }

  attach() {
    this.mp.onSignal = this._boundSignal;
  }

  detach() {
    if (this.mp.onSignal === this._boundSignal) this.mp.onSignal = () => {};
  }

  async enable(constraints) {
    if (this.localStream) return this.localStream;
    const base = constraints || {};
    if (this.mediaMode === 'audio') {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
        ...base
      });
    } else {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        ...base
      });
    }
    this.attach();
    this.connectAll();
    return this.localStream;
  }

  disable() {
    this.detach();
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  connectAll() {
    if (!this.localStream) return;
    this.mp.getPeerIds().forEach((id) => {
      if (id === this.mp.myId || this.peers.has(id)) return;
      if (this.mp.myId < id) this.callPeer(id);
    });
  }

  async callPeer(peerId) {
    if (!this.localStream || this.peers.has(peerId)) return;
    const pc = this.makePeer(peerId);
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.mp.sendSignal(peerId, 'offer', { sdp: offer, mode: this.mediaMode });
  }

  makePeer(peerId) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.peers.set(peerId, pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.mp.sendSignal(peerId, 'ice', { candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      this.onRemoteStream(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.peers.delete(peerId);
        pc.close();
      }
    };
    return pc;
  }

  async handleSignal(sig) {
    const { from, type, payload } = sig;
    if (!from || from === this.mp.myId) return;

    if (type === 'offer') {
      if (payload?.mode && payload.mode !== this.mediaMode) return;
      if (!this.localStream) return;
      let pc = this.peers.get(from);
      if (!pc) {
        pc = this.makePeer(from);
        this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
      }
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.mp.sendSignal(from, 'answer', { sdp: answer, mode: this.mediaMode });
      return;
    }

    if (type === 'answer') {
      if (payload?.mode && payload.mode !== this.mediaMode) return;
      const pc = this.peers.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp);
      return;
    }

    if (type === 'ice') {
      const pc = this.peers.get(from);
      if (!pc || !payload?.candidate) return;
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch (_) {}
    }
  }

  hangup(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
  }
}