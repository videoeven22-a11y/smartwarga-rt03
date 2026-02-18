const CACHE_NAME = 'smartwarga-v3'; // Updated cache version to force refresh

// Only cache specific static assets, NOT _next chunks
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - DO NOT cache _next chunks or API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for _next static chunks and API routes
  if (url.pathname.startsWith('/_next/') || 
      url.pathname.startsWith('/api/') ||
      url.pathname.includes('.js') ||
      url.pathname.includes('.css')) {
    // Always fetch from network for these resources
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For other resources, try cache first
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
  );
});

// Activate event - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL old caches
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});
