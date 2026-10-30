/* Little Ants Teacher service worker.
 * - App shell: every screen is a static route (state lives in the query string), so caching each route once
 *   lets every lesson open offline.
 * - /_next/static files are immutable: cache first.
 * - Media saved by "Download unit" lives in the la-media-v1 cache and is served from there first.
 * - API calls always go to the network (the app keeps its own offline copies in IndexedDB).
 */
// The app registers /sw.js?v=<build id>, so every deploy installs a fresh worker and drops old caches.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL_CACHE = `la-shell-${VERSION}`;
const STATIC_CACHE = `la-static-${VERSION}`;
const MEDIA_CACHE = 'la-media-v1';
const ROUTES = [
  '/',
  '/unit',
  '/teach',
  '/prepare',
  '/observe',
  '/present',
  '/print',
  '/preview',
  '/listening',
  '/tv-help',
];
const FILES = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-horizontal.webp',
  '/pdf.worker.min.mjs',
];

async function cacheShell() {
  const shell = await caches.open(SHELL_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  for (const route of ROUTES) {
    try {
      const response = await fetch(route, { cache: 'no-store' });
      if (!response.ok) continue;
      const html = await response.clone().text();
      await shell.put(route, response);
      const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
      await Promise.all(
        [...assets].map(async (url) => {
          if (await statics.match(url)) return;
          const asset = await fetch(url);
          if (asset.ok) await statics.put(url, asset);
        }),
      );
    } catch {
      // Offline during install: the next online visit fills the cache.
    }
  }
  await Promise.all(
    FILES.map(async (file) => {
      try {
        const response = await fetch(file);
        if (response.ok) await shell.put(file, response);
      } catch {
        /* ignore */
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE]);
      for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'refresh-shell') event.waitUntil(cacheShell());
});

async function navigate(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const shell = await caches.open(SHELL_CACHE);
      await shell.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(url.pathname, { ignoreSearch: true })) || (await caches.match('/'));
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (FILES.includes(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
    return;
  }
  // Media downloaded for offline teaching (any origin: R2 media domain or the API's file store).
  event.respondWith(
    (async () => {
      const media = await caches.open(MEDIA_CACHE);
      const hit = await media.match(request.url);
      return hit || fetch(request);
    })(),
  );
});
