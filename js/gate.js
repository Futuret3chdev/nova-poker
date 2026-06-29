/** Age verification + access gate for Nova Mirage. */

const AGE_KEY = 'nm-age-verified';
const AGE_VALUE_KEY = 'nm-age-year';
export const UNDERAGE_REDIRECT = 'https://memetorrent.futuret3ch.com.au';

export function isAgeVerified() {
  return localStorage.getItem(AGE_KEY) === '1';
}

export function getStoredBirthYear() {
  const y = Number(localStorage.getItem(AGE_VALUE_KEY));
  return Number.isFinite(y) ? y : null;
}

export function verifyAge(birthYear) {
  const year = Number(birthYear);
  const now = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1900 || year > now) {
    return { ok: false, error: 'Enter a valid birth year' };
  }
  const age = now - year;
  if (age < 18) {
    return { ok: false, underage: true, error: 'You must be 18 or older to enter Nova Mirage' };
  }
  localStorage.setItem(AGE_KEY, '1');
  localStorage.setItem(AGE_VALUE_KEY, String(year));
  return { ok: true, age };
}

function frameEl() {
  return document.getElementById('age-gate-frame');
}

export function openAgeGate() {
  const el = frameEl();
  if (el) {
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
  }
}

export function closeAgeGate() {
  const el = frameEl();
  if (el) {
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  }
}

export function bindAgeGate(onVerified) {
  const input = document.getElementById('age-birth-year');
  const btn = document.getElementById('btn-age-confirm');
  const err = document.getElementById('age-gate-error');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const res = verifyAge(input?.value);
    if (!res.ok) {
      if (res.underage) {
        window.location.href = UNDERAGE_REDIRECT;
        return;
      }
      if (err) {
        err.textContent = res.error;
        err.hidden = false;
      }
      return;
    }
    if (err) err.hidden = true;
    closeAgeGate();
    onVerified?.(res);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
}

export function canAccessCasino(profile, isSignedIn) {
  return isAgeVerified() && isSignedIn(profile);
}