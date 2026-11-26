const CACHE_NAME = 'asvath-box-shell-v16';
const APP_SHELL = ['/', '/index.html', '/css/app.css', '/css/forms.css', '/css/variations.css', '/css/export-menu.css', '/css/asset-actions.css', '/css/quantity.css', '/css/pwa.css', '/css/theme-toggle.css', '/css/theme-light.css', '/js/app.js', '/js/store.js', '/js/theme-toggle.js', '/manifest.json', '/icons/asvath-logo-transparent.png', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/', response.clone()));
      return response;
    }).catch(() => caches.match('/') || caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => {
    const update = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    });
    return cached || update;
  }));
});

