/** CGI-style human avatars — Ready Player Me presets + custom creator. */

const RPM_CREATOR = 'https://demo.readyplayer.me/avatar?frameApi&bodyType=fullbody&quickStart=true';

/** Public RPM demo models (full-body GLB). Users can replace via creator. */
export const CLUB_AVATAR_PRESETS = [
  {
    id: 'hostess',
    name: 'VIP Hostess',
    gender: 'f',
    style: 'glam',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c393419.glb?quality=medium&meshLod=1'
  },
  {
    id: 'sharp-m',
    name: 'Sharp Suit',
    gender: 'm',
    style: 'vip',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c39341a.glb?quality=medium&meshLod=1'
  },
  {
    id: 'dj',
    name: 'Resident DJ',
    gender: 'm',
    style: 'edm',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c39341b.glb?quality=medium&meshLod=1'
  },
  {
    id: 'uni-f',
    name: 'Campus Queen',
    gender: 'f',
    style: 'uni',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c39341c.glb?quality=medium&meshLod=1'
  },
  {
    id: 'boho-f',
    name: 'Boho Chic',
    gender: 'f',
    style: 'boho',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c39341d.glb?quality=medium&meshLod=1'
  },
  {
    id: 'rnb-m',
    name: 'R&B Smooth',
    gender: 'm',
    style: 'rnb',
    model: 'https://models.readyplayer.me/64bfa15f0e72c63d7c39341e.glb?quality=medium&meshLod=1'
  }
];

export function getAvatarPreset(id) {
  return CLUB_AVATAR_PRESETS.find((p) => p.id === id) || CLUB_AVATAR_PRESETS[0];
}

export function resolveClubAvatarUrl(profile) {
  if (profile?.clubAvatarUrl) return profile.clubAvatarUrl;
  const preset = getAvatarPreset(profile?.clubAvatarPreset || 'hostess');
  return preset.model;
}

export function bindAvatarCreator(onUrl) {
  const modal = document.getElementById('club-avatar-modal');
  const iframe = document.getElementById('club-avatar-iframe');
  const close = document.getElementById('club-avatar-close');
  if (!modal || !iframe) return;

  const onMessage = (event) => {
    const json = parseRPM(event);
    if (json?.data?.url) {
      const url = json.data.url.includes('.glb') ? json.data.url : `${json.data.url}.glb?quality=medium&meshLod=1`;
      onUrl?.(url);
      modal.hidden = true;
      window.removeEventListener('message', onMessage);
    }
  };

  close?.addEventListener('click', () => {
    modal.hidden = true;
    window.removeEventListener('message', onMessage);
  });

  document.querySelectorAll('[data-club-avatar-create]').forEach((btn) => {
    btn.addEventListener('click', () => {
      iframe.src = RPM_CREATOR;
      modal.hidden = false;
      window.addEventListener('message', onMessage);
    });
  });
}

function parseRPM(event) {
  try {
    if (typeof event.data !== 'string' || !event.data.includes('readyplayer')) return null;
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export function renderAvatarPicker(container, profile, onPick) {
  if (!container) return;
  const current = profile?.clubAvatarPreset || 'hostess';
  container.innerHTML = `
    <p class="club-picker-label">Your CGI avatar</p>
    <div class="club-avatar-grid">
      ${CLUB_AVATAR_PRESETS.map((p) => `
        <button type="button" class="club-avatar-pick${p.id === current ? ' on' : ''}" data-preset="${p.id}">
          <span class="club-avatar-icon">${p.gender === 'f' ? '👩' : '👨'}</span>
          <span class="club-avatar-name">${p.name}</span>
        </button>
      `).join('')}
      <button type="button" class="club-avatar-pick club-avatar-custom" data-club-avatar-create>
        <span class="club-avatar-icon">✨</span>
        <span class="club-avatar-name">Custom CGI</span>
      </button>
    </div>
  `;
  container.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.club-avatar-pick').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      onPick?.(btn.dataset.preset, null);
    });
  });
}