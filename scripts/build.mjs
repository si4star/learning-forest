// Copies public/ to dist/ and stamps a version into the page and service worker,
// so each deploy busts browser and service-worker caches.
// Cloudflare Pages sets CF_PAGES_COMMIT_SHA; locally a timestamp is used.
// Website pages get the shared header and footer (public/_partials/) in place of
// <!-- lf:header --> and <!-- lf:footer -->; the app (/app/) has its own screens.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const version = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 10) || 'dev' + Date.now().toString(36);
rmSync('dist', { recursive: true, force: true });
cpSync('public', 'dist', { recursive: true });
const stamp = (file, token) => writeFileSync(file, readFileSync(file, 'utf8').replaceAll(token, version));
stamp('dist/app/index.html', '__V__');
stamp('dist/app/sw.js', '__VERSION__');

const parts = { header: readFileSync('public/_partials/header.html', 'utf8').trim(), footer: readFileSync('public/_partials/footer.html', 'utf8').trim() };
rmSync('dist/_partials', { recursive: true });
const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'app' && dir === 'dist' ? [] : pages(join(dir, e.name))) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);
let n = 0;
for (const file of pages('dist')) {
  const html = readFileSync(file, 'utf8');
  if (!html.includes('<!-- lf:header -->')) continue;   // e.g. the /tables/ redirect page
  if (!html.includes('<!-- lf:footer -->')) throw new Error(`${file} has the header marker but not the footer marker`);
  writeFileSync(file, html.replace('<!-- lf:header -->', parts.header).replace('<!-- lf:footer -->', parts.footer));
  n++;
}
console.log('Built dist/ version', version, `(header and footer on ${n} pages)`);
