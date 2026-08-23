const CACHE_NAME = 'home-dashboard-v14';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
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
  './js/backup.js',
  './js/decide.js',
  './js/changelog.js',
  './js/settings.js',
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
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
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
