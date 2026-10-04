// Generated child credentials: easy for a 7–9 year old to read, write down and type.
// Username: Adjective + Tree + 2 digits, e.g. MightyOak42.
// Password: three short words, e.g. otter-river-lemon (≈16 million combinations,
// with login attempts rate-limited).

const ADJECTIVES = `Amber Bold Bouncy Brave Breezy Bright Calm Cheery Clever Cosy Daring Eager Fizzy Friendly
  Frosty Gentle Giant Glowing Golden Grand Happy Hardy Jolly Kind Leafy Lively Lucky Merry Mighty Misty
  Mossy Noble Plucky Proud Quick Quiet Rapid Rosy Shady Silver Snowy Sparkly Speedy Starry Steady Strong
  Sturdy Sunny Super Swift Tall Tiny Wise Zippy`.split(/\s+/);

const TREES = `Alder Apple Ash Aspen Beech Birch Cedar Cherry Chestnut Elder Elm Fir Hawthorn Hazel Holly
  Juniper Larch Laurel Lime Magnolia Maple Oak Olive Pear Pine Plum Poplar Redwood Rowan Spruce Sycamore
  Walnut Willow Yew`.split(/\s+/);

const WORDS = [...new Set(`
  ant bear bee bird cat cow crab deer dog duck fish fox frog goat hen horse lamb lion mole mouse newt
  owl panda pig pony puppy rabbit robin seal sheep shark snail swan tiger toad whale wolf zebra otter
  koala llama camel hippo kitten badger beaver donkey eagle goose lizard monkey parrot puffin spider
  turtle walrus ferret
  apple bean berry bread bun cake carrot cheese corn egg grape honey jam jelly lemon mango melon milk
  muffin onion orange pasta peach pea pie pizza rice salad soup sugar toast tomato waffle cookie donut
  pepper potato banana
  cloud river rain snow star sun moon hill lake leaf rock sand sea sky storm tree wave wind field
  flower forest grass island ocean pebble pond puddle seed shell stone stream valley beach cave frost
  comet planet rocket
  anchor arrow ball basket bell bike boat book boot bottle box brick brush bucket button candle castle
  chair clock coat coin crown cup desk drum flag fork gate glove hat jumper kettle key kite ladder lamp
  map mitten mug nest net paper pen pencil piano pillow plate pocket rope ruler scarf shoe sock sofa
  spoon stamp table teapot tent ticket train truck tunnel van wagon wheel window yoyo robot jigsaw
  crayon magnet marble parcel puzzle sail violin banjo guitar dragon giant knight wizard
  red blue green pink purple yellow silver gold
`.trim().split(/\s+/))];

function pick(list) {
  // Rejection sampling so every item is equally likely.
  const max = Math.floor(0x100000000 / list.length) * list.length;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= max);
  return list[buf[0] % list.length];
}

function digits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += pick('0123456789'.split(''));
  return s;
}

export function newUsername() {
  return pick(ADJECTIVES) + pick(TREES) + pick('123456789'.split('')) + digits(1);
}

export function newPassword() {
  const w = new Set();
  while (w.size < 3) w.add(pick(WORDS));
  return [...w].join('-');
}

export function newRecoveryCode() {
  return digits(4) + '-' + digits(4);
}

// Forgiving input: case, spaces and punctuation don't matter.
export const normUsername = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
export const normPassword = s => (String(s || '').toLowerCase().match(/[a-z]+/g) || []).join('-').slice(0, 60);
export const normRecovery = s => String(s || '').replace(/\D/g, '').slice(0, 8);

export const WORD_COUNT = WORDS.length;
