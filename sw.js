const CACHE_NAME = 'campos-pass-v1';
const OFFLINE_URL = './';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './icon-512-maskable.svg'
];

const PRIVATE_PATH_RE = /\/(api|auth|login|logout|admin|session|sessions|token|tokens|account|profile|me)(\/|$)/i;

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (PRIVATE_PATH_RE.test(url.pathname)) return false;
  return true;
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isCacheableRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match(OFFLINE_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
