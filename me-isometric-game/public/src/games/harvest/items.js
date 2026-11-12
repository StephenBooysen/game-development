/**
 * Everything the player can hold, grow, buy or sell on the farm.
 *
 * One flat item table keyed by id, plus a crop table that references it. Prices
 * are tuned so a watered spring plot roughly doubles its seed cost, and the
 * autumn crops are the ones that pay for the shop's upgrades.
 *
 * `tool` names the shared verb an item performs — see `shared/actions.js`.
 */

/** Held-tool models, attached to the character's right hand. */
const TOOL_MODELS = {
  prepare: ['survival', 'tool-hoe'],
  charge: ['survival', 'bucket'],
  fell: ['survival', 'tool-axe'],
  break: ['survival', 'tool-pickaxe'],
  clear: ['survival', 'tool-shovel'],
};

export const ITEMS = {
  // --- tools (never stack, never sell) ------------------------------------
  hoe:     { name: 'Hoe',           icon: '⚒️', kind: 'tool', tool: 'prepare', energy: 2, desc: 'Turns grass into a planting bed.' },
  can:     { name: 'Watering Can',  icon: '🚿', kind: 'tool', tool: 'charge',  energy: 1, desc: 'Refill at any water tile.' },
  axe:     { name: 'Axe',           icon: '🪓', kind: 'tool', tool: 'fell',    energy: 4, desc: 'Fells trees for wood.' },
  pickaxe: { name: 'Pickaxe',       icon: '⛏️', kind: 'tool', tool: 'break',   energy: 4, desc: 'Breaks rocks into stone.' },
  scythe:  { name: 'Scythe',        icon: '🔪', kind: 'tool', tool: 'clear',   energy: 1, desc: 'Clears weeds and brush.' },

  // --- produce -------------------------------------------------------------
  turnip:  { name: 'Turnip',   icon: '🥔', kind: 'produce', sell: 60 },
  carrot:  { name: 'Carrot',   icon: '🥕', kind: 'produce', sell: 110 },
  wheat:   { name: 'Wheat',    icon: '🌾', kind: 'produce', sell: 34 },
  corn:    { name: 'Corn',     icon: '🌽', kind: 'produce', sell: 105 },
  melon:   { name: 'Melon',    icon: '🍉', kind: 'produce', sell: 420 },
  pumpkin: { name: 'Pumpkin',  icon: '🎃', kind: 'produce', sell: 520 },
  apple:   { name: 'Apple',    icon: '🍎', kind: 'produce', sell: 95 },
  pear:    { name: 'Pear',     icon: '🍐', kind: 'produce', sell: 120 },

  // --- gathered ------------------------------------------------------------
  wood:     { name: 'Wood',     icon: '🪵', kind: 'material', sell: 14 },
  stone:    { name: 'Stone',    icon: '🪨', kind: 'material', sell: 12 },
  fibre:    { name: 'Fibre',    icon: '🌿', kind: 'material', sell: 5 },
  mushroom: { name: 'Mushroom', icon: '🍄', kind: 'forage',   sell: 45 },
  flower:   { name: 'Wildflower', icon: '🌷', kind: 'forage', sell: 30 },
};

/**
 * Crops. `stageDays[i]` is how many *watered* days it takes to leave stage i,
 * so the last stage is the harvestable one. `models` is parallel to the stage
 * list, with null for "nothing above the soil yet".
 */
export const CROPS = {
  turnip: {
    name: 'Turnip', icon: '🥔', item: 'turnip', kit: 'nature', phases: ['spring'],
    seedPrice: 30, stageDays: [1, 1, 2], yield: [1, 1],
    models: [null, 'crops_leafsStageA', 'crops_leafsStageB', 'crop_turnip'],
  },
  carrot: {
    name: 'Carrot', icon: '🥕', item: 'carrot', kit: 'nature', phases: ['spring'],
    seedPrice: 55, stageDays: [2, 2, 2], yield: [1, 2],
    models: [null, 'crops_leafsStageA', 'crops_leafsStageB', 'crop_carrot'],
  },
  wheat: {
    name: 'Wheat', icon: '🌾', item: 'wheat', kit: 'nature', phases: ['summer', 'autumn'],
    seedPrice: 20, stageDays: [1, 2, 1], yield: [2, 3],
    models: [null, 'crops_leafsStageA', 'crops_wheatStageA', 'crops_wheatStageB'],
  },
  corn: {
    name: 'Corn', icon: '🌽', item: 'corn', kit: 'nature', phases: ['summer', 'autumn'],
    seedPrice: 110, stageDays: [2, 2, 3], yield: [1, 2], regrow: 3,
    models: [null, 'crops_cornStageA', 'crops_cornStageC', 'crops_cornStageD'],
  },
  melon: {
    name: 'Melon', icon: '🍉', item: 'melon', kit: 'nature', phases: ['summer'],
    seedPrice: 180, stageDays: [3, 3, 3], yield: [1, 1],
    models: [null, 'crops_leafsStageA', 'crops_leafsStageB', 'crop_melon'],
  },
  pumpkin: {
    name: 'Pumpkin', icon: '🎃', item: 'pumpkin', kit: 'nature', phases: ['autumn'],
    seedPrice: 200, stageDays: [3, 3, 4], yield: [1, 1],
    models: [null, 'crops_leafsStageA', 'crops_leafsStageB', 'crop_pumpkin'],
  },
};

/** Fruit trees. Planted on open ground, then they pay out every few days. */
export const SAPLINGS = {
  apple: {
    name: 'Apple Sapling', icon: '🍎', yields: 'apple', price: 900, kit: 'nature',
    growDays: 8, yieldEvery: 2, phases: ['spring', 'summer', 'autumn'],
    models: ['plant_bushSmall', 'tree_small', 'tree_default'],
    marker: ['food', 'apple'],
  },
  pear: {
    name: 'Pear Sapling', icon: '🍐', yields: 'pear', price: 1150, kit: 'nature',
    growDays: 10, yieldEvery: 2, phases: ['summer', 'autumn'],
    models: ['plant_bushSmall', 'tree_small', 'tree_oak'],
    marker: ['food', 'pear'],
  },
};

/** One-off purchases. `effect` is read by shared/state.js — see the doc there. */
export const UPGRADES = {
  hoe2: {
    name: 'Steel Hoe', icon: '⚒️', price: 1000,
    desc: 'Tills a 3×3 patch in one swing.',
    effect: { wide: 'prepare' },
  },
  can2: {
    name: 'Copper Can', icon: '🚿', price: 1200,
    desc: 'Holds 40 charges and waters 3×3.',
    effect: { wide: 'charge', reserve: 40 },
  },
  axe2: {
    name: 'Broad Axe', icon: '🪓', price: 850,
    desc: 'Fells any tree in a single swing.',
    effect: { power: 'fell' },
  },
  pick2: {
    name: 'Steel Pickaxe', icon: '⛏️', price: 850,
    desc: 'Shatters any rock in a single swing.',
    effect: { power: 'break' },
  },
  boots: {
    name: 'Sturdy Boots', icon: '🥾', price: 600,
    desc: 'Walk and run 20% faster.',
    effect: { speed: 1.2 },
  },
  thermos: {
    name: 'Coffee Thermos', icon: '☕', price: 1500,
    desc: 'Raises your energy ceiling by 30.',
    effect: { energy: 30 },
  },
};

// --- derived tables ---------------------------------------------------------

export const seedIdFor = (id) => `seed_${id}`;
export const saplingIdFor = (id) => `sapling_${id}`;

const totalDays = (crop) => crop.stageDays.reduce((a, b) => a + b, 0);

/** Seeds are generated from the crop table so the two can never drift apart. */
for (const [id, crop] of Object.entries(CROPS)) {
  ITEMS[seedIdFor(id)] = {
    name: `${crop.name} Seeds`,
    icon: '🌱',
    kind: 'seed',
    grows: id,
    price: crop.seedPrice,
    sell: Math.round(crop.seedPrice * 0.4),
    desc: `${crop.phases.join(', ')} · ${totalDays(crop)} days`,
  };
}

for (const [id, sap] of Object.entries(SAPLINGS)) {
  ITEMS[saplingIdFor(id)] = {
    name: sap.name,
    icon: sap.icon,
    kind: 'sapling',
    species: id,
    price: sap.price,
    sell: Math.round(sap.price * 0.3),
    desc: `Bears fruit after ${sap.growDays} days.`,
  };
}

export function toolModel(id) {
  const tool = ITEMS[id]?.tool;
  return tool ? TOOL_MODELS[tool] : null;
}
