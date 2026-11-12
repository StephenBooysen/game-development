/** Mare Copernicus's tunables. Balance can be adjusted here without hunting. */

/** Tile terrain kinds. Stored as small ints in the grid. */
export const T = {
  REGOLITH: 0,
  SEAM: 1,
  ARRAY: 2,
  PLATE: 3,
  EJECTA: 4,
  RILLE: 5,
  ICE: 6,
};

export const TILE_COLORS = {
  [T.REGOLITH]: 0x6b6a67,
  [T.SEAM]: 0x4a4640,
  [T.ARRAY]: 0x1b2434,
  [T.PLATE]: 0x8d9199,
  [T.EJECTA]: 0x93918a,
  [T.RILLE]: 0x45464b,
  [T.ICE]: 0xc3dceb,
};

/** A surveyed seam is dark rock; a charged one runs an induction blue. */
export const SEAM_DRY = 0x4a4640;
export const SEAM_CHARGED = 0x2b4a5e;

/**
 * The lunar cycle: 14 sols each, which is very nearly the real thing.
 *
 * The outpost sits in the polar highlands where the sun circles low rather
 * than climbing, so the phase sets how much light there is at all — and the
 * Long Night sets it to none, which is why nothing extracts through it.
 */
export const PHASES = [
  { key: 'dawn',  name: 'Dawn Terminator', short: 'Dwn', icon: '🌗', tint: 0x67665f },
  { key: 'day',   name: 'Full Sun',        short: 'Sun', icon: '☀️', tint: 0x7b7a74 },
  { key: 'dusk',  name: 'Dusk Terminator', short: 'Dsk', icon: '🌓', tint: 0x5c5b56 },
  { key: 'night', name: 'Long Night',      short: 'Ngt', icon: '🌑', tint: 0x393c43 },
];

/**
 * Re-grade of the nature kit's palette for a world with no chlorophyll in it.
 *
 * The kit's material names are the farm's — `grass`, `leafsFall`, `corn` — but
 * nothing says they have to mean what they're called. Every rock, cliff and
 * boulder in the pack is built from `grass`/`dirt`/`stone`, so pushing those
 * three to basalt greys turns the whole nature kit lunar in one move.
 *
 * The accent names are the useful part: they are the only way one model tells
 * itself apart from another, so each becomes an ore. `colorRed` is oxide,
 * `woodInner` is ice, `colorYellow` is helium-3. Which model carries which
 * material is checked, not guessed — see the ore table in items.js.
 */
export const KIT_COLORS = {
  // the ground and everything made of it
  grass: 0x74736d,
  leafsGreen: 0x5f7078,
  leafsDark: 0x3f4a52,
  dirt: 0x5c5952,
  dirtDark: 0x43413c,
  stone: 0x9aa0a8,
  stoneDark: 0x6e737a,
  woodBark: 0x55565b,
  woodBarkDark: 0x3e3f44,
  woodDark: 0x4a4b50,
  wood: 0x7c7f86,
  water: 0x74c6e8,
  _defaultMat: 0xb9bec6,

  // the ores — each is the one material that model carries
  colorRed: 0xc05a44,     // oxide-rich iron
  colorTan: 0xcabfa6,     // pale silicates
  colorYellow: 0xf2c74e,  // helium-3
  colorPurple: 0xa98fdc,  // platinum group
  colorWhite: 0xe4f2ff,   // frost
  woodInner: 0xd6ecf7,    // water ice
  woodBirch: 0xdbe2ea,    // titanium
  leafsFall: 0xc07a3e,    // deuterium-bearing
  corn: 0xf0d78a,
};

/**
 * Airless sky.
 *
 * There is no atmosphere to scatter light, so the "sky" is black at noon and
 * the only thing the clock changes is how hard the sun hits. The fill values
 * stay deliberately low — a lunar shadow really is close to black — but not
 * zero, because regolith does bounce and a pitch-black shadow is unplayable.
 */
export const SKY_STOPS = [
  { h: 0,    zenith: 0x000000, horizon: 0x03040a, sun: 0x2a3550, sunI: 0.05, hemiI: 0.16, ambI: 0.05, fog: 0x000000 },
  { h: 4.5,  zenith: 0x000000, horizon: 0x04060e, sun: 0x33405e, sunI: 0.08, hemiI: 0.18, ambI: 0.06, fog: 0x000000 },
  { h: 6.2,  zenith: 0x010206, horizon: 0x0d1018, sun: 0xb9c3d8, sunI: 1.10, hemiI: 0.26, ambI: 0.09, fog: 0x000000 },
  { h: 8.0,  zenith: 0x02030a, horizon: 0x11141c, sun: 0xf4f2ea, sunI: 2.60, hemiI: 0.34, ambI: 0.12, fog: 0x000000 },
  { h: 12.5, zenith: 0x03040c, horizon: 0x14171f, sun: 0xfffdf6, sunI: 3.60, hemiI: 0.40, ambI: 0.15, fog: 0x000000 },
  { h: 16.5, zenith: 0x02030a, horizon: 0x11141c, sun: 0xfaf6e8, sunI: 2.70, hemiI: 0.34, ambI: 0.12, fog: 0x000000 },
  { h: 18.6, zenith: 0x010206, horizon: 0x0c0f16, sun: 0xc8bfae, sunI: 1.00, hemiI: 0.24, ambI: 0.09, fog: 0x000000 },
  { h: 20.3, zenith: 0x000004, horizon: 0x05070e, sun: 0x4a5470, sunI: 0.18, hemiI: 0.19, ambI: 0.06, fog: 0x000000 },
  { h: 22.0, zenith: 0x000000, horizon: 0x03040a, sun: 0x2e3852, sunI: 0.07, hemiI: 0.17, ambI: 0.05, fog: 0x000000 },
  { h: 24,   zenith: 0x000000, horizon: 0x03040a, sun: 0x2a3550, sunI: 0.05, hemiI: 0.16, ambI: 0.05, fog: 0x000000 },
];


/**
 * Odds by phase. A solar flare charges every rig for you overnight — and there
 * are none through the Long Night, which is the whole difficulty of it.
 */
export const WEATHER_TABLE = {
  dawn:  [['clear', 0.45], ['dust', 0.25], ['flare', 0.22], ['meteor', 0.08]],
  day:   [['clear', 0.40], ['dust', 0.18], ['flare', 0.34], ['meteor', 0.08]],
  dusk:  [['clear', 0.45], ['dust', 0.27], ['flare', 0.18], ['meteor', 0.10]],
  night: [['clear', 0.55], ['dust', 0.30], ['meteor', 0.15]],
};

export const WEATHER_LABEL = {
  clear: 'vacuum, still and hard',
  dust: 'levitated dust across the mare',
  meteor: 'a micrometeorite shower',
  flare: 'a solar flare — the arrays are singing',
};

/** Particle fields, keyed by the weather they belong to. */
export const WEATHER_MODES = {
  // Electrostatic levitation: dust doesn't fall so much as drift sideways.
  dust: {
    kind: 'point', count: 1200, color: 0xa89b86, opacity: 0.5,
    speed: [0.6, 1.6], size: 0.09, sway: 1.4, wind: [3.5, 1.2],
  },
  meteor: {
    kind: 'streak', count: 60, color: 0xffe3a8, opacity: 0.85,
    speed: [55, 80], streak: 2.2, slant: 0.9,
  },
  // Charged particles lit up by the arrays — bright, weightless, everywhere.
  flare: {
    kind: 'point', count: 700, color: 0xffdf9c, opacity: 0.55,
    speed: [0.4, 1.0], size: 0.07, sway: 1.0, wind: [0.8, -0.4],
  },
};
