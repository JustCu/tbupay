const CACHE_NAME = "tbu-pay-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./logo.png",
  "./avatar_placeholder.png"
];

// Install Event - Pre-cache Core Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for robust SPA experience
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and local assets/APIs
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // If it is a navigation request (page load/refresh), prioritize network but fallback to index.html on cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If successful, cache a copy of index.html
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline or network fails, return cached index.html for smooth client-side routing
          return caches.match("./index.html") || caches.match("./");
        })
    );
    return;
  }

  // General Assets: Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the newest response if it's a valid local asset
        if (response.status === 200 && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: attempt to retrieve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache and it is an image, we can return a fallback or placeholder
          if (event.request.headers.get("accept").includes("image")) {
            return caches.match("./avatar_placeholder.png") || caches.match("./logo.png");
          }
        });
      })
  );
});
