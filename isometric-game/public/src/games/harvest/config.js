/** Harvest Hollow's tunables. Balance can be adjusted here without hunting. */

/** Tile terrain kinds. Stored as small ints in the grid. */
export const T = {
  GRASS: 0,
  SOIL: 1,
  WATER: 2,
  PATH: 3,
  SAND: 4,
  FOREST: 5,
};

export const TILE_COLORS = {
  [T.GRASS]: 0x6fae4a,
  [T.SOIL]: 0x7a5334,
  [T.WATER]: 0x2f7fb5,
  [T.PATH]: 0x9c8f74,
  [T.SAND]: 0xd8c48c,
  [T.FOREST]: 0x4d7c39,
};

/** Wet soil is just a darker, cooler soil. */
export const SOIL_WET_COLOR = 0x46301d;

export const SEASONS = [
  { key: 'spring', name: 'Spring', short: 'Spr', icon: '🌱', tint: 0x6fae4a },
  { key: 'summer', name: 'Summer', short: 'Sum', icon: '☀️', tint: 0x5f9c3a },
  { key: 'autumn', name: 'Autumn', short: 'Aut', icon: '🍂', tint: 0x9a8f42 },
  { key: 'winter', name: 'Winter', short: 'Win', icon: '❄️', tint: 0xa8b6ab },
];

/**
 * Re-grade of the nature kit's palette, keyed by its material names.
 *
 * The kit ships a bright turquoise-and-peach scheme (its grass is #2cd8b8),
 * which fights both the ground colours above and the warm signage look of the
 * interface. Only twenty material names exist across the whole pack, so
 * restating them is cheaper and far more controllable than a hue filter — and
 * it leaves the flowers and mushrooms their accent colours.
 *
 * Only applies to untextured materials; the town/food/survival/character kits
 * share a colormap texture and are left alone.
 */
export const KIT_COLORS = {
  grass: 0x82c257,
  leafsGreen: 0x5ea63c,
  leafsDark: 0x3d7a37,
  leafsFall: 0xd9812f,
  woodBark: 0x8e5c3c,
  woodBarkDark: 0x6f4629,
  woodDark: 0x6a4429,
  wood: 0xa8753f,
  woodInner: 0xd9bf92,
  woodBirch: 0xeadcbe,
  dirt: 0x8a5f3a,
  dirtDark: 0x6a4527,
  stone: 0xa6ada4,
  stoneDark: 0x848c85,
  water: 0x4f9fd0,
  corn: 0xe6bb5c,
  colorRed: 0xcf4640,
  colorPurple: 0x8f74d4,
  colorYellow: 0xefb241,
  colorTan: 0xdca878,
  colorWhite: 0xf2ecdd,
  _defaultMat: 0xf0ead8,
};

/** hour, zenith, horizon, sun colour, sun intensity, hemi intensity, fog */
export const SKY_STOPS = [
  { h: 0,    zenith: 0x080d20, horizon: 0x18213c, sun: 0x415a96, sunI: 0.20, hemiI: 0.30, ambI: 0.14, fog: 0x141d33 },
  { h: 4.5,  zenith: 0x0d1630, horizon: 0x2a3050, sun: 0x536ba8, sunI: 0.26, hemiI: 0.36, ambI: 0.16, fog: 0x1c2440 },
  { h: 6.2,  zenith: 0x4d6ca8, horizon: 0xf0a978, sun: 0xffb583, sunI: 1.35, hemiI: 0.70, ambI: 0.26, fog: 0xc9a68e },
  { h: 8.0,  zenith: 0x6ea3dd, horizon: 0xd6ecff, sun: 0xfff0cf, sunI: 2.45, hemiI: 1.00, ambI: 0.33, fog: 0xbcd8ea },
  { h: 12.5, zenith: 0x74b4ee, horizon: 0xdcf0ff, sun: 0xfffaf0, sunI: 3.00, hemiI: 1.15, ambI: 0.38, fog: 0xbfdcef },
  { h: 16.5, zenith: 0x7fb0e2, horizon: 0xffe9c8, sun: 0xffdca6, sunI: 2.35, hemiI: 0.98, ambI: 0.34, fog: 0xcfd9df },
  { h: 18.6, zenith: 0x53619c, horizon: 0xff9f62, sun: 0xff9257, sunI: 1.15, hemiI: 0.62, ambI: 0.25, fog: 0xb5859a },
  { h: 20.3, zenith: 0x1e2750, horizon: 0x5b4270, sun: 0x6d6bb0, sunI: 0.42, hemiI: 0.40, ambI: 0.18, fog: 0x33304f },
  { h: 22.0, zenith: 0x0a1024, horizon: 0x1b2340, sun: 0x475f9c, sunI: 0.22, hemiI: 0.32, ambI: 0.15, fog: 0x161f36 },
  { h: 24,   zenith: 0x080d20, horizon: 0x18213c, sun: 0x415a96, sunI: 0.20, hemiI: 0.30, ambI: 0.14, fog: 0x141d33 },
];

/** Odds by season. Rain waters every bed for you overnight. */
export const WEATHER_TABLE = {
  spring: [['clear', 0.45], ['cloudy', 0.25], ['rain', 0.30]],
  summer: [['clear', 0.55], ['cloudy', 0.20], ['rain', 0.18], ['storm', 0.07]],
  autumn: [['clear', 0.40], ['cloudy', 0.30], ['rain', 0.30]],
  winter: [['clear', 0.40], ['cloudy', 0.28], ['snow', 0.32]],
};

export const WEATHER_LABEL = {
  clear: 'a clear morning',
  cloudy: 'grey and still',
  rain: 'rain on the roof',
  storm: 'a storm rolling through',
  snow: 'snow overnight',
};

/** Particle fields, keyed by the weather they belong to. */
export const WEATHER_MODES = {
  rain: {
    kind: 'streak', count: 1100, color: 0xbcd8ef, opacity: 0.44,
    speed: [22, 34], streak: 0.55, slant: 0.12,
  },
  storm: {
    kind: 'streak', count: 1200, color: 0xbcd8ef, opacity: 0.72,
    speed: [28, 42], streak: 0.62, slant: 0.34,
  },
  snow: {
    kind: 'point', count: 900, color: 0xffffff, opacity: 0.9,
    speed: [1.1, 2.4], size: 0.12, sway: 0.6,
  },
};
