/** Nova Mirage Club — room picker, 3D floor, multiplayer, bar cam, voice, on-chain ownership. */

import { CLUB_ROOMS, getClubRoom } from './club-rooms.js?v=35';
import { renderAvatarPicker, bindAvatarCreator } from './club-avatars.js?v=35';
import { ClubEngine } from './club-engine.js?v=35';
import { ClubMultiplayer } from './club-multiplayer.js?v=35';
import { BarVideoChat } from './club-video.js?v=35';
import { DanceFloorVoice } from './club-voice.js?v=35';
import {
  loadClubManagement, hireStaff, restock, startEvent, tickClub, renderManagementPanel
} from './club-management.js?v=35';
import {
  fetchClubOwner, buyClubOwnership, CLUB_OWNERSHIP_PRICE, shortWallet
} from './club-ownership.js?v=35';
import { updateProfile } from './profile.js?v=35';
import { casinoSound } from './sounds.js?v=35';
import { getProvider } from './solana-wallet.js?v=35';

export class MirageClub {
  constructor(root, profile, { onZone, onProfileUpdate } = {}) {
    this.root = root;
    this.profile = profile;
    this.onZone = onZone || (() => {});
    this.onProfileUpdate = onProfileUpdate || (() => {});
    this.engine = null;
    this.mp = null;
    this.video = null;
    this.voice = null;
    this.mgmt = loadClubManagement();
    this.mgmtTimer = null;
    this.owner = null;
    this.selectedRoom = profile?.clubRoom || 'edm';
    this.showPicker();
  }

  showPicker() {
    this.root.innerHTML = `
      <div class="club-picker-screen">
        <h2 class="club-picker-title">Choose your vibe</h2>
        <p class="club-picker-sub">Walk in with real players · proximity voice · own the club with $MT</p>
        <div class="club-room-grid">
          ${Object.values(CLUB_ROOMS).map((r) => `
            <button type="button" class="club-room-card${r.id === this.selectedRoom ? ' on' : ''}" data-room="${r.id}">
              <span class="club-room-name">${r.name}</span>
              <span class="club-room-tag">${r.tagline}</span>
              <span class="club-room-crowd">${r.crowd}</span>
            </button>
          `).join('')}
        </div>
        <div id="club-avatar-picker"></div>
        <button type="button" class="btn-play club-enter-btn" id="club-enter-btn">Enter Club Floor</button>
      </div>
    `;
    this.root.querySelectorAll('[data-room]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedRoom = btn.dataset.room;
        this.root.querySelectorAll('.club-room-card').forEach((b) => b.classList.toggle('on', b === btn));
      });
    });
    renderAvatarPicker(this.root.querySelector('#club-avatar-picker'), this.profile, (preset) => {
      this.profile = updateProfile({ clubAvatarPreset: preset, clubAvatarUrl: null });
      this.onProfileUpdate(this.profile);
    });
    bindAvatarCreator((url) => {
      this.profile = updateProfile({ clubAvatarUrl: url });
      this.onProfileUpdate(this.profile);
    });
    this.root.querySelector('#club-enter-btn')?.addEventListener('click', () => this.enterFloor());
  }

  async enterFloor() {
    const room = getClubRoom(this.selectedRoom);
    this.profile = updateProfile({ clubRoom: room.id });
    this.onProfileUpdate(this.profile);
    this.owner = await fetchClubOwner(room.id);

    this.root.innerHTML = `
      <div class="club-stage-3d" id="club-stage-3d"></div>
      <div class="club-overlay">
        <div class="club-top-hud">
          <span class="club-venue">${room.name.toUpperCase()}</span>
          <span class="club-live" id="club-online">● connecting…</span>
          <span class="club-owner-badge" id="club-owner-badge" hidden></span>
          <button type="button" class="club-mgmt-open" id="club-mgmt-open">Manage</button>
        </div>
        <p class="club-prompt" id="club-prompt" hidden></p>
        <button type="button" class="club-interact" id="club-interact" hidden>Enter</button>
        <button type="button" class="club-bar-cam" id="club-bar-cam" hidden>📹 Bar Cam</button>
        <button type="button" class="club-voice-btn" id="club-voice-btn">🎤 Floor Voice</button>
        <div class="club-video-grid" id="club-video-grid" hidden></div>
        <div class="club-stick-wrap" id="club-stick-wrap">
          <div class="club-stick-base" id="club-stick-base"><div class="club-stick-knob" id="club-stick-knob"></div></div>
        </div>
        <button type="button" class="club-dance" id="club-dance">💃</button>
      </div>
      <div class="club-mgmt-drawer" id="club-mgmt-drawer" hidden></div>
    `;

    const stage = this.root.querySelector('#club-stage-3d');
    this.engine = new ClubEngine(stage, {
      room,
      profile: this.profile,
      onZone: (z) => this.onNearZone(z),
      onMove: () => this.voice?.updateVolumes()
    });

    this.mp = new ClubMultiplayer({
      roomId: room.id,
      profile: this.profile,
      onPeerState: (id, data) => {
        this.engine?.upsertRemote(id, data);
        this.voice?.updateVolumes();
      },
      onPeerJoin: (id) => {
        this.updateOnline();
        this.video?.connectToPeers();
        this.voice?.onPeerJoin();
      },
      onPeerLeave: (id) => {
        this.engine?.removeRemote(id);
        this.video?.onPeerLeave(id);
        this.voice?.onPeerLeave(id);
        this.updateOnline();
      }
    });
    this.mp.setLocalStateGetter(() => this.engine?.getLocalState() || {});
    await this.mp.connect().catch(() => {});
    this.updateOnline();
    this.renderOwnerBadge();

    this.video = new BarVideoChat({
      multiplayer: this.mp,
      videoGrid: this.root.querySelector('#club-video-grid')
    });

    this.voice = new DanceFloorVoice({
      multiplayer: this.mp,
      getLocalPos: () => this.engine?.getPosition() || { x: 0, z: 0 },
      getPeerPos: (id) => {
        const p = this.mp?.getPeer(id);
        return p ? { x: p.x || 0, z: p.z || 0 } : null;
      }
    });

    this.bindControls();
    casinoSound.clubAmbience();
    this.mgmtTimer = setInterval(() => {
      this.mgmt = tickClub(this.mgmt, room.bpm);
    }, 8000);
  }

  renderOwnerBadge() {
    const el = this.root.querySelector('#club-owner-badge');
    if (!el) return;
    if (this.owner?.wallet) {
      el.hidden = false;
      el.textContent = `👑 ${shortWallet(this.owner.wallet)}`;
    } else {
      el.hidden = true;
    }
  }

  updateOnline() {
    const el = this.root.querySelector('#club-online');
    if (!el || !this.mp) return;
    const n = this.mp.getPeerIds().length + 1;
    el.textContent = `● ${n} in room`;
  }

  onNearZone(zone) {
    const prompt = this.root.querySelector('#club-prompt');
    const interact = this.root.querySelector('#club-interact');
    const barCam = this.root.querySelector('#club-bar-cam');
    if (!zone) {
      prompt.hidden = true;
      interact.hidden = true;
      barCam.hidden = true;
      return;
    }
    prompt.hidden = false;
    interact.hidden = false;
    if (zone.id === 'bar') {
      prompt.textContent = '🍸 VIP Bar — video chat with party';
      interact.textContent = 'Order drink';
      barCam.hidden = false;
    } else if (zone.id === 'dj') {
      prompt.textContent = '🎧 DJ Booth — drop the beat';
      interact.textContent = 'Hype crowd';
    } else {
      prompt.textContent = `Enter ${zone.id}`;
      interact.textContent = `Play ${zone.id}`;
      barCam.hidden = true;
    }
    this._nearZone = zone;
  }

  bindControls() {
    const interact = this.root.querySelector('#club-interact');
    const dance = this.root.querySelector('#club-dance');
    const barCam = this.root.querySelector('#club-bar-cam');
    const voiceBtn = this.root.querySelector('#club-voice-btn');
    const mgmtOpen = this.root.querySelector('#club-mgmt-open');
    const drawer = this.root.querySelector('#club-mgmt-drawer');

    interact?.addEventListener('click', () => {
      if (!this._nearZone) return;
      if (this._nearZone.id === 'bar') {
        toastMsg('Bartender slides a cocktail — stock -1');
        this.mgmt.stock.cocktails = Math.max(0, (this.mgmt.stock.cocktails || 0) - 1);
      } else if (this._nearZone.id === 'dj') {
        casinoSound.clubHit();
        toastMsg('DJ hypes the crowd — rep +1');
        this.mgmt.reputation += 1;
      } else {
        this.onZone(this._nearZone.id);
      }
    });

    barCam?.addEventListener('click', async () => {
      const ok = await this.video?.enable();
      if (ok) {
        this.video.connectToPeers();
        toastMsg('Bar cam live — say hi!');
      } else toastMsg('Allow camera/mic for bar video');
    });

    voiceBtn?.addEventListener('click', async () => {
      if (this.voice?.active) {
        this.voice.disable();
        voiceBtn.classList.remove('on');
        toastMsg('Floor voice off');
        return;
      }
      const ok = await this.voice?.enable();
      if (ok) {
        voiceBtn.classList.add('on');
        toastMsg('Proximity voice on — chat near dancers');
      } else toastMsg('Allow microphone for floor voice');
    });

    dance?.addEventListener('click', () => {
      const on = !this.engine?.dancing;
      this.engine?.setDancing(on);
      dance.classList.toggle('on', on);
      casinoSound.clubHit();
    });

    mgmtOpen?.addEventListener('click', () => {
      drawer.hidden = !drawer.hidden;
      if (!drawer.hidden) this.renderMgmt(drawer);
    });

    this.bindJoystick();
  }

  async renderMgmt(drawer) {
    const room = getClubRoom(this.selectedRoom);
    this.owner = await fetchClubOwner(room.id);
    const wallet = getProvider()?.publicKey?.toString();
    const isOwner = wallet && this.owner?.wallet === wallet;

    renderManagementPanel(drawer, this.mgmt, room, (action, arg) => {
      if (action === 'close') drawer.hidden = true;
      if (action === 'hire') {
        const r = hireStaff(this.mgmt, arg);
        if (!r.ok) toastMsg(r.error);
        else { this.mgmt = r.state; this.renderMgmt(drawer); }
      }
      if (action === 'stock') {
        const r = restock(this.mgmt, arg);
        if (!r.ok) toastMsg(r.error);
        else { this.mgmt = r.state; this.renderMgmt(drawer); }
      }
      if (action === 'event') {
        const r = startEvent(this.mgmt, arg);
        if (!r.ok) toastMsg(r.error || 'Need DJ');
        else { this.mgmt = r.state; this.renderMgmt(drawer); toastMsg('Event launched!'); }
      }
      if (action === 'buy-club') {
        this.purchaseClub(room.id, drawer);
      }
    }, { owner: this.owner, wallet, isOwner, priceMt: CLUB_OWNERSHIP_PRICE });
  }

  async purchaseClub(roomId, drawer) {
    try {
      toastMsg(`Claiming club — ${CLUB_OWNERSHIP_PRICE} $MT on-chain…`);
      const { owner } = await buyClubOwnership(roomId);
      this.owner = owner;
      this.renderOwnerBadge();
      toastMsg('You own this club on-chain!');
      this.renderMgmt(drawer);
    } catch (err) {
      toastMsg(err.message || 'Purchase failed');
    }
  }

  bindJoystick() {
    const base = this.root.querySelector('#club-stick-base');
    const knob = this.root.querySelector('#club-stick-knob');
    if (!base || !knob) return;
    let stickId = null;
    const maxR = 36;
    const setStick = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      const ox = rect.left + rect.width / 2;
      const oy = rect.top + rect.height / 2;
      let dx = cx - ox, dy = cy - oy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.engine?.setMove(dx / maxR, -dy / maxR);
    };
    const reset = () => {
      stickId = null;
      knob.style.transform = '';
      this.engine?.setMove(0, 0);
    };
    base.addEventListener('pointerdown', (e) => { stickId = e.pointerId; base.setPointerCapture(stickId); setStick(e.clientX, e.clientY); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
  }

  destroy() {
    if (this.mgmtTimer) clearInterval(this.mgmtTimer);
    this.voice?.disable();
    this.video?.disable();
    this.mp?.destroy();
    this.engine?.destroy();
    casinoSound.clubAmbienceStop();
    this.root.innerHTML = '';
  }
}

function toastMsg(msg) {
  const el = document.getElementById('lobby-toast');
  if (el) {
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastMsg._t);
    toastMsg._t = setTimeout(() => { el.hidden = true; }, 3200);
  }
}

export function mountLoungePreview(el, profile, opts = {}) {
  if (!el) return null;
  return new MirageClub(el, profile, opts);
}