// How do fungi work?: writes public/fungi/index.html and public/fungi/fungi.css (see scripts/explainer.mjs).
// The text and diagrams live here. Run `node scripts/fungi.mjs` after changing anything.
import { esc, slug, figure, writePage } from './explainer.mjs';

// ---------- diagrams (each is { id, title, desc, svg, buttons:[[state,label,caption]], note, hl }) ----------

// a little grid of wood tubes seen end-on; parts change with the rot
function cells({ x0 = 40, y0 = 24, cols = 4, rows = 3, w = 72, h = 58, gap = 9 }, part) {
  let out = '';
  const W = cols * w + (cols - 1) * gap, H = rows * h + (rows - 1) * gap;
  if (part.glue) out += `<rect ${part.glue} x="${x0 - gap / 2}" y="${y0 - gap / 2}" width="${W + gap}" height="${H + gap}" rx="10" fill="#9C6B3E"/>`;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * (w + gap), y = y0 + r * (h + gap);
    out += part.cell(x, y, w, h, r, c);
  }
  return out;
}
const wall = (x, y, w, h, fill, pat) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}"/>` +
  (pat ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#${pat})"/>` : '') +
  `<rect x="${x + 13}" y="${y + 12}" width="${w - 26}" height="${h - 24}" rx="7" style="fill:var(--fig-bg)"/>`;
const stringsPat = id => `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#C9A676" stroke-width="2.4"/></pattern>`;

const figWood = {
  id: 'wood', title: 'Strings and glue',
  desc: 'Twelve wood tubes seen end-on, like looking into drinking straws. Each tube has a pale wall of strings with a hollow middle, and dark brown glue fills the gaps between the tubes.',
  svg: `<defs>${stringsPat('wd-s')}</defs>` +
    cells({}, { glue: 'data-hl="glue"', cell: (x, y, w, h) => `<g data-hl="strings">${wall(x, y, w, h, '#F3E3BF', 'wd-s')}</g>` }) +
    `<text class="tx ts" x="200" y="252" text-anchor="middle">wood tubes, seen end-on</text>`,
  hl: true,
  buttons: [
    ['all', 'Wood', 'Wood is millions of tiny tubes, side by side. Water travels up the hollow middles.'],
    ['strings', 'The strings', 'Each tube’s wall is made of strong strings wound round and round, in layers. Paper is made of these strings.'],
    ['glue', 'The glue', 'Woody glue holds the tubes together and soaks into their walls, making wood stiff. There’s most of it between the tubes.'],
  ],
  note: 'Grown-up words: the tubes are cells (fibres, vessels and tracheids), the strings are cellulose and hemicellulose, and the glue is lignin. The glue between the tubes is the middle lamella.',
};

const figRot = {
  id: 'rot', title: 'Three kinds of rot',
  desc: 'The same twelve wood tubes. Choose a rot to see which part of the wood the fungus eats.',
  svg: `<defs>${stringsPat('rt-s')}</defs>` +
    `<g data-show="sound">${cells({}, { glue: '', cell: (x, y, w, h) => wall(x, y, w, h, '#F3E3BF', 'rt-s') })}</g>` +
    // white rot: the glue goes, the strings are left pale and coming apart
    `<g data-show="white" style="display:none">${cells({}, { cell: (x, y, w, h, r, c) =>
      `<g transform="translate(${(c - 1.5) * 4} ${(r - 1) * 4})">${wall(x + 3, y + 3, w - 6, h - 6, '#F7EDD4', 'rt-s')}</g>` })}</g>` +
    // brown rot: the strings go, brown glue is left, cracked into cubes
    `<g data-show="brown" style="display:none">${cells({}, { glue: '', cell: (x, y, w, h) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#7A4A22"/><rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="9" style="fill:var(--fig-bg)"/>` })}` +
      `<g stroke="#2E1B0C" stroke-width="5" stroke-linecap="round"><line x1="122" y1="14" x2="120" y2="232"/><line x1="280" y1="14" x2="284" y2="232"/><line x1="30" y1="90" x2="370" y2="94"/><line x1="30" y1="158" x2="370" y2="154"/></g></g>` +
    // soft rot: chains of little holes tunnelled inside the walls
    `<g data-show="soft" style="display:none">${cells({}, { glue: '', cell: (x, y, w, h) => wall(x, y, w, h, '#F3E3BF', 'rt-s') +
      [0, 1, 2, 3].map(k => `<ellipse cx="${x + 14 + k * 15}" cy="${y + 6}" rx="5" ry="3" fill="#6B4A2E"/><ellipse cx="${x + 14 + k * 15}" cy="${y + h - 6}" rx="5" ry="3" fill="#6B4A2E"/>`).join('') +
      [0, 1, 2].map(k => `<ellipse cx="${x + 6}" cy="${y + 13 + k * 16}" rx="3" ry="5" fill="#6B4A2E"/><ellipse cx="${x + w - 6}" cy="${y + 13 + k * 16}" rx="3" ry="5" fill="#6B4A2E"/>`).join('') })}</g>` +
    `<text class="tx ts" x="200" y="252" text-anchor="middle">wood tubes, seen end-on</text>`,
  buttons: [
    ['sound', 'Healthy wood', 'Healthy wood: strong string walls, with woody glue holding them together.'],
    ['white', 'White rot', 'White rot: the fungus eats the glue, and often the strings too. What’s left is pale, soft and stringy, and the tubes come apart.'],
    ['brown', 'Brown rot', 'Brown rot: the fungus eats the strings and leaves the brown glue. The wood shrinks, cracks into little cubes and crumbles.'],
    ['soft', 'Soft rot', 'Soft rot: the fungus tunnels inside the tube walls, leaving chains of tiny holes. The wood goes soft and can snap suddenly.'],
  ],
  note: 'Grown-up words: white rot breaks down lignin (selective delignification, or simultaneous white rot when it takes everything at once). Brown rot breaks down cellulose and hemicellulose. Soft rot makes cavities inside the S2 layer of the cell wall.',
};

// side view of a trunk with a branch; cut it and watch the straws dry
const figCut = {
  id: 'cut', title: 'Cut off a branch',
  desc: 'A trunk with a leafy branch. Blue lines are water straws running from the trunk out to the leaves. Step through what happens after the branch is cut off.',
  svg:
    // trunk
    `<rect x="40" y="10" width="96" height="240" rx="10" fill="#C9A06A"/><rect x="40" y="10" width="10" height="240" fill="#6E4A30"/><rect x="126" y="10" width="10" height="240" fill="#6E4A30"/>` +
    // dry wood cone in the trunk below and inside the stub
    `<path data-show="dry fungi walls" style="display:none" d="M180 90 L136 97 Q100 140 112 214 Q124 172 136 142 L180 148Z" fill="#EADFC9" stroke="#B9A27A" stroke-width="1.5"/>` +
    // trunk straws
    `<g stroke="#2F6FB5" stroke-width="3" stroke-linecap="round" opacity=".85"><line x1="64" y1="16" x2="64" y2="244"/><line x1="84" y1="16" x2="84" y2="244"/></g>` +
    `<g data-show="cut dry fungi walls" style="display:none" stroke="#2F6FB5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"><path d="M104 244 L104 212"/><path d="M118 244 L118 214"/></g>` +
    // branch, then the stub once it's cut
    `<path data-show="leafy" d="M136 96 L340 44 L346 84 L136 142Z" fill="#C9A06A" stroke="#6E4A30" stroke-width="4" stroke-linejoin="round"/>` +
    `<path data-show="leafy" d="M104 244 L104 150 Q104 118 136 108 L330 60" stroke="#2F6FB5" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/><path data-show="leafy" d="M118 244 L118 158 Q118 132 136 124 L336 78" stroke="#2F6FB5" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<g data-show="leafy"><circle cx="340" cy="50" r="34" fill="#3E8E41"/><circle cx="372" cy="78" r="26" fill="#4FA052"/><circle cx="318" cy="84" r="24" fill="#4FA052"/><path d="M300 30 l10 -12 M352 20 l6 -10" stroke="#2F6FB5" stroke-width="3" stroke-linecap="round"/><text class="tx ts" x="300" y="132" text-anchor="middle">leaves pull water up</text></g>` +
    `<path data-show="cut dry fungi walls" style="display:none" d="M136 96 L180 88 L180 150 L136 142Z" fill="#C9A06A" stroke="#6E4A30" stroke-width="4" stroke-linejoin="round"/>` +
    `<g data-show="cut dry fungi walls" style="display:none" stroke="#9DB7D6" stroke-width="3" stroke-linecap="round" fill="none" stroke-dasharray="2 7"><path d="M104 212 L104 150 Q104 118 136 108 L178 98"/><path d="M118 214 L118 158 Q118 132 136 124 L178 116"/></g>` +
    `<g data-show="cut" style="display:none" fill="#fff" stroke="#2F6FB5" stroke-width="1.5"><circle cx="160" cy="103" r="5"/><circle cx="150" cy="120" r="4"/><circle cx="112" cy="168" r="4"/><circle cx="98" cy="186" r="3.5"/></g>` +
    // spores landing and threads moving in
    `<g data-show="fungi walls" style="display:none" fill="#7A4A22"><circle cx="196" cy="100" r="3"/><circle cx="204" cy="122" r="3"/><circle cx="192" cy="140" r="3"/><circle cx="214" cy="110" r="3"/></g>` +
    `<g data-show="fungi walls" style="display:none" stroke="#8A6B4A" stroke-width="2" fill="none" stroke-linecap="round"><path d="M180 104 q-10 6 -22 2 q-10 -3 -20 6"/><path d="M180 124 q-14 4 -24 12 q-8 8 -22 8"/><path d="M178 140 q-16 2 -30 -4"/><path d="M132 140 q-10 12 -18 26 q-4 10 -10 18"/><path d="M128 118 q-12 10 -16 22"/></g>` +
    // the tree's walls round the dry wood
    `<path data-show="walls" style="display:none" d="M136 142 Q124 172 112 214 Q100 140 136 97" fill="none" stroke="#2F9E44" stroke-width="6" stroke-linecap="round"/>` +
    `<text class="tx ts" x="88" y="270" text-anchor="middle">trunk</text>`,
  viewBox: '0 0 400 280',
  buttons: [
    ['leafy', 'Leafy branch', 'Leaves pull water up the straws, all the way from the roots. Wood that’s carrying water is wet, and its living cells fight back, so fungi can’t get in.'],
    ['cut', 'Cut it off', 'Snip! Nothing pulls water through these straws any more. They fill with air bubbles.'],
    ['dry', 'Drying out', 'The wood in the stub, and a little way into the trunk, dries out and its living cells die. It has stopped working.'],
    ['fungi', 'Fungi move in', 'Dry, airy wood with nothing fighting back: just what a fungus wants. Spores land on the cut, and threads grow into the dry wood.'],
    ['walls', 'The tree fights back', 'The tree builds walls (green) round the wood that has stopped working, to keep the fungus in there. It doesn’t always manage.'],
  ],
  note: 'Grown-up words: the straws are xylem vessels; air getting in is embolism; wood that has stopped working is dysfunctional; the walls are the tree’s compartmentalisation (CODIT), shown in How does a tree work?',
};

// grain seen from the side: a saw cut slices the tubes; a snap pulls them apart
function grain(ends, gaps) {
  let out = '';
  for (let r = 0; r < 7; r++) {
    const y = 30 + r * 28, x2 = ends[r];
    out += `<rect x="30" y="${y}" width="${x2 - 30}" height="22" rx="6" fill="#F3E3BF" stroke="#C9A676" stroke-width="1.5"/>` +
      `<line x1="36" y1="${y + 11}" x2="${x2 - 6}" y2="${y + 11}" stroke="#E2CDA0" stroke-width="5" stroke-linecap="round"/>`;
    if (r < 6) {
      const g = gaps[r] || 0, gx = Math.min(x2, ends[r + 1]);
      out += `<rect x="30" y="${y + 22}" width="${gx - 30 - g}" height="6" fill="#9C6B3E"/>`;
    }
  }
  return out;
}
const figBreak = {
  id: 'break', title: 'Saw cut or snap?',
  desc: 'Wood tubes seen from the side, lying along the branch, with brown glue between them. Compare the end left by a saw with the end left when a branch snaps.',
  svg: `<g data-show="saw">${grain([250, 250, 250, 250, 250, 250, 250], [])}<line x1="252" y1="22" x2="252" y2="226" stroke="#6E4A30" stroke-width="3" stroke-dasharray="6 5"/>` +
    [0, 1, 2, 3, 4, 5, 6].map(r => `<ellipse cx="250" cy="${41 + r * 28}" rx="3" ry="7" fill="#6B4A2E"/>`).join('') +
    `<text class="tx ts" x="300" y="128">flat end,</text><text class="tx ts" x="300" y="146">tubes cut open</text></g>` +
    `<g data-show="snap" style="display:none">${grain([300, 236, 330, 262, 292, 214, 318], [70, 30, 40, 60, 24, 50])}` +
    `<text class="tx ts" x="200" y="238" text-anchor="middle">jagged end, pulled apart at the glue</text></g>` +
    `<text class="tx ts" x="200" y="256" text-anchor="middle">← towards the trunk</text>`,
  viewBox: '0 0 400 262',
  buttons: [
    ['saw', 'Saw cut', 'A saw slices straight across the tubes. The end is flat, and every tube is cut open.'],
    ['snap', 'Snapped', 'When a branch snaps, the tubes mostly pull apart along the glue between them, leaving a jagged, splintery end with long splinters.'],
  ],
  note: 'Grown-up words: a break along the glue is an intercellular fracture; a cut through the walls is transwall. Nobody has yet tested properly whether a snapped end rots more slowly than a saw cut, though The Tree Fella sees much less decay around natural fractures than around pruning cuts.',
};

// trunk slice: the four ways in
const ring = (r, fill) => `<circle cx="130" cy="130" r="${r}" fill="${fill}"/>`;
const figWays = {
  id: 'ways', title: 'Four ways in',
  desc: 'A slice across a trunk: dark bark outside, pale sapwood, and darker heartwood in the middle. Choose a way in to see where that kind of fungus lives.',
  svg: ring(120, '#5E3E27') + ring(110, '#EFD9AE') + ring(60, '#C99B62') +
    [100, 86, 72].map(r => `<circle cx="130" cy="130" r="${r}" fill="none" stroke="#C9A676" stroke-width="1.5"/>`).join('') +
    [46, 32, 18].map(r => `<circle cx="130" cy="130" r="${r}" fill="none" stroke="#A57A45" stroke-width="1.5"/>`).join('') +
    // heart rot
    `<g data-show="heart"><path d="M130 130 m-40 6 q8 -40 46 -36 q30 6 26 38 q-8 34 -40 30 q-34 -4 -32 -32z" fill="#5B3A22" opacity=".85"/><path d="M226 62 L172 104" stroke="#5E3E27" stroke-width="10" stroke-linecap="round"/></g>` +
    // exposed sapwood
    `<g data-show="wound" style="display:none"><path d="M236 104 A110 110 0 0 1 236 156 L246 160 A120 120 0 0 0 246 100Z" style="fill:var(--fig-bg)"/><path d="M236 104 A110 110 0 0 1 236 156 L196 146 A70 70 0 0 0 196 114Z" fill="#5B3A22" opacity=".8"/></g>` +
    // latent: asleep, then awake
    `<g data-show="asleep" style="display:none" fill="#5B3A22">${[[70, 52], [200, 70], [214, 168], [88, 214], [44, 140], [160, 228], [178, 40], [36, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5"/>`).join('')}</g>` +
    `<g data-show="awake" style="display:none" fill="#5B3A22" opacity=".8">${[[70, 52], [200, 70], [214, 168], [88, 214], [44, 140], [160, 228], [178, 40], [36, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17"/>`).join('')}</g>` +
    // pathogen: attacks the living outside, with bootlaces coming in
    `<g data-show="attack" style="display:none"><circle cx="130" cy="130" r="104" fill="none" stroke="#5B3A22" stroke-width="14" stroke-dasharray="120 40" opacity=".85"/><path d="M262 250 q-20 -30 -10 -60 q8 -20 -6 -40 M290 220 q-30 -10 -40 -40" stroke="#1C1410" stroke-width="4" fill="none" stroke-linecap="round"/></g>` +
    `<g class="tx ts"><text x="268" y="40">bark</text><text x="268" y="62">sapwood: carries</text><text x="268" y="78">water, still alive</text><text x="268" y="100">heartwood: old,</text><text x="268" y="116">no longer working</text></g>`,
  viewBox: '0 0 400 262',
  buttons: [
    ['heart', 'Eat the middle', 'Heart rot fungi get in through a wound, like a broken branch, and eat the old heartwood in the middle. The tree carries on, sometimes for years.'],
    ['wound', 'Wait at a wound', 'When bark is torn off, the sapwood underneath dries out. Lots of fungi race to grab it, then spread inwards.'],
    ['asleep', 'Hide inside', 'Some fungi sneak in while the tree is healthy and wait inside the sapwood, asleep, doing no harm.'],
    ['awake', '…and wake up', 'If the wood dries out, in a drought or when the tree is weak, the hidden fungi wake up and spread very fast.'],
    ['attack', 'Break in', 'A few fungi can attack living, working wood all by themselves. Honey fungus creeps through the soil in black bootlaces and attacks the living outside of the roots and trunk. Only a few fungi can do this.'],
  ],
  note: 'Grown-up words: heart rot; exposed sapwood colonisation (unspecialised opportunism); latent invasion (specialised opportunism); active pathogenesis. These are the four colonisation strategies described by Rayner and Boddy.',
};

const FIGS = { wood: figWood, rot: figRot, cut: figCut, break: figBreak, ways: figWays };

// ---------- spot the fungus: a drawing each, with numbered clues ----------
const num = (x, y, n) => `<g class="pin"><circle cx="${x}" cy="${y}" r="10" fill="#1D2B22" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="Fredoka,sans-serif">${n}</text></g>`;
const bark = (w, fill = '#7A5A3E', line = '#5E4430') => `<rect x="0" y="0" width="${w}" height="180" fill="${fill}"/>` +
  [0.2, 0.45, 0.7].map(f => `<path d="M${w * f} 0 q4 45 -2 90 q-4 45 2 90" stroke="${line}" stroke-width="3" fill="none"/>`).join('');
const soil = y => `<rect x="0" y="${y}" width="240" height="${180 - y}" fill="#5A4030"/>`;
const tier = (y, len) =>
  `<path d="M70 ${y - 16} Q${70 + len * .6} ${y - 30} ${70 + len} ${y - 2} Q${78 + len} ${y + 12} ${60 + len} ${y + 16} Q${70 + len * .5} ${y + 22} 70 ${y + 12}Z" fill="#F6D243"/>` +
  `<path d="M70 ${y - 14} Q${70 + len * .55} ${y - 26} ${58 + len} ${y - 2} Q${64 + len} ${y + 7} ${52 + len} ${y + 9} Q${70 + len * .45} ${y + 13} 70 ${y + 7}Z" fill="#F08A24"/>` +
  `<path d="M${70 + len * .3} ${y - 20} q20 -4 40 0 M${70 + len * .35} ${y - 10} q24 -3 46 2" stroke="#F6B347" stroke-width="2" fill="none"/>`;
const scales = () => {
  let o = '';
  for (const r of [34, 58, 82, 104]) for (let a = -150; a <= -20; a += 22 - r / 10) {
    const x = 92 + r * Math.cos(a * Math.PI / 180), y = 108 + r * .62 * Math.sin(a * Math.PI / 180);
    o += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l7 -3 l-2 7z" fill="#7A4A22"/>`;
  }
  return o;
};
const SPOTS = [
  { name: 'Chicken of the woods', latin: 'Laetiporus sulphureus',
    svg: bark(70) + tier(46, 130) + tier(92, 150) + tier(136, 118) + num(150, 34, 1) + num(226, 96, 2) + num(140, 158, 3),
    clues: ['Layers of soft, fan-shaped brackets, bright orange and yellow, in summer.', 'A wavy, sulphur-yellow edge.', 'Underneath is yellow, with tiny holes, not gills.'],
    more: 'Old ones fade to chalky white and crumble.',
    lives: 'Oak, yew and sweet chestnut, sometimes other trees.', does: 'Brown rot in the heartwood. It hollows out old oaks.' },
  { name: 'Beefsteak fungus', latin: 'Fistulina hepatica',
    svg: bark(80) + `<path d="M80 68 Q140 50 170 78 Q184 104 160 122 Q120 136 80 112Z" fill="#9E2A1E"/>` +
      [[100, 80], [120, 72], [140, 76], [112, 96], [134, 92], [154, 98], [126, 112], [146, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#C8584A"/>`).join('') +
      `<path d="M80 112 Q120 136 160 122 Q152 134 120 138 Q94 136 80 122Z" fill="#EBCDB0"/>` +
      `<path d="M186 54 Q220 46 232 64 Q238 84 222 96 Q200 104 186 92Z" fill="#B83A2E"/><path d="M192 62 q14 6 30 -2 M190 74 q18 8 36 0 M192 86 q14 4 28 -2" stroke="#E79A8C" stroke-width="2.5" fill="none"/>` +
      `<path d="M204 100 q-3 8 0 10 q3 -2 0 -10z M216 98 q-3 10 0 13 q3 -3 0 -13z" fill="#B83A2E"/><text x="210" y="128" text-anchor="middle" font-size="12" fill="#5E4430" font-family="Fredoka,sans-serif">cut open</text>` +
      num(122, 58, 1) + num(186, 40, 2) + num(110, 150, 3),
    clues: ['One tongue-shaped bracket, red-brown, often low down the trunk, in late summer and autumn.', 'Cut it and it looks just like raw steak, and drips red juice.', 'Underneath is cream, turning pinkish-brown.'],
    lives: 'Oak and sweet chestnut.', does: 'A very slow brown rot in the heartwood. It stains oak a rich, dark brown.' },
  { name: 'Artist’s bracket', latin: 'Ganoderma applanatum',
    svg: bark(70) + [[20, 40], [36, 52], [50, 34], [28, 64], [58, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#8A5A2E"/>`).join('') +
      `<path d="M70 70 L206 80 Q224 84 222 96 L70 104Z" fill="#8B6B4E"/><path d="M76 78 L200 86 M76 88 L212 92 M76 97 L216 99" stroke="#6E5238" stroke-width="2" fill="none"/>` +
      [[100, 80], [130, 82], [160, 86], [118, 92], [150, 94], [186, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#6B4024"/>`).join('') +
      `<path d="M200 80 Q224 84 222 96 L198 98" stroke="#FAF7F0" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M70 104 L222 96 Q216 116 70 120Z" fill="#F4EFE6" stroke="#D8CDB8" stroke-width="1.5"/>` +
      `<path d="M160 116 l8 -12 l8 12 M168 104 l0 -1 M150 110 q6 -6 4 4" stroke="#6B4024" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      [[96, 112], [114, 110], [130, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#E2CFA6" stroke="#B89A66" stroke-width="1.2"/><circle cx="${x}" cy="${y + 4}" r="1.5" fill="#B89A66"/>`).join('') +
      num(42, 20, 1) + num(232, 78, 2) + num(186, 132, 3) + num(104, 136, 4),
    clues: ['Brown dust like cocoa powder on top, and on the bark and plants around it.', 'A hard, flat, woody shelf with a white edge while it’s growing. It stays for years, adding a layer each year.', 'A white underside: scratch it and the line turns brown.', 'Little nipple-like bumps underneath, made by a tiny fly.'],
    more: 'The southern bracket looks very like it, but it’s thicker and never has the bumps.',
    lives: 'Broadleaved trees, often beech.', does: 'White rot in the heartwood, low down in the trunk and big roots.' },
  { name: 'Lacquered bracket', latin: 'Ganoderma resinaceum',
    svg: bark(80) + soil(156) + `<path d="M80 108 Q150 88 190 110 Q198 130 170 136 Q120 142 80 132Z" fill="#8E2B17"/>` +
      `<path d="M96 106 Q130 96 160 102" stroke="#fff" stroke-width="4" opacity=".45" fill="none" stroke-linecap="round"/><path d="M104 116 Q130 110 150 112" stroke="#fff" stroke-width="2.5" opacity=".3" fill="none" stroke-linecap="round"/>` +
      `<path d="M156 98 Q192 104 194 120 Q192 132 172 136" stroke="#F2DFA0" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      num(124, 86, 1) + num(214, 120, 2) + num(40, 140, 3),
    clues: ['A shiny, red-brown top, as if it’s been varnished.', 'A creamy-yellow edge while it’s growing.', 'Low down on the trunk, often oak. A new one grows each year.'],
    lives: 'Oak, and sometimes other trees.', does: 'White rot in the roots and the bottom of the trunk. It can spread into the working wood.' },
  { name: 'Dryad’s saddle', latin: 'Cerioporus squamosus',
    svg: bark(60) + `<path d="M60 102 L92 104 L92 120 L60 122Z" fill="#E9D8B4"/><path d="M60 104 L74 104 L74 120 L60 121Z" fill="#1E1C1A"/>` +
      `<clipPath id="ds-cap"><path d="M84 114 Q84 46 190 46 Q236 60 226 100 Q170 136 84 114Z"/></clipPath>` +
      `<path d="M84 114 Q84 46 190 46 Q236 60 226 100 Q170 136 84 114Z" fill="#E9D8B4" stroke="#C9B48A" stroke-width="2"/><g clip-path="url(#ds-cap)">` + scales() + `</g>` +
      num(206, 64, 1) + num(150, 84, 2) + num(68, 140, 3),
    clues: ['A big cream fan, shaped like a saddle, in spring and early summer.', 'Brown scales in rings, like a pheasant’s feathers.', 'A short, thick stalk, black at the bottom.'],
    more: 'Underneath has big, wide holes, and it smells of cucumber or watermelon.',
    lives: 'Sycamore, elm, ash and beech.', does: 'White rot. It waits at wounds, where the sapwood has dried out.' },
  { name: 'Birch polypore', latin: 'Fomitopsis betulina',
    svg: bark(80, '#F2F0EA', '#F2F0EA') + [[12, 30], [44, 22], [20, 140], [52, 120], [30, 160]].map(([x, y]) => `<rect x="${x}" y="${y}" width="22" height="4" rx="2" fill="#2B2B2B"/>`).join('') +
      `<path d="M14 80 l10 -8 l10 8 l-10 8z" fill="#3A3A3A"/>` +
      `<path d="M80 60 Q150 48 176 80 Q186 104 162 112 Q120 120 80 108Z" fill="#BCA88E"/><path d="M90 64 Q140 56 166 78" stroke="#D4C4AA" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M80 108 Q120 120 162 112 Q178 106 174 118 Q130 134 80 122Z" fill="#FAF7F0" stroke="#D8D0C0" stroke-width="1.5"/>` +
      num(36, 104, 1) + num(130, 84, 2) + num(132, 146, 3),
    clues: ['Only ever on birch.', 'A smooth, pale grey-brown cushion, like a hoof, with a rounded edge.', 'White underneath, with tiny holes.'],
    lives: 'Birch, usually ones that are weak or dying.', does: 'Brown rot. It hides inside healthy birch, then wakes up when the tree weakens.' },
  { name: 'Honey fungus', latin: 'Armillaria',
    svg: bark(70) + `<rect x="12" y="50" width="44" height="78" rx="6" fill="#DCC69C"/><path d="M20 56 q10 20 0 40 q-6 14 6 30 M34 54 q-8 24 4 44 q6 14 -2 28 M46 58 q6 18 -2 34" stroke="#141010" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      soil(150) + `<path d="M80 160 q30 -6 50 4 M120 170 q40 -10 90 0" stroke="#141010" stroke-width="3" fill="none"/>` +
      [[104, 150, 96, 22], [134, 150, 70, 24], [164, 150, 92, 21], [194, 150, 66, 19], [222, 150, 84, 16]].map(([x, base, top, r]) =>
        `<rect x="${x - 4}" y="${top}" width="8" height="${base - top}" fill="#EFE3C6"/><ellipse cx="${x}" cy="${top + 22}" rx="9" ry="3" fill="#FAF7F0"/>` +
        `<path d="M${x - r} ${top + 4} Q${x} ${top - r * .9} ${x + r} ${top + 4}Z" fill="#C99A3A"/>` +
        [[-4, -6], [3, -9], [6, -3], [-1, -2]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${top + dy}" r="1.6" fill="#5A3A14"/>`).join('')).join('') +
      num(166, 54, 1) + num(150, 124, 2) + num(34, 140, 3),
    clues: ['Clumps of honey-coloured mushrooms at the bottom of the tree, in autumn.', 'Little dark scales in the middle of each cap, and a white ring round the stem.', 'Black bootlaces under the bark and in the soil.'],
    more: 'Under the bark there can also be a white, fan-shaped sheet of fungus.',
    lives: 'Lots of different trees and shrubs.', does: 'Attacks living roots and the bottom of the trunk, then white rot. One of the few that can break in.' },
  { name: 'Brittle cinder', latin: 'Kretzschmaria deusta',
    svg: `<path d="M50 0 L150 0 L150 120 Q170 150 200 160 L10 160 Q40 150 50 120Z" fill="#7A5A3E"/>` + soil(156) +
      `<path d="M30 132 Q40 112 70 116 Q86 122 80 140 Q60 152 34 146Z" fill="#9C9A94" stroke="#FAFAF7" stroke-width="5"/>` +
      `<path d="M96 138 Q100 118 130 120 Q156 124 160 142 Q140 156 104 152Z" fill="#1E1C1A"/>` + [[108, 132], [122, 128], [136, 134], [148, 140], [118, 144]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#2C2926"/>`).join('') +
      num(56, 98, 1) + num(130, 104, 2),
    clues: ['In spring: a flat grey crust with a white edge, right at the bottom of the trunk.', 'Later: black and lumpy, like burnt charcoal or tarmac. It crumbles when you press it.'],
    more: 'It’s easy to miss, so tree surgeons look for it on purpose.',
    lives: 'Beech, lime and other broadleaved trees.', does: 'Soft rot, then white rot, in the bottom of the trunk and roots. The tree can snap with little warning.' },
  { name: 'Ash dieback', latin: 'Hymenoscyphus fraxineus',
    svg: `<rect x="0" y="0" width="240" height="180" fill="#C9B28A"/>` + [[30, 30], [180, 150], [60, 160], [210, 30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="18" ry="8" fill="#B39466" transform="rotate(-30 ${x} ${y})"/>`).join('') +
      `<path d="M20 150 Q70 110 130 60" stroke="#2A2420" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      [[46, 128], [62, 116], [80, 100], [98, 86], [112, 74]].map(([x, y]) => `<path d="M${x} ${y} l0 -8" stroke="#F5F0E0" stroke-width="2"/><ellipse cx="${x}" cy="${y - 10}" rx="5" ry="2.6" fill="#FAF7F0" stroke="#D8D0C0"/>`).join('') +
      `<rect x="160" y="20" width="70" height="140" rx="10" fill="#E9E1CC"/><path d="M195 26 L195 154" stroke="#8A8F5A" stroke-width="12"/><path d="M195 90 L222 70" stroke="#8A8F5A" stroke-width="7"/>` +
      `<path d="M195 62 L204 90 L195 118 L186 90Z" fill="#4A2E1A"/>` +
      num(30, 168, 1) + num(98, 60, 2) + num(176, 92, 3),
    clues: ['Last year’s fallen ash leaf stalks, gone black, in the leaf litter.', 'Tiny white cups on the stalks, only a few millimetres across, in summer.', 'On the tree: dark, diamond-shaped patches on the bark where a twig joins.'],
    lives: 'Ash.', does: 'Grows from the leaves into the twigs and wood, so the branches die back from the tips.' },
];
const spotCard = s => `<figure class="spot" id="spot-${slug(s.name)}"><svg viewBox="0 0 240 180" role="img" aria-labelledby="spot-${slug(s.name)}-h" focusable="false">${s.svg}</svg>` +
  `<figcaption><h3 id="spot-${slug(s.name)}-h">${s.name} <i>${s.latin}</i></h3><ol class="clues">${s.clues.map(c => `<li>${c}</li>`).join('')}</ol>` +
  (s.more ? `<p>${s.more}</p>` : '') + `<p><b>Lives on:</b> ${s.lives}</p><p><b>What it does:</b> ${s.does}</p></figcaption></figure>`;
const spotGallery = () => `<p class="spot-safe">Look, draw and take photos. Never pick or eat wild fungi. The numbers on each picture match the clues.</p><div class="spots">${SPOTS.map(spotCard).join('')}</div>`;

// ---------- the text ----------
// zones: [id, class, nav label, where, question, answer, items]; an item is [question, answer] or {fig:'id'}
const ZONES = [
  ['fungus', 'z-leaf', 'What is a fungus?', 'Meet the fungi', 'What is a fungus?',
    'A living thing that isn’t a plant or an animal. It can’t make its own food, so it eats other things, and most of it is hidden.', [
      ['Is a fungus a plant?', 'No. A plant makes its own food from sunshine. A fungus can’t, so it [feeds on other things|heterotroph], a bit like we do. Fungi are [a group of living things all of their own|kingdom Fungi].'],
      ['Where is the rest of the fungus?', 'Most of a fungus is [a web of tiny threads|mycelium], each [thinner than a hair|hypha (plural: hyphae)]. The threads grow through wood or soil, eating as they go. The mushroom or bracket you see is only [the fungus’s fruit|fruiting body].'],
      ['How does a fungus eat?', 'It has no mouth. The threads [leak out juices that break food into tiny pieces|enzymes], then [soak the pieces up|absorption]. It eats from the outside in.'],
      ['What are spores?', 'A fungus’s fruit lets go of [tiny specks, like seeds|spores], far too small to see. They drift on the wind, so spores land on trees all the time. Most land somewhere they can’t grow, and nothing happens.'],
    ]],
  ['wood', 'z-trunk', 'Wood', 'Inside the wood', 'What is wood made of?',
    'Millions of tiny tubes, with walls made of strong strings and soaked in woody glue.', [
      ['What are the tubes made of?', 'Each tube’s wall is [strong strings|cellulose] wound round and round in layers, soaked in [a tough, woody glue|lignin]. More glue sits [between the tubes|middle lamella], holding them together.'],
      { fig: 'wood' },
      ['Is paper made of wood?', 'Yes! Paper is the [wood strings|cellulose fibres], pulled apart, with most of the glue taken out, then pressed flat. Tear some paper and look closely at the edge: the fuzzy bits are the strings. Newspaper keeps more of the glue in, which is why old newspaper goes yellow in the sun.'],
      ['Why is wood so hard to eat?', 'The strings are wrapped up in glue, and the glue is very hard to break down. Hardly anything can eat it. People can’t even eat the strings: that’s the [fibre in our food|dietary fibre]. Some fungi can eat both, which makes them the forest’s [big recyclers|decomposers].'],
    ]],
  ['chances', 'z-branch', 'Opportunists', 'Waiting for a chance', 'Why don’t fungi eat every tree?',
    'Healthy, working wood is wet and fights back. Most fungi wait for a chance: wood that has stopped working.', [
      ['Why can’t fungi eat healthy wood?', 'Wood that’s carrying water is [full of water|high moisture content], so there’s [hardly any air inside|low oxygen], and most fungi need air. Its [living cells|parenchyma] fight back with chemicals, too.'],
      ['What is an opportunist?', 'Someone who waits for a chance, then grabs it. Most wood-eating fungi are like that. They can’t break into healthy wood, so they wait for wood that has [stopped working|dysfunctional wood].'],
      ['What happens when you cut off a branch?', 'Every leaf sits at the top of [lots of drinking straws|xylem vessels] running down through the wood. The leaves pull water up those straws. Cut the branch off and nothing pulls any more. The straws in the stub [fill with air|embolism] and dry out, and the living cells nearby die. That wood has [stopped working|dysfunction].'],
      { fig: 'cut' },
      ['Why do fungi move into the dry wood?', 'Dry, airy wood with nothing left to fight back is just what a fungus wants. Spores land on the cut, or [were already hiding inside|latent colonisation], and the fungus moves in. The tree builds [walls|compartmentalisation (CODIT)] to keep it in that one part: see <a target="_blank" rel="noopener" href="../trees/#how-does-a-tree-deal-with-a-wound">how a tree deals with a wound</a>.'],
      ['Why do big cuts matter?', 'The bigger the cut, the more straws stop working, and the more dry wood there is for fungi. Taking lots of leaves off a tree at once, like [chopping its top off|topping], does the same all over the tree. That’s why tree surgeons try to [make small cuts|minimising wound size], and why <a target="_blank" rel="noopener" href="../trees/#when-is-the-worst-time-to-prune-a-tree">when you prune</a> matters too.'],
      ['Does cutting roots do the same?', 'Yes. Roots are the bottom end of the straws. Cut a big root and the wood it was feeding [stops working too|dysfunction], and fungi can get in from below.'],
      ['Is a snapped branch different from a sawn one?', 'When a branch snaps, the wood mostly [pulls apart between the tubes|intercellular fracture], along the glue, leaving a jagged, splintery end. A saw [slices straight across the tubes|transverse cut] and leaves them cut open. On some old trees, tree surgeons copy snapping on purpose with [jagged cuts|coronet cuts, natural fracture pruning], to make homes for beetles and fungi. Whether a snapped end rots more slowly than a sawn one hasn’t been tested properly yet, but here at The Tree Fella we can’t help noticing much less rot around natural snaps than around pruning cuts.'],
      { fig: 'break' },
    ]],
  ['heartwood', 'z-bark', 'Heartwood', 'In the middle', 'What’s in the middle of a tree?',
    'Old wood that has stopped carrying water. Some trees fill it with chemicals that fungi hate. Others don’t.', [
      ['What is heartwood?', 'As a tree grows, the old wood in the middle [stops carrying water|non-conducting wood] and its living cells die. In many trees it fills up with [chemicals that fungi hate|extractives] and turns darker. That’s [heartwood|heartwood].'],
      ['Do all trees protect their middle?', 'No. Oak and sweet chestnut fill theirs with [bitter chemicals|tannins], the same sort that make strong tea taste bitter. Oak also [plugs its old straws with bubbles of cell|tyloses], so water and air can’t get in. Other trees, like beech and birch, [don’t make a protected middle|no true heartwood]. Their middle rots more easily.'],
      ['What lines the tree’s walls?', 'When a tree builds a wall round damage, it can line it with [a waxy, corky stuff|suberin], the same stuff that makes cork waterproof. It’s mostly in the walls and the bark, not the heartwood.'],
      ['Which fungi eat heartwood?', 'Some fungi are [heartwood specialists|heart rot fungi]. They can live where there’s [hardly any air and lots of tree chemicals|low oxygen, high carbon dioxide, phenolic compounds]. Many are fussy and only live in one kind of tree, like the [beefsteak fungus|Fistulina hepatica], which lives on oak and sweet chestnut.'],
      ['Is a tree with heart rot going to die?', 'Not usually. The heartwood isn’t carrying water, so the tree can carry on for years and years while the middle slowly [hollows out|hollowing]. [Chicken of the woods|Laetiporus sulphureus] is famous for hollowing out very old oaks. A hollow tree can still be strong: see <a target="_blank" rel="noopener" href="../trees/#is-a-hollow-tree-always-weak">is a hollow tree always weak?</a>'],
    ]],
  ['ways-in', 'z-msg', 'Four ways in', 'Getting in', 'How do fungi get into a tree?',
    'Four ways. Three of them wait for a chance. Only a few fungi can break in on their own.', [
      { fig: 'ways' },
      ['Which fungi wait at a wound?', 'When bark is torn off or a branch is cut, the sapwood underneath [dries out in the air|exposed sapwood]. Lots of different fungi race to grab it, like [dryad’s saddle|Cerioporus squamosus], a big scaly bracket shaped like a saddle.'],
      ['Which fungi hide inside?', 'Some fungi sneak in while the tree is healthy, through [tiny breathing holes|lenticels and stomata], then [wait inside the wood|latent invasion], doing no harm. If the wood dries out, in a [drought|water stress], they wake up and spread fast. The [birch polypore|Fomitopsis betulina] lives in birch trees like this.'],
      ['Can a fungus hide in an acorn?', 'Yes! Scientists have found [one of these hiding fungi|Biscogniauxia mediterranea] inside acorns, but only in a few acorns, from oak trees that were already poorly. The young trees that grew from those acorns didn’t have it.'],
      ['Which fungi can break in?', 'A few fungi can attack living, working wood on their own. [Honey fungus|Armillaria] spreads from old stumps through the soil in [black bootlaces|rhizomorphs] and attacks tree roots. Fungi like this are [rare|pathogens]: most fungi on trees are opportunists.'],
    ]],
  ['rot', 'z-seed', 'Rot', 'Rot', 'Does all rot look the same?',
    'No. Different fungi eat different parts of the wood, so the rot they leave looks different.', [
      ['What is white rot?', 'Some fungi eat [the glue|lignin], and often the strings too. What’s left is pale, soft and stringy, like wet paper. Some eat [the glue first|selective delignification]; others [eat everything at once|simultaneous white rot].'],
      ['What is brown rot?', 'Other fungi eat [the strings|cellulose and hemicellulose] and leave the glue. The wood goes brown, shrinks and [cracks into little cubes|cubical cracking], then crumbles to powder. Instead of juices, these fungi [fire tiny chemical sparks|free radicals] at the strings.'],
      ['What is soft rot?', 'A few fungi [tunnel inside the tube walls|cavities in the S2 layer], leaving chains of tiny holes. The wood goes soft. [Brittle cinder|Kretzschmaria deusta] does this at the bottom of trees, and looks like a patch of burnt charcoal.'],
      { fig: 'rot' },
      ['Which rot makes a tree break?', 'Wood with some white rots [bends a long way before it breaks|ductile fracture]. Brown rot, soft rot and the white rots that eat everything at once can make wood [snap like a carrot|brittle fracture], with little warning. That’s why tree surgeons want to know which fungus is there, not just that there is one.'],
    ]],
  ['spot', 'z-time', 'Spot them', 'Spot the fungus', 'How do I tell which fungus it is?',
    'Look for clues: its shape, its colour, what’s underneath, and which tree it’s on.', [{ spots: true }]],
  ['ganoderma', 'z-soil', 'Ganoderma', 'Meet a bracket', 'What is Ganoderma?',
    'A family of big, tough bracket fungi that rot the middle of trees, usually from near the bottom.', [
      ['What does Ganoderma look like?', 'Ganoderma is a [family of fungi|genus]. Its brackets are hard and woody, and stick out from the trunk like shelves, often near the ground. Some [add a new layer every year|perennial fruiting bodies], so they stay on a tree for years. The [lacquered bracket|Ganoderma resinaceum] looks shiny, as if it’s been varnished.'],
      ['Why is it covered in cocoa powder?', 'That brown dust is its [spores|basidiospores]. There are so many that they settle all over the top of the bracket, and on the trunk and ground around it.'],
      ['Why is one called the artist’s bracket?', 'The underside of [the artist’s bracket|Ganoderma applanatum] is creamy white. Scratch it and the scratch turns dark brown, so people draw pictures on it. A tiny [fly|yellow flat-footed fly, Agathomyia wankowiczii] lays its eggs in it, which makes [little bumps|galls]. It doesn’t do this to the [southern bracket|Ganoderma australe], so the bumps help tell them apart.'],
      ['What does Ganoderma do to a tree?', 'It mostly [rots the middle|heart rot] with white rot, low down in the trunk and big roots, and some kinds can [spread into the working wood|extend into sapwood] too. If enough wood rots, the trunk can break or the tree can blow over. So when tree surgeons see Ganoderma, they check how much good wood is left.'],
    ]],
  ['illness', 'z-deep', 'Tree diseases', 'Making trees ill', 'Which fungi make trees ill?',
    'Only a few. They attack the living, working parts of a tree, and many arrived here from other countries.', [
      ['What is ash dieback?', '[Ash dieback|Hymenoscyphus fraxineus] is a fungus that came from [eastern Asia|native range]. In summer it grows [tiny white cups|apothecia] on [last year’s fallen leaf stalks|leaf rachises] on the ground. Their spores blow onto ash leaves, and the fungus grows from the leaf into the twig and the wood. Twigs and branches [die back from the tips|dieback]. A few ash trees can [fight it off|tolerance].'],
      ['What is Dutch elm disease?', '[Dutch elm disease|Ophiostoma novo-ulmi] is a fungus carried by [little beetles|elm bark beetles] that tunnel under elm bark. It grows inside the water straws. The tree tries to stop it by [plugging its own straws|tyloses and gums], but that stops the water too, so the leaves [wilt and go yellow|wilting]. Peel back the bark and there are [brown streaks|vascular staining] in the wood. It has killed millions of elm trees in Britain.'],
      ['What is Phytophthora?', '[Phytophthora|Phytophthora] looks like a fungus, but it isn’t one. It’s a [water mould|oomycete]. Its spores [swim|zoospores] through wet soil to the tips of tree roots. It kills the thin roots that drink, and the [inner bark at the bottom of the trunk|collar rot], so the tree can’t get enough water. Sometimes [dark, sticky drips|bleeding canker] ooze out of the bark.'],
      ['How do we stop them spreading?', 'Tree germs hitch a lift on [boots, tools and new plants|pathways]. Tree surgeons [clean their kit|biosecurity] and report poorly trees to [tree scientists|Forest Research’s TreeAlert]. You can help: clean the mud off your boots before you go to a different wood or park.'],
    ]],
  ['forest', 'z-people', 'Fungi & us', 'Fungi and the forest', 'Why do forests need fungi?',
    'Without them, dead wood would pile up and up, and lots of animals would have nowhere to live.', [
      ['What if nothing ate dead wood?', 'Dead trees and branches would [hardly rot at all|decomposition], and the forest floor would fill up with wood. Fungi turn it back into [food for the soil|nutrient cycling], so new trees can grow.'],
      ['Are hollow trees useful?', 'Very! Hollows made by heart rot fungi become homes for bats, owls and beetles. Dead wood is busy: see <a target="_blank" rel="noopener" href="../trees/#is-dead-wood-useful">is dead wood useful?</a>'],
      ['Are some fungi the tree’s friends?', 'Yes. Fungi wrapped round tree roots swap water and minerals for sugar: see <a target="_blank" rel="noopener" href="../trees/#why-do-tree-roots-need-fungi">why tree roots need fungi</a>.'],
      ['Can I touch or eat fungi on trees?', 'Never eat wild fungi. Some deadly ones look just like safe ones. Look at them, draw them and take photos instead, and wash your hands if you touch one. If you spot a big bracket at the bottom of a tree near a path or playground, tell a grown-up.'],
    ]],
];

const nFig = Object.keys(FIGS).length;

const hero = `<svg id="hero-fungi" viewBox="0 0 400 420" role="img" aria-labelledby="hft"><title id="hft">A tree trunk with a big bracket fungus near the bottom, brown spore dust on top of it, and white fungus threads spreading through the soil and the wood.</title>
<rect x="150" y="0" width="120" height="330" fill="#8A5E3B"/><rect x="150" y="0" width="14" height="330" fill="#6E4A30"/><rect x="256" y="0" width="14" height="330" fill="#6E4A30"/>
<path d="M150 300 Q120 330 70 340 L340 340 Q300 330 270 300Z" fill="#6E4A30"/>
<rect x="0" y="336" width="400" height="84" fill="#4A3325"/>
<g stroke="#F3E6D6" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"><path d="M196 330 q-30 20 -70 26 q-40 6 -80 30"/><path d="M220 334 q30 22 80 24 q40 4 80 30"/><path d="M200 336 q-6 30 -30 52"/><path d="M226 338 q14 30 46 46"/><path d="M180 200 q14 30 6 60 q-6 30 10 60"/><path d="M236 150 q-12 40 0 80 q10 40 -6 90"/></g>
<path d="M268 222 Q334 204 382 230 Q384 246 362 254 Q318 264 268 262Z" fill="#7A5230"/><path d="M268 232 Q332 216 376 236" stroke="#9C6E42" stroke-width="4" fill="none"/><path d="M268 244 Q330 230 372 246" stroke="#9C6E42" stroke-width="4" fill="none"/><path d="M268 260 Q320 262 364 252" stroke="#F3E6D6" stroke-width="5" fill="none" stroke-linecap="round"/>
<g fill="#6B4024" opacity=".7"><circle cx="300" cy="222" r="2.5"/><circle cx="320" cy="219" r="2.5"/><circle cx="340" cy="222" r="2.5"/><circle cx="286" cy="226" r="2"/><circle cx="356" cy="228" r="2"/></g>
<g><path d="M96 340 q0 -26 -4 -34" stroke="#F3E6D6" stroke-width="6" stroke-linecap="round"/><ellipse cx="92" cy="304" rx="22" ry="11" fill="#C0392B"/><circle cx="84" cy="300" r="3" fill="#fff"/><circle cx="98" cy="303" r="3" fill="#fff"/></g>
</svg>`;

const nQ = writePage({
  dir: 'fungi', zones: ZONES, hero,
  bg: { 'z-time': 'time', 'z-leaf': 'leaf', 'z-trunk': 'trunk', 'z-branch': 'branch', 'z-bark': 'bark', 'z-msg': 'msg', 'z-seed': 'seed', 'z-soil': 'soil', 'z-deep': 'deep', 'z-people': 'people' },
  render: it => it.spots ? spotGallery() : figure(FIGS[it.fig]),
  text: nQ => ({
    title: 'How Do Fungi Work? Tree Fungi for Kids | The Learning Forest',
    description: 'How do fungi work? Why most tree fungi are opportunists, what a cut branch has to do with rot, white, brown and soft rot, Ganoderma and tree diseases, explained so a five-year-old gets it.',
    ogTitle: `How do fungi work? ${nQ} questions, answered like you’re five`,
    ogDescription: `Why most tree fungi wait for a chance, what a cut branch has to do with rot, and the few fungi that make trees ill. ${nFig} diagrams to poke at.`,
    h1: 'How do fungi work?', headline: 'How fungi work in trees, explained simply',
    ldDescription: 'How fungi live in trees: why most are opportunists, what happens to wood after a branch is cut, heartwood, white, brown and soft rot, Ganoderma, and the few fungi that make trees ill.',
    keywords: 'fungi for kids, how do fungi work, tree fungi, wood rot, white rot, brown rot, ash dieback, Dutch elm disease, Ganoderma',
    lede: `Most fungi on trees are opportunists: they wait for a chance. ${nQ} questions about what that chance is, and what fungi do when they get it. ${nFig} diagrams to play with.`,
    hint: '<p class="hint">In the answers, hover over or tap any underlined words to see their grown-up word.</p>',
    finish: `<h2 id="finish-h">You made it to the end.</h2>
    <p>That’s ${nQ} questions about how fungi work. Next time you see a bracket on a tree, you’ll know it’s only the fruit.</p>
    <p class="sources">The grown-up versions: <cite>Fungi and Trees: Their Complex Relationships</cite> by Lynne Boddy (Arboricultural Association, 2021), <cite>Fungi on Trees: An Arborists’ Field Guide</cite> by Watson, Green and Lonsdale (Arboricultural Association, 2011), and <cite>Fungal Strategies of Wood Decay in Trees</cite> by Schwarze, Engels and Mattheck (Springer, 2000).</p>`,
  }),
  css: `.spot-safe{font-weight:700;margin:0 0 1rem}\n.spots{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem}\n` +
  `.spot{margin:0;background:var(--fig-bg);color:var(--fig-ink);border-radius:20px;overflow:hidden}\n.spot svg{display:block;width:100%;height:auto}\n` +
  `.spot figcaption{padding:.8rem 1rem 1rem}\n.spot h3{font-family:var(--head);font-weight:600;font-size:1.25rem;margin:0 0 .5rem;line-height:1.15}\n` +
  `.spot h3 i{display:block;font-family:var(--body);font-weight:400;font-size:.9rem;opacity:.75}\n.spot ol{margin:0 0 .6rem;padding-left:1.5rem}\n.spot li{margin:.25rem 0}\n` +
  `.spot li::marker{font-family:var(--head);font-weight:700}\n.spot p{margin:.35rem 0}\n`,
});
console.log(`public/fungi/index.html: ${nQ} questions, ${nFig} diagrams`);
