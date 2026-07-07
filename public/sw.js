const CACHE_VERSION = 'v3';
const CACHE_NAME = `arabic-flashcards-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/';

// Assets that must be cached for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/review',
];

// Patterns for assets to cache dynamically
const CACHE_PATTERNS = {
  static: /\/_next\/static\//,
  images: /\.(png|jpg|jpeg|svg|gif|ico)$/,
  fonts: /\.(woff|woff2|ttf|otf)$/,
  scripts: /\.(js)$/,
  styles: /\.(css)$/,
};

// Skip these patterns
const SKIP_PATTERNS = [
  /\/api\//,
  /\/_next\/image/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('arabic-flashcards-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests (also excludes chrome-extension:// etc.)
  if (url.origin !== self.location.origin) return;

  // Never cache in local development -- stale JS/CSS chunks break pages
  // after rebuilds.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // Skip if matches skip patterns
  if (SKIP_PATTERNS.some(pattern => pattern.test(request.url))) return;

  // Network-first strategy for HTML documents
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((response) => response || caches.match(OFFLINE_PAGE));
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  if (Object.values(CACHE_PATTERNS).some(pattern => pattern.test(request.url))) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }

          return fetch(request).then((response) => {
            if (!response.ok) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache));

            return response;
          });
        })
    );
    return;
  }

  // Network-only for everything else
  event.respondWith(fetch(request));
});