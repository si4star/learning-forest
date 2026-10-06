// Imports the "How does a tree work?" page (a single HTML file written outside this repo) into
// public/trees/, adapted to this site:
//  - its inline script moves to public/trees/trees.js (the site's security policy runs no inline scripts)
//  - Google Analytics and its cookie banner come out (the site promises schools no tracking)
//  - Google Fonts are replaced by self-hosted copies (public/trees/fonts.css)
//  - addresses change from learn.thetreefella.co.uk/ to learn.thetreefella.co.uk/trees/
//  - The Learning Forest's header and footer replace the page's own (its section links and progress bar
//    stay, as a bar under the site header; the book credits move into its closing section)
//  - the sharing image and logo come out (the site's header carries the brand), and so do the Share
//    button and the links out to other sites in its closing section
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
  '<link rel="stylesheet" href="/chrome.css">\n<link rel="stylesheet" href="/trees/site.css">');

// sharing image: not used on this site
swap('og:image', /<meta property="og:image" [^>]*>\n/, '');
swap('og:image:width', /<meta property="og:image:width" [^>]*>\n/, '');
swap('og:image:height', /<meta property="og:image:height" [^>]*>\n/, '');
swap('og:image:alt', /<meta property="og:image:alt" [^>]*>\n/, '');
swap('twitter:image', /<meta name="twitter:image" [^>]*>\n/, '');
swap('twitter:card', /<meta name="twitter:card" content="summary_large_image">/, '<meta name="twitter:card" content="summary">');
html = html.replace(/,? ?"image": "https:\/\/learn\.thetreefella\.co\.uk\/og-image\.png"/g, '');

// icons: The Learning Forest's tree icon (the site only loads images from itself)
swap('icon', /<link rel="icon" href="https:\/\/thetreefella\.co\.uk[^"]*" sizes="270x270">/,
  '<link rel="icon" href="/app/icons/icon.svg" type="image/svg+xml">');
swap('apple icon', /<link rel="apple-touch-icon" href="https:\/\/thetreefella\.co\.uk[^"]*">/,
  '<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">');

// addresses: the page now lives at /trees/
html = html.replaceAll('https://learn.thetreefella.co.uk/#', HOME + '#');
html = html.replaceAll('"https://learn.thetreefella.co.uk/"', `"${HOME}"`);
// closing section: no sharing or outside links in a learning app module
swap('share line', / Know someone who’d rather doom-scroll a tree than the news\? Send it to them\./, '');
swap('share button', /\n    <p><button type="button" class="go" id="share">[\s\S]*?<\/p>/, '');
swap('outside links', /\n    <p>Got a real tree that needs looking after\?[\s\S]*?<\/p>/, '');
swap('share script', /\/\/ share\nconst URL_=[\s\S]*?\n\}\);\n/, '');
swap('link tracking', /\ndocument\.querySelectorAll\('a\[href\*="trees\.org\.uk"\]'\)[^\n]*\ndocument\.querySelectorAll\('a\[href\^="https:\/\/thetreefella\.co\.uk"\]'\)[^\n]*\n/, '\n');

// The Learning Forest's header and footer (put in at build time from public/_partials/)
swap('header', /<header class="bar">\n  <div class="bar-in">\n    <p class="brand">[\s\S]*?<\/p>\n(    <nav id="nav"[\s\S]*?<\/nav>\n    <div class="progress"[^\n]*<\/div>\n)    <a class="pro"[^\n]*<\/a>\n  <\/div>\n<\/header>/,
  '<div class="lf-stick">\n<!-- lf:header -->\n<div class="bar">\n  <div class="bar-in">\n$1  </div>\n</div>\n</div>');
let credits;
swap('footer', /<footer>\n  <div>\n    (<p>The topics follow two books[\s\S]*?<\/p>)\n[\s\S]*?<\/footer>\n/, (_, p) => { credits = p; return '<!-- lf:footer -->\n'; });
swap('credits', /(<section class="finish"[\s\S]*?)(\n  <\/div>\n<\/section>)/, (_, a, b) => a + '\n    ' + credits.replace('<p>', '<p class="sources">') + b);
swap('footer styles', /footer\{[^\n]*\}\nfooter div\{[^\n]*\}\nfooter p\{[^\n]*\}\n/, '');

// the browser bar (iPhone status bar area) matches the site header, not the page's blue sky
swap('theme-color light', /<meta name="theme-color" content="#CDE8F3" media="\(prefers-color-scheme: light\)">\n/, '<meta name="theme-color" content="#F1F6E6">\n');
swap('theme-color dark', /<meta name="theme-color" content="#13283A" media="\(prefers-color-scheme: dark\)">\n/, '');

// the site it belongs to
swap('title', /<title>How Does a Tree Work\? Tree Science for Kids \| The Tree Fella<\/title>/, '<title>How Does a Tree Work? Tree Science for Kids | The Learning Forest</title>');
swap('og:site_name', /<meta property="og:site_name" content="The Tree Fella">/, '<meta property="og:site_name" content="The Learning Forest">');
swap('isPartOf', /"isPartOf": \{"@type": "WebSite", "name": "The Tree Fella", "url": "https:\/\/thetreefella\.co\.uk\/"\}/,
  '"isPartOf": {"@type": "WebSite", "name": "The Learning Forest", "url": "https://learn.thetreefella.co.uk/"}');

// the page script moves to its own file
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>\n?/g)];
if (scripts.length !== 1) throw new Error(`expected 1 inline script after removing analytics, found ${scripts.length}`);
mkdirSync('public/trees', { recursive: true });
writeFileSync('public/trees/trees.js', '// How does a tree work? Page script, imported by scripts/import-trees.mjs.\n' + scripts[0][1].trim() + '\n');
html = html.replace(scripts[0][0], '<script src="/trees/stick.js"></script>\n<script src="/trees/trees.js"></script>\n');

if (/learn\.thetreefella\.co\.uk\/(?!trees\/|"\})/.test(html)) throw new Error('an address still points at the site root');
if (/<script(?![^>]*(src=|type="application\/ld\+json"))/.test(html)) throw new Error('an inline script is left');
if (/googletagmanager|gtag\(|fonts\.googleapis|fonts\.gstatic|localStorage|og-image|logo\.webp|wp-content\/uploads\/[^"]*270x270/.test(html)) throw new Error('a third-party or storage reference is left');

writeFileSync('public/trees/index.html', html);
console.log('Wrote public/trees/index.html and public/trees/trees.js');
