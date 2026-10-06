// Service worker. VERSION is stamped at build time (scripts/build.mjs), so every
// deploy installs a fresh cache and deletes the old one. The page asks the waiting
// worker to take over when the child isn't mid-round, then reloads.
const VERSION = '__VERSION__';
const CACHE = 'lf-' + VERSION;
const OLD = k => k.startsWith('ttf-') || k.startsWith('tables-') || k.startsWith('tts-') || (k.startsWith('lf-') && k !== CACHE);   // ttf-, tables-: from before the app's moves; tts-: the old read-aloud clips
const SHELL = [
  '/app/',
  '/app/css/styles.css?v=' + VERSION,
  '/app/js/app.js?v=' + VERSION,
  '/app/fonts/fredoka-latin-wght-normal.woff2',
  '/app/manifest.webmanifest',
  '/app/icons/icon.svg',
  '/app/icons/icon-192.png',
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
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    // The app is only /app/ itself; any other page under /app/ is a plain web page
    if (url.pathname !== '/app/' && url.pathname !== '/app/index.html') return;
    // The app is one page: serve this version's copy, so page, script and styles always match.
    e.respondWith(caches.open(CACHE).then(c => c.match('/app/')).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(r => r || fetch(e.request)));
});

// Daily reminder (sent with no body by the reminders Worker)
self.addEventListener('push', e => {
  e.waitUntil(self.registration.showNotification('Your forest is waiting 🌳', {
    body: 'A few minutes of times tables will help your trees grow.',
    icon: '/app/icons/icon-192.png', badge: '/app/icons/icon-192.png', tag: 'daily-reminder',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(ws => (ws.length ? ws[0].focus() : self.clients.openWindow('/app/'))));
});
