const CACHE_NAME = 'campos-pass-shell-v4-safe';
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
const SENSITIVE_QUERY_RE = /^(token|access_token|refresh_token|password|passwd|secret|session|auth|authorization|api[_-]?key|key|code|credential|credentials)$/i;
const STATIC_PATHS = new Set(STATIC_ASSETS.map(asset => new URL(asset, self.registration.scope).pathname));

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_RE.test(key)) return true;
  }
  return false;
}

function isSafeRequest(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('authorization') || request.headers.has('cookie')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (PRIVATE_PATH_RE.test(url.pathname) || hasSensitiveQuery(url)) return false;
  return true;
}

function isStaticShellRequest(request) {
  if (!isSafeRequest(request)) return false;
  const url = new URL(request.url);
  if (url.search) return false;
  return STATIC_PATHS.has(url.pathname);
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
  if (!isSafeRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin' })
        .then(response => response)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (!isStaticShellRequest(request)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request, { credentials: 'same-origin' })
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
