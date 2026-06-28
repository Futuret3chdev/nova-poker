import { CHARACTER_PRESETS } from './profile.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hairSvg(style, color) {
  const paths = {
    short: `<ellipse cx="24" cy="14" rx="14" ry="10" fill="${color}"/>`,
    medium: `<ellipse cx="24" cy="12" rx="15" ry="12" fill="${color}"/><rect x="10" y="14" width="28" height="8" rx="4" fill="${color}"/>`,
    long: `<ellipse cx="24" cy="12" rx="15" ry="12" fill="${color}"/><rect x="9" y="14" width="30" height="14" rx="6" fill="${color}"/>`,
    buzz: `<ellipse cx="24" cy="14" rx="13" ry="9" fill="${color}" opacity="0.85"/>`,
    mohawk: `<rect x="20" y="4" width="8" height="18" rx="3" fill="${color}"/><ellipse cx="24" cy="16" rx="12" ry="8" fill="${color}" opacity="0.5"/>`,
    bald: ''
  };
  return paths[style] || paths.short;
}

function accessorySvg(type) {
  const items = {
    sunglasses: '<rect x="10" y="22" width="12" height="6" rx="2" fill="#111"/><rect x="26" y="22" width="12" height="6" rx="2" fill="#111"/><line x1="22" y1="25" x2="26" y2="25" stroke="#111" stroke-width="2"/>',
    headphones: '<path d="M8 24 Q8 14 24 14 Q40 14 40 24" fill="none" stroke="#444" stroke-width="3"/><rect x="6" y="22" width="8" height="12" rx="3" fill="#333"/><rect x="34" y="22" width="8" height="12" rx="3" fill="#333"/>',
    crown: '<polygon points="12,18 18,8 24,16 30,8 36,18" fill="#ffd700" stroke="#b8860b" stroke-width="1"/>',
    visor: '<path d="M10 20 L38 20 L36 26 L12 26 Z" fill="#1565c0"/>'
  };
  return items[type] || '';
}

export function renderCharacterSvg(character, size = 48) {
  const c = character || {};
  const skin = c.skinTone || '#c68642';
  const hair = c.hairColor || '#2c1810';
  const style = c.hairStyle || 'short';
  const acc = c.accessory || 'none';
  const frame = c.frameColor || '#e53935';

  return `<svg class="avatar-character-svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="none" stroke="${frame}" stroke-width="3"/>
    <circle cx="24" cy="26" r="14" fill="${skin}"/>
    ${hairSvg(style, hair)}
    <circle cx="18" cy="26" r="2" fill="#222"/>
    <circle cx="30" cy="26" r="2" fill="#222"/>
    <path d="M18 32 Q24 36 30 32" fill="none" stroke="#8b4513" stroke-width="1.5" stroke-linecap="round"/>
    ${accessorySvg(acc)}
  </svg>`;
}

function avatarSizePx(size) {
  if (size === 'large') return 96;
  if (size === 'preview') return 120;
  if (size === 'seat') return 40;
  return 48;
}

export function renderAvatarHTML(player, opts = {}) {
  const size = opts.size || 'seat';
  const svgPx = avatarSizePx(size);
  const cls = [
    'avatar',
    size === 'large' ? 'avatar-lg' : '',
    size === 'preview' ? 'avatar-preview' : '',
    size === 'seat' ? 'avatar-seat' : '',
    player?.isHuman ? 'avatar-you' : '',
    player?.avatarUrl ? 'avatar-photo' : '',
    !player?.avatarUrl && player?.character ? 'avatar-character' : ''
  ].filter(Boolean).join(' ');

  if (player?.avatarUrl && !opts.preferCharacter) {
    const src = escapeHtml(player.avatarUrl);
    const alt = escapeHtml(player?.name || 'Player');
    return `<div class="${cls}"><img src="${src}" alt="${alt}" loading="eager" referrerpolicy="no-referrer" crossorigin="anonymous"></div>`;
  }

  if (player?.character) {
    return `<div class="${cls}">${renderCharacterSvg(player.character, svgPx)}</div>`;
  }

  const initial = escapeHtml((player?.name || '?').charAt(0).toUpperCase());
  return `<div class="${cls}">${initial}</div>`;
}

export function botCharacterForName(name) {
  const hash = String(name).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const { skinTones, hairColors, hairStyles, frames, accessories } = CHARACTER_PRESETS;
  return {
    skinTone: skinTones[hash % skinTones.length],
    hairColor: hairColors[(hash * 3) % hairColors.length],
    hairStyle: hairStyles[(hash * 7) % hairStyles.length],
    frameColor: frames[(hash * 5) % frames.length],
    accessory: accessories[(hash * 11) % accessories.length]
  };
}

export function profileToPlayer(profile, isHuman = true) {
  return {
    name: profile?.displayName || 'Player1',
    avatarUrl: profile?.avatarUrl || null,
    character: profile?.character || null,
    isHuman
  };
}

export { CHARACTER_PRESETS };