// Minimal pass-through service worker to silence registration errors
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  self.clients.claim();
});

self.addEventListener("fetch", () => {
  // No caching; allow network to handle requests
});
