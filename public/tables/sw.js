// Service worker. VERSION is stamped at build time (scripts/build.mjs), so every
// deploy installs a fresh cache and deletes the old one. The page asks the waiting
// worker to take over when the child isn't mid-round, then reloads.
const VERSION = '__VERSION__';
const CACHE = 'tables-' + VERSION;
const TTS_CACHE = 'tts-v1';   // not deleted on update
const OLD = k => k.startsWith('ttf-') || (k.startsWith('tables-') && k !== CACHE);   // 'ttf-': before the move to /tables/
const SHELL = [
  '/tables/',
  '/tables/css/styles.css?v=' + VERSION,
  '/tables/js/app.js?v=' + VERSION,
  '/tables/fonts/fredoka-latin-wght-normal.woff2',
  '/tables/manifest.webmanifest',
  '/tables/icons/icon.svg',
  '/tables/icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(OLD).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // read-aloud clips: kept across app versions, so each phrase downloads once and works offline
  if (e.request.method === 'GET' && url.origin === location.origin && url.pathname === '/api/tts') {
    e.respondWith(caches.open(TTS_CACHE).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    // Other pages under /tables/ (like /tables/about/) are plain web pages, not the app
    if (url.pathname !== '/tables/' && url.pathname !== '/tables/index.html') return;
    // The app is one page: serve this version's copy, so page, script and styles always match.
    e.respondWith(caches.open(CACHE).then(c => c.match('/tables/')).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(r => r || fetch(e.request)));
});

// Daily reminder (sent with no body by the reminders Worker)
self.addEventListener('push', e => {
  e.waitUntil(self.registration.showNotification('Your forest is waiting 🌳', {
    body: 'A few minutes of times tables will help your trees grow.',
    icon: '/tables/icons/icon-192.png', badge: '/tables/icons/icon-192.png', tag: 'daily-reminder',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(ws => (ws.length ? ws[0].focus() : self.clients.openWindow('/tables/'))));
});
