const CACHE_NAME = 'iac-airdrop-v1';
const urlsToCache = [
  'index.html',
  'style.css',
  'erdrop.js',
  'manifest.json',
  'icons/iconsiac-192x192.png',
  'icons/iconsiac-512x512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })))
  );
});
