const CACHE_NAME = 'capitao-shell-v2';
const APP_SHELL = ['/pdv', '/manifest.webmanifest', '/Logo_Capitao_Esportivo.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isCatalog = url.pathname === '/api/bling/products';
  const isStaticAsset = url.pathname.startsWith('/assets/') || url.pathname === '/pdv' || event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && (isCatalog || isStaticAsset)) {
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())));
        }
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