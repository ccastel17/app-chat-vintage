// Service worker mínimo — necesario para que Chrome/Safari ofrezcan
// "Instalar app". No implementa caché offline compleja todavía; se puede
// ampliar más adelante si el wifi del set es poco confiable.

const CACHE_NAME = "chat-rodaje-v1";
const APP_SHELL = ["/", "/device/", "/control/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: network-first con fallback a caché, para que en rodaje con
// wifi inestable la interfaz no se rompa aunque el dato en tiempo real falle.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
