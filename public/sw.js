// AulaIA · service worker mínimo para poder instalarla como app.
// No guarda la aplicación en caché (así siempre se ve la última versión);
// solo muestra un aviso si no hay conexión.
const OFFLINE = "/offline.html";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("aulaia-offline-v1").then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== "aulaia-offline-v1").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // todo lo demás va directo a la red
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
