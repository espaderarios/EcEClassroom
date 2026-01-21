const CACHE_NAME = 'ec-eclassroom-v3';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './tailwindcss.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        PRECACHE_ASSETS.map(asset =>
          cache.add(asset).catch(err => {
            console.warn('Precache failed', asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
  // notify clients that SW is active
  self.clients.matchAll().then(clients => {
    clients.forEach(c => c.postMessage({ type: 'cache-status', message: 'Service worker active', status: 'success' }));
  });
});

self.addEventListener('fetch', event => {
  // Try cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          // cache fetched assets (basic strategy)
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'cache-status', message: 'Cache cleared', status: 'info' }));
      });
    });
  }
});
