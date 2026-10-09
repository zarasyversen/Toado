// Keeps Toado usable offline: the app itself, and the last forecast it saw.
const CACHE = 'toado-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

/** Try the network, keep a copy, and fall back to the copy when offline. */
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw err;
  }
}

/** Drop built files the current page no longer uses, so old builds don't pile up. */
async function pruneAssets(html) {
  const used = new Set([...html.matchAll(/\/assets\/[^"'\s)]+/g)].map((m) => m[0]));
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !used.has(path)) await cache.delete(request);
  }
}

async function page(request) {
  const response = await networkFirst(request, '/');
  if (response.ok) response.clone().text().then(pruneAssets);
  return response;
}

/** Built files have hashed names, so a cached copy never goes stale. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Gemma answers are live or not at all.
  if (url.pathname.startsWith('/ollama')) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin || url.hostname.endsWith('open-meteo.com')) {
    // The manifest, icons and forecasts change without changing their names.
    event.respondWith(networkFirst(request));
  }
});
