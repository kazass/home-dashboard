const CACHE_NAME = 'home-dashboard-v3-redesign-2';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/redesign.css',
  './js/runtime.js',
  './js/ui-icons.js',
  './fonts/Manrope.woff2',
  './fonts/InstrumentSerif.woff2',
  './js/actions.js',
  './js/workspace.js',
  './js/today.js',
  './js/app.js',
  './js/db.js',
  './js/weather.js',
  './js/holidays.js',
  './js/calendar.js',
  './js/dashboard.js',
  './js/notes.js',
  './js/shopping.js',
  './js/homework.js',
  './js/scheduling.js',
  './js/maintenance.js',
  './js/tasks.js',
  './js/ideas.js',
  './js/garden.js',
  './js/recipes.js',
  './js/search.js',
  './js/backup.js',
  './js/decide.js',
  './js/changelog.js',
  './js/settings.js',
  './js/layout.js',
  './js/digest.js',
  './js/goal.js',
  './js/points.js',
  './js/activities.js',
  './js/stats.js',
  './js/dailyStatus.js',
  './js/game.js',
  './js/screensaver.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('home-dashboard-v3-redesign-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin app files, so a new deploy is picked up on next load
// instead of being stuck behind a stale cache. Falls back to cache when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, copy);
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
