// Retires an old service worker. The app moved from / to /app/ and then to /tables/;
// devices that installed it before still have a worker registered at / or /app/.
// This replacement (served at both paths) clears the old caches, unregisters itself and
// reloads open windows, which are then sent on to /tables/. It leaves the new app's
// caches ('tables-', 'tts-') alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ttf-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
