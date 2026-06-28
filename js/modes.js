export const CASINO_GAMES = [
  {
    id: 'lucky-reels',
    title: 'Lucky Reels',
    subtitle: 'Premium slots — real $MEMETORRENT on-chain',
    icon: '🎰',
    badge: 'SLOTS',
    external: true,
    url: 'https://lucky-reels-eosin.vercel.app'
  }
];

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

export const MENU_SECTIONS = [
  {
    id: 'play',
    title: 'Play',
    items: ['free-ai', 'free-multi', 'mt-ai', 'mt-multi']
  },
  {
    id: 'variants',
    title: 'Variants',
    items: ['turbo', 'sitngo']
  }
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