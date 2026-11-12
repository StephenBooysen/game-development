import { WORLD, TIME, PLAYER, ECONOMY } from '../../core/config.js';
import { VOCAB } from './vocab.js';
import { T, TILE_COLORS, PHASES } from './config.js';
import {
  ITEMS, RIGS, WELLS, UPGRADES, seedIdFor, saplingIdFor, toolModel,
} from './items.js';

/**
 * Everything the shared systems read to run Mare Copernicus.
 *
 * Kept apart from `index.js` because nothing in here touches three.js: the
 * whole rule set — the extracting, the trading, the calendar, the wording —
 * can be loaded and exercised without a browser, which is what the headless
 * test in `test/` does with it.
 */
export const RULES = {
  vocab: VOCAB,
  world: WORLD,
  time: { ...TIME, daysPerPhase: 14 },
  player: PLAYER,
  economy: ECONOMY,
  phases: PHASES,

  items: ITEMS,
  growables: RIGS,
  perennials: WELLS,
  upgrades: UPGRADES,
  seedIdFor,
  saplingIdFor,
  toolModel,

  reserveBase: 20,
  defaultHotbar: ['scanner', 'cell', 'cutter', 'drill', 'grinder', 'rig_silicate', null, null],
  startingInventory: { rig_silicate: 8, rig_iron: 5 },
  stackOrder: ['tool', 'seed', 'sapling'],

  groundTerrain: T.REGOLITH,
  blockedTerrain: [T.ARRAY],
  preparable: [T.REGOLITH, T.EJECTA, T.SEAM],
  chargeSources: [T.ARRAY],
  perennialGround: [T.REGOLITH, T.SEAM],

  map: {
    background: '#0a0d14',
    colors: TILE_COLORS,
    tinted: [T.REGOLITH, T.RILLE],
    tintScale: { [T.RILLE]: 0.58 },
    prepared: '#4a4640',
    preparedCharged: '#2b4a5e',
    plotReady: '#f0c44e',
    plotGrowing: '#7fb0c4',
    marks: { shop: '#e8913d', bin: '#f0c44e', door: '#cfe4ff', perennial: '#a98fdc' },
    player: '#fff',
    playerOutline: '#0a0d14',
  },
};
