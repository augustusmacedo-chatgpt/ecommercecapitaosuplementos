const CACHE_NAME = 'niegpt-pdv-shell-v4';
const APP_SHELL = ['/pdv', '/manifest.webmanifest', '/pdv-niegpt-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function updateCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isCatalog = url.pathname === '/api/bling/products';
  const isStaticAsset = url.pathname.startsWith('/assets/') || url.pathname === '/pdv' || event.request.mode === 'navigate';

  if (isCatalog) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        event.waitUntil(updateCache(event.request).catch(() => undefined));
        return cached;
      }

      try {
        return await updateCache(event.request);
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return (await caches.match('/pdv')) || Response.error();
        return Response.error();
      })
  );
});
