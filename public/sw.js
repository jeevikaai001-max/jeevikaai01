// JeevikaAI Service Worker v3.0.0 - App Shell Offline Support & Background Web Push
// Never intercepts POST requests, cross-origin AI calls, or /api/* endpoints.

const STATIC_CACHE_NAME = 'jeevika-static-v3.0.0';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== STATIC_CACHE_NAME && name !== 'jeevika-data-v3.0.0') {
              return caches.delete(name);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // NEVER intercept non-GET requests (POST /api/chat, /api/generate-location-data, /api/push/*, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // NEVER intercept cross-origin requests (Cloudflare Worker, Nominatim, BigDataCloud, Firebase, OSM)
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER intercept any /api/* routes so live AI and push APIs are always fresh
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests: Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Same-origin static assets: Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

// Background Web Push event (fires even when PWA / browser tab is closed)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'JeevikaAI Update',
    body: 'आपके लिए नई आजीविका सूचना उपलब्ध है।',
    url: '/',
    tag: 'jeevika-push-' + Date.now(),
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || '/',
        tag: parsed.tag || parsed.id || payload.tag,
      };
    } catch {
      const txt = event.data.text();
      if (txt) payload.body = txt;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: payload.tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Direct client-to-SW notification bridge (required for Android Chrome & standalone PWA notifications)
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (msg.type === 'SHOW_NOTIFICATION' && msg.title) {
    event.waitUntil(
      self.registration.showNotification(String(msg.title), {
        body: String(msg.body || ''),
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        tag: String(msg.tag || 'jeevika-alert-' + Date.now()),
        renotify: true,
        vibrate: [180, 90, 180],
        data: { url: String(msg.url || '/') },
      })
    );
  }
});

// Focus existing PWA window or open target URL when citizen taps notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (targetUrl && targetUrl !== '/' && 'navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
