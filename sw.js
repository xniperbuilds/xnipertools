/* Xnipertools service worker — minimal, network-first, NO content caching (avoids stale tools).
   Only caches a tiny offline fallback page + icons. Bump VERSION to force cleanup. */
var VERSION = 'xt-v1';
var OFFLINE = '/offline.html';
var PRECACHE = [OFFLINE, '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(PRECACHE); }).catch(function(){}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // never touch POST etc.
  // Page navigations: try network, fall back to a friendly offline page when truly offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () { return caches.match(OFFLINE); })
    );
    return;
  }
  // Everything else (CSS/JS/images): pure network — let the browser's normal HTTP cache handle it.
  // Only fall back to the SW cache for our precached icons when offline.
  e.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
