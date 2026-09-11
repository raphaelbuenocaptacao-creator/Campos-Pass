const CACHE_PREFIX = 'campos-pass-';
const CACHE_NAME = `${CACHE_PREFIX}v10-range-vary-safe-shell`;
const OFFLINE_URL = './';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
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
  if (request.headers.has('range') || request.headers.has('if-range')) return false;
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

function variesPrivate(response) {
  const vary = (response.headers.get('vary') || '').toLowerCase();
  return vary.split(',').some(value => {
    const key = value.trim();
    return key === '*' || key === 'cookie' || key === 'authorization' || key === 'range' || key === 'if-range';
  });
}

function responseIsCacheable(response) {
  if (!response || !response.ok || response.status === 206 || response.type !== 'basic') return false;
  if (response.redirected || response.headers.has('content-range')) return false;
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  if (cacheControl.includes('private') || cacheControl.includes('no-store')) return false;
  if (response.headers.has('set-cookie') || variesPrivate(response)) return false;
  return true;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(STATIC_ASSETS.map(async asset => {
      const request = new Request(asset, { credentials: 'omit', cache: 'reload', redirect: 'error' });
      const response = await fetch(request);
      if (responseIsCacheable(response)) await cache.put(request, response.clone());
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isSafeRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' })
        .then(response => response)
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        })
    );
    return;
  }

  if (!isStaticShellRequest(request)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    try {
      const response = await fetch(request, { credentials: 'omit', cache: 'no-cache', redirect: 'error' });
      if (responseIsCacheable(response)) await cache.put(request, response.clone());
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
