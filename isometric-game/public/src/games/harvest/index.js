import { Water } from '../../shared/water.js';
import { FarmWorld } from './world.js';
import { RULES } from './rules.js';
import {
  T, TILE_COLORS, SOIL_WET_COLOR, KIT_COLORS,
  SKY_STOPS, WEATHER_TABLE, WEATHER_LABEL, WEATHER_MODES,
} from './config.js';

/**
 * Harvest Hollow, assembled.
 *
 * Everything below is data the shared systems read. The only code the farm
 * still owns is its worldgen and its noises — the growing, the trading, the
 * clock and the save all come from `shared/`.
 */

/** Models the game actually places, grouped by kit. The packs hold ~800
 *  between them; loading all of them would cost tens of megabytes for scenery
 *  that never appears. This list is the contract. */
const MANIFEST = [
  ['nature', [
    // trees — the three deciduous types carry seasonal variants
    'tree_default', 'tree_default_dark', 'tree_default_fall',
    'tree_oak', 'tree_oak_dark', 'tree_oak_fall',
    'tree_small', 'tree_small_dark', 'tree_small_fall',
    'tree_pineDefaultA', 'tree_pineTallA', 'tree_pineRoundB', 'tree_thin', 'tree_fat',
    // crops
    'crops_leafsStageA', 'crops_leafsStageB',
    'crops_wheatStageA', 'crops_wheatStageB',
    'crops_cornStageA', 'crops_cornStageC', 'crops_cornStageD',
    'crop_turnip', 'crop_carrot', 'crop_melon', 'crop_pumpkin',
    // ground cover
    'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge',
    'flower_redA', 'flower_redB', 'flower_purpleA', 'flower_purpleC',
    'flower_yellowA', 'flower_yellowB',
    'plant_bush', 'plant_bushSmall', 'plant_bushDetailed', 'plant_bushLarge',
    'mushroom_red', 'mushroom_redGroup', 'mushroom_tan', 'mushroom_tanTall',
    // rocks, wood, water dressing
    'rock_smallA', 'rock_smallB', 'rock_largeA', 'rock_largeC', 'rock_tallA',
    'stone_smallA', 'stone_largeB',
    'log', 'log_stack', 'stump_round', 'stump_old',
    'lily_small', 'lily_large',
    // farmstead dressing
    'path_stone', 'fence_simple', 'fence_gate', 'sign', 'pot_small', 'bed',
    'campfire_stones',
  ]],

  ['town', [
    'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters',
    'roof', 'roof-gable', 'chimney',
    'lantern', 'stall-red', 'stall-bench', 'stall-stool', 'planks', 'cart',
  ]],

  ['survival', [
    'chest', 'barrel', 'box', 'workbench', 'signpost',
    'tool-hoe', 'tool-axe', 'tool-pickaxe', 'tool-shovel', 'bucket',
    'resource-wood', 'resource-stone',
  ]],

  ['food', ['apple', 'pear']],

  ['chars', ['character-female-c', 'character-male-a']],
];

/** Deciduous trees swap model as the season turns. */
const SEASONAL_TREES = new Set(['tree_default', 'tree_oak', 'tree_small']);

/** Bright green ground cover reads wrong on snow, so it hides for winter. */
const SUMMER_ONLY = [
  'nature/grass', 'nature/grass_large', 'nature/grass_leafs', 'nature/grass_leafsLarge',
  'nature/flower_redA', 'nature/flower_redB', 'nature/flower_purpleA',
  'nature/flower_purpleC', 'nature/flower_yellowA', 'nature/flower_yellowB',
];

const VOICES = {
  prepare: (s) => {
    s.burst({ freq: 420, to: 140, dur: 0.24, gain: 0.32, q: 0.8, type: 'lowpass' });
    s.tone({ freq: 130, to: 70, type: 'triangle', dur: 0.16, gain: 0.16 });
  },
  charge: (s) => s.burst({ freq: 700, to: 2600, dur: 0.5, gain: 0.16, q: 1.6 }),
  strike_fell: (s) => {
    s.burst({ freq: 1500, to: 300, dur: 0.16, gain: 0.3, q: 0.7, type: 'lowpass' });
    s.tone({ freq: 190, to: 96, type: 'triangle', dur: 0.2, gain: 0.24 });
  },
  strike_break: (s) => {
    s.burst({ freq: 2600, to: 700, dur: 0.14, gain: 0.3, q: 1.4 });
    s.tone({ freq: 320, to: 150, type: 'square', dur: 0.09, gain: 0.1 });
  },
  strike_clear: (s) => s.burst({ freq: 1800, to: 600, dur: 0.12, gain: 0.2, q: 0.9, type: 'lowpass' }),
  fall_fell: (s) => {
    s.burst({ freq: 900, to: 120, dur: 1.1, gain: 0.24, q: 0.6, type: 'lowpass' });
    s.tone({ freq: 120, to: 48, type: 'sawtooth', dur: 0.9, gain: 0.12 });
  },
  fall_break: (s) => {
    s.burst({ freq: 1800, to: 240, dur: 0.32, gain: 0.28, q: 0.8, type: 'lowpass' });
    s.tone({ freq: 160, to: 70, type: 'square', dur: 0.18, gain: 0.12 });
  },
  fall_clear: (s) => s.burst({ freq: 1200, to: 420, dur: 0.2, gain: 0.18, q: 1.1 }),
};

/** Sparse birdsong by day, crickets after dark. */
function ambience(s, nightFactor) {
  if (nightFactor > 0.6) {
    const base = 4200 + Math.random() * 900;
    for (let i = 0; i < 3; i++) {
      s.burst({ freq: base, dur: 0.035, gain: 0.03, q: 22, delay: i * 0.09 });
    }
    return 1.4 + Math.random() * 2.4;
  }
  const base = 1800 + Math.random() * 1600;
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    s.tone({
      freq: base * (1 + i * 0.16),
      to: base * (1 + i * 0.16) * 1.5,
      type: 'sine', dur: 0.07, gain: 0.035, delay: i * 0.085,
    });
  }
  return 3.5 + Math.random() * 7;
}

export const HARVEST = {
  id: 'harvest',
  slot: 'farm',
  // The farm predates the split; its old browser-side save is still honoured.
  legacyKeys: ['harvest-hollow:farm'],
  name: 'Harvest Hollow',
  icon: '🌾',
  theme: 'harvest',
  tagline: 'a little farm at the edge of the woods',
  blurb: 'Till the soil, sow the seeds, and watch four seasons turn over a valley plot.',
  bullets: ['Six crops and an orchard', 'Rain, storms and snow', 'A store that pays for better tools'],
  bootLines: [
    'waking the chickens…',
    'unrolling the fields…',
    'planting the treeline…',
    'filling the pond…',
    'sharpening the hoe…',
  ],

  manifest: MANIFEST,
  characters: ['character-female-c', 'character-male-a'],
  palette: KIT_COLORS,

  rules: RULES,
  terrainPaint: {
    colors: TILE_COLORS,
    prepared: { dry: TILE_COLORS[T.SOIL], wet: SOIL_WET_COLOR },
    tinted: [T.GRASS, T.FOREST],
    tintScale: { [T.FOREST]: 0.76 },
    dust: { kinds: [T.PATH, T.SAND], color: 0xbfae90, amount: 0.12 },
    shadeSpread: 0.22,
  },

  sky: {
    stops: SKY_STOPS,
    airless: false,
    groundTint: 0x5a6b3a,
  },

  weather: {
    modes: WEATHER_MODES,
    table: WEATHER_TABLE,
    labels: WEATHER_LABEL,
    charging: ['rain', 'storm'],
    bedIntensity: { rain: 0.6, storm: 1 },
  },

  audio: { voices: VOICES, ambience, bed: { freq: 1400, gain: 0.06, type: 'lowpass' } },

  createWorld: ({ grid, props, assets, scene }) => new FarmWorld({
    grid, props, assets, scene,
    opts: {
      skirtColor: 0x3d5c33,
      variantModels: SEASONAL_TREES,
      variantSuffix: { spring: '', summer: '', autumn: '_fall', winter: '_dark' },
      hiddenPools: { winter: SUMMER_ONLY },
      skirtByPhase: {
        spring: 0x3d5c33, summer: 0x365528, autumn: 0x4e4526, winter: 0x54604f,
      },
    },
  }),

  createSurfaces: ({ grid }) => [new Water(grid, { kind: T.WATER })],
};
