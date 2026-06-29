/** Club room themes — EDM, R&B, Uni, Boho (social gathering vibes). */

export const CLUB_ROOMS = {
  edm: {
    id: 'edm',
    name: 'EDM Main Floor',
    tagline: 'Lasers, bass & peak-hour energy',
    crowd: 'EDM heads · festival crowd',
    bpm: 128,
    palette: { floor: 0x1a0a3a, accent: 0x00e5ff, warm: 0xff00ff, bar: 0x311b92 },
    fog: 0x12082a,
    lightA: 0x00e5ff,
    lightB: 0xff1744,
    decor: 'industrial'
  },
  rnb: {
    id: 'rnb',
    name: 'R&B VIP Lounge',
    tagline: 'Slow grooves · velvet booths · late night',
    crowd: 'R&B lovers · date night',
    bpm: 92,
    palette: { floor: 0x1a0f0a, accent: 0xffb74d, warm: 0xe65100, bar: 0x4e342e },
    fog: 0x1a1008,
    lightA: 0xff8f00,
    lightB: 0xbf360c,
    decor: 'velvet'
  },
  uni: {
    id: 'uni',
    name: 'Uni Hangout',
    tagline: 'Campus night · young crowd · cheap drinks',
    crowd: 'Students · freshers · house parties',
    bpm: 110,
    palette: { floor: 0x0f1a28, accent: 0x69f0ae, warm: 0xffeb3b, bar: 0x1565c0 },
    fog: 0x0d1520,
    lightA: 0x40c4ff,
    lightB: 0x69f0ae,
    decor: 'campus'
  },
  boho: {
    id: 'boho',
    name: 'Boho Terrace',
    tagline: 'Warm wood · plants · sunset cocktails',
    crowd: 'Creatives · boho · rooftop vibes',
    bpm: 100,
    palette: { floor: 0x2a1f14, accent: 0xd7ccc8, warm: 0xffab91, bar: 0x5d4037 },
    fog: 0x1f1610,
    lightA: 0xffcc80,
    lightB: 0xa1887f,
    decor: 'boho'
  }
};

export function getClubRoom(id) {
  return CLUB_ROOMS[id] || CLUB_ROOMS.edm;
}

export function lobbyIdForRoom(roomId) {
  const bucket = Math.floor(Date.now() / 300000);
  return `nova-${roomId}-${bucket}`;
}