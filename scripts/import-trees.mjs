// Imports the "How does a tree work?" page (a single HTML file written outside this repo) into
// public/trees/, adapted to this site:
//  - its inline script moves to public/trees/trees.js (the site's security policy runs no inline scripts)
//  - Google Analytics and its cookie banner come out (the site promises schools no tracking)
//  - Google Fonts are replaced by self-hosted copies (public/trees/fonts.css)
//  - addresses change from learn.thetreefella.co.uk/ to learn.thetreefella.co.uk/trees/
//  - a link back to The Learning Forest goes above its header, and the site's small print in its footer
// Every replacement must match exactly once, so a changed source page fails loudly instead of half-importing.
// Usage: node scripts/import-trees.mjs path/to/index.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('Usage: node scripts/import-trees.mjs path/to/index.html');
let html = readFileSync(src, 'utf8');

function swap(name, pattern, replacement) {
  const n = (html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) || []).length;
  if (n !== 1) throw new Error(`${name}: expected 1 match, found ${n}`);
  html = html.replace(pattern, replacement);
}

const HOME = 'https://learn.thetreefella.co.uk/trees/';

// analytics: the consent-mode bootstrap in <head>, the cookie banner, and the banner's script
swap('analytics bootstrap', /<script>\s*window\.dataLayer=[\s\S]*?<\/script>\n/, '');
swap('cookie banner', /<div class="consent" id="consent"[\s\S]*?<\/div>\n/, '');
swap('track()', /\/\/ analytics events[^\n]*\nfunction track\(event,params\)\{[^\n]*\}\n/,
  '// Analytics removed on this site; diagrams still call track(), which does nothing.\nfunction track(){}\n');
swap('cookie choice', /\/\/ cookie choice\n\(\(\)=>\{const c=document\.getElementById\('consent'\)[\s\S]*?\}\)\)\}\)\(\);\n/, '');

// fonts and third-party connections
swap('preconnect fonts', /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/, '');
swap('preconnect gtm', /<link rel="preconnect" href="https:\/\/www\.googletagmanager\.com">\n/, '');
swap('preconnect gstatic', /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/, '');
swap('google fonts', /<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/,
  '<link rel="stylesheet" href="/trees/site.css">');

// icons and images (the site only loads images from itself): The Learning Forest's tree icon, and the
// logo and sharing image copied into public/trees/
swap('icon', /<link rel="icon" href="https:\/\/thetreefella\.co\.uk[^"]*" sizes="270x270">/,
  '<link rel="icon" href="/app/icons/icon.svg" type="image/svg+xml">');
swap('apple icon', /<link rel="apple-touch-icon" href="https:\/\/thetreefella\.co\.uk[^"]*">/,
  '<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">');
swap('logo', /<img src="\/logo\.webp"/, '<img src="/trees/logo.webp"');

// addresses: the page now lives at /trees/
html = html.replaceAll('https://learn.thetreefella.co.uk/og-image.png', HOME + 'og-image.png');
html = html.replaceAll('https://learn.thetreefella.co.uk/#', HOME + '#');
html = html.replaceAll('"https://learn.thetreefella.co.uk/"', `"${HOME}"`);
swap('share link', /const URL_='https:\/\/learn\.thetreefella\.co\.uk\/'/, `const URL_='${HOME}'`);
if (/learn\.thetreefella\.co\.uk\/(?!trees\/)/.test(html)) throw new Error('an address still points at the site root');

// The Learning Forest: link home, and the site's small print
swap('header', /<header class="bar">/,
  '<p class="lf-strip"><a href="/">‹ The Learning Forest</a></p>\n<header class="bar">');
swap('footer company line', /<p>The Tree Fella NE Ltd, trading as The Tree Fella®, is registered in England &amp; Wales\. Company number 11632007\.<\/p>/,
  '<p>How does a tree work? is part of <a href="/">The Learning Forest</a>, made by The Tree Fella.</p>\n' +
  '    <p class="small-print">The Tree Fella NE Ltd trading as The Tree Fella® is registered in England &amp; Wales Company Number 11632007. We are registered with the Information Commissioner\'s Office (ICO) &amp; our registration number is ZA845692. We are registered for VAT &amp; our registration number is GB341407236.</p>');

// the page script moves to its own file
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>\n?/g)];
if (scripts.length !== 1) throw new Error(`expected 1 inline script after removing analytics, found ${scripts.length}`);
mkdirSync('public/trees', { recursive: true });
writeFileSync('public/trees/trees.js', '// How does a tree work? Page script, imported by scripts/import-trees.mjs.\n' + scripts[0][1].trim() + '\n');
html = html.replace(scripts[0][0], '<script src="/trees/trees.js"></script>\n');

if (/<script(?![^>]*(src=|type="application\/ld\+json"))/.test(html)) throw new Error('an inline script is left');
if (/googletagmanager|gtag\(|fonts\.googleapis|fonts\.gstatic|localStorage/.test(html)) throw new Error('a third-party or storage reference is left');

writeFileSync('public/trees/index.html', html);
console.log('Wrote public/trees/index.html and public/trees/trees.js');
