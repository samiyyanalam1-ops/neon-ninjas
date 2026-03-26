// NEON NINJA ∞ — Service Worker
// Caches all game assets for full offline play

const CACHE_NAME = 'neon-ninja-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600&display=swap',
  'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6BoWgz.woff2',
  'https://fonts.gstatic.com/s/rajdhani/v15/LDI2apCSOBg7S-QT7pb2LDEssK8.woff2'
];

// Install: cache everything
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets reliably; try remote fonts best-effort
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => {
          return Promise.allSettled(
            ASSETS.filter(a => a.startsWith('http')).map(url =>
              fetch(url).then(r => cache.put(url, r)).catch(() => {})
            )
          );
        });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for local, network-first for remote
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // For same-origin (game files) — cache first
  if (url.origin === location.origin || e.request.url.startsWith('./')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // For fonts / external — stale while revalidate
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(response => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
