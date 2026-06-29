/** Nova Mirage Club — walkable party floor (Night Club Sim vibe). */

import { casinoSound } from './sounds.js?v=33';

const ZONES = [
  { id: 'dj', label: 'DJ Booth', x: 0.5, y: 0.2, color: '#7c4dff' },
  { id: 'bar', label: 'VIP Bar', x: 0.11, y: 0.42, color: '#ff6f00' },
  { id: 'poker', label: 'Poker Pit', x: 0.3, y: 0.36, color: '#2ea043' },
  { id: 'roulette', label: 'Roulette', x: 0.7, y: 0.36, color: '#e53935' },
  { id: 'slots', label: 'Pokiers', x: 0.89, y: 0.42, color: '#ffc107' }
];

const NPCS = [
  { name: 'ChipQueen', x: 0.35, y: 0.62, hue: 320, phase: 0 },
  { name: 'HighRoller', x: 0.55, y: 0.68, hue: 200, phase: 1.2 },
  { name: 'MirageVIP', x: 0.42, y: 0.74, hue: 45, phase: 2.4 },
  { name: 'NovaGuest', x: 0.62, y: 0.58, hue: 280, phase: 0.8 }
];

export class MirageClub {
  constructor(root, profile, { onZone } = {}) {
    this.root = root;
    this.profile = profile;
    this.onZone = onZone || (() => {});
    this.player = { x: 0.5, y: 0.78, dancing: false, danceT: 0 };
    this.move = { x: 0, y: 0 };
    this.nearZone = null;
    this.t = 0;
    this.raf = null;

    this.buildUI();
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.bindControls();
    casinoSound.clubAmbience();
    this.tick();
  }

  buildUI() {
    this.root.innerHTML = `
      <canvas class="lounge-canvas" aria-label="Nova Mirage nightclub floor"></canvas>
      <div class="club-overlay">
        <div class="club-top-hud">
          <span class="club-venue">NOVA MIRAGE CLUB</span>
          <span class="club-live">● LIVE</span>
          <span class="club-count">24 partying</span>
        </div>
        <p class="club-prompt" id="club-prompt" hidden></p>
        <button type="button" class="club-interact" id="club-interact" hidden>Enter</button>
        <div class="club-stick-wrap" id="club-stick-wrap">
          <div class="club-stick-base" id="club-stick-base">
            <div class="club-stick-knob" id="club-stick-knob"></div>
          </div>
        </div>
        <button type="button" class="club-dance" id="club-dance" aria-label="Dance">💃</button>
      </div>
    `;
    this.canvas = this.root.querySelector('.lounge-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.promptEl = this.root.querySelector('#club-prompt');
    this.interactBtn = this.root.querySelector('#club-interact');
    this.stickWrap = this.root.querySelector('#club-stick-wrap');
    this.stickBase = this.root.querySelector('#club-stick-base');
    this.stickKnob = this.root.querySelector('#club-stick-knob');
    this.danceBtn = this.root.querySelector('#club-dance');
  }

  bindControls() {
    this.interactBtn?.addEventListener('click', () => {
      if (this.nearZone) {
        casinoSound.chip();
        this.onZone(this.nearZone.id);
      }
    });

    this.danceBtn?.addEventListener('click', () => {
      this.player.dancing = !this.player.dancing;
      this.player.danceT = this.t;
      casinoSound.clubHit();
      this.danceBtn.classList.toggle('on', this.player.dancing);
    });

    window.addEventListener('keydown', this._onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') this.move.y = -1;
      if (k === 'arrowdown' || k === 's') this.move.y = 1;
      if (k === 'arrowleft' || k === 'a') this.move.x = -1;
      if (k === 'arrowright' || k === 'd') this.move.x = 1;
      if (k === ' ' || k === 'enter') {
        if (this.nearZone) this.interactBtn?.click();
      }
    });
    window.addEventListener('keyup', this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'w', 'arrowdown', 's'].includes(k)) this.move.y = 0;
      if (['arrowleft', 'a', 'arrowright', 'd'].includes(k)) this.move.x = 0;
    });

    let stickId = null;
    const stickOrigin = { x: 0, y: 0 };
    const maxR = 36;

    const setStick = (cx, cy) => {
      const rect = this.stickBase.getBoundingClientRect();
      const ox = rect.left + rect.width / 2;
      const oy = rect.top + rect.height / 2;
      let dx = cx - ox;
      let dy = cy - oy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / maxR;
      this.move.y = dy / maxR;
    };

    const resetStick = () => {
      stickId = null;
      this.stickKnob.style.transform = '';
      this.move.x = 0;
      this.move.y = 0;
    };

    this.stickBase?.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId;
      this.stickBase.setPointerCapture(stickId);
      setStick(e.clientX, e.clientY);
    });
    this.stickBase?.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      setStick(e.clientX, e.clientY);
    });
    this.stickBase?.addEventListener('pointerup', resetStick);
    this.stickBase?.addEventListener('pointercancel', resetStick);

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const tx = (e.clientX - rect.left) / rect.width;
      const ty = (e.clientY - rect.top) / rect.height;
      this.walkToward(tx, ty);
    });
  }

  walkToward(tx, ty) {
    const dx = tx - this.player.x;
    const dy = ty - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    this.move.x = dx / len;
    this.move.y = dy / len;
    clearTimeout(this._walkStop);
    this._walkStop = setTimeout(() => {
      this.move.x = 0;
      this.move.y = 0;
    }, 480);
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    const w = rect.width || 360;
    const h = rect.height || 520;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  depthScale(y) {
    return 0.55 + (1 - y) * 0.65;
  }

  drawBackground() {
    const { ctx, w, h, t } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.45, '#150a28');
    g.addColorStop(1, '#080510');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Ceiling lights sweep
    for (let i = 0; i < 3; i++) {
      const angle = t * 0.001 + i * 2.1;
      const lx = w * (0.5 + Math.sin(angle) * 0.35);
      const beam = ctx.createRadialGradient(lx, h * 0.05, 0, lx, h * 0.55, h * 0.5);
      const hue = i === 0 ? '124,77,255' : i === 1 ? '255,193,7' : '229,57,53';
      beam.addColorStop(0, `rgba(${hue},0.18)`);
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawDanceFloor() {
    const { ctx, w, h, t } = this;
    const top = h * 0.48;
    const floorH = h * 0.52;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.05, top);
    ctx.lineTo(w * 0.95, top);
    ctx.lineTo(w * 0.88, h);
    ctx.lineTo(w * 0.12, h);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, top, 0, h);
    fg.addColorStop(0, '#1a0a30');
    fg.addColorStop(1, '#0d0618');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.clip();

    const pulse = 0.5 + Math.sin(t * 0.008) * 0.5;
    const cols = 10;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = w * (0.12 + (c / cols) * 0.76);
        const y = top + (floorH * (r / rows));
        const on = Math.sin(t * 0.012 + c * 0.8 + r * 0.6) > 0.2;
        ctx.fillStyle = on
          ? `rgba(${c % 2 ? '124,77,255' : '255,193,7'},${0.12 + pulse * 0.15})`
          : 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, w * 0.072, floorH / rows - 2);
      }
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.05, top);
    ctx.lineTo(w * 0.95, top);
    ctx.stroke();
  }

  drawZone(zone) {
    const { ctx, w, h, t } = this;
    const px = zone.x * w;
    const py = zone.y * h;
    const sc = this.depthScale(zone.y);
    const rw = 52 * sc;
    const rh = 34 * sc;
    const pulse = 0.7 + Math.sin(t * 0.006 + zone.x * 5) * 0.3;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px - rw / 2, py, rw, rh * 0.5);

    ctx.fillStyle = zone.color + '44';
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px - rw / 2, py - rh * 0.3, rw, rh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.max(8, 10 * sc)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(zone.label.toUpperCase(), px, py + 4);

    if (zone.id === 'dj') {
      ctx.fillStyle = `rgba(124,77,255,${0.3 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py - rh * 0.55, 14 * sc, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = t * 0.01 + i * 1.5;
        ctx.fillStyle = `hsla(${(t * 0.05 + i * 60) % 360},80%,60%,0.5)`;
        ctx.beginPath();
        ctx.arc(px + Math.cos(a) * 22 * sc, py - rh * 0.55 + Math.sin(a) * 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawAvatar(entity, isPlayer = false) {
    const { ctx, w, h, t } = this;
    const px = entity.x * w;
    const py = entity.y * h;
    const sc = this.depthScale(entity.y);
    let bob = 0;
    if (entity.dancing || entity.phase !== undefined) {
      const phase = isPlayer ? entity.danceT : entity.phase * 1000;
      bob = Math.sin((t - phase) * 0.012) * (isPlayer && entity.dancing ? 10 : 6) * sc;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(px, py + 26 * sc, 16 * sc, 5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    const name = isPlayer ? (this.profile?.displayName || 'You') : entity.name;
    ctx.fillStyle = isPlayer ? '#b388ff' : '#69f0ae';
    ctx.font = `600 ${Math.max(8, 9 * sc)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(name, px, py - 34 * sc + bob);

    const body = ctx.createRadialGradient(px, py + bob - 4, 0, px, py + bob, 18 * sc);
    if (isPlayer) {
      body.addColorStop(0, '#b388ff');
      body.addColorStop(1, '#5e35b1');
    } else {
      body.addColorStop(0, `hsl(${entity.hue},70%,55%)`);
      body.addColorStop(1, `hsl(${entity.hue},60%,30%)`);
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(px, py + bob, 15 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (entity.dancing) {
      ctx.strokeStyle = 'rgba(255,193,7,0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = t * 0.015 + i * 2;
        ctx.beginPath();
        ctx.arc(px, py + bob, 20 * sc + i * 4, a, a + 0.8);
        ctx.stroke();
      }
    }
  }

  updatePlayer(dt) {
    const speed = 0.00034 * dt;
    if (Math.abs(this.move.x) > 0.05 || Math.abs(this.move.y) > 0.05) {
      this.player.x = Math.max(0.08, Math.min(0.92, this.player.x + this.move.x * speed));
      this.player.y = Math.max(0.48, Math.min(0.88, this.player.y + this.move.y * speed));
      if (this.player.dancing && (Math.abs(this.move.x) > 0.2 || Math.abs(this.move.y) > 0.2)) {
        this.player.dancing = false;
        this.danceBtn?.classList.remove('on');
      }
    }

    NPCS.forEach((n) => {
      n.x += Math.sin(this.t * 0.0004 + n.phase) * 0.00015;
      n.y += Math.cos(this.t * 0.00035 + n.phase) * 0.00008;
    });

    let near = null;
    let best = 0.11;
    for (const z of ZONES) {
      const d = Math.hypot(this.player.x - z.x, this.player.y - z.y);
      if (d < best) {
        best = d;
        near = z;
      }
    }
    this.nearZone = near;
    if (near) {
      this.promptEl.hidden = false;
      this.promptEl.textContent = near.id === 'dj' ? '🎧 Drop in at the DJ booth' : `Walk in — ${near.label}`;
      this.interactBtn.hidden = false;
      this.interactBtn.textContent = near.id === 'dj' ? 'Vibe' : `Enter ${near.label}`;
    } else {
      this.promptEl.hidden = true;
      this.interactBtn.hidden = true;
    }
  }

  tick = (now = 0) => {
    const dt = this._last ? now - this._last : 16;
    this._last = now;
    this.t = now;
    this.updatePlayer(dt);

    this.drawBackground();
    ZONES.forEach((z) => this.drawZone(z));
    this.drawDanceFloor();

    const entities = [...NPCS, this.player].sort((a, b) => a.y - b.y);
    entities.forEach((e) => this.drawAvatar(e, e === this.player));

    this.raf = requestAnimationFrame(this.tick);
  };

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    clearTimeout(this._walkStop);
    casinoSound.clubAmbienceStop();
    this.root.innerHTML = '';
  }
}

export function mountLoungePreview(el, profile, opts = {}) {
  if (!el) return null;
  return new MirageClub(el, profile, opts);
}