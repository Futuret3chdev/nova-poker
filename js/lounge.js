/** Social lounge — avatar walk + video hangout (scaffold, evolving). */



const WALKERS = [
  { name: 'NovaGuest', x: 0.2, y: 0.55, dx: 0.0008 },
  { name: 'ChipQueen', x: 0.7, y: 0.4, dx: -0.0006 },
  { name: 'MirageVIP', x: 0.45, y: 0.72, dx: 0.0005 }
];

export class LoungeScene {
  constructor(canvas, profile) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.profile = profile;
    this.raf = null;
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.tick();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 360;
    const h = rect?.height || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  drawFloor() {
    const { ctx, w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a1030');
    g.addColorStop(0.5, '#120a1e');
    g.addColorStop(1, '#0a0612');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.08)';
    ctx.lineWidth = 1;
    for (let y = h * 0.35; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(124, 77, 255, 0.12)';
    ctx.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.45);
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.25)';
    ctx.strokeRect(w * 0.15, h * 0.2, w * 0.7, h * 0.45);
  }

  drawWalker(walker, t) {
    walker.x += walker.dx;
    if (walker.x < 0.08 || walker.x > 0.92) walker.dx *= -1;
    const px = walker.x * this.w;
    const py = walker.y * this.h;
    const bob = Math.sin(t * 0.004 + walker.x * 10) * 4;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.beginPath();
    this.ctx.ellipse(px, py + 28, 18, 6, 0, 0, Math.PI * 2);
    this.ctx.fill();

    const label = walker.name === 'You' ? this.profile?.displayName || 'You' : walker.name;
    this.ctx.fillStyle = '#ffc107';
    this.ctx.font = '600 10px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, px, py - 38 + bob);

    this.ctx.fillStyle = walker.name === 'You' ? '#7c4dff' : '#2ea043';
    this.ctx.beginPath();
    this.ctx.arc(px, py + bob, 16, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    this.ctx.stroke();
  }

  tick = (t = 0) => {
    this.drawFloor();
    WALKERS.forEach((w) => this.drawWalker(w, t));
    this.drawWalker({ name: 'You', x: 0.5, y: 0.62, dx: 0 }, t);

    this.ctx.fillStyle = 'rgba(240, 243, 246, 0.75)';
    this.ctx.font = '11px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Video lounge & walkable avatars — expanding soon', this.w / 2, this.h * 0.14);

    this.raf = requestAnimationFrame(this.tick);
  };

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
  }
}

export function mountLoungePreview(el, profile) {
  if (!el) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'lounge-canvas';
  canvas.setAttribute('aria-label', 'Nova Mirage social lounge preview');
  el.innerHTML = '';
  el.appendChild(canvas);
  return new LoungeScene(canvas, profile);
}