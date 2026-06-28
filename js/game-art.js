/** Art + animated FX per game card (Nova Mirage lobby). */
export const GAME_ART = {
  'free-ai':       { image: '/assets/games/free-ai.jpg',       fx: 'neon' },
  'free-multi':    { image: '/assets/games/free-multi.jpg',    fx: 'electric' },
  'mt-ai':         { image: '/assets/games/mt-ai.jpg',         fx: 'crystal' },
  'mt-multi':      { image: '/assets/games/mt-multi.jpg',    fx: 'fire' },
  turbo:           { image: '/assets/games/turbo.jpg',         fx: 'fire' },
  sitngo:          { image: '/assets/games/sitngo.jpg',        fx: 'gold' },
  'lucky-reels':   { image: '/assets/games/lucky-reels.jpg',   fx: 'jackpot' },
  'meme-jackpot':  { image: '/assets/games/meme-jackpot.jpg',  fx: 'gold' },
  'starfall-spins':{ image: '/assets/games/starfall-spins.jpg',fx: 'stars' },
  'diamond-drift': { image: '/assets/games/diamond-drift.jpg', fx: 'ice' },
  'torrent-treasures': { image: '/assets/games/torrent-treasures.jpg', fx: 'wave' },
  blackjack:       { image: '/assets/games/blackjack.jpg',     fx: 'neon' },
  roulette:        { image: '/assets/games/roulette.jpg',      fx: 'fire' },
  baccarat:        { image: '/assets/games/baccarat.jpg',      fx: 'gold' },
  craps:           { image: '/assets/games/craps.jpg',         fx: 'fire' },
  'video-poker':   { image: '/assets/games/video-poker.jpg',   fx: 'electric' },
  keno:            { image: '/assets/games/keno.jpg',          fx: 'stars' },
  wheel:           { image: '/assets/games/wheel.jpg',         fx: 'jackpot' },
  crash:           { image: '/assets/games/crash.jpg',         fx: 'fire' },
  plinko:          { image: '/assets/games/plinko.jpg',        fx: 'neon' }
};

export function artForGame(gameId) {
  return GAME_ART[gameId] || { image: null, fx: 'neon' };
}