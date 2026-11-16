// Shared by the explainer pages written by script (How do fungi work?, What is soil?): questions answered for a
// five-year-old, grown-up words to tap, and diagrams with buttons, in the How does a tree work? page's style.
// In an answer, [shown words|grown-up word] makes the shown words tappable, lighting up their grown-up word.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export const esc = s => s.replace(/&(?![a-z#0-9]+;)/g, '&amp;');
export const slug = s => s.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// a diagram: { id, title, desc, svg, viewBox, buttons:[[state,label,caption]], note }
export function figure(f) {
  const first = f.buttons[0];
  return `<figure class="fig" id="fig-${f.id}" data-fig="${f.id}" data-state="${first[0]}"><figcaption class="fig-title" id="${f.id}-c">${f.title}</figcaption>` +
    `<svg viewBox="${f.viewBox || '0 0 400 262'}" role="img" aria-labelledby="${f.id}-c ${f.id}-d" focusable="false"><desc id="${f.id}-d">${f.desc}</desc>${f.svg}</svg>` +
    `<div class="ctl" role="group" aria-label="${f.title}">` +
    f.buttons.map(([s, label, say], i) => `<button type="button" data-state="${s}" data-say="${say}" aria-pressed="${i ? 'false' : 'true'}">${label}</button>`).join('') +
    `</div><p class="cap" aria-live="polite">${first[2]}</p><p class="fig-note">${f.note}</p></figure>`;
}

function answer(id, text) {
  let n = 0;
  const chips = [];
  const html = text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_, shown, word) => {
    if (shown.toLowerCase() === word.toLowerCase()) return shown;   // already the grown-up word
    n++;
    const k = `kw-${id}-${n}`, g = `gw-${id}-${n}`;
    chips.push(`<span class="gw" id="${g}" data-kw="${k}"><dfn>${word}</dfn><span class="sr"> is the grown-up word for</span><span aria-hidden="true"> =</span> ‘${shown}’</span>`);
    return `<span class="kw" id="${k}" data-gw="${g}" role="button" tabindex="0" aria-pressed="false" aria-describedby="${g}">${shown}</span>`;
  });
  return { html, chips };
}
export function topic([q, a]) {
  const id = slug(q), { html, chips } = answer(id, a);
  return `<article class="topic" id="${id}" itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><h3><span itemprop="name">${esc(q)}</span></h3>` +
    `<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">${esc(html)}</p></div>` +
    (chips.length ? `<p class="words"><span class="words-h">Grown-up words:</span> ${esc(chips.join(' '))}</p>` : '') + `</article>`;
}

// links to the other explainer pages open in a new tab
export const link = (href, text) => `<a target="_blank" rel="noopener" href="${href}">${text}</a>`;

// zones: [id, class, nav label, where, question, answer, items]. An item is [question, answer], or anything else,
// which render(item) turns into HTML. bg maps each zone class to the name of its background colour variable.
// extra(zoneId) can add HTML at the end of a zone (outside its content column).
export function writePage(o) {
  const { dir, zones, bg, render, extra = () => '' } = o;
  const sections = zones.map(([id, cls, , where, q, a, items], i) => {
    const prev = zones[i - 1], next = zones[i + 1], me = `var(--${bg[cls]}-bg)`;
    const top = `color-mix(in srgb,${prev ? `var(--${bg[prev[1]]}-bg)` : o.topBg || 'var(--sky-bg)'},${me})`;
    const style = `--top:${top}` + (next ? `;--bot:color-mix(in srgb,${me},var(--${bg[next[1]]}-bg))` : '');
    const body = items.map(it => Array.isArray(it) ? topic(it) : render(it)).join('');
    return `<section class="zone ${cls}" id="${id}" aria-labelledby="h-${id}" style="${style}"><div class="zone-in"><div class="zone-head" itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><p class="where">${where}</p><h2 id="h-${id}" itemprop="name">${esc(q)}</h2><div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">${esc(a)}</p></div></div><div class="topics">${body}</div></div>${extra(id)}</section>`;
  }).join('\n');
  const nQ = zones.reduce((s, z) => s + z[6].filter(Array.isArray).length + 1, 0);
  const t = typeof o.text === 'function' ? o.text(nQ) : o.text;
  const ld = [{
    '@context': 'https://schema.org', '@type': 'LearningResource', '@id': `https://learn.thetreefella.co.uk/${dir}/#learning`,
    url: `https://learn.thetreefella.co.uk/${dir}/`, isPartOf: { '@type': 'WebSite', name: 'The Learning Forest', url: 'https://learn.thetreefella.co.uk/' },
    name: t.h1, headline: t.headline, description: t.ldDescription,
    inLanguage: 'en-GB', isAccessibleForFree: true, keywords: t.keywords,
    learningResourceType: ['Explainer', 'Interactive diagram'], educationalLevel: 'Beginner',
    audience: { '@type': 'EducationalAudience', educationalRole: ['student', 'parent', 'teacher'] },
    teaches: zones.map(z => z[4]),
    author: { '@type': 'Organization', name: 'The Tree Fella', legalName: 'The Tree Fella NE Ltd', url: 'https://thetreefella.co.uk/' },
    publisher: { '@type': 'Organization', name: 'The Tree Fella', legalName: 'The Tree Fella NE Ltd', url: 'https://thetreefella.co.uk/' },
  }];
  const page = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${t.title}</title>
<meta name="description" content="${t.description}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="The Tree Fella">
<link rel="canonical" href="https://learn.thetreefella.co.uk/${dir}/">
<link rel="icon" href="/app/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
<meta name="theme-color" content="#F1F6E6">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="The Learning Forest">
<meta property="og:url" content="https://learn.thetreefella.co.uk/${dir}/">
<meta property="og:title" content="${t.ogTitle}">
<meta property="og:description" content="${t.ogDescription}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/chrome.css">
<link rel="stylesheet" href="/${dir}/${dir}.css">
<link rel="stylesheet" href="/trees/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<div class="lf-stick">
<!-- lf:header -->
<div class="bar">
  <div class="bar-in">
    <nav id="nav" aria-label="Sections">${zones.map(z => `<a href="#${z[0]}">${esc(z[2])}</a>`).join('')}</nav>
    <div class="progress" aria-hidden="true"><span id="progress"></span></div>
  </div>
</div>
</div>
<main id="main" tabindex="-1" itemscope itemtype="https://schema.org/FAQPage">
<section class="hero" aria-labelledby="t">
  <div class="hero-in">
    <div class="hero-copy">
      <h1 id="t">${t.h1}</h1>
      <p class="lede">${t.lede}</p>
      ${t.hint}
    </div>
    ${o.hero}
  </div>
</section>
${sections}
<section class="finish" aria-labelledby="finish-h">
  <div class="finish-in">
    ${t.finish}
  </div>
</section>
</main>
<!-- lf:footer -->
<button type="button" class="totop" id="totop" aria-label="Back to the top" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<script src="/trees/stick.js"></script>
<script src="/explainer.js"></script>${(o.scripts || []).map(s => `\n<script src="${s}"></script>`).join('')}
</body>
</html>
`;
  // the How does a tree work? page's own styles, copied each run so the pages match
  const trees = readFileSync('public/trees/index.html', 'utf8');
  const css = trees.slice(trees.indexOf('<style>') + 7, trees.indexOf('</style>'));
  mkdirSync(`public/${dir}`, { recursive: true });
  writeFileSync(`public/${dir}/${dir}.css`, `/* Copied from How does a tree work? by scripts/explainer.mjs, so the pages match. Don't edit here. */\n${css.trim()}\n` +
    `/* explainer pages */\n.hero .hint{max-width:34ch}\n.topic a{color:inherit;text-decoration-thickness:2px;text-underline-offset:3px}\n` +
    `/* ${dir} page */\n${(o.css || '').trim()}\n`);
  writeFileSync(`public/${dir}/index.html`, page);
  return nQ;
}
