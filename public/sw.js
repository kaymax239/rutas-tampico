const CACHE_REFRESH_VERSION = "2026-06-06-dae3047";
self.__RUTAS_TAMPICO_CACHE_REFRESH_VERSION = CACHE_REFRESH_VERSION;

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            return caches.delete(cacheName);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function () {
  return;
});