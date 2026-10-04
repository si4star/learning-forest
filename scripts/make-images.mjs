// Generates the PWA icons and the iPhone/iPad launch (splash) screens from icons/icon.svg,
// and writes the matching <link rel="apple-touch-startup-image"> tags into index.html.
// Android draws its own splash from the manifest (background_color + 512px icon).
// Run after changing the artwork:  node scripts/make-images.mjs   (CHROMIUM=path to override)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const BG = '#E8F0E0', INK = '#1E2B1A';
// Portrait CSS size × pixel ratio for each iPhone/iPad screen shape
const DEVICES = [
  [375, 667, 2],   // iPhone SE (2nd/3rd), 8
  [414, 736, 3],   // iPhone 8 Plus
  [375, 812, 3],   // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2],   // iPhone XR, 11
  [414, 896, 3],   // iPhone XS Max, 11 Pro Max
  [390, 844, 3],   // iPhone 12, 13, 14, 16e
  [428, 926, 3],   // iPhone 12/13 Pro Max, 14 Plus
  [393, 852, 3],   // iPhone 14 Pro, 15, 15 Pro, 16
  [430, 932, 3],   // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3],   // iPhone 16 Pro, 17, 17 Pro
  [440, 956, 3],   // iPhone 16 Pro Max, 17 Pro Max
  [420, 912, 3],   // iPhone Air
  [744, 1133, 2],  // iPad mini (6th+)
  [810, 1080, 2],  // iPad (7th–9th)
  [820, 1180, 2],  // iPad (10th+), iPad Air (4th–5th)
  [834, 1194, 2],  // iPad Pro 11", iPad Air 11"
  [834, 1210, 2],  // iPad Pro 11" (M4)
  [1024, 1366, 2], // iPad Pro 12.9", iPad Air 13"
  [1032, 1376, 2], // iPad Pro 13" (M4)
];

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const square = svg.replace('rx="5.5" ', '');                                   // full bleed: Apple and maskable
const maskable = square.replace('translate(2.4 1.6) scale(.8)', 'translate(4.2 3.6) scale(.65)');
const tree = svg.replace(/<rect[^>]*\/>/, '');                                 // tree only, for splash screens
const font = readFileSync('public/fonts/fredoka-latin-wght-normal.woff2').toString('base64');

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();

for (const [file, size, src] of [
  ['icon-192.png', 192, svg], ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, maskable], ['apple-touch-icon.png', 180, square],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`);
  await page.screenshot({ path: 'public/icons/' + file, omitBackground: true });
}

rmSync('public/splash', { recursive: true, force: true });
mkdirSync('public/splash');
const links = [];
for (const [w, h, dpr] of DEVICES) {
  for (const orientation of ['portrait', 'landscape']) {
    const [vw, vh] = orientation === 'portrait' ? [w, h] : [h, w];
    const file = `splash/${vw * dpr}x${vh * dpr}.png`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    const s = Math.round(Math.min(vw, vh) * 0.36);
    await p.setContent(`<style>
      @font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700}
      html,body{margin:0;height:100%;background:${BG}}
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(s * 0.12)}px;font-family:F}
      svg{width:${s}px;height:${s}px}
      h1{margin:0;color:${INK};font-weight:700;font-size:${Math.round(s * 0.2)}px;letter-spacing:-.01em}
    </style>${tree}<h1>Times Table Forest</h1>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: 'public/' + file });
    await ctx.close();
    links.push(`<link rel="apple-touch-startup-image" href="${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})">`);
  }
}
await browser.close();

const html = readFileSync('public/index.html', 'utf8');
const out = html.replace(/<!-- splash:start -->[\s\S]*<!-- splash:end -->/,
  `<!-- splash:start -->\n${links.join('\n')}\n<!-- splash:end -->`);
if (out === html && !html.includes(links[0])) throw new Error('splash markers missing from index.html');
writeFileSync('public/index.html', out);
console.log(`Wrote 4 icons and ${links.length} splash screens`);
