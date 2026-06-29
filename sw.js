const CACHE = 'mt-poker-v40';
const SHELL = [
  '/',
  '/index.html',
  '/auth/callback.html',
  '/css/style.css',
  '/css/roulette.css',
  '/css/game-scene.css',
  '/css/celebration.css',
  '/css/gate.css',
  '/css/game-fx.css',
  '/css/blackjack.css',
  '/css/starfall.css',
  '/js/game-fx.js',
  '/assets/dealer-hostess.jpg',
  '/js/gate.js',

  '/js/blackjack.js',
  '/js/blackjack-ui.js',
  '/js/starfall.js',
  '/js/starfall-ui.js',
  '/js/club-webrtc.js',
  '/js/club-voice.js',
  '/js/club-ownership.js',
  '/js/main.js',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res.ok && url.pathname.match(/\.(css|js|png|svg|json|html)$/)) {
          caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});