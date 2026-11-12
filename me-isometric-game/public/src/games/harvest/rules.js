import { WORLD, TIME, PLAYER, ECONOMY } from '../../core/config.js';
import { VOCAB } from './vocab.js';
import { T, TILE_COLORS, SEASONS } from './config.js';
import {
  ITEMS, CROPS, SAPLINGS, UPGRADES, seedIdFor, saplingIdFor, toolModel,
} from './items.js';

/**
 * Everything the shared systems read to run Harvest Hollow.
 *
 * Kept apart from `index.js` because nothing in here touches three.js: the
 * whole rule set — the growing, the trading, the calendar, the wording — can
 * be loaded and exercised without a browser, which is what the headless test
 * in `test/` does with it.
 */
export const RULES = {
  vocab: VOCAB,
  world: WORLD,
  time: { ...TIME, daysPerPhase: 14 },
  player: PLAYER,
  economy: ECONOMY,
  phases: SEASONS,

  items: ITEMS,
  growables: CROPS,
  perennials: SAPLINGS,
  upgrades: UPGRADES,
  seedIdFor,
  saplingIdFor,
  toolModel,

  reserveBase: 20,
  defaultHotbar: ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'seed_turnip', null, null],
  startingInventory: { seed_turnip: 8, seed_wheat: 5 },
  stackOrder: ['tool', 'seed', 'sapling'],

  groundTerrain: T.GRASS,
  blockedTerrain: [T.WATER],
  preparable: [T.GRASS, T.SAND, T.SOIL],
  chargeSources: [T.WATER],
  perennialGround: [T.GRASS, T.SOIL],

  map: {
    background: '#1d2b1f',
    colors: TILE_COLORS,
    tinted: [T.GRASS, T.FOREST],
    tintScale: { [T.FOREST]: 0.62 },
    prepared: '#7a5334',
    preparedCharged: '#46301d',
    plotReady: '#ffc978',
    plotGrowing: '#b6e37a',
    marks: { shop: '#b8453f', bin: '#e8a33d', door: '#f6ead2', perennial: '#7cae4a' },
    player: '#fff',
    playerOutline: '#241a12',
  },
};
