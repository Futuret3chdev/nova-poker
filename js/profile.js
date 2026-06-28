const STORAGE_KEY = 'mt-poker-profile';

export const CHARACTER_PRESETS = {
  skinTones: ['#f5d0b0', '#e8b88a', '#c68642', '#8d5524', '#5c3a1e', '#3d2314'],
  hairColors: ['#1a1a1a', '#4a3728', '#8b4513', '#d4a574', '#c0392b', '#6a5acd', '#2ecc71'],
  hairStyles: ['short', 'medium', 'long', 'buzz', 'mohawk', 'bald'],
  frames: ['#e53935', '#ff9800', '#ffd700', '#2e7d32', '#1565c0', '#7b1fa2', '#ffffff'],
  accessories: ['none', 'sunglasses', 'headphones', 'crown', 'visor']
};

export const DEFAULT_PROFILE = {
  displayName: 'Player1',
  avatarUrl: null,
  avatarType: 'initial',
  authProvider: null,
  authId: null,
  authEmail: null,
  character: {
    skinTone: '#c68642',
    hairStyle: 'short',
    hairColor: '#2c1810',
    accessory: 'none',
    frameColor: '#e53935'
  }
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, character: { ...DEFAULT_PROFILE.character } };
    const data = JSON.parse(raw);
    return {
      ...DEFAULT_PROFILE,
      ...data,
      character: { ...DEFAULT_PROFILE.character, ...data.character }
    };
  } catch {
    return { ...DEFAULT_PROFILE, character: { ...DEFAULT_PROFILE.character } };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function updateProfile(patch) {
  const p = loadProfile();
  const next = {
    ...p,
    ...patch,
    character: { ...p.character, ...(patch.character || {}) }
  };
  saveProfile(next);
  return next;
}

export function applyAuthUser(user) {
  const p = loadProfile();
  const next = {
    ...p,
    displayName: user.name || p.displayName,
    authProvider: user.provider,
    authId: user.id,
    authEmail: user.email || null
  };
  if (user.avatarUrl) {
    next.avatarUrl = user.avatarUrl;
    next.avatarType = p.avatarType === 'upload' ? 'upload' : 'oauth';
  }
  saveProfile(next);
  return next;
}

export function clearAuth() {
  const p = loadProfile();
  const next = {
    ...p,
    authProvider: null,
    authId: null,
    authEmail: null
  };
  if (p.avatarType === 'oauth') {
    next.avatarUrl = null;
    next.avatarType = 'initial';
  }
  saveProfile(next);
  return next;
}

export function compressImage(file, maxSize = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatarFile(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a JPG or PNG image');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');
  const dataUrl = await compressImage(file);
  return updateProfile({ avatarUrl: dataUrl, avatarType: 'upload' });
}

export function removeAvatar() {
  return updateProfile({ avatarUrl: null, avatarType: 'initial' });
}

export function getDisplayName(profile) {
  return profile?.displayName?.trim() || 'Player1';
}

export function isSignedIn(profile) {
  return !!(profile?.authProvider && profile?.authId);
}