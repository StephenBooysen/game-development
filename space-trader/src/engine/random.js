'use strict';

/**
 * Wraps a [0, 1) random source with the helpers the engine needs.
 * Pass a seeded source (see `seeded`) for repeatable tests.
 *
 * @param {function(): number} [source=Math.random]
 * @return {{next: function(): number, int: function(number, number): number, float: function(number, number): number, chance: function(number): boolean, pick: function(Array): *, weighted: function(Array<[*, number]>): *}}
 */
function makeRng(source = Math.random) {
  return {
    next: source,
    int(min, max) {
      return min + Math.floor(source() * (max - min + 1));
    },
    float(min, max) {
      return min + source() * (max - min);
    },
    chance(p) {
      return source() < p;
    },
    pick(list) {
      return list[Math.floor(source() * list.length)];
    },
    weighted(entries) {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = source() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return entries[entries.length - 1][0];
    }
  };
}

/**
 * Mulberry32: a small seeded PRNG for deterministic tests.
 * @param {number} seed
 * @return {function(): number}
 */
function seeded(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

module.exports = { makeRng, seeded, clamp };
