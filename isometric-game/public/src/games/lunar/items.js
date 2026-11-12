/**
 * Everything the operator can hold, extract, buy or sell on the Moon.
 *
 * One flat item table keyed by id, plus a rig table that references it. Prices
 * mirror the farm's curve — a powered claim roughly doubles its rig cost, and
 * the Dusk-phase ores are the ones that pay for the depot's upgrades.
 *
 * `tool` names the shared verb an item performs — see `shared/actions.js`.
 *
 * The model each rig matures into is picked for the *material* it carries, not
 * its shape: the nature kit tells its models apart by material name, so
 * `mushroom_red` is the only way to get an oxide-red deposit and `crops_wheat`
 * the only way to get pale ice. See KIT_COLORS in config.js.
 */

/** Held-tool models, attached to the operator's right hand. */
const TOOL_MODELS = {
  prepare: ['survival', 'tool-shovel'],
  charge: ['survival', 'bottle-large'],
  fell: ['survival', 'tool-axe-upgraded'],
  break: ['survival', 'tool-pickaxe-upgraded'],
  clear: ['survival', 'tool-hammer'],
};

export const ITEMS = {
  // --- tools (never stack, never sell) ------------------------------------
  scanner: { name: 'Survey Scanner', icon: '📡', kind: 'tool', tool: 'prepare', energy: 2, desc: 'Exposes the ore seam under the regolith.' },
  cell:    { name: 'Power Cell',     icon: '🔋', kind: 'tool', tool: 'charge',  energy: 1, desc: 'Recharge at any solar array.' },
  cutter:  { name: 'Laser Cutter',   icon: '🔦', kind: 'tool', tool: 'fell',    energy: 4, desc: 'Cuts ice spires down for water.' },
  drill:   { name: 'Rock Drill',     icon: '⛏️', kind: 'tool', tool: 'break',   energy: 4, desc: 'Breaks boulders into regolith.' },
  grinder: { name: 'Grinder',        icon: '🪚', kind: 'tool', tool: 'clear',   energy: 1, desc: 'Chews up wreckage and debris.' },

  // --- extracted ore -------------------------------------------------------
  silicate:  { name: 'Silicates',  icon: '🪨', kind: 'ore', sell: 60 },
  ice:       { name: 'Water Ice',  icon: '🧊', kind: 'ore', sell: 110 },
  iron:      { name: 'Iron Ore',   icon: '🔩', kind: 'ore', sell: 34 },
  titanium:  { name: 'Titanium',   icon: '⚙️', kind: 'ore', sell: 105 },
  helium3:   { name: 'Helium-3',   icon: '💛', kind: 'ore', sell: 420 },
  platinum:  { name: 'Platinum',   icon: '💠', kind: 'ore', sell: 520 },
  deuterium: { name: 'Deuterium',  icon: '🟠', kind: 'ore', sell: 95 },
  palladium: { name: 'Palladium',  icon: '⬜', kind: 'ore', sell: 120 },

  // --- gathered ------------------------------------------------------------
  regolith: { name: 'Regolith Block', icon: '🧱', kind: 'material', sell: 14 },
  basalt:   { name: 'Basalt',         icon: '⬛', kind: 'material', sell: 12 },
  scrap:    { name: 'Scrap Alloy',    icon: '🔗', kind: 'material', sell: 5 },
  iridium:  { name: 'Iridium Shard',  icon: '✨', kind: 'find',     sell: 45 },
  crystal:  { name: 'Vug Crystal',    icon: '🔮', kind: 'find',     sell: 30 },
};

/**
 * Drill rigs. `stageDays[i]` is how many *powered* cycles it takes to leave
 * stage i, so the last stage is the collectable one. `models` is parallel to
 * the stage list, with null for "the bore hasn't reached anything yet".
 *
 * Stages 1 and 2 are the same spoil-and-mast silhouette for every rig; the
 * last one is the ore body itself, which is what you learn to read at a glance.
 */
const SPOIL = 'rock_smallA';
const MAST = 'stone_tallB';

export const RIGS = {
  silicate: {
    name: 'Regolith Sifter', icon: '🪨', item: 'silicate', kit: 'nature', phases: ['dawn', 'day', 'dusk'],
    seedPrice: 30, stageDays: [1, 1, 2], yield: [1, 1], scale: 1.1, wind: false,
    models: [null, SPOIL, MAST, 'mushroom_tanTall'],
  },
  iron: {
    name: 'Iron Drill', icon: '🔩', item: 'iron', kit: 'nature', phases: ['day', 'dusk'],
    seedPrice: 20, stageDays: [1, 2, 1], yield: [2, 3], scale: 1.15, wind: false,
    models: [null, SPOIL, MAST, 'mushroom_red'],
  },
  ice: {
    name: 'Ice Auger', icon: '🧊', item: 'ice', kit: 'nature', phases: ['dawn', 'dusk'],
    seedPrice: 55, stageDays: [2, 2, 2], yield: [1, 2], scale: 1.3, wind: false,
    models: [null, SPOIL, MAST, 'crops_wheatStageB'],
  },
  titanium: {
    name: 'Titanium Drill', icon: '⚙️', item: 'titanium', kit: 'nature', phases: ['day', 'dusk'],
    seedPrice: 110, stageDays: [2, 2, 3], yield: [1, 2], regrow: 3, scale: 1.2, wind: false,
    models: [null, SPOIL, MAST, 'crop_turnip'],
  },
  helium3: {
    name: 'Helium-3 Extractor', icon: '💛', item: 'helium3', kit: 'nature', phases: ['day'],
    seedPrice: 180, stageDays: [3, 3, 3], yield: [1, 1], scale: 1.5, wind: false,
    models: [null, SPOIL, MAST, 'flower_yellowA'],
  },
  platinum: {
    name: 'Platinum Drill', icon: '💠', item: 'platinum', kit: 'nature', phases: ['dusk'],
    seedPrice: 200, stageDays: [3, 3, 4], yield: [1, 1], scale: 1.5, wind: false,
    models: [null, SPOIL, MAST, 'flower_purpleA'],
  },
};

/**
 * Deep-core wells. Sunk once into open ground, then they produce every few
 * cycles forever — the Moon's answer to an orchard.
 */
export const WELLS = {
  deuterium: {
    name: 'Deuterium Well', icon: '🟠', yields: 'deuterium', price: 900, kit: 'nature',
    growDays: 8, yieldEvery: 2, phases: ['dawn', 'day', 'dusk'], scale: 1.2,
    models: ['rock_smallB', 'stone_tallE', 'crop_carrot'],
    marker: ['survival', 'barrel'], markerScale: 1.6, markerOffset: [0.34, 0.2, 0],
  },
  palladium: {
    name: 'Palladium Well', icon: '⬜', yields: 'palladium', price: 1150, kit: 'nature',
    growDays: 10, yieldEvery: 2, phases: ['day', 'dusk'], scale: 1.2,
    models: ['rock_smallB', 'stone_tallG', 'crop_pumpkin'],
    marker: ['survival', 'box'], markerScale: 1.6, markerOffset: [0.34, 0.2, 0],
  },
};

/** One-off purchases. `effect` is read by shared/state.js — see the doc there. */
export const UPGRADES = {
  scanner2: {
    name: 'Deep Scanner', icon: '📡', price: 1000,
    desc: 'Surveys a 3×3 block in one sweep.',
    effect: { wide: 'prepare' },
  },
  cell2: {
    name: 'High-Density Cell', icon: '🔋', price: 1200,
    desc: 'Holds 40 charges and powers 3×3.',
    effect: { wide: 'charge', reserve: 40 },
  },
  cutter2: {
    name: 'Plasma Cutter', icon: '🔦', price: 850,
    desc: 'Drops any ice spire in a single pass.',
    effect: { power: 'fell' },
  },
  drill2: {
    name: 'Diamond Drill', icon: '⛏️', price: 850,
    desc: 'Splits any boulder in a single pass.',
    effect: { power: 'break' },
  },
  thrusters: {
    name: 'Hop Thrusters', icon: '🚀', price: 600,
    desc: 'Cross the mare 20% faster.',
    effect: { speed: 1.2 },
  },
  rebreather: {
    name: 'Extended Rebreather', icon: '🫁', price: 1500,
    desc: 'Raises your O₂ ceiling by 30.',
    effect: { energy: 30 },
  },
};

// --- derived tables ---------------------------------------------------------

export const seedIdFor = (id) => `rig_${id}`;
export const saplingIdFor = (id) => `well_${id}`;

const totalDays = (rig) => rig.stageDays.reduce((a, b) => a + b, 0);

/** Rig crates are generated from the rig table so the two can never drift. */
for (const [id, rig] of Object.entries(RIGS)) {
  ITEMS[seedIdFor(id)] = {
    name: rig.name,
    icon: '📦',
    kind: 'seed',
    grows: id,
    price: rig.seedPrice,
    sell: Math.round(rig.seedPrice * 0.4),
    desc: `${rig.phases.join(', ')} · ${totalDays(rig)} cycles`,
  };
}

for (const [id, well] of Object.entries(WELLS)) {
  ITEMS[saplingIdFor(id)] = {
    name: `${well.name} Kit`,
    icon: well.icon,
    kind: 'sapling',
    species: id,
    price: well.price,
    sell: Math.round(well.price * 0.3),
    desc: `Produces after ${well.growDays} cycles.`,
  };
}

export function toolModel(id) {
  const tool = ITEMS[id]?.tool;
  return tool ? TOOL_MODELS[tool] : null;
}
