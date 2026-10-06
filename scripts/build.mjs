// Copies public/ to dist/ and stamps a version into the page and service worker,
// so each deploy busts browser and service-worker caches.
// Cloudflare Pages sets CF_PAGES_COMMIT_SHA; locally a timestamp is used.
import { cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const version = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 10) || 'dev' + Date.now().toString(36);
rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
const stamp = (file, token) => writeFileSync(file, readFileSync(file, 'utf8').replaceAll(token, version));
stamp('dist/tables/index.html', '__V__');
stamp('dist/tables/sw.js', '__VERSION__');
console.log('Built dist/ version', version);
