// ميزان service worker — precache everything, cache-first, works fully offline.
// Bump CACHE on every release so iPhones pick up the update.
const CACHE = 'mizan-v2.0.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/calc.js',
  './js/data-exercises.js',
  './js/data-programs.js',
  './js/data-tips.js',
  './js/icons.js',
  './js/figure.js',
  './js/store.js',
  './js/timer.js',
  './js/app.js',
  './fonts/plex-arabic-400-arabic.woff2',
  './fonts/plex-arabic-400-latin.woff2',
  './fonts/plex-arabic-600-arabic.woff2',
  './fonts/plex-arabic-600-latin.woff2',
  './fonts/plex-arabic-700-arabic.woff2',
  './fonts/plex-arabic-700-latin.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  // cache:'reload' bypasses the HTTP cache so a new release never precaches stale files
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mizan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
