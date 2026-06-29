/** Club management sim — staff, stock, events (Night Club Sim style). */

const STORAGE_KEY = 'nm-club-mgmt';

const DEFAULT = {
  cash: 8500,
  reputation: 24,
  staff: { dj: 1, bartender: 1, security: 0, dancers: 0 },
  stock: { vodka: 30, beer: 60, cocktails: 20 },
  activeEvent: null,
  upgrades: { lights: 1, sound: 1, vip: 0 }
};

const STAFF_COST = { dj: 120, bartender: 80, security: 100, dancers: 150 };
const STOCK_PRICE = { vodka: 12, beer: 4, cocktails: 8 };

export function loadClubManagement() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT);
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function saveClubManagement(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function hireStaff(state, role) {
  const cost = STAFF_COST[role] || 100;
  if (state.cash < cost) return { ok: false, error: 'Not enough club cash' };
  state.cash -= cost;
  state.staff[role] = (state.staff[role] || 0) + 1;
  state.reputation += 2;
  saveClubManagement(state);
  return { ok: true, state };
}

export function restock(state, item, qty = 10) {
  const cost = (STOCK_PRICE[item] || 5) * qty;
  if (state.cash < cost) return { ok: false, error: 'Not enough club cash' };
  state.cash -= cost;
  state.stock[item] = (state.stock[item] || 0) + qty;
  saveClubManagement(state);
  return { ok: true, state };
}

export function startEvent(state, eventId) {
  const events = {
    edm: { name: 'EDM Takeover', rep: 8, cash: 400 },
    rnb: { name: 'Slow Jams Night', rep: 6, cash: 350 },
    uni: { name: 'Freshers Party', rep: 10, cash: 500 },
    boho: { name: 'Sunset Sessions', rep: 5, cash: 280 }
  };
  const ev = events[eventId];
  if (!ev) return { ok: false };
  if (state.staff.dj < 1) return { ok: false, error: 'Hire a DJ first' };
  state.activeEvent = { id: eventId, ...ev, ends: Date.now() + 120000 };
  state.reputation += ev.rep;
  state.cash += ev.cash;
  saveClubManagement(state);
  return { ok: true, state };
}

export function tickClub(state, roomBpm) {
  const s = { ...state };
  const staffTotal = Object.values(s.staff).reduce((a, b) => a + b, 0);
  const vibe = roomBpm > 120 ? 1.4 : roomBpm < 95 ? 0.9 : 1.1;
  s.cash += Math.floor((staffTotal * 3 + s.reputation * 0.2) * vibe);
  if (s.activeEvent && Date.now() > s.activeEvent.ends) s.activeEvent = null;
  saveClubManagement(s);
  return s;
}

export function renderManagementPanel(el, state, room, onAction) {
  if (!el) return;
  const ev = state.activeEvent;
  el.innerHTML = `
    <div class="mgmt-head">
      <h3>Club Manager</h3>
      <button type="button" class="mgmt-close" id="mgmt-close">✕</button>
    </div>
    <div class="mgmt-stats">
      <span>₵${state.cash.toLocaleString()}</span>
      <span>Rep ${state.reputation}</span>
      <span>DJ×${state.staff.dj} Bar×${state.staff.bartender}</span>
    </div>
    ${ev ? `<p class="mgmt-event">🎉 ${ev.name} live!</p>` : ''}
    <div class="mgmt-section">
      <h4>Staff</h4>
      <div class="mgmt-btns">
        <button type="button" data-hire="dj">+ DJ (₵120)</button>
        <button type="button" data-hire="bartender">+ Bartender (₵80)</button>
        <button type="button" data-hire="security">+ Security (₵100)</button>
        <button type="button" data-hire="dancers">+ Dancers (₵150)</button>
      </div>
    </div>
    <div class="mgmt-section">
      <h4>Stock</h4>
      <p class="mgmt-stock">Vodka ${state.stock.vodka} · Beer ${state.stock.beer} · Cocktails ${state.stock.cocktails}</p>
      <div class="mgmt-btns">
        <button type="button" data-stock="vodka">Restock vodka</button>
        <button type="button" data-stock="beer">Restock beer</button>
        <button type="button" data-stock="cocktails">Restock cocktails</button>
      </div>
    </div>
    <div class="mgmt-section">
      <h4>Events — ${room.name}</h4>
      <button type="button" class="mgmt-event-btn" data-event="${room.id}">Launch ${room.name} night</button>
    </div>
  `;
  el.querySelector('#mgmt-close')?.addEventListener('click', () => onAction?.('close'));
  el.querySelectorAll('[data-hire]').forEach((b) => b.addEventListener('click', () => onAction?.('hire', b.dataset.hire)));
  el.querySelectorAll('[data-stock]').forEach((b) => b.addEventListener('click', () => onAction?.('stock', b.dataset.stock)));
  el.querySelector('[data-event]')?.addEventListener('click', () => onAction?.('event', room.id));
}