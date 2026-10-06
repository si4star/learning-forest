// The app moved from / to /app/. Devices that installed it before the move still have a
// service worker registered at /. This replacement clears its caches, unregisters it and
// reloads open windows, which the home page then sends on to /app/.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ttf-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
