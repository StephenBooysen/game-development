// Floor and ceiling patterns, made pixel by pixel in code.
// Walls are drawn one column at a time with drawImage, but floors are drawn one
// screen *row* at a time and every pixel lands on a different spot of the pattern
// ("floor casting", see render.js). That needs direct access to the pattern's pixels,
// so these patterns are plain arrays of colours instead of canvases.

/** Floor and ceiling patterns are 64x64 pixels, like the walls. */
export const FLOOR_SIZE = 64;
/** How many darker copies are made for distance fog (0 = full brightness). */
export const SHADES = 16;

const N = FLOOR_SIZE;

// Same idea as in textures.js: a seeded generator, so the pattern is the same every time.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jitter = (rgb, rng, amount) => {
  const change = (rng() - 0.5) * amount;
  return rgb.map((value) => value + change);
};

// Each painter returns the colour [r, g, b] of one pixel. `rng` gives a little grain.
const PAINTERS = {
  // Large grey stone slabs with dark joints.
  flagstone: (x, y, rng) => {
    const joint = x % 32 === 0 || y % 32 === 0;
    const slab = ((x >> 5) + (y >> 5) * 2) % 3;
    return jitter(joint ? [52, 52, 50] : [[112, 110, 104], [102, 100, 96], [120, 117, 110]][slab], rng, 18);
  },
  // Pale plaster with a dark wooden beam every half tile.
  plaster: (x, y, rng) => (y % 32 < 4 ? jitter([60, 44, 28], rng, 10) : jitter([92, 90, 84], rng, 10)),
  // A checkerboard of small tiles.
  tiles: (x, y, rng) => {
    if (x % 16 === 0 || y % 16 === 0) return [40, 38, 34];
    return jitter(((x >> 4) + (y >> 4)) % 2 ? [128, 120, 100] : [84, 80, 70], rng, 8);
  },
  // Dark metal ceiling panels with rivets in the corners.
  panels: (x, y, rng) => {
    const px = x % 32;
    const py = y % 32;
    if (px === 0 || py === 0) return [20, 20, 34];
    if ((px === 3 || px === 28) && (py === 3 || py === 28)) return [130, 130, 150];
    return jitter([48, 50, 76], rng, 8);
  },
  // Packed earth with pebbles.
  dirt: (x, y, rng) => (rng() < 0.04 ? [120, 110, 90] : jitter([78, 62, 44], rng, 26)),
  // Rough cave rock with mossy patches.
  rock: (x, y, rng) => {
    const moss = Math.sin(x * 0.3) + Math.cos(y * 0.25) > 1.2;
    return jitter(moss ? [44, 66, 38] : [46, 48, 44], rng, 22);
  },
};

/** The names of all floor and ceiling patterns. */
export const FLOOR_NAMES = Object.freeze(Object.keys(PAINTERS));

// Pixels are stored as one 32-bit number each, in the byte order canvas ImageData
// uses on little-endian computers (nearly all of them): red in the lowest byte.
const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const byte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const cache = new Map();

/**
 * A floor or ceiling pattern: an array of SHADES copies, each a Uint32Array of
 * 64x64 packed pixels. Copy 0 is full brightness, later ones are darker (for fog).
 * Unknown names give null, so the renderer falls back to a flat colour.
 */
export function floorTexture(name) {
  if (!PAINTERS[name]) return null;
  if (cache.has(name)) return cache.get(name);
  const rng = seeded(name.length * 104729);
  const base = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) base.push(PAINTERS[name](x, y, rng));
  }
  const shades = Array.from({ length: SHADES }, (_, level) => {
    // The same darkening as the wall fog in render.js: up to 60% darker.
    const light = 1 - (level / (SHADES - 1)) * 0.6;
    return Uint32Array.from(base, ([r, g, b]) => pack(byte(r * light), byte(g * light), byte(b * light)));
  });
  cache.set(name, shades);
  return shades;
}
