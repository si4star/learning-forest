// How do fungi work?: writes public/fungi/index.html and public/fungi/fungi.css.
// The text lives here. In an answer, [shown words|grown-up word] makes the shown words tappable,
// lighting up their grown-up word underneath. Run `node scripts/fungi.mjs` after changing anything.
// The styles are the How does a tree work? page's own, copied from it each run so the two match.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const esc = s => s.replace(/&(?![a-z#0-9]+;)/g, '&amp;');
const slug = s => s.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  note: 'Grown-up words: a break along the glue is an intercellular fracture; a cut through the walls is transwall. Nobody has yet tested properly whether a snapped end rots more slowly than a saw cut.',
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

function figure(f) {
  const first = f.buttons[0];
  return `<figure class="fig" id="fig-${f.id}" data-fig="${f.id}" data-state="${first[0]}"><figcaption class="fig-title" id="${f.id}-c">${f.title}</figcaption>` +
    `<svg viewBox="${f.viewBox || '0 0 400 262'}" role="img" aria-labelledby="${f.id}-c ${f.id}-d" focusable="false"><desc id="${f.id}-d">${f.desc}</desc>${f.svg}</svg>` +
    `<div class="ctl" role="group" aria-label="${f.title}">` +
    f.buttons.map(([s, label, say], i) => `<button type="button" data-state="${s}" data-say="${say}" aria-pressed="${i ? 'false' : 'true'}">${label}</button>`).join('') +
    `</div><p class="cap" aria-live="polite">${first[2]}</p><p class="fig-note">${f.note}</p></figure>`;
}

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
      ['Why do fungi move into the dry wood?', 'Dry, airy wood with nothing left to fight back is just what a fungus wants. Spores land on the cut, or [were already hiding inside|latent colonisation], and the fungus moves in. The tree builds [walls|compartmentalisation (CODIT)] to keep it in that one part: see <a href="../trees/#how-does-a-tree-deal-with-a-wound">how a tree deals with a wound</a>.'],
      ['Why do big cuts matter?', 'The bigger the cut, the more straws stop working, and the more dry wood there is for fungi. Taking lots of leaves off a tree at once, like [chopping its top off|topping], does the same all over the tree. That’s why tree surgeons try to [make small cuts|minimising wound size], and why <a href="../trees/#when-is-the-worst-time-to-prune-a-tree">when you prune</a> matters too.'],
      ['Does cutting roots do the same?', 'Yes. Roots are the bottom end of the straws. Cut a big root and the wood it was feeding [stops working too|dysfunction], and fungi can get in from below.'],
      ['Is a snapped branch different from a sawn one?', 'When a branch snaps, the wood mostly [pulls apart between the tubes|intercellular fracture], along the glue, leaving a jagged, splintery end. A saw [slices straight across the tubes|transverse cut] and leaves them cut open. On some old trees, tree surgeons copy snapping on purpose with [jagged cuts|coronet cuts, natural fracture pruning], to make homes for beetles and fungi. Whether a snapped end rots more slowly than a sawn one hasn’t been tested properly yet.'],
      { fig: 'break' },
    ]],
  ['heartwood', 'z-bark', 'Heartwood', 'In the middle', 'What’s in the middle of a tree?',
    'Old wood that has stopped carrying water. Some trees fill it with chemicals that fungi hate. Others don’t.', [
      ['What is heartwood?', 'As a tree grows, the old wood in the middle [stops carrying water|non-conducting wood] and its living cells die. In many trees it fills up with [chemicals that fungi hate|extractives] and turns darker. That’s [heartwood|heartwood].'],
      ['Do all trees protect their middle?', 'No. Oak and sweet chestnut fill theirs with [bitter chemicals|tannins], the same sort that make strong tea taste bitter. Oak also [plugs its old straws with bubbles of cell|tyloses], so water and air can’t get in. Other trees, like beech and birch, [don’t make a protected middle|no true heartwood]. Their middle rots more easily.'],
      ['What lines the tree’s walls?', 'When a tree builds a wall round damage, it can line it with [a waxy, corky stuff|suberin], the same stuff that makes cork waterproof. It’s mostly in the walls and the bark, not the heartwood.'],
      ['Which fungi eat heartwood?', 'Some fungi are [heartwood specialists|heart rot fungi]. They can live where there’s [hardly any air and lots of tree chemicals|low oxygen, high carbon dioxide, phenolic compounds]. Many are fussy and only live in one kind of tree, like the [beefsteak fungus|Fistulina hepatica], which lives on oak and sweet chestnut.'],
      ['Is a tree with heart rot going to die?', 'Not usually. The heartwood isn’t carrying water, so the tree can carry on for years and years while the middle slowly [hollows out|hollowing]. [Chicken of the woods|Laetiporus sulphureus] is famous for hollowing out very old oaks. A hollow tree can still be strong: see <a href="../trees/#is-a-hollow-tree-always-weak">is a hollow tree always weak?</a>'],
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
      ['Are hollow trees useful?', 'Very! Hollows made by heart rot fungi become homes for bats, owls and beetles. Dead wood is busy: see <a href="../trees/#is-dead-wood-useful">is dead wood useful?</a>'],
      ['Are some fungi the tree’s friends?', 'Yes. Fungi wrapped round tree roots swap water and minerals for sugar: see <a href="../trees/#why-do-tree-roots-need-fungi">why tree roots need fungi</a>.'],
      ['Can I touch or eat fungi on trees?', 'Never eat wild fungi. Some deadly ones look just like safe ones. Look at them, draw them and take photos instead, and wash your hands if you touch one. If you spot a big bracket at the bottom of a tree near a path or playground, tell a grown-up.'],
    ]],
];

// ---------- page ----------
function answer(id, text) {
  let n = 0;
  const chips = [];
  const html = text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_, shown, word) => {
    n++;
    const k = `kw-${id}-${n}`, g = `gw-${id}-${n}`;
    chips.push(`<span class="gw" id="${g}" data-kw="${k}"><dfn>${word}</dfn><span class="sr"> is the grown-up word for</span><span aria-hidden="true"> =</span> ‘${shown}’</span>`);
    return `<span class="kw" id="${k}" data-gw="${g}" role="button" tabindex="0" aria-pressed="false" aria-describedby="${g}">${shown}</span>`;
  });
  return { html, chips };
}
function topic([q, a]) {
  const id = slug(q), { html, chips } = answer(id, a);
  return `<article class="topic" id="${id}" itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><h3><span itemprop="name">${esc(q)}</span></h3>` +
    `<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">${esc(html)}</p></div>` +
    (chips.length ? `<p class="words"><span class="words-h">Grown-up words:</span> ${esc(chips.join(' '))}</p>` : '') + `</article>`;
}
const BG = { 'z-leaf': 'leaf', 'z-trunk': 'trunk', 'z-branch': 'branch', 'z-bark': 'bark', 'z-msg': 'msg', 'z-seed': 'seed', 'z-soil': 'soil', 'z-deep': 'deep', 'z-people': 'people' };
const sections = ZONES.map(([id, cls, , where, q, a, items], i) => {
  const prev = ZONES[i - 1], next = ZONES[i + 1], me = `var(--${BG[cls]}-bg)`;
  const top = `color-mix(in srgb,${prev ? `var(--${BG[prev[1]]}-bg)` : 'var(--sky-bg)'},${me})`;
  const style = `--top:${top}` + (next ? `;--bot:color-mix(in srgb,${me},var(--${BG[next[1]]}-bg))` : '');
  const body = items.map(it => it.fig ? figure(FIGS[it.fig]) : topic(it)).join('');
  return `<section class="zone ${cls}" id="${id}" aria-labelledby="h-${id}" style="${style}"><div class="zone-in"><div class="zone-head" itemprop="mainEntity" itemscope itemtype="https://schema.org/Question"><p class="where">${where}</p><h2 id="h-${id}" itemprop="name">${esc(q)}</h2><div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><p itemprop="text">${esc(a)}</p></div></div><div class="topics">${body}</div></div></section>`;
}).join('\n');
const nQ = ZONES.reduce((s, z) => s + z[6].filter(it => !it.fig).length + 1, 0);
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

const ld = [{
  '@context': 'https://schema.org', '@type': 'LearningResource', '@id': 'https://learn.thetreefella.co.uk/fungi/#learning',
  url: 'https://learn.thetreefella.co.uk/fungi/', isPartOf: { '@type': 'WebSite', name: 'The Learning Forest', url: 'https://learn.thetreefella.co.uk/' },
  name: 'How do fungi work?', headline: 'How fungi work in trees, explained simply',
  description: 'How fungi live in trees: why most are opportunists, what happens to wood after a branch is cut, heartwood, white, brown and soft rot, Ganoderma, and the few fungi that make trees ill.',
  inLanguage: 'en-GB', isAccessibleForFree: true,
  keywords: 'fungi for kids, how do fungi work, tree fungi, wood rot, white rot, brown rot, ash dieback, Dutch elm disease, Ganoderma',
  learningResourceType: ['Explainer', 'Interactive diagram'], educationalLevel: 'Beginner',
  audience: { '@type': 'EducationalAudience', educationalRole: ['student', 'parent', 'teacher'] },
  teaches: ZONES.map(z => z[4]),
  author: { '@type': 'Organization', name: 'The Tree Fella', legalName: 'The Tree Fella NE Ltd', url: 'https://thetreefella.co.uk/' },
  publisher: { '@type': 'Organization', name: 'The Tree Fella', legalName: 'The Tree Fella NE Ltd', url: 'https://thetreefella.co.uk/' },
}];

const page = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>How Do Fungi Work? Tree Fungi for Kids | The Learning Forest</title>
<meta name="description" content="How do fungi work? Why most tree fungi are opportunists, what a cut branch has to do with rot, white, brown and soft rot, Ganoderma and tree diseases, explained so a five-year-old gets it.">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="The Tree Fella">
<link rel="canonical" href="https://learn.thetreefella.co.uk/fungi/">
<link rel="icon" href="/app/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
<meta name="theme-color" content="#F1F6E6">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="The Learning Forest">
<meta property="og:url" content="https://learn.thetreefella.co.uk/fungi/">
<meta property="og:title" content="How do fungi work? ${nQ} questions, answered like you’re five">
<meta property="og:description" content="Why most tree fungi wait for a chance, what a cut branch has to do with rot, and the few fungi that make trees ill. ${nFig} diagrams to poke at.">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/chrome.css">
<link rel="stylesheet" href="/fungi/fungi.css">
<link rel="stylesheet" href="/trees/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<div class="lf-stick">
<!-- lf:header -->
<div class="bar">
  <div class="bar-in">
    <nav id="nav" aria-label="Sections">${ZONES.map(z => `<a href="#${z[0]}">${esc(z[2])}</a>`).join('')}</nav>
    <div class="progress" aria-hidden="true"><span id="progress"></span></div>
  </div>
</div>
</div>
<main id="main" tabindex="-1" itemscope itemtype="https://schema.org/FAQPage">
<section class="hero" aria-labelledby="t">
  <div class="hero-in">
    <div class="hero-copy">
      <h1 id="t">How do fungi work?</h1>
      <p class="lede">Most fungi on trees are opportunists: they wait for a chance. ${nQ} questions about what that chance is, and what fungi do when they get it. ${nFig} diagrams to play with.</p>
      <p class="hint">In the answers, hover over or tap any underlined words to see their grown-up word.</p>
    </div>
    ${hero}
  </div>
</section>
${sections}
<section class="finish" aria-labelledby="finish-h">
  <div class="finish-in">
    <h2 id="finish-h">You made it to the end.</h2>
    <p>That’s ${nQ} questions about how fungi work. Next time you see a bracket on a tree, you’ll know it’s only the fruit.</p>
    <p class="sources">The grown-up versions: <cite>Fungi and Trees: Their Complex Relationships</cite> by Lynne Boddy (Arboricultural Association, 2021), <cite>Fungi on Trees: An Arborists’ Field Guide</cite> by Watson, Green and Lonsdale (Arboricultural Association, 2011), and <cite>Fungal Strategies of Wood Decay in Trees</cite> by Schwarze, Engels and Mattheck (Springer, 2000).</p>
  </div>
</section>
</main>
<!-- lf:footer -->
<button type="button" class="totop" id="totop" aria-label="Back to the top" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<script src="/trees/stick.js"></script>
<script src="/fungi/fungi.js"></script>
</body>
</html>
`;

const trees = readFileSync('public/trees/index.html', 'utf8');
const css = trees.slice(trees.indexOf('<style>') + 7, trees.indexOf('</style>'));
mkdirSync('public/fungi', { recursive: true });
writeFileSync('public/fungi/fungi.css', `/* Copied from How does a tree work? by scripts/fungi.mjs, so the two pages match. Don't edit here. */\n${css.trim()}\n` +
  `/* fungi page */\n.hero .hint{max-width:34ch}\n.topic a{color:inherit;text-decoration-thickness:2px;text-underline-offset:3px}\n`);
writeFileSync('public/fungi/index.html', page);
console.log(`public/fungi/index.html: ${nQ} questions, ${nFig} diagrams`);
