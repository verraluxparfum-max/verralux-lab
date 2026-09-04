const CACHE_NAME = 'verralux-lab-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/seed-ingredients.js',
  './js/seed-ifra.js',
  './js/ui.js',
  './js/library-ingredients.js',
  './js/library-accords.js',
  './js/library-references.js',
  './js/library.js',
  './js/rd-ingredient-studies.js',
  './js/rd-accord-development.js',
  './js/rd-clone-trials.js',
  './js/rd-original-composition.js',
  './js/rd-fixative-trials.js',
  './js/rd-modifier-trials.js',
  './js/rd-formula-lock.js',
  './js/rd.js',
  './js/journal-batch.js',
  './js/journal-compounding.js',
  './js/journal-maceration.js',
  './js/journal-qc.js',
  './js/journal-release.js',
  './js/journal.js',
  './js/reports.js',
  './js/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => cached)
    )
  );
});