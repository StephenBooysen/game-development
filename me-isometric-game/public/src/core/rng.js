/**
 * Deterministic randomness. World generation needs to be reproducible from a
 * seed so a saved farm regenerates its scenery identically.
 */

/** mulberry32 — small, fast, good enough for scenery. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (lo, hi) => Math.floor(rng.range(lo, hi + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  /** Random unit angle, handy for scattering props. */
  rng.angle = () => rng() * Math.PI * 2;
  return rng;
}

/** Cheap hash-based value noise — enough for terrain colour and clumping. */
export function makeNoise(seed = 1) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2654435761) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);

  /** Value noise in roughly [0,1]. */
  const noise2 = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };

  /** Layered noise for a more organic result. */
  noise2.fbm = (x, y, octaves = 3, gain = 0.5, lacunarity = 2) => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };

  return noise2;
}
