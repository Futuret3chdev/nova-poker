export const CASINO_BRAND = {
  name: 'Nova Mirage',
  tagline: 'Where legends deal & the reels never sleep',
  shortName: 'Nova Mirage',
  inviteMessage: 'Join me at Nova Mirage — poker, pokiers & more in the MT Ecosystem!'
};

export const TABLE_MODES = {
  'free-ai': {
    id: 'free-ai',
    title: 'Free Play vs AI',
    subtitle: 'Practice with play chips — no risk',
    currency: 'free',
    symbol: '₵',
    vsAI: true,
    multiplayer: false,
    startingChips: 5000,
    smallBlind: 25,
    bigBlind: 50,
    buyIn: 0,
    icon: '🤖',
    badge: 'FREE'
  },
  'free-multi': {
    id: 'free-multi',
    title: 'Free Multiplayer',
    subtitle: 'Play for fun chips against real players',
    currency: 'free',
    symbol: '₵',
    vsAI: false,
    multiplayer: true,
    startingChips: 5000,
    smallBlind: 25,
    bigBlind: 50,
    buyIn: 0,
    icon: '👥',
    badge: 'FREE'
  },
  'mt-ai': {
    id: 'mt-ai',
    title: '$MT vs AI',
    subtitle: 'Load $MT from wallet — no free tokens',
    currency: 'mt',
    symbol: '$MEMETORRENT',
    vsAI: true,
    multiplayer: false,
    startingChips: 100,
    smallBlind: 0.05,
    bigBlind: 0.1,
    buyIn: 1,
    icon: '💎',
    badge: '$MT'
  },
  'mt-multi': {
    id: 'mt-multi',
    title: '$MT Multiplayer',
    subtitle: 'Connect wallet & load $MT to play',
    currency: 'mt',
    symbol: '$MEMETORRENT',
    vsAI: false,
    multiplayer: true,
    startingChips: 200,
    smallBlind: 0.1,
    bigBlind: 0.2,
    buyIn: 2,
    icon: '⚡',
    badge: '$MT'
  },
  turbo: {
    id: 'turbo',
    title: 'Turbo $MT',
    subtitle: 'Fast blinds, quick hands',
    currency: 'mt',
    symbol: '$MEMETORRENT',
    vsAI: true,
    multiplayer: false,
    startingChips: 50,
    smallBlind: 0.05,
    bigBlind: 0.1,
    buyIn: 0.5,
    icon: '🚀',
    badge: 'TURBO'
  },
  sitngo: {
    id: 'sitngo',
    title: 'Sit & Go',
    subtitle: '6-player knockout tournament',
    currency: 'free',
    symbol: '₵',
    vsAI: true,
    multiplayer: false,
    startingChips: 1500,
    smallBlind: 10,
    bigBlind: 20,
    buyIn: 0,
    tournament: true,
    icon: '🏆',
    badge: 'SNG'
  }
};

/** 20 games across Poker, Pokiers, and Casino Floor (in development). */
export const CASINO_GAME_SECTIONS = [
  {
    id: 'poker',
    title: 'Poker',
    subtitle: 'Texas Hold\'em — live tables & tournaments',
    games: [
      { id: 'free-ai', modeId: 'free-ai', status: 'live' },
      { id: 'free-multi', modeId: 'free-multi', status: 'live' },
      { id: 'mt-ai', modeId: 'mt-ai', status: 'live' },
      { id: 'mt-multi', modeId: 'mt-multi', status: 'live' },
      { id: 'turbo', modeId: 'turbo', status: 'live' },
      { id: 'sitngo', modeId: 'sitngo', status: 'live' }
    ]
  },
  {
    id: 'pokiers',
    title: 'Pokiers',
    subtitle: 'Premium reels — $MEMETORRENT on-chain',
    games: [
      {
        id: 'lucky-reels',
        title: 'Lucky Reels',
        subtitle: 'Flagship slots — real $MT wins',
        icon: '🎰',
        badge: 'LIVE',
        status: 'live',
        external: true,
        url: 'https://lucky-reels-eosin.vercel.app'
      },
      {
        id: 'meme-jackpot',
        title: 'Meme Jackpot',
        subtitle: 'Progressive meme-themed reels',
        icon: '💰',
        badge: 'SOON',
        status: 'soon'
      },
      {
        id: 'starfall-spins',
        title: 'Starfall Spins',
        subtitle: 'Cascading wins under neon lights',
        icon: '✨',
        badge: 'SOON',
        status: 'soon'
      },
      {
        id: 'diamond-drift',
        title: 'Diamond Drift',
        subtitle: 'High-volatility gem chase',
        icon: '💎',
        badge: 'SOON',
        status: 'soon'
      },
      {
        id: 'torrent-treasures',
        title: 'Torrent Treasures',
        subtitle: 'MemeTorrent adventure reels',
        icon: '🌊',
        badge: 'SOON',
        status: 'soon'
      }
    ]
  },
  {
    id: 'floor',
    title: 'Casino Floor',
    subtitle: 'More games — opening soon on Nova Mirage',
    games: [
      { id: 'blackjack', title: 'Blackjack', subtitle: 'Beat the dealer to 21', icon: '🃏', badge: 'SOON', status: 'soon' },
      { id: 'roulette', title: 'Roulette', subtitle: 'Spin the wheel of fortune', icon: '🎡', badge: 'SOON', status: 'soon' },
      { id: 'baccarat', title: 'Baccarat', subtitle: 'Player vs banker elegance', icon: '🂡', badge: 'SOON', status: 'soon' },
      { id: 'craps', title: 'Craps', subtitle: 'Roll the dice on the pass line', icon: '🎲', badge: 'SOON', status: 'soon' },
      { id: 'video-poker', title: 'Video Poker', subtitle: 'Jacks or better multi-hand', icon: '📺', badge: 'SOON', status: 'soon' },
      { id: 'keno', title: 'Keno Lounge', subtitle: 'Pick lucky numbers fast', icon: '🔢', badge: 'SOON', status: 'soon' },
      { id: 'wheel', title: 'Wheel of Fate', subtitle: 'Big multipliers, one spin', icon: '🎯', badge: 'SOON', status: 'soon' },
      { id: 'crash', title: 'Crash Orbit', subtitle: 'Cash out before the bust', icon: '🚀', badge: 'SOON', status: 'soon' },
      { id: 'plinko', title: 'Plinko Palace', subtitle: 'Drop chips for cascading prizes', icon: '⚪', badge: 'SOON', status: 'soon' }
    ]
  }
];

/** @deprecated — use CASINO_GAME_SECTIONS */
export const CASINO_GAMES = CASINO_GAME_SECTIONS.find((s) => s.id === 'pokiers')?.games.filter((g) => g.status === 'live') || [];

/** @deprecated — poker section only */
export const MENU_SECTIONS = [
  { id: 'play', title: 'Play', items: ['free-ai', 'free-multi', 'mt-ai', 'mt-multi'] },
  { id: 'variants', title: 'Variants', items: ['turbo', 'sitngo'] }
];

export const MULTIPLAYER_ROOMS = [
  { id: 'mt-high', name: 'MT High Rollers', stakes: '0.5/1 MT', players: 4, max: 6, currency: 'mt' },
  { id: 'free-casual', name: 'Casual Lounge', stakes: '25/50 ₵', players: 2, max: 6, currency: 'free' },
  { id: 'mt-micro', name: 'Micro Stakes', stakes: '0.05/0.1 MT', players: 5, max: 6, currency: 'mt' },
  { id: 'free-turbo', name: 'Turbo Freeroll', stakes: '10/20 ₵', players: 3, max: 6, currency: 'free' }
];

export const FAKE_PLAYER_NAMES = [
  'CryptoKing', 'MemeLord', 'WhaleWatch', 'DiamondHands', 'MoonShot',
  'TokenTrader', 'BluffMaster', 'RiverQueen', 'AcePilot', 'StackSurge'
];