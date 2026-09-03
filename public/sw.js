const CACHE_NAME = 'kineto-agenda-v13';
const SHELL_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/dashboard/calendar',
  '/dashboard/patients',
  '/dashboard/reports',
  '/dashboard/settings',
  '/manifest.json'
];

// Install: cache the app shell so navigation is instant even on poor networks.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each asset individually so one failure doesn't abort everything.
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((response) => {
              if (response.ok) return cache.put(url, response);
            })
            .catch(() => { /* ignore missing/offline assets during install */ })
        )
      );
    })
  );
});

// Activate: delete old caches and claim clients immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: is this an app HTML page?
function isAppPage(url) {
  return (
    url.pathname === '/' ||
    url.pathname === '/login' ||
    url.pathname.startsWith('/dashboard')
  );
}

// Helper: is this a static asset?
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json')
  );
}

// Fetch: network-first for HTML pages (never serve stale app shell),
// cache-first for static hashed assets.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    return;
  }

  // Pe localhost/dezvoltare nu folosim cache pentru a vedea modificările instant
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Manifest: always network-first so the browser/PWA sees updated metadata.
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request, { credentials: 'same-origin' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {})).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => {
            return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
          })
        )
    );
    return;
  }

  // App HTML pages: always try network first, fall back to cache only offline.
  if (isAppPage(url)) {
    event.respondWith(
      fetch(request, { credentials: 'same-origin' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {})).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => {
            return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
          })
        )
    );
    return;
  }

  // Static assets: cache-first, then network fallback.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            const clone = response.clone();
            cache.put(request, clone).catch(() => {});
          }
          return response;
        } catch (err) {
          return new Response('Not found', { status: 404, statusText: 'Not found' });
        }
      })
    );
    return;
  }
});

// Messages from the app (manual cache clear / skip waiting).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      }).then(() => {
        event.source?.postMessage({ type: 'CACHES_CLEARED' });
      })
    );
  }
});

// Mobile Notification Click Handler — opens or focuses the app when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Push event handler (pentru notificări Web Push în fundal / ecran blocat)
self.addEventListener('push', (event) => {
  let data = { title: '🔔 Agendă Kineto', body: 'Ai o nouă actualizare în program.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'kineto-push-alert',
    data: { url: data.url || '/dashboard' },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
