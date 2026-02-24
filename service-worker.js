const CACHE_NAME = 'ec-eclassroom-v9';
const CORE_ASSETS = [
  './',
  './index.html',
  './info.html',
  './app.js',
  './styles.css',
  './tailwindcss.js',
  './manifest.json',
  './service-worker.js',
  './head_app_full.txt',
  './head_app_top.txt',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const FONT_ASSETS = [
  './fonts/BBHBartle-Regular.ttf',
  './fonts/BBHBogle-Regular.ttf',
  './fonts/BBHHegarty-Regular.ttf',
  './fonts/GoogleSans-Italic-VariableFont_GRAD,opsz,wght.ttf',
  './fonts/GoogleSans-VariableFont_GRAD,opsz,wght.ttf',
  './fonts/OpenSans-Italic-VariableFont_wdth,wght.ttf',
  './fonts/OpenSans-VariableFont_wdth,wght.ttf',
  './fonts/Orbitron-VariableFont_wght.ttf',
  './fonts/PlayfairDisplay-Italic-VariableFont_wght.ttf',
  './fonts/PlayfairDisplay-VariableFont_wght.ttf',
  './fonts/Roboto-Italic-VariableFont_wdth,wght.ttf',
  './fonts/Roboto-VariableFont_wdth,wght.ttf'
];

const IMAGE_ASSETS = [
  './CircuitsImg/CircuitsA1.jpeg',
  './CircuitsImg/CircuitsA2.jpeg',
  './CircuitsImg/CircuitsA3.jpeg',
  './CircuitsImg/CircuitsA4.jpeg',
  './CircuitsImg/CircuitsA5.jpeg',
  './CircuitsImg/CircuitsA6.jpeg',
  './CircuitsImg/CircuitsA7.jpeg',
  './CircuitsImg/CircuitsQ1.jpeg',
  './CircuitsImg/CircuitsQ2.jpeg',
  './CircuitsImg/CircuitsQ3.jpeg',
  './CircuitsImg/CircuitsQ4.jpeg',
  './CircuitsImg/CircuitsQ5.jpeg',
  './CircuitsImg/CircuitsQ6.jpeg',
  './CircuitsImg/CircuitsQ7.jpeg'
];

const ICON_ASSETS = [
  './icons/achievement.svg',
  './icons/add copy.svg',
  './icons/add.svg',
  './icons/ai copy.svg',
  './icons/ai.svg',
  './icons/analysis.svg',
  './icons/art.svg',
  './icons/attempts-summary.svg',
  './icons/attempts.svg',
  './icons/back copy.svg',
  './icons/back.svg',
  './icons/bio.svg',
  './icons/biology.svg',
  './icons/browse.svg',
  './icons/cards-summary.svg',
  './icons/cards.svg',
  './icons/chemistry.svg',
  './icons/circuits.svg',
  './icons/classes.svg',
  './icons/clear.svg',
  './icons/cloud-off.svg',
  './icons/cloud-sync.svg',
  './icons/code.svg',
  './icons/computer-science.svg',
  './icons/computer.svg',
  './icons/copy.svg',
  './icons/default.svg',
  './icons/delete copy.svg',
  './icons/delete.svg',
  './icons/download.svg',
  './icons/email.svg',
  './icons/english.svg',
  './icons/error.svg',
  './icons/expand-less.svg',
  './icons/expand-more.svg',
  './icons/filipino.svg',
  './icons/flashcard.svg',
  './icons/forward.svg',
  './icons/geography.svg',
  './icons/google-connected.svg',
  './icons/google-disconnected.svg',
  './icons/headline.svg',
  './icons/history-icon.svg',
  './icons/history.svg',
  './icons/home.svg',
  './icons/import.svg',
  './icons/info.svg',
  './icons/innovation.svg',
  './icons/instructions.svg',
  './icons/law.svg',
  './icons/loading.svg',
  './icons/location.svg',
  './icons/management.svg',
  './icons/math.svg',
  './icons/music.svg',
  './icons/pause.svg',
  './icons/pdf-document.svg',
  './icons/pdf-generate.svg',
  './icons/pdf-text.svg',
  './icons/pdfs.svg',
  './icons/physics.svg',
  './icons/play.svg',
  './icons/profile-badge.svg',
  './icons/profile.svg',
  './icons/publish.svg',
  './icons/quiz copy.svg',
  './icons/quiz-code.svg',
  './icons/quiz-publish.svg',
  './icons/quiz-start.svg',
  './icons/quiz.svg',
  './icons/reference.svg',
  './icons/research.svg',
  './icons/save.svg',
  './icons/school.svg',
  './icons/science.svg',
  './icons/sets-summary.svg',
  './icons/sets.svg',
  './icons/settings.svg',
  './icons/start.svg',
  './icons/stats.svg',
  './icons/study-guide.svg',
  './icons/subjects-glyph.svg',
  './icons/subjects-summary.svg',
  './icons/subjects.svg',
  './icons/success.svg',
  './icons/themes.svg',
  './icons/thesis.svg',
  './icons/time.svg',
  './icons/timer-hide.svg',
  './icons/timer-show.svg',
  './icons/timer.svg',
  './icons/tips.svg',
  './icons/upload.svg',
  './icons/warning.svg',
  './icons/year-level.svg'
];

const PRECACHE_ASSETS = [
  ...new Set([
    ...CORE_ASSETS,
    ...FONT_ASSETS,
    ...ICON_ASSETS,
    ...IMAGE_ASSETS
  ])
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
      
      // Prevent caching non-http(s) requests (e.g., chrome-extension://)
      const url = new URL(event.request.url);
      if (!url.protocol.startsWith('http')) {
        return fetch(event.request).catch(() => caches.match('/index.html'));
      }
      
      return fetch(event.request)
        .then(response => {
          // cache fetched assets (basic strategy)
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone).catch(err => {
                console.warn('Cache put failed:', err.message);
              });
            });
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
