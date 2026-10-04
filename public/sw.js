// Service worker. VERSION is stamped at build time (scripts/build.mjs), so every
// deploy installs a fresh cache and deletes the old one. The page asks the waiting
// worker to take over when the child isn't mid-round, then reloads.
const VERSION = '__VERSION__';
const CACHE = 'ttf-' + VERSION;
const SHELL = [
  '/',
  '/css/styles.css?v=' + VERSION,
  '/js/app.js?v=' + VERSION,
  '/fonts/fredoka-latin-wght-normal.woff2',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ttf-') && k !== CACHE).map(k => caches.delete(k))))
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
    // The app is one page: serve this version's copy, so page, script and styles always match.
    e.respondWith(caches.open(CACHE).then(c => c.match('/')).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(r => r || fetch(e.request)));
});
