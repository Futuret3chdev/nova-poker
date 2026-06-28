import { WHEEL_ORDER, RED_NUMS, isRed, spinRotation } from './roulette.js';

/** Canvas classic European roulette wheel + ball. */
export class RouletteWheelCanvas {
  constructor(wrapEl) {
    this.wrap = wrapEl;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'rl-wheel-canvas';
    this.wrap.innerHTML = '';
    this.wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.wheelRot = 0;
    this.ballAngle = -Math.PI / 2;
    this.size = 300;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.draw();
  }

  resize() {
    const rect = this.wrap.getBoundingClientRect();
    const s = Math.min(rect.width, rect.height) || 300;
    this.size = s;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = s * dpr;
    this.canvas.height = s * dpr;
    this.canvas.style.width = `${s}px`;
    this.canvas.style.height = `${s}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  setPose(wheelDeg, ballRad) {
    this.wheelRot = wheelDeg;
    this.ballAngle = ballRad;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    ctx.clearRect(0, 0, s, s);

    // Shadow under wheel
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.04, s * 0.42, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.restore();

    // Wood outer rim
    const woodR = s * 0.47;
    const gradWood = ctx.createRadialGradient(cx, cy, woodR * 0.5, cx, cy, woodR);
    gradWood.addColorStop(0, '#8b5a2b');
    gradWood.addColorStop(0.5, '#5c3d1e');
    gradWood.addColorStop(1, '#3e2914');
    ctx.beginPath();
    ctx.arc(cx, cy, woodR, 0, Math.PI * 2);
    ctx.fillStyle = gradWood;
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Brass ball track
    const trackR = s * 0.405;
    const gradBrass = ctx.createLinearGradient(cx - trackR, cy, cx + trackR, cy);
    gradBrass.addColorStop(0, '#b8860b');
    gradBrass.addColorStop(0.3, '#ffd700');
    gradBrass.addColorStop(0.5, '#fff8dc');
    gradBrass.addColorStop(0.7, '#ffd700');
    gradBrass.addColorStop(1, '#8b6914');
    ctx.beginPath();
    ctx.arc(cx, cy, trackR, 0, Math.PI * 2);
    ctx.lineWidth = s * 0.045;
    ctx.strokeStyle = gradBrass;
    ctx.stroke();

    // Rotating wheel body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.wheelRot * Math.PI) / 180);

    const pocketR = s * 0.36;
    const seg = (Math.PI * 2) / WHEEL_ORDER.length;

    WHEEL_ORDER.forEach((num, i) => {
      const a0 = i * seg - Math.PI / 2;
      const a1 = a0 + seg;
      const fill = num === 0 ? '#1b7a3d' : isRed(num) ? '#b71c1c' : '#111';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, pocketR, a0, a1);
      ctx.closePath();
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pocketR);
      pg.addColorStop(0, fill);
      pg.addColorStop(1, num === 0 ? '#0d4d28' : isRed(num) ? '#7f0000' : '#000');
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const mid = a0 + seg / 2;
      const tx = Math.cos(mid) * pocketR * 0.72;
      const ty = Math.sin(mid) * pocketR * 0.72;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${s * 0.038}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), 0, 0);
      ctx.restore();
    });

    // Inner bowl
    const bowlR = s * 0.14;
    const bowlG = ctx.createRadialGradient(0, 0, 0, 0, 0, bowlR);
    bowlG.addColorStop(0, '#2a1f14');
    bowlG.addColorStop(1, '#0a0806');
    ctx.beginPath();
    ctx.arc(0, 0, bowlR, 0, Math.PI * 2);
    ctx.fillStyle = bowlG;
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spokes
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(0, bowlR * 0.3);
      ctx.lineTo(0, pocketR * 0.55);
      ctx.strokeStyle = 'rgba(201,162,39,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Ball on track (world space)
    const ballOrbit = trackR - s * 0.018;
    const bx = cx + Math.cos(this.ballAngle) * ballOrbit;
    const by = cy + Math.sin(this.ballAngle) * ballOrbit;
    const ballR = s * 0.022;
    const ballG = ctx.createRadialGradient(bx - ballR * 0.3, by - ballR * 0.3, 0, bx, by, ballR);
    ballG.addColorStop(0, '#ffffff');
    ballG.addColorStop(0.45, '#e8e8e8');
    ballG.addColorStop(1, '#999');
    ctx.beginPath();
    ctx.arc(bx, by, ballR, 0, Math.PI * 2);
    ctx.fillStyle = ballG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /** Animate wheel + ball; returns promise. */
  animateTo(result, currentWheelDeg, duration = 4500) {
    const targetWheel = spinRotation(result, currentWheelDeg, 5 + Math.floor(Math.random() * 2));
    const startWheel = currentWheelDeg;
    const startBall = this.ballAngle;
    const ballSpins = 7 + Math.random() * 4;
    const endBall = -Math.PI / 2;
    const start = performance.now();

    return new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const ease = 1 - Math.pow(1 - t, 3.2);
        const wheel = startWheel + (targetWheel - startWheel) * ease;
        const ball = startBall + (endBall + ballSpins * Math.PI * 2 - startBall) * ease;
        this.wheelRot = wheel;
        this.ballAngle = ball;
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else resolve(targetWheel);
      };
      requestAnimationFrame(frame);
    });
  }
}