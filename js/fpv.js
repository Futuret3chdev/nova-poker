/** Classic lobby vs first-person casino view (FPV scaffold). */

const KEY = 'nm-view-mode';

export function getViewMode() {
  return localStorage.getItem(KEY) || 'classic';
}

export function setViewMode(mode) {
  const next = mode === 'fpv' ? 'fpv' : 'classic';
  localStorage.setItem(KEY, next);
  document.documentElement.dataset.viewMode = next;
  return next;
}

export function toggleViewMode() {
  return setViewMode(getViewMode() === 'fpv' ? 'classic' : 'fpv');
}

export function bootViewMode() {
  document.documentElement.dataset.viewMode = getViewMode();
}

export function updateViewModeButton(btn) {
  if (!btn) return;
  const fpv = getViewMode() === 'fpv';
  btn.textContent = fpv ? 'Classic' : '1st Person';
  btn.title = fpv ? 'Switch to classic view' : 'Switch to first-person casino view';
  btn.classList.toggle('fpv-on', fpv);
}