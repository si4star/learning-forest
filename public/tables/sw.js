// Retires an old service worker. The app was at /, then /app/, then /tables/, and is now
// The Learning Forest app at /app/. Devices that installed it at / or /tables/ still have a
// worker there. This replacement (served at both paths) clears the old caches, unregisters
// itself and reloads open windows, which are then sent on to /app/. It leaves the current
// app's caches ('lf-', 'tts-') alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ttf-') || k.startsWith('tables-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
