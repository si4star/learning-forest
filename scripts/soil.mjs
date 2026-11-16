// What is soil?: writes public/soil/index.html and public/soil/soil.css (see scripts/explainer.mjs).
// The page digs down as you scroll: grass and fallen leaves at the bottom of a tree, mulch, topsoil, subsoil, rock.
// Creatures hide at the edges of the sections (public/soil/soil.js lets you tap them).
// Run `node scripts/soil.mjs` after changing anything.
import { figure, writePage, link } from './explainer.mjs';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f1 = n => n.toFixed(1);

// ---------- creatures, drawn facing right round (0,0), about 80 × 50 ----------
const legs = (xs, y, dy, col, w = 1.6) => xs.map(x => `<path d="M${x} ${y} l${-2} ${dy}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
const C = {
  woodlouse: () => legs([-14, -8, -2, 4, 10, 16], 10, 6, '#4E5258') +
    `<ellipse cx="0" cy="0" rx="24" ry="13" fill="#7B7F86"/>` + [-15, -9, -3, 3, 9, 15].map(x => `<path d="M${x} -12 Q${x + 3} 0 ${x} 12" stroke="#5E6268" stroke-width="2" fill="none"/>`).join('') +
    `<ellipse cx="24" cy="0" rx="6" ry="8" fill="#5E6268"/><path d="M28 -4 q10 -9 17 -5 M28 4 q10 9 17 5" stroke="#5E6268" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  millipede: () => { let o = ''; for (let i = 0; i < 13; i++) { const x = -32 + i * 5, y = 3 * Math.sin(i / 1.8); o += legs([x - 1, x + 1], y + 3, 6, '#2A1D15', 1.2) + `<circle cx="${x}" cy="${f1(y)}" r="4.4" fill="#3B2A20"/><circle cx="${x - 1}" cy="${f1(y - 2)}" r="1.2" fill="#6B5444"/>`; }
    return o + `<path d="M31 -2 q8 -6 12 -2" stroke="#2A1D15" stroke-width="1.6" fill="none"/>`; },
  centipede: () => { let o = ''; for (let i = 0; i < 9; i++) { const x = -28 + i * 6.5; o += `<path d="M${x} 0 l-4 -9 M${x} 0 l-4 9" stroke="#8A4A14" stroke-width="1.6" stroke-linecap="round"/><rect x="${x - 3}" y="-3.5" width="6" height="7" rx="2.5" fill="#B5651D"/>`; }
    return o + `<path d="M30 -2 q8 -8 14 -6 M30 2 q8 8 14 6 M-31 -1 q-8 -6 -12 -4 M-31 1 q-8 6 -12 4" stroke="#8A4A14" stroke-width="1.5" fill="none"/><ellipse cx="30" cy="0" rx="4" ry="4" fill="#9C5418"/>`; },
  earthworm: () => `<path d="M-34 6 q10 -14 20 -4 t20 0 t20 -4" stroke="#D98C8C" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M-4 3 q5 -3 10 -1" stroke="#EBB0A6" stroke-width="11" fill="none" stroke-linecap="round"/>` +
    [-26, -18, 12, 20].map(x => `<path d="M${x} -2 l0 8" stroke="#C07070" stroke-width="1" opacity=".6"/>`).join(''),
  springtail: () => legs([-4, 0, 4], 4, 6, '#5E6E7A', 1.3) + `<path d="M-12 4 q-8 6 2 8" stroke="#5E6E7A" stroke-width="1.6" fill="none"/>` +
    `<ellipse cx="-2" cy="0" rx="11" ry="5.5" fill="#8A9BA8"/><circle cx="11" cy="-1" r="4.5" fill="#6E808C"/><path d="M14 -4 q6 -8 12 -8 M14 -2 q7 -4 12 -2" stroke="#5E6E7A" stroke-width="1.4" fill="none"/>`,
  mite: () => [-1, 1].map(s => [[-6, 1], [-2, 1.2], [2, 1.2], [6, 1]].map(([x, k]) => `<path d="M${x} 0 q${x * .6} ${s * 8 * k} ${x * 1.2} ${s * 12 * k}" stroke="#8E2A1E" stroke-width="1.6" fill="none"/>`).join('')).join('') +
    `<circle cx="0" cy="0" r="8.5" fill="#C0392B"/><circle cx="10" cy="0" r="3" fill="#8E2A1E"/><circle cx="-2" cy="-3" r="2" fill="#E37462"/>`,
  slug: () => `<path d="M-32 8 Q-30 -4 -8 -6 Q14 -9 26 -2 Q32 2 30 8 Z" fill="#8A6A4A"/><ellipse cx="6" cy="-4" rx="14" ry="5" fill="#7A5A3A"/>` +
    `<path d="M26 -3 l5 -10 M29 -1 l8 -8" stroke="#7A5A3A" stroke-width="2.4" stroke-linecap="round"/><circle cx="31" cy="-13" r="1.8" fill="#3A2A1A"/><circle cx="37" cy="-9" r="1.8" fill="#3A2A1A"/>`,
  beetle: () => legs([-8, 0, 8], 8, 7, '#111', 1.8) + legs([-8, 0, 8], -8, -7, '#111', 1.8) +
    `<ellipse cx="-4" cy="0" rx="16" ry="10" fill="#1E1E24"/><path d="M-20 0 L12 0" stroke="#3A3A44" stroke-width="1.5"/><path d="M-14 -6 q8 -3 16 -1" stroke="#5A5A6A" stroke-width="2" fill="none"/>` +
    `<ellipse cx="15" cy="0" rx="6" ry="7" fill="#26262E"/><circle cx="23" cy="0" r="4" fill="#26262E"/><path d="M25 -2 q8 -8 13 -6 M25 2 q8 8 13 6" stroke="#111" stroke-width="1.4" fill="none"/>`,
  ant: () => legs([-2, 3, 8], 3, 9, '#2A1A14', 1.5) + legs([-2, 3, 8], -3, -9, '#2A1A14', 1.5) +
    `<ellipse cx="-14" cy="0" rx="10" ry="7" fill="#3A2016"/><ellipse cx="3" cy="0" rx="7" ry="4" fill="#3A2016"/><circle cx="16" cy="-1" r="5.5" fill="#3A2016"/>` +
    `<path d="M20 -4 q6 -8 12 -6 M20 -2 q8 -2 12 2" stroke="#2A1A14" stroke-width="1.4" fill="none"/>`,
  mole: () => `<ellipse cx="-4" cy="0" rx="26" ry="16" fill="#2E2A2E"/><path d="M20 -6 Q34 -2 38 2 Q32 6 20 8Z" fill="#E8A0A8"/>` +
    `<ellipse cx="10" cy="14" rx="9" ry="6" fill="#E8A0A8"/><path d="M15 18 l3 3 M12 19 l2 4 M9 19 l0 4" stroke="#B87078" stroke-width="1.4"/>` +
    `<ellipse cx="-14" cy="14" rx="6" ry="4" fill="#E8A0A8"/><path d="M-30 4 q-6 2 -8 6" stroke="#E8A0A8" stroke-width="2.5" stroke-linecap="round"/><circle cx="18" cy="-5" r="1.3" fill="#111"/>`,
};
const draw = (who, x, y, s = 1, flip = false) => `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${C[who]()}</g>`;

// ---------- diagrams ----------
const leafShape = (x, y, s, rot, fill) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -20 C14 -14 16 6 0 22 C-16 6 -14 -14 0 -20Z" fill="${fill}"/><path d="M0 -18 L0 22" stroke="#8A5A20" stroke-width="1.2"/></g>`;

const figMix = (() => {
  seed = 11;
  const box = { x: 20, y: 20, w: 200, h: 200 }, rocks = [];
  for (let t = 0; t < 4000 && rocks.length < 70; t++) {
    const r = 7 + rnd() * 11, x = box.x + r + rnd() * (box.w - 2 * r), y = box.y + r + rnd() * (box.h - 2 * r);
    if (rocks.every(c => Math.hypot(c.x - x, c.y - y) > c.r + r + 3)) rocks.push({ x, y, r });
  }
  const cols = ['#C9A06A', '#B88A55', '#D8B98A', '#A9784A'];
  const water = Array.from({ length: 16 }, () => `<ellipse cx="${f1(box.x + 10 + rnd() * 180)}" cy="${f1(box.y + 10 + rnd() * 180)}" rx="${f1(9 + rnd() * 9)}" ry="${f1(6 + rnd() * 6)}" fill="#8EC0EA"/>`).join('');
  const flakes = Array.from({ length: 12 }, () => `<ellipse cx="${f1(box.x + 12 + rnd() * 176)}" cy="${f1(box.y + 12 + rnd() * 176)}" rx="6" ry="3" fill="#3B2716" transform="rotate(${Math.round(rnd() * 180)} 0 0)"/>`).join('');
  // rotate each flake about its own centre
  const flakesFixed = flakes.replace(/<ellipse cx="([\d.]+)" cy="([\d.]+)"([^>]*)transform="rotate\((\d+) 0 0\)"\/>/g, (_, x, y, rest, a) => `<ellipse cx="${x}" cy="${y}"${rest}transform="rotate(${a} ${x} ${y})"/>`);
  const bar = [['rock', 20, 90, '#C9A06A'], ['rotted', 110, 10, '#3B2716'], ['water', 120, 50, '#8EC0EA'], ['air', 170, 50, '#F7F4EC']];
  return {
    id: 'mix', title: 'What’s in a handful of soil?', viewBox: '0 0 400 240',
    desc: 'A square of soil close up: brown and tan bits of rock, small dark flakes of rotted leaf, and gaps between them filled with blue water or white air. A bar beside it shows roughly how much of each: about half rock bits, a little rotted stuff, a quarter water and a quarter air.',
    svg: `<rect data-hl="air" x="20" y="20" width="200" height="200" fill="#F7F4EC"/><g data-hl="water">${water}</g>` +
      `<g data-hl="rock">${rocks.map((c, i) => `<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(c.r)}" fill="${cols[i % 4]}"/>`).join('')}</g>` +
      `<g data-hl="rotted">${flakesFixed}</g><rect x="20" y="20" width="200" height="200" fill="none" stroke="#5E4430" stroke-width="3"/>` +
      bar.map(([k, y, h, c]) => `<rect data-hl="${k}" x="250" y="${y}" width="44" height="${h}" fill="${c}" stroke="#5E4430" stroke-width="1.5"/>`).join('') +
      `<g class="tx ts"><text x="304" y="60">rock bits</text><text x="304" y="76" opacity=".7">about half</text><text x="304" y="118">rotted bits</text><text x="304" y="148">water</text><text x="304" y="164" opacity=".7">a quarter</text><text x="304" y="198">air</text><text x="304" y="214" opacity=".7">a quarter</text></g>`,
    hl: true,
    buttons: [
      ['all', 'Everything', 'Soil close up: bits of rock, a little rotted stuff, and gaps full of water and air.'],
      ['rock', 'Rock bits', 'About half of soil is tiny bits of broken rock: sand, silt and clay.'],
      ['rotted', 'Rotted bits', 'Only a little is rotted leaves and plants, but it’s the most important bit for food and creatures.'],
      ['water', 'Water', 'Some gaps hold water. Roots drink it, with the minerals melted into it.'],
      ['air', 'Air', 'The other gaps hold air. Roots and creatures need it to breathe.'],
    ],
    note: 'Grown-up words: mineral particles (sand, silt and clay), organic matter, and pore space holding soil water and air. These are rough amounts for a good soil; after rain there’s more water and less air.',
  };
})();

const figCycle = {
  id: 'cycle', title: 'From leaf to soil', viewBox: '0 0 400 250',
  desc: 'A fallen leaf on the ground, with dark soil underneath. Step through how creatures, fungi and bacteria turn it back into soil food for the tree.',
  svg: `<rect x="0" y="100" width="400" height="14" fill="#C98B4A"/><rect x="0" y="114" width="400" height="136" fill="#4A3325"/>` +
    `<g data-show="fall">${leafShape(200, 98, 2, 84, '#D98A2B')}<path d="M120 20 q30 20 10 50" stroke="#B9A27A" stroke-width="2" stroke-dasharray="4 5" fill="none"/>${leafShape(118, 18, .9, 30, '#E2B33C')}</g>` +
    `<g data-show="shred" style="display:none">${leafShape(200, 98, 2, 84, '#D98A2B')}${[[184, 92], [204, 102], [222, 94], [196, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#C98B4A"/>`).join('')}${draw('woodlouse', 118, 92, .8)}${draw('millipede', 300, 98, .8, true)}</g>` +
    `<g data-show="worm" style="display:none">${[[120, 100, 40], [160, 102, -20], [290, 100, 70], [320, 103, 10]].map(([x, y, r]) => leafShape(x, y, .45, r, '#C77A26')).join('')}` +
      `<path d="M244 112 Q250 160 238 230" stroke="#2E1F15" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M244 116 Q249 150 242 186" stroke="#D98C8C" stroke-width="8" fill="none" stroke-linecap="round"/>${leafShape(244, 104, .6, -30, '#C77A26')}` +
      `<path d="M176 106 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0" stroke="#3A2618" stroke-width="5" fill="none" stroke-linecap="round"/></g>` +
    `<g data-show="tiny" style="display:none">${Array.from({ length: 24 }, (_, i) => `<ellipse cx="${60 + i * 12 + (i % 3) * 3}" cy="${103 + (i % 4) * 2}" rx="2.5" ry="1.4" fill="#8A5A20"/>`).join('')}${draw('springtail', 168, 92, .8)}${draw('mite', 236, 94, .7)}` +
      `<g stroke="#F3E6D6" stroke-width="1.6" fill="none" opacity=".85"><path d="M90 118 q20 20 50 18 q30 -2 50 20"/><path d="M220 118 q16 24 50 22 q30 0 60 26"/><path d="M150 120 q-10 30 10 50"/></g></g>` +
    `<g data-show="back" style="display:none"><rect x="0" y="114" width="400" height="30" fill="#2A1C12"/>${Array.from({ length: 30 }, (_, i) => `<circle cx="${8 + i * 13}" cy="${120 + (i % 5) * 4}" r="${2 + (i % 3)}" fill="#3B2818"/>`).join('')}` +
      `<path d="M200 250 L200 150 M200 190 Q170 170 150 176 M200 172 Q228 158 252 166 M200 210 Q236 200 262 214" stroke="#D9C08F" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<g fill="#6AA6E8"><path d="M188 236 l-6 10 h12z" transform="rotate(180 188 241)"/><path d="M188 206 l-6 10 h12z" transform="rotate(180 188 211)"/><path d="M188 176 l-6 10 h12z" transform="rotate(180 188 181)"/></g>` +
      `<text class="tx ts" x="230" y="240">up to the leaves</text></g>`,
  buttons: [
    ['fall', 'A leaf falls', 'In autumn, the tree drops its leaves. It takes some of the goodness back first, but lots is left in them.'],
    ['shred', 'Shredders', 'Woodlice, millipedes and slugs nibble the leaf full of holes and chew it into little bits.'],
    ['worm', 'Worms', 'Earthworms pull bits of leaf down into their burrows and eat them with soil. Their poo, worm casts, is rich, crumbly soil.'],
    ['tiny', 'Tiny helpers', 'Springtails and mites eat the tiniest bits. Fungus threads and bacteria finish off the rest.'],
    ['back', 'Back to the tree', 'What’s left is dark, crumbly soil food. Its minerals melt into the soil water, and the tree’s roots drink them up, ready for next spring’s leaves.'],
  ],
  note: 'Grown-up words: the shredders are detritivores; the dark, crumbly stuff is humus; the whole loop is nutrient cycling.',
};

function particles(top, bottom, step, s) {
  seed = s; let o = '';
  for (let y = top + step / 2; y < bottom; y += step) for (let x = step / 2 - 4; x < 404; x += step) {
    const r = step * (.38 + rnd() * .1), col = ['#9C6B3E', '#B07A45', '#8A5E36'][Math.floor(rnd() * 3)];
    o += `<circle cx="${f1(x + (rnd() - .5) * step * .3)}" cy="${f1(y + (rnd() - .5) * step * .3)}" r="${f1(r)}" fill="${col}"/>`;
  }
  return o;
}
const roots = d => `<g stroke="#E2CC98" stroke-width="4" fill="none" stroke-linecap="round">${d}</g>`;
const rain = xs => `<g fill="#3B82C4">${xs.map(([x, y]) => `<path d="M${x} ${y} q-4 7 0 10 q4 -3 0 -10z"/>`).join('')}</g>`;
const trunk = `<path d="M178 0 L222 0 L224 58 Q236 66 252 70 L148 70 Q164 66 176 58Z" fill="#8A5E3B"/>`;
const figSquash = {
  id: 'squash', title: 'Squash the soil', viewBox: '0 0 400 262',
  desc: 'The bottom of a tree trunk and the soil under it, close up. Brown blobs are bits of soil; the pale spaces between them are the gaps for air and water. Pale lines are roots. Step through what happens as the soil gets squashed, then mended.',
  svg: `<rect x="0" y="70" width="400" height="192" fill="#EADBC0"/>` +
    `<g data-show="loose">${particles(70, 262, 26, 3)}${roots('<path d="M190 70 Q120 90 40 120"/><path d="M210 70 Q290 92 362 132"/><path d="M196 70 Q170 140 120 210"/><path d="M206 70 Q236 140 290 200"/><path d="M200 70 L202 236"/><path d="M90 104 l-10 22 M300 110 l12 24 M150 170 l-26 6"/>')}${rain([[60, 30], [110, 44], [300, 26], [350, 46]])}<g fill="#3B82C4">${[[70, 150], [130, 120], [260, 160], [330, 210], [180, 230], [40, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5"/>`).join('')}</g></g>` +
    `<g data-show="feet" style="display:none">${particles(70, 106, 16, 4)}${particles(106, 262, 26, 5)}${roots('<path d="M190 70 Q160 82 120 92"/><path d="M210 70 Q244 82 280 90"/><path d="M200 70 L200 100"/>')}${rain([[60, 30], [110, 44], [300, 26], [350, 46]])}` +
      `<ellipse cx="90" cy="70" rx="44" ry="5" fill="#6AA6E8"/><ellipse cx="320" cy="70" rx="40" ry="5" fill="#6AA6E8"/>` +
      `<g fill="#5A4030">${[[60, 60], [80, 54], [292, 58], [312, 52], [340, 60]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="9" transform="rotate(70 ${x} ${y})"/>`).join('')}</g></g>` +
    `<g data-show="digger" style="display:none">${particles(70, 262, 16, 6)}${roots('<path d="M194 70 L182 82"/><path d="M206 70 L218 82"/>')}${rain([[60, 30], [110, 44], [300, 26], [350, 46]])}` +
      `<ellipse cx="80" cy="70" rx="70" ry="6" fill="#6AA6E8"/><rect x="262" y="26" width="128" height="40" rx="20" fill="#2B2B2B"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${272 + i * 19}" y="20" width="8" height="10" fill="#2B2B2B"/>`).join('')}<rect x="250" y="0" width="150" height="22" fill="#F2B705"/></g>` +
    `<g data-show="mulch" style="display:none">${particles(70, 262, 24, 3)}` +
      `<g stroke="#F5ECDA" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"><path d="M70 80 q10 40 -6 80 q-10 30 8 60"/><path d="M330 80 q-14 50 6 90"/></g>${draw('earthworm', 70, 150, .6)}` +
      `<g>${(() => { seed = 9; let o = ''; for (let x = 4; x < 396; x += 9) { if (x > 160 && x < 240) continue; o += `<rect x="${x}" y="${f1(58 + rnd() * 8)}" width="10" height="5" rx="1.5" fill="${rnd() > .5 ? '#B5793E' : '#9A6230'}" transform="rotate(${Math.round(rnd() * 40 - 20)} ${x + 5} 62)"/>`; } return o; })()}</g>` +
      `${roots('<path d="M190 70 Q120 90 40 120"/><path d="M210 70 Q290 92 362 132"/><path d="M196 70 Q170 130 130 190"/><path d="M206 70 Q236 130 280 180"/><path d="M200 70 L202 210"/>')}</g>` +
    trunk,
  buttons: [
    ['loose', 'Healthy soil', 'Healthy soil: lots of gaps for air and water. Rain soaks in, and roots spread out wide.'],
    ['feet', 'Lots of feet', 'Lots of feet squash the top of the soil. The gaps near the top close up, rain sits in puddles, and roots stay short.'],
    ['digger', 'A digger', 'A heavy digger squashes the soil deep down. Hardly any gaps are left, so roots can’t breathe or push through.'],
    ['mulch', 'Mulch and time', 'Mulch and time: worms, roots and frost slowly open up the gaps again. It takes years, so it’s much better not to squash the soil in the first place.'],
  ],
  note: 'Grown-up words: squashed soil is compacted; the gaps are pore space; how tightly packed soil is gets measured as bulk density.',
};

const chips = (x1, x2, y, s) => { seed = s; let o = ''; for (let x = x1; x < x2; x += 8) o += `<rect x="${x}" y="${f1(y + rnd() * 8)}" width="10" height="5" rx="1.5" fill="${rnd() > .5 ? '#B5793E' : '#9A6230'}" transform="rotate(${Math.round(rnd() * 40 - 20)} ${x + 5} ${y + 4})"/>`; return o; };
const figMulch = {
  id: 'mulch', title: 'Bare soil or mulch?', viewBox: '0 0 400 240',
  desc: 'The bottom of a tree and the ground round it, with the soil cut away underneath. Compare bare soil, a ring of mulch, and mulch piled up against the trunk.',
  svg: `<circle cx="40" cy="34" r="18" fill="#F6C343"/><g stroke="#F6C343" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${f1(40 + 24 * Math.cos(r))}" y1="${f1(34 + 24 * Math.sin(r))}" x2="${f1(40 + 32 * Math.cos(r))}" y2="${f1(34 + 32 * Math.sin(r))}"/>`; }).join('')}</g>` +
    `<path d="M180 0 L220 0 L222 128 Q232 136 246 140 L154 140 Q168 136 178 128Z" fill="#8A5E3B"/>` +
    `<g data-show="bare"><rect x="0" y="140" width="400" height="100" fill="#C9A77A"/><g stroke="#7A5A3A" stroke-width="2" fill="none"><path d="M40 140 l6 14 l-4 10 l8 12"/><path d="M110 140 l-4 12 l6 8"/><path d="M290 140 l5 16 l-6 8"/><path d="M350 140 l-3 10 l6 14"/></g>` +
      `<g stroke="#4FA052" stroke-width="2.5" stroke-linecap="round">${Array.from({ length: 34 }, (_, i) => { const x = 6 + i * 11.6; return `<path d="M${f1(x)} 140 l-2 -9 M${f1(x + 3)} 140 l2 -11"/>`; }).join('')}</g>` +
      `<path d="M208 112 q8 4 6 14 q-8 0 -10 -8z" fill="#E9D3A8"/>` +
      `<g stroke="#3B82C4" stroke-width="3" fill="none" stroke-linecap="round"><path d="M300 90 l0 34 q0 12 14 12 l40 0"/><path d="M340 136 l14 0 m-6 -5 l6 5 l-6 5"/></g>` +
      roots('<path d="M190 146 Q140 156 90 158"/><path d="M210 146 Q260 156 310 158"/>') + `</g>` +
    `<g data-show="mulch" style="display:none"><rect x="0" y="140" width="400" height="100" fill="#6B4A33"/><g>${chips(20, 168, 130, 2)}${chips(232, 382, 130, 3)}</g>` +
      `<g stroke="#3B82C4" stroke-width="3" fill="none" stroke-linecap="round"><path d="M300 90 l0 90 m-6 -6 l6 6 l6 -6"/><path d="M100 90 l0 90 m-6 -6 l6 6 l6 -6"/></g>` +
      roots('<path d="M190 140 Q130 152 40 160"/><path d="M210 140 Q270 152 360 160"/><path d="M196 140 Q170 180 130 210"/><path d="M204 140 Q236 180 280 206"/><path d="M80 157 l-6 12 M320 158 l8 12 M150 196 l-14 4"/>') +
      draw('earthworm', 250, 200, .55) + `</g>` +
    `<g data-show="volcano" style="display:none"><rect x="0" y="140" width="400" height="100" fill="#8A6A4A"/>` +
      `<path d="M96 142 Q200 52 304 142Z" fill="#A86E36"/>${chips(110, 290, 122, 4)}<path d="M150 112 Q200 70 250 112" stroke="#9A6230" stroke-width="10" fill="none"/>` +
      `<path d="M182 66 L218 66 L220 84 L180 84Z" fill="#3B2A1E"/><path d="M186 84 q2 6 0 10 M206 84 q2 8 0 12" stroke="#3B2A1E" stroke-width="3"/>` +
      roots('<path d="M180 120 q-20 -10 -24 -24"/><path d="M220 118 q22 -12 26 -26"/>') + `</g>`,
  buttons: [
    ['bare', 'Bare soil', 'Bare soil bakes in the sun and cracks. Rain runs off instead of soaking in. Grass grows right up to the trunk, so mowers and strimmers bump the bark.'],
    ['mulch', 'A ring of mulch', 'A wide ring of mulch, with a gap round the trunk. The soil stays damp and soft, rain soaks in, worms move in, and roots grow.'],
    ['volcano', 'A mulch volcano', 'Too much, piled up against the trunk like a volcano. The bark stays wet and can rot, and roots grow up into the mulch instead of the soil.'],
  ],
  note: 'Grown-up words: a mulch ring about 5 to 10 cm deep; piling it against the trunk is volcano mulching.',
};

const FIGS = { mix: figMix, cycle: figCycle, squash: figSquash, mulch: figMulch };

// ---------- creatures hiding down the page: [zone, creature, name, side, top %, what it says] ----------
const LURKS = [
  ['soil', 'ant', 'Ant', 'right', 14, 'I’m an ant. Our tunnels let air and rain into the soil.'],
  ['leaves', 'woodlouse', 'Woodlouse', 'left', 22, 'I’m a woodlouse. I eat dead leaves and rotting wood. I’m not an insect: I’m related to crabs!'],
  ['leaves', 'millipede', 'Millipede', 'right', 64, 'I’m a millipede. I munch dead leaves. I’ve got two pairs of legs on most of my body bits, but nowhere near a thousand legs.'],
  ['mulch', 'slug', 'Slug', 'right', 18, 'I’m a slug. I eat rotting plants and fungi, and leave a slimy trail.'],
  ['mulch', 'springtail', 'Springtail', 'left', 50, 'I’m a springtail, smaller than a grain of rice. I eat fungus threads and rotting bits, and I can flick myself into the air with a spring under my tummy.'],
  ['mulch', 'beetle', 'Ground beetle', 'right', 80, 'I’m a ground beetle. I hunt slugs and other minibeasts at night.'],
  ['food', 'earthworm', 'Earthworm', 'left', 30, 'I’m an earthworm. I pull leaves into my burrow and eat soil. I’ve got no eyes, and I breathe through my skin.'],
  ['food', 'mite', 'Soil mite', 'right', 72, 'I’m a soil mite, about as big as a full stop. I’ve got eight legs, like my cousins the spiders.'],
  ['squash', 'centipede', 'Centipede', 'left', 60, 'I’m a centipede, a fast hunter. I’ve got one pair of legs on each body bit.'],
  ['deeper', 'mole', 'Mole', 'right', 40, 'I’m a mole. I dig tunnels with my big front paws, hunting for earthworms to eat.'],
];
const lurkers = zone => LURKS.filter(l => l[0] === zone).map(([, who, name, side, top, say]) =>
  `<button type="button" class="lurk lurk-${side}" style="top:${top}%" data-who="${name}" data-say="${say}" aria-label="Something is hiding here"><svg viewBox="-46 -26 92 52" aria-hidden="true" focusable="false">${draw(who, 0, 0, 1, side === 'right')}</svg></button>`).join('');

// ---------- the text ----------
const ZONES = [
  ['soil', 'z-grass', 'What is soil?', 'At the bottom of a tree', 'What is soil?',
    'The soft, dark stuff under the grass: tiny bits of rock, rotted leaves, air, water, and more living things than you could ever count.', [
      ['What is soil made of?', 'About half of soil is [tiny bits of broken rock|mineral particles]. A little is [rotted leaves and plants|organic matter]. The rest is [gaps|pore space], filled with air and water. Roots and creatures need both.'],
      { fig: 'mix' },
      ['Where does soil come from?', 'Rain, ice, plant roots and [lichens|lichens] slowly [crumble rock into tiny bits|weathering]. Dead plants and animals rot into it. Making soil takes a very, very long time, so it’s precious.'],
      ['What are sand, silt and clay?', 'They’re bits of rock of different sizes. [Sand|sand] is the biggest: it feels gritty, and water runs straight through it. [Clay|clay] is the tiniest: it’s sticky, holds on to water and food, and squashes easily. [Silt|silt] is in between. Most soil is a mix, called [loam|loam].'],
      ['Why do trees need soil?', `Soil holds a tree up, and gives its roots water, [food|nutrients] and air. Thick roots near the trunk hold it steady like tent pegs: see ${link('../trees/#what-stops-a-tree-blowing-over', 'what stops a tree blowing over')}.`],
      ['Is soil alive?', 'Very! Soil is full of worms, beetles, woodlice, fungi, and [living things too tiny to see|bacteria and other microbes]. A handful of good soil holds millions of them. Some are hiding on this page: see if you can find them on the way down.'],
    ]],
  ['leaves', 'z-litter', 'Fallen leaves', 'On the ground', 'What happens to fallen leaves?',
    'They get eaten! An army of creatures and fungi turns them back into soil food, so the tree can use it all over again.', [
      ['What is leaf litter?', 'The layer of fallen leaves, twigs and bark on top of the soil is called [leaf litter|leaf litter, the O horizon]. In a wood, it’s like a blanket that never gets tidied away.'],
      ['Who eats the leaves first?', '[Shredders|detritivores]: woodlice, millipedes, slugs and earthworms. They nibble big leaves into small bits, and their poo is full of tiny pieces that are easier for others to eat.'],
      { fig: 'cycle' },
      ['What do earthworms do?', 'Earthworms pull leaves down into their [burrows|burrows] and eat them with soil. Their poo, called [worm casts|casts], is rich, crumbly soil. Their tunnels let air and rain in. Charles Darwin was so amazed by worms that he wrote a whole book about them.'],
      ['Who finishes the job?', '[Springtails|Collembola] and [mites|soil mites], smaller than a grain of rice, nibble the tiniest bits. Then fungi and [bacteria|bacteria] break down what’s left, until it’s [dark, crumbly soil food|humus].'],
      ['Should we sweep up leaves under trees?', 'On paths, yes: wet leaves are slippery. But on soil and flower beds under a tree, leaving them feeds the soil and its creatures. In a wood, nobody sweeps up, and the trees do fine. You can also pile leaves up to turn into [crumbly leaf compost|leaf mould].'],
    ]],
  ['mulch', 'z-mulch', 'Mulch', 'A blanket for roots', 'Why put mulch round a tree?',
    'A layer of wood chip or leaves copies the forest floor. It keeps soil damp, soft and full of life.', [
      ['What is mulch?', '[Mulch|mulch] is a layer of something spread on top of soil. For trees, the best is [chunky wood chip|coarse arborist wood chip], like the chip tree surgeons make, or leaves.'],
      ['What does mulch do?', 'It stops the soil [drying out|reducing evaporation], keeps weeds down, and stops feet squashing the soil. As it slowly rots, it feeds the creatures, and they feed the soil. Roots grow better under it.'],
      { fig: 'mulch' },
      ['How do you put mulch down?', 'Spread it in a wide circle, [about 5 to 10 centimetres deep|mulch depth], like a [doughnut|mulch ring]. Leave a gap round the trunk. Piled up against the trunk like a [volcano|volcano mulching], it keeps the bark wet, and the bark can rot.'],
      ['Does mulch protect the trunk?', `Yes. With a ring of mulch, mowers and strimmers stay away from the trunk. Their [bumps and cuts on the bark|mechanical injury] are a way in for germs: see ${link('../fungi/#ways-in', 'how fungi get into a tree')}.`],
      ['Is fresh wood chip all right?', 'Yes, spread on top of the soil. It only borrows a little [plant food|nitrogen] right where it touches the surface, not down where the roots are. Don’t dig it in, though.'],
    ]],
  ['food', 'z-top', 'Soil food', 'In the topsoil', 'What food is in soil?',
    'Minerals, a bit like vitamins for trees. They melt into the water in the soil, and roots drink them up.', [
      ['What do trees need from soil?', `Trees make their own sugar from sunshine, but they need [minerals|mineral nutrients] from the soil: [nitrogen|N] for leaves, [phosphorus|P] for energy, [potassium|K] for opening and shutting leaf mouths, and tiny bits of others, like iron. See ${link('../trees/#what-minerals-does-a-tree-need', 'what minerals a tree needs')}.`],
      ['Where do the minerals come from?', 'Most come back from rotting leaves, poo and dead things: that’s [recycling|nutrient cycling]. Some come slowly out of the bits of rock. And some [tiny living things grab nitrogen out of the air|nitrogen fixation].'],
      ['How do roots get the minerals?', `The minerals [melt into the water|dissolve] in the soil, and the thinnest roots soak them up. Fungi wrapped round the roots help, reaching much further: see ${link('../trees/#why-do-tree-roots-need-fungi', 'why tree roots need fungi')}.`],
      ['Why is topsoil darker?', 'Topsoil has the most [rotted leaves and plants|organic matter] in it, and that makes it dark. It’s where most creatures live, and where most of a tree’s drinking roots are.'],
      ['Can a tree run short of food?', `In a wood, fallen leaves keep the food coming back. In streets, parks and gardens, leaves are often swept away and the soil gets squashed, so less comes back. Mulch helps put that right. Pouring on plant food usually isn’t the answer: see ${link('../trees/#do-trees-need-plant-food', 'do trees need plant food?')}`],
    ]],
  ['squash', 'z-top2', 'Squashed soil', 'Under our feet', 'Why is squashed soil bad for trees?',
    'Soil needs its gaps. Squash them shut and roots can’t breathe, drink or grow.', [
      ['What are the gaps for?', 'Roots need air to breathe, just like you. The gaps hold the air, let rain soak in, and give roots and creatures room to move.'],
      { fig: 'squash' },
      ['What squashes soil?', 'Feet, bikes, cars and big diggers. Feet mostly squash the [top few centimetres|surface compaction]. Heavy machines squash much deeper. Wet soil squashes most easily of all.'],
      ['What happens to the tree?', 'Its roots can’t push through, rain runs off instead of soaking in, and the roots run short of air. The tree slowly gets weaker, and it can take years to show.'],
      ['How do we protect a tree’s soil?', 'During building work, a fence goes round a big area of soil round the tree, called the [root protection area|RPA, from BS 5837]. Nobody drives or stores anything in there. Paths, boards and mulch help too.'],
      ['Can squashed soil be mended?', 'Slowly. Worms, roots and frost open up the gaps again over the years, and mulch feeds the worms. Tree surgeons can also loosen the soil round roots with [a tool that blasts air|air spade].'],
    ]],
  ['deeper', 'z-sub', 'Deeper down', 'In the subsoil', 'What’s deeper down?',
    'Paler, harder soil, with less air, fewer creatures and fewer roots.', [
      ['What is subsoil?', 'Under the dark topsoil is [paler soil|subsoil]. It has much less rotted stuff in it, and less air, so fewer creatures and roots live there.'],
      ['How deep do tree roots go?', `Not as deep as you’d think! Most stay in the top part of the soil, where there’s air, but they spread out wide, often further than the branches. See ${link('../trees/#how-deep-do-tree-roots-go', 'how deep tree roots go')}.`],
      ['Who digs down here?', 'Some earthworms dig burrows [more than a metre deep|deep-burrowing (anecic) earthworms]. Moles dig tunnels, hunting for them.'],
      ['Why are soils different colours?', 'Dark brown or black soil has lots of rotted stuff in it. Red, orange or yellow soil has [rusty iron|iron oxides] in it. Grey or blue-grey soil is often [soaked, with no air|gleyed soil].'],
    ]],
  ['rock', 'z-rock', 'Rock', 'At the very bottom', 'What’s at the very bottom?',
    'Solid rock. Very slowly, it crumbles and becomes new soil.', [
      ['What is bedrock?', 'Under all the soil is solid rock, called [bedrock|bedrock]. Sometimes it’s just under the surface; sometimes it’s many metres down.'],
      ['How does rock turn into soil?', 'Water seeps into cracks and freezes. Ice takes up more room than water, so it pushes the cracks wider. Roots grow into cracks and push too. Bit by bit, rock breaks into stones, then sand, then silt and clay. It takes [thousands of years|soil formation].'],
      ['Why should we look after soil?', 'Because it takes so long to make, and almost all our food grows in it. Look after the soil, and it looks after the trees.'],
    ]],
];

const hero = `<svg id="hero-soil" viewBox="0 0 400 420" role="img" aria-labelledby="hst"><title id="hst">The bottom of a tree trunk standing in grass, with fallen leaves round it. Underneath, the ground is cut away to show dark topsoil with roots and a worm, paler subsoil, and rock at the bottom.</title>
<rect x="0" y="236" width="400" height="20" fill="#5FA052"/>
<rect x="0" y="256" width="400" height="70" fill="#4A3325"/><rect x="0" y="326" width="400" height="58" fill="#8A5A35"/><rect x="0" y="384" width="400" height="36" fill="#6E6A64"/>
${[[30, 396, 14], [90, 404, 10], [160, 398, 16], [240, 406, 11], [320, 396, 15], [380, 404, 9]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .6}" fill="#8A857C"/>`).join('')}
<path d="M226 0 L304 0 L306 214 Q322 234 352 244 L178 244 Q210 234 224 214Z" fill="#8A5E3B"/><rect x="226" y="0" width="12" height="230" fill="#6E4A30"/><rect x="292" y="0" width="12" height="230" fill="#6E4A30"/>
<g stroke="#D9C08F" stroke-width="6" fill="none" stroke-linecap="round"><path d="M240 250 Q170 270 60 280"/><path d="M290 250 Q340 268 396 282"/><path d="M256 252 Q230 300 190 320"/><path d="M276 252 Q300 296 330 316"/></g>
<g stroke="#D9C08F" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M120 274 l-10 16 M180 266 l8 18 M350 274 l10 14 M210 312 l-18 6"/></g>
<g stroke="#3F8A3A" stroke-width="3" stroke-linecap="round">${Array.from({ length: 40 }, (_, i) => `<path d="M${5 + i * 10} 240 l-3 -12 M${8 + i * 10} 240 l3 -14"/>`).join('')}</g>
${[[150, 238, 1, 70, '#D98A2B'], [120, 244, .8, -40, '#E2B33C'], [196, 246, .9, 20, '#B8562A'], [330, 244, 1, -60, '#D98A2B'], [370, 238, .8, 30, '#C77A26'], [80, 242, .7, 80, '#B8562A'], [356, 248, .7, 10, '#E2B33C']].map(([x, y, s, r, c]) => leafShape(x, y, s, r, c)).join('')}
${draw('earthworm', 110, 300, .7)}${draw('woodlouse', 170, 236, .45)}
</svg>`;

const css = `
:root{--grass-bg:#DCEFD2;--grass-ink:#1D3B1A;--litter-bg:#EED9B7;--litter-ink:#3A2415;--mulch-bg:#D3B087;--mulch-ink:#2E1A0C;
  --top-bg:#4A3325;--top-ink:#F3E6D6;--top2-bg:#3E2A1E;--top2-ink:#F3E6D6;--sub-bg:#8A5A35;--sub-ink:#FFF4E6;--rock-bg:#55524E;--rock-ink:#F0EEEA}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--grass-bg:#15291A;--grass-ink:#D5ECCB;--litter-bg:#2E2214;--litter-ink:#F0DFC8;--mulch-bg:#3A2A18;--mulch-ink:#F0DFC8}}
:root[data-theme="dark"]{--grass-bg:#15291A;--grass-ink:#D5ECCB;--litter-bg:#2E2214;--litter-ink:#F0DFC8;--mulch-bg:#3A2A18;--mulch-ink:#F0DFC8}
.z-grass{--bg:var(--grass-bg);color:var(--grass-ink)}
.z-litter{--bg:var(--litter-bg);color:var(--litter-ink)}
.z-mulch{--bg:var(--mulch-bg);color:var(--mulch-ink)}
.z-top{--bg:var(--top-bg);color:var(--top-ink)}
.z-top2{--bg:var(--top2-bg);color:var(--top2-ink)}
.z-sub{--bg:var(--sub-bg);color:var(--sub-ink)}
.z-rock{--bg:var(--rock-bg);color:var(--rock-ink)}
.finish{background:var(--rock-bg);color:var(--rock-ink)}
/* creatures hiding at the edges of the sections */
section.zone{position:relative;overflow-x:clip}
.lurk{position:absolute;z-index:3;width:92px;height:52px;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.lurk svg{display:block;width:100%;height:100%;overflow:visible}
.lurk-right,.lurk-left{right:-30px}
@media (min-width:720px){.lurk-right{right:2%}.lurk-left{left:auto;right:12%}}
@media (prefers-reduced-motion:no-preference){.lurk:not(.found) svg{animation:lurk 3.2s ease-in-out infinite}}
@keyframes lurk{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px) rotate(-3deg)}}
.lurk.found{opacity:.55}
.lurk:focus-visible{outline:3px solid #F6C343;outline-offset:2px;border-radius:12px}
.lurk-say{position:absolute;z-index:60;max-width:min(300px,calc(100vw - 16px));background:#FFFDF8;color:#23201C;border-radius:16px;padding:.7rem .9rem;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:1rem;line-height:1.4}
.lurk-say[hidden]{display:none}
.lurk-say b{display:block;font-family:var(--head);font-size:1.15rem}
.lurk-say small{display:block;margin-top:.35rem;font-family:var(--head);font-weight:600;color:#2F7A34}
.found-line{font-family:var(--head);font-weight:500}
/* on the dark soil, creatures get a pale outline and a soft glow so they stand out */
.z-top .lurk svg,.z-top2 .lurk svg,.z-sub .lurk svg,.z-rock .lurk svg{filter:drop-shadow(0 0 1.2px #FFF4E0) drop-shadow(0 0 1.2px #FFF4E0) drop-shadow(0 0 6px rgba(255,236,200,.55))}
`;

const nFig = Object.keys(FIGS).length, nLurk = LURKS.length;
const nQ = writePage({
  dir: 'soil', zones: ZONES, hero, css, scripts: ['/soil/soil.js'], topBg: 'var(--sky-bg)',
  bg: { 'z-grass': 'grass', 'z-litter': 'litter', 'z-mulch': 'mulch', 'z-top': 'top', 'z-top2': 'top2', 'z-sub': 'sub', 'z-rock': 'rock' },
  render: it => figure(FIGS[it.fig]),
  extra: lurkers,
  text: nQ => ({
    title: 'What Is Soil? Soil and Trees for Kids | The Learning Forest',
    description: 'What is soil? Dig down from the grass at the bottom of a tree to the rock: fallen leaves and the creatures that eat them, mulch, soil food, squashed soil and subsoil, explained so a five-year-old gets it.',
    ogTitle: `What is soil? ${nQ} questions, answered like you’re five`,
    ogDescription: `Dig down from the grass at the bottom of a tree to the rock. ${nFig} diagrams to play with and ${nLurk} creatures hiding on the way down.`,
    h1: 'What is soil?', headline: 'What soil is and why trees need it, explained simply',
    ldDescription: 'Soil for children: what it’s made of, how fallen leaves become soil food, mulch, nutrients, squashed (compacted) soil, subsoil and rock, and the creatures that live there.',
    keywords: 'what is soil, soil for kids, soil and trees, mulch, soil compaction, leaf litter, soil creatures, earthworms, nutrients',
    lede: `Dig down from the grass at the bottom of a tree, all the way to the rock. ${nQ} questions, ${nFig} diagrams to play with, and ${nLurk} creatures hiding on the way down.`,
    hint: `<p class="hint">In the answers, hover over or tap any underlined words to see their grown-up word.</p><p class="hint found-line" aria-live="polite">Tap the creatures when you spot them. Found <b id="found">0</b> of ${nLurk}.</p>`,
    finish: `<h2 id="finish-h">You dug all the way down to the rock.</h2>
    <p>That’s ${nQ} questions about soil. Next time you walk past a tree, think about the roots, worms and fungi under your feet.</p>
    <p class="sources">For the grown-ups: <cite>BS 5837:2012 Trees in relation to design, demolition and construction</cite>, for keeping roots safe on building sites, and Linda Chalker-Scott’s review <cite>Impact of mulches on landscape plants and the environment</cite> (Journal of Environmental Horticulture, 2007).</p>`,
  }),
});
console.log(`public/soil/index.html: ${nQ} questions, ${nFig} diagrams, ${nLurk} creatures`);
