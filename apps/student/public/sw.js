/* Little Ants Listening (student app) service worker.
 * - App shell: every screen is a static route (state lives in the query string and on the device), so caching
 *   each route once lets the app open offline.
 * - /_next/static files are immutable: cache first.
 * - Media saved by "Download for offline" lives in the la-media-v1 cache and is served from there first.
 * - API calls always go to the network (the app keeps its own offline copies in IndexedDB).
 */
// The app registers /sw.js?v=<build id>, so every deploy installs a fresh worker and drops old caches.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL_CACHE = `la-listen-shell-${VERSION}`;
const STATIC_CACHE = `la-listen-static-${VERSION}`;
const MEDIA_CACHE = 'la-media-v1';
const ROUTES = ['/', '/signin'];
const FILES = [
  '/manifest.webmanifest',
  '/favicon.png',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
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
  // Media downloaded for offline listening (any origin: R2 media domain or the API's file store).
  event.respondWith(
    (async () => {
      const media = await caches.open(MEDIA_CACHE);
      const hit = await media.match(request.url);
      return hit ? rangeOf(request, hit) : fetch(request);
    })(),
  );
});

/**
 * <audio> asks for byte ranges, and Safari only plays a recording answered with 206 Partial Content, so a cached
 * file is cut to the requested range.
 */
async function rangeOf(request, response) {
  const header = request.headers.get('range');
  const match = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return response;
  const blob = await response.blob();
  const size = blob.size;
  let start = match[1] === '' ? NaN : Number(match[1]);
  let end = match[2] === '' ? size - 1 : Number(match[2]);
  if (Number.isNaN(start)) {
    // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - end);
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  if (start >= size || start > end)
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || blob.type || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
