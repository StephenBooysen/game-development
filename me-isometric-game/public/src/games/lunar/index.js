import { Water } from '../../shared/water.js';
import { LunarWorld } from './world.js';
import { RULES } from './rules.js';
import {
  T, TILE_COLORS, SEAM_DRY, SEAM_CHARGED, KIT_COLORS,
  SKY_STOPS, WEATHER_TABLE, WEATHER_LABEL, WEATHER_MODES,
} from './config.js';

/**
 * Mare Copernicus, assembled.
 *
 * Same shape as the farm's module, because it runs on the same systems. The
 * only code the Moon owns is its worldgen and its noises; the extracting, the
 * trading, the clock and the save all come from `shared/`.
 */

const MANIFEST = [
  ['nature', [
    // crater rim
    'cliff_block_rock', 'cliff_block_stone', 'cliff_blockHalf_rock',
    'cliff_blockSlope_stone', 'cliff_blockDiagonal_rock',
    // boulders and outcrops
    'rock_largeA', 'rock_largeC', 'rock_largeD', 'rock_largeE',
    'rock_tallA', 'rock_tallC',
    'stone_largeB', 'stone_largeC', 'stone_largeE',
    'stone_tallA', 'stone_tallB', 'stone_tallC', 'stone_tallE',
    'stone_tallF', 'stone_tallG', 'stone_tallJ',
    // gravel
    'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD', 'rock_smallE', 'rock_smallF',
    'rock_smallFlatB', 'stone_smallA', 'stone_smallB', 'stone_smallD', 'stone_smallFlatA',
    // wreckage
    'log', 'log_stack', 'stump_old',
    // ice
    'crops_wheatStageA', 'crops_wheatStageB',
    // ore bodies — each is here for the material it carries, see items.js
    'mushroom_tanTall', 'mushroom_red', 'crop_turnip', 'crop_carrot', 'crop_pumpkin',
    'flower_yellowA', 'flower_purpleA',
    'flower_purpleC', 'flower_redC', 'flower_yellowC',
  ]],

  ['survival', [
    'structure-metal-wall', 'structure-metal-doorway', 'structure-metal-roof',
    'metal-panel-screws', 'floor', 'fence', 'fence-doorway',
    'signpost', 'signpost-single', 'workbench', 'chest', 'barrel', 'box', 'box-large',
    'tool-shovel', 'bottle-large', 'tool-axe-upgraded', 'tool-pickaxe-upgraded', 'tool-hammer',
  ]],

  ['chars', ['character-female-a', 'character-male-b']],
];

/**
 * There is no air, so nothing you hear travels through it: every sound is
 * conducted up the tool, through the glove, into the suit. Everything is
 * therefore low, short and a little dead — no ring, no tail, no reverb.
 */
const VOICES = {
  prepare: (s) => {
    s.tone({ freq: 420, to: 1500, type: 'sine', dur: 0.22, gain: 0.14 });
    s.burst({ freq: 2200, to: 900, dur: 0.1, gain: 0.06, q: 6 });
  },
  charge: (s) => {
    s.tone({ freq: 70, to: 190, type: 'sawtooth', dur: 0.3, gain: 0.1 });
    s.burst({ freq: 3200, to: 1200, dur: 0.22, gain: 0.07, q: 9 });
  },
  plant: (s) => {
    s.burst({ freq: 300, to: 130, dur: 0.14, gain: 0.24, q: 0.8, type: 'lowpass' });
    s.tone({ freq: 240, to: 400, type: 'square', dur: 0.16, gain: 0.07, delay: 0.08 });
  },
  harvest: (s) => {
    s.tone({ freq: 720, type: 'sine', dur: 0.1, gain: 0.16 });
    s.tone({ freq: 1080, type: 'sine', dur: 0.16, gain: 0.13, delay: 0.06 });
  },
  strike_break: (s) => {
    s.burst({ freq: 900, to: 180, dur: 0.2, gain: 0.3, q: 0.6, type: 'lowpass' });
    s.tone({ freq: 110, to: 62, type: 'square', dur: 0.14, gain: 0.16 });
  },
  strike_fell: (s) => {
    s.tone({ freq: 2400, to: 700, type: 'sawtooth', dur: 0.13, gain: 0.1 });
    s.burst({ freq: 4200, to: 1600, dur: 0.12, gain: 0.09, q: 7 });
  },
  strike_clear: (s) => s.burst({ freq: 1400, to: 420, dur: 0.16, gain: 0.16, q: 2.2 }),
  fall_break: (s) => {
    s.burst({ freq: 1200, to: 90, dur: 0.45, gain: 0.28, q: 0.5, type: 'lowpass' });
    s.tone({ freq: 88, to: 40, type: 'sawtooth', dur: 0.4, gain: 0.13 });
  },
  fall_fell: (s) => {
    s.burst({ freq: 5200, to: 1400, dur: 0.34, gain: 0.16, q: 3 });
    s.tone({ freq: 1600, to: 500, type: 'triangle', dur: 0.3, gain: 0.1 });
  },
  fall_clear: (s) => s.burst({ freq: 900, to: 260, dur: 0.22, gain: 0.16, q: 1.4 }),
  sleep: (s) => {
    s.tone({ freq: 190, to: 92, type: 'sine', dur: 1.5, gain: 0.14 });
    s.tone({ freq: 128, to: 64, type: 'sine', dur: 1.7, gain: 0.1, delay: 0.14 });
  },
  dawn: (s) => [392, 523, 698, 880].forEach((f, i) =>
    s.tone({ freq: f, type: 'sine', dur: 0.4, gain: 0.12, delay: i * 0.11 })),
};

/**
 * Life support by day, the station's reactor hum by night. The only sounds out
 * here are the ones the suit makes, so they are sparse and always the same
 * handful — which is the point.
 */
function ambience(s, nightFactor) {
  if (nightFactor > 0.6) {
    // The habitat's coolant loop, carried through the ground.
    s.tone({ freq: 58 + Math.random() * 10, type: 'sine', dur: 2.4, gain: 0.045 });
    s.tone({ freq: 87, type: 'sine', dur: 1.8, gain: 0.02, delay: 0.4 });
    return 3.0 + Math.random() * 3.5;
  }
  // Telemetry chirps from the rigs checking in.
  const base = 1500 + Math.random() * 900;
  const beeps = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < beeps; i++) {
    s.tone({ freq: base * (1 + i * 0.28), type: 'square', dur: 0.045, gain: 0.028, delay: i * 0.13 });
  }
  return 5 + Math.random() * 8;
}

export const LUNAR = {
  id: 'lunar',
  slot: 'lunar',
  name: 'Mare Copernicus',
  icon: '🌘',
  theme: 'lunar',
  tagline: 'a one-operator mining claim on the near side',
  blurb: 'Survey the seams, sink your rigs, and keep them powered through a fortnight of night.',
  bullets: ['Six ores and two deep-core wells', 'Dust, meteors and solar flares', 'A depot that refits your suit'],
  bootLines: [
    'pressurising the habitat…',
    'unrolling the mare…',
    'raising the crater wall…',
    'aligning the solar array…',
    'charging the cell…',
  ],

  manifest: MANIFEST,
  characters: ['character-female-a', 'character-male-b'],
  palette: KIT_COLORS,
  // The survival pack is one shared colormap of timber and canvas browns, which
  // is the wrong century for a mining claim. Pulling nearly all the saturation
  // out and tinting cool turns the whole kit to anodised metal in one move. The
  // suit keeps a little of its colour so the operator stays findable on basalt.
  kitGrades: {
    survival: { saturation: 0.16, tint: 0xa8b4c4 },
    chars: { saturation: 0.55, tint: 0xdce6f2 },
  },

  rules: RULES,
  terrainPaint: {
    colors: TILE_COLORS,
    prepared: { dry: SEAM_DRY, wet: SEAM_CHARGED },
    tinted: [T.REGOLITH, T.RILLE],
    tintScale: { [T.RILLE]: 0.66 },
    dust: { kinds: [T.PLATE, T.EJECTA], color: 0xb9bec6, amount: 0.1 },
    // Regolith is genuinely blotchy at this scale — more jitter than a field.
    shadeSpread: 0.3,
  },

  sky: {
    stops: SKY_STOPS,
    airless: true,
    groundTint: 0x4a4844,
  },

  weather: {
    modes: WEATHER_MODES,
    table: WEATHER_TABLE,
    labels: WEATHER_LABEL,
    charging: ['flare'],
    initial: 'clear',
    bedIntensity: { flare: 0.5 },
  },

  audio: {
    voices: VOICES,
    ambience,
    // The flare bed is a high, thin hiss — induction, not rain.
    bed: { freq: 5200, gain: 0.05, type: 'bandpass' },
  },

  createWorld: ({ grid, props, assets, scene }) => new LunarWorld({
    grid, props, assets, scene,
    opts: {
      skirtColor: 0x55544f,
      lampIntensity: 6.5,
      kitBaseY: { nature: 0.05, survival: 0 },
      // The mare doesn't stop at the crater rim, so the surround tracks the
      // regolith tint a stop darker rather than sitting there as a grey void.
      skirtByPhase: {
        dawn: 0x55544f, day: 0x66655f, dusk: 0x4b4a46, night: 0x2c2e34,
      },
    },
  }),

  // Ice in a permanently shadowed crater: barely moving, and lit from the sky
  // rather than the sun, so the glint is cold and low.
  createSurfaces: ({ grid }) => [new Water(grid, {
    kind: T.ICE,
    color: 0x9fc4dc,
    opacity: 0.72,
    amplitude: 0.25,
    glint: [0.22, 0.30, 0.38],
  })],
};
