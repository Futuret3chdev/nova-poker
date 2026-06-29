/** Shared ambient particles & burst FX for casino mini-games. */

export function spawnAmbient(container, type = 'gold', count = 24) {
  if (!container || container.querySelector('.gfx-ambient')) return () => {};
  const layer = document.createElement('div');
  layer.className = `gfx-ambient gfx-${type}`;
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'gfx-particle';
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--y', `${Math.random() * 100}%`);
    p.style.setProperty('--dur', `${4 + Math.random() * 6}s`);
    p.style.setProperty('--delay', `${Math.random() * 4}s`);
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    p.style.setProperty('--size', `${2 + Math.random() * 4}px`);
    layer.appendChild(p);
  }
  container.prepend(layer);
  return () => layer.remove();
}

export function burstAt(el, type = 'coins', n = 14) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'gfx-burst';
  host.style.left = `${rect.left + rect.width / 2}px`;
  host.style.top = `${rect.top + rect.height / 2}px`;
  const chars = type === 'stars' ? ['✦', '★', '✨'] : ['₵', '♦', '●'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'gfx-burst-bit';
    s.textContent = chars[i % chars.length];
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 40 + Math.random() * 70;
    s.style.setProperty('--bx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--by', `${Math.sin(ang) * dist}px`);
    s.style.setProperty('--bd', `${0.4 + Math.random() * 0.35}s`);
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 900);
}

export function showBanner(container, text, tier = 'win') {
  if (!container) return;
  container.querySelector('.gfx-banner')?.remove();
  const b = document.createElement('div');
  b.className = `gfx-banner gfx-banner-${tier}`;
  b.innerHTML = `<span class="gfx-banner-glow"></span><span class="gfx-banner-text">${text}</span>`;
  container.appendChild(b);
  requestAnimationFrame(() => b.classList.add('on'));
  setTimeout(() => {
    b.classList.remove('on');
    setTimeout(() => b.remove(), 500);
  }, 2200);
}

export function chaseLights(container, count = 12) {
  if (!container || container.querySelector('.gfx-chase')) return;
  const ring = document.createElement('div');
  ring.className = 'gfx-chase';
  ring.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const bulb = document.createElement('span');
    bulb.className = 'gfx-bulb';
    bulb.style.setProperty('--i', i);
    bulb.style.setProperty('--n', count);
    ring.appendChild(bulb);
  }
  container.appendChild(ring);
}