/**
 * Headless smoke test for the shared game logic.
 *
 * `shared/` deliberately imports no three.js and touches no DOM, and `rules.js`
 * for each game is pure data — so the whole loop (prepare, plant, charge, wait
 * out the days, harvest, break things, ship, save, reload) can be driven from
 * node against the *real* tables, with a handful of stubs standing in for the
 * scene and the interface.
 *
 * It is not a substitute for looking at the thing. It is the part that catches
 * a missing vocab key, an item id nothing defines, or a save that won't reload
 * — which are the failures that survive a glance at the screen.
 *
 *   npm test
 */
import { Grid } from '../public/src/shared/grid.js';
import { GameState } from '../public/src/shared/state.js';
import { GrowthSystem } from '../public/src/shared/growth.js';
import { Actions } from '../public/src/shared/actions.js';
import { findPath } from '../public/src/shared/path.js';
import { RULES as HARVEST } from '../public/src/games/harvest/rules.js';
import { RULES as LUNAR } from '../public/src/games/lunar/rules.js';

let checks = 0;
let failures = 0;
const failed = [];

function ok(label, condition, detail = '') {
  checks++;
  if (condition) return true;
  failures++;
  failed.push(`${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

function eq(label, actual, expected) {
  return ok(label, Object.is(actual, expected), `expected ${expected}, got ${actual}`);
}

// --- stubs -------------------------------------------------------------------

/** Just enough world for the growth and action systems to talk to. */
function stubWorld(grid) {
  const props = {
    add: () => ({ live: true }),
    remove: (r) => { if (r) r.live = false; },
  };
  return {
    props,
    prop: () => ({ live: true }),
    placeObject(x, z, spec) {
      const { model, scale = 1, ry = 0, ...data } = spec;
      return grid.addObject(x, z, { model, scale, ry, ...data, record: props.add() });
    },
    removeObject(x, z) {
      const obj = grid.objectAt(x, z);
      if (!obj) return null;
      props.remove(obj.record);
      grid.removeObject(x, z);
      return obj;
    },
    reskinObject(obj, model) { obj.model = model; },
  };
}

function harness(rules, seed = 7) {
  const grid = new Grid({
    size: 24,
    blocked: rules.blockedTerrain,
    ground: rules.groundTerrain,
  });
  const state = new GameState(rules, seed);
  const world = stubWorld(grid);
  const growth = new GrowthSystem(grid, world, rules);
  const toasts = [];
  const floaters = [];
  const player = {
    distanceToTile: () => 0,
    faceTile() {},
    act() {},
  };
  const actions = new Actions({
    grid, state, world, growth, player,
    sfx: { play() {} },
    terrain: { refresh() {} },
    rules,
    ui: {
      toast: (m, tone) => toasts.push({ m, tone }),
      floater: (x, z, text) => floaters.push(text),
      openPanel() {},
      sleep() {},
    },
  });
  /** Actions rate-limit themselves; tests want one act per call. */
  const act = (fn) => { actions.cooldown = 0; actions._denyAt = 0; return fn(); };
  return { grid, state, world, growth, actions, player, toasts, floaters, act, rules };
}

// --- 1. the tables hang together ---------------------------------------------

function checkTables(name, rules) {
  const items = rules.items;

  for (const [id, def] of Object.entries(rules.growables)) {
    const seed = rules.seedIdFor(id);
    ok(`${name}: ${id} has a purchasable ${seed}`, !!items[seed]);
    ok(`${name}: ${id} yields a real item (${def.item})`, !!items[def.item]);
    eq(`${name}: ${id} has a model per stage`, def.models.length, def.stageDays.length + 1);
    ok(`${name}: ${id} names phases that exist`,
      def.phases.every((p) => rules.phases.some((ph) => ph.key === p)),
      def.phases.join(','));
    ok(`${name}: ${id} sells for something`, (items[def.item].sell ?? 0) > 0);
  }

  for (const [id, def] of Object.entries(rules.perennials)) {
    ok(`${name}: ${id} has a purchasable kit`, !!items[rules.saplingIdFor(id)]);
    ok(`${name}: ${id} yields a real item (${def.yields})`, !!items[def.yields]);
    eq(`${name}: ${id} has three growth models`, def.models.length, 3);
    ok(`${name}: ${id} names phases that exist`,
      def.phases.every((p) => rules.phases.some((ph) => ph.key === p)));
  }

  for (const id of rules.defaultHotbar) {
    if (id) ok(`${name}: hotbar item ${id} is defined`, !!items[id]);
  }
  for (const id of Object.keys(rules.startingInventory)) {
    ok(`${name}: starting item ${id} is defined`, !!items[id]);
  }

  // Every tool verb the actions can dispatch must be held by something.
  const verbs = new Set(Object.values(items).map((d) => d.tool).filter(Boolean));
  for (const verb of ['prepare', 'charge', 'fell', 'break', 'clear']) {
    ok(`${name}: something performs "${verb}"`, verbs.has(verb));
  }

  for (const [id, up] of Object.entries(rules.upgrades)) {
    ok(`${name}: upgrade ${id} carries an effect`, !!up.effect && Object.keys(up.effect).length > 0);
  }

  eq(`${name}: four calendar phases`, rules.phases.length, 4);
  for (const p of rules.phases) {
    ok(`${name}: phase ${p.key} is complete`, !!(p.name && p.short && p.icon && p.tint !== undefined));
  }
}

// --- 2. both games say all the same things ------------------------------------

/** Every leaf path in a vocab tree, so the two can be compared shape-to-shape. */
function paths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const at = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...paths(v, at));
    else out.push(`${at}:${typeof v}`);
  }
  return out.sort();
}

function checkVocabParity() {
  const a = paths(HARVEST.vocab);
  const b = paths(LUNAR.vocab);
  const onlyHarvest = a.filter((k) => !b.includes(k));
  const onlyLunar = b.filter((k) => !a.includes(k));
  ok('vocab: harvest has no keys lunar lacks', onlyHarvest.length === 0, onlyHarvest.join(', '));
  ok('vocab: lunar has no keys harvest lacks', onlyLunar.length === 0, onlyLunar.join(', '));
}

// --- 3. the loop actually runs ------------------------------------------------

function checkLoop(name, rules, { plantId, toolPrepare, toolCharge }) {
  const h = harness(rules);
  const { grid, state, growth, actions, act } = h;
  const x = 5;
  const z = 5;

  // survey / till
  state.assignToHotbar(toolPrepare);
  act(() => actions.use({ x, z }));
  ok(`${name}: ${toolPrepare} prepares the tile`, grid.prepared[grid.idx(x, z)] === 1);

  // plant
  const seedId = rules.seedIdFor(plantId);
  state.add(seedId, 3);
  state.assignToHotbar(seedId);
  const before = state.count(seedId);
  act(() => actions.use({ x, z }));
  ok(`${name}: planting puts a plot on the tile`, grid.plots.has(grid.idx(x, z)));
  eq(`${name}: planting consumes one ${seedId}`, state.count(seedId), before - 1);

  // charge
  state.assignToHotbar(toolCharge);
  state.reserve = state.reserveMax;
  grid.setCharge(x, z, 0);
  const reserveBefore = state.reserve;
  act(() => actions.use({ x, z }));
  eq(`${name}: charging fills the tile`, grid.charge[grid.idx(x, z)], 1);
  ok(`${name}: charging spends reserve`, state.reserve < reserveBefore);

  // run it out to maturity
  const def = rules.growables[plantId];
  const need = growth.totalDays(def);
  for (let d = 0; d < need; d++) growth.advanceDay({ charged: true, phase: state.phase });
  ok(`${name}: ${plantId} matures after ${need} charged days`, growth.ready(x, z));

  // harvest
  const item = def.item;
  const had = state.count(item);
  act(() => actions.use({ x, z }));
  ok(`${name}: harvest yields ${item}`, state.count(item) > had);
  ok(`${name}: quality bonus fires when never starved`, state.stats.harvested > 0);

  // a plot left unpowered stalls rather than dies
  const h2 = harness(rules);
  h2.grid.setPrepared(3, 3, true);
  h2.growth.plant(3, 3, plantId);
  const plot = h2.grid.plotAt(3, 3);
  plot.chargedToday = 0;
  h2.growth.advanceDay({ charged: false, phase: h2.state.phase });
  eq(`${name}: an unpowered day doesn't advance the plot`, h2.grid.plotAt(3, 3).days, 0);
  eq(`${name}: an unpowered day is recorded as missed`, h2.grid.plotAt(3, 3).missed, 1);

  // and one in the wrong phase is lost
  const offPhase = rules.phases.find((p) => !def.phases.includes(p.key));
  const log = h2.growth.advanceDay({ charged: true, phase: offPhase });
  eq(`${name}: ${plantId} is lost outside its phase (${offPhase.key})`, log.withered, 1);
}

// --- 4. breaking things down --------------------------------------------------

function checkStrike(name, rules, { tool, needs, drops }) {
  const h = harness(rules);
  const { grid, state, world, actions, act } = h;
  world.placeObject(8, 8, {
    kind: 'thing', model: 'x', hp: 3, maxHp: 3,
    breakable: true, needs, solid: true, drops, dropCount: 3, label: 'Thing',
  });
  state.assignToHotbar(tool);
  state.energy = 100;

  act(() => actions.use({ x: 8, z: 8 }));
  eq(`${name}: one hit takes one hp`, grid.objectAt(8, 8).hp, 2);
  act(() => actions.use({ x: 8, z: 8 }));
  act(() => actions.use({ x: 8, z: 8 }));
  ok(`${name}: three hits clear it`, !grid.objectAt(8, 8));
  eq(`${name}: it drops ${drops}`, state.count(drops), 3);
  ok(`${name}: the tile is walkable again`, grid.walkable(8, 8));

  // the wrong tool is refused
  const h2 = harness(rules);
  h2.world.placeObject(8, 8, {
    kind: 'thing', model: 'x', hp: 3, maxHp: 3,
    breakable: true, needs, solid: true, drops, dropCount: 1, label: 'Thing',
  });
  const wrong = Object.entries(rules.items)
    .find(([, d]) => d.tool && d.tool !== needs && ['fell', 'break', 'clear'].includes(d.tool));
  h2.state.assignToHotbar(wrong[0]);
  h2.act(() => h2.actions.use({ x: 8, z: 8 }));
  eq(`${name}: the wrong tool does no damage`, h2.grid.objectAt(8, 8).hp, 3);
  ok(`${name}: the wrong tool explains itself`, h2.toasts.length > 0, 'no toast raised');
}

// --- 5. money in, money out ---------------------------------------------------

function checkEconomy(name, rules, { good }) {
  const h = harness(rules);
  const { state, actions, world, act } = h;
  state.add(good, 4);
  state.assignToHotbar(good);
  world.placeObject(9, 9, { kind: 'bin', model: null, breakable: false, persist: false });

  act(() => actions.use({ x: 9, z: 9 }));
  eq(`${name}: the bin takes the whole stack`, state.count(good), 0);
  eq(`${name}: the bin holds it until dawn`, state.shipped.get(good), 4);

  const owed = state.sellValue(good) * 4;
  const before = state.gold;
  state.earn(owed);
  eq(`${name}: the payout lands`, state.gold, before + owed);

  ok(`${name}: tools can't be shipped`, (() => {
    const h2 = harness(rules);
    h2.world.placeObject(9, 9, { kind: 'bin', model: null, breakable: false, persist: false });
    h2.state.assignToHotbar(rules.defaultHotbar[0]);
    h2.act(() => h2.actions.use({ x: 9, z: 9 }));
    return h2.state.shipped.size === 0;
  })());
}

// --- 6. upgrades are pure data ------------------------------------------------

function checkUpgrades(name, rules) {
  const h = harness(rules);
  const { state } = h;
  const base = state.reserveMax;

  const wider = Object.entries(rules.upgrades).find(([, u]) => u.effect.reserve);
  state.upgrades.add(wider[0]);
  ok(`${name}: ${wider[0]} raises the reserve`, state.reserveMax > base);
  ok(`${name}: ${wider[0]} widens its verb`, state.hasWide(wider[1].effect.wide));

  const stronger = Object.entries(rules.upgrades).find(([, u]) => u.effect.power);
  state.upgrades.add(stronger[0]);
  ok(`${name}: ${stronger[0]} powers its tool`, state.hasPower(stronger[1].effect.power));

  const faster = Object.entries(rules.upgrades).find(([, u]) => u.effect.speed);
  const speedBefore = rules.player.speed;
  state.upgrades.add(faster[0]);
  ok(`${name}: ${faster[0]} raises move speed`, state.moveSpeed > speedBefore);

  const roomier = Object.entries(rules.upgrades).find(([, u]) => u.effect.energy);
  const energyBefore = state.maxEnergy;
  state.upgrades.add(roomier[0]);
  ok(`${name}: ${roomier[0]} raises the energy ceiling`, state.maxEnergy > energyBefore);
}

// --- 7. saving and coming back ------------------------------------------------

function checkSave(name, rules) {
  const h = harness(rules);
  const { grid, state, growth, world } = h;

  state.day = 33;
  state.gold = 4242;
  state.reserve = 7;
  state.add(Object.keys(rules.growables).map((k) => rules.growables[k].item)[0], 9);
  grid.setPrepared(4, 4, true);
  grid.setCharge(4, 4, 1);
  growth.plant(4, 4, Object.keys(rules.growables)[0]);
  world.placeObject(6, 6, {
    kind: 'thing', model: 'x', hp: 2, maxHp: 3, breakable: true,
    needs: 'break', solid: true, drops: 'x', label: 'Thing',
  });

  const wire = JSON.parse(JSON.stringify({
    state: state.serialize(),
    grid: grid.serialize(),
  }));

  const back = GameState.deserialize(rules, wire.state);
  eq(`${name}: day survives the round trip`, back.day, 33);
  eq(`${name}: gold survives`, back.gold, 4242);
  eq(`${name}: reserve survives`, back.reserve, 7);
  eq(`${name}: the phase is recomputed`, back.phase.key, state.phase.key);
  eq(`${name}: the pack survives`, back.inv.size, state.inv.size);

  const grid2 = new Grid({ size: 24, blocked: rules.blockedTerrain, ground: rules.groundTerrain });
  grid2.loadTerrain(wire.grid);
  grid2.plots = Grid.plotsFrom(wire.grid);
  eq(`${name}: prepared tiles survive`, grid2.prepared[grid2.idx(4, 4)], 1);
  eq(`${name}: charge survives`, grid2.charge[grid2.idx(4, 4)], 1);
  eq(`${name}: plots survive`, grid2.plots.size, 1);

  // The live scene handles must not be in the payload, or the graph is circular.
  const objects = wire.grid.objects;
  eq(`${name}: one changed object is stored`, objects.length, 1);
  ok(`${name}: no live handles in the save`, !('record' in objects[0][1]));
  eq(`${name}: object damage is stored`, objects[0][1].hp, 2);
}

/** The farm predates the split; its save used the old field names. */
function checkLegacySave() {
  const legacy = {
    seed: 15628886, day: 12, time: 16.5, weather: 'cloudy', gold: 836,
    energy: 22, water: 14,
    inv: [['hoe', 1], ['can', 1], ['seed_wheat', 5]],
    hotbar: ['hoe', 'can', null, null, null, null, null, null],
    selected: 1, upgrades: [], shipped: [],
    settings: { volume: 0.7, dayLength: 420 },
    stats: { harvested: 3, earned: 500, chopped: 7, mined: 4 },
  };
  const state = GameState.deserialize(HARVEST, legacy);
  eq('legacy: day loads', state.day, 12);
  eq('legacy: gold loads', state.gold, 836);
  eq('legacy: water becomes reserve', state.reserve, 14);
  eq('legacy: chopped becomes cleared', state.stats.cleared, 7);
  eq('legacy: mined becomes broken', state.stats.broken, 4);
  eq('legacy: the pack loads', state.count('seed_wheat'), 5);

  const grid = new Grid({ size: 8, blocked: HARVEST.blockedTerrain, ground: HARVEST.groundTerrain });
  const tilled = new Array(64).fill(0);
  const moisture = new Array(64).fill(0);
  tilled[9] = 1;
  moisture[9] = 1;
  grid.loadTerrain({ terrain: new Array(64).fill(0), tilled, moisture });
  eq('legacy: tilled becomes prepared', grid.prepared[9], 1);
  eq('legacy: moisture becomes charge', grid.charge[9], 1);

  const plots = Grid.plotsFrom({ crops: [[9, { id: 'turnip', stage: 1, days: 1 }]] });
  eq('legacy: crops become plots', plots.size, 1);
}

// --- 8. pathfinding still routes ----------------------------------------------

function checkPathing() {
  const grid = new Grid({ size: 16, blocked: HARVEST.blockedTerrain, ground: HARVEST.groundTerrain });
  // A wall with one gap in it.
  for (let z = 0; z < 16; z++) if (z !== 12) grid.solid[grid.idx(8, z)] = 1;

  const path = findPath(grid, { x: 2, z: 2 }, { x: 14, z: 2 });
  ok('path: a route is found around a wall', path.length > 0);
  ok('path: the route ends at the goal',
    path.at(-1)?.x === 14 && path.at(-1)?.z === 2,
    JSON.stringify(path.at(-1)));
  ok('path: the route only uses walkable tiles', path.every((p) => grid.walkable(p.x, p.z)));
  ok('path: the route goes through the gap', path.some((p) => p.x === 8 && p.z === 12));

  for (let z = 0; z < 16; z++) grid.solid[grid.idx(8, z)] = 1;
  eq('path: a sealed wall yields no route', findPath(grid, { x: 2, z: 2 }, { x: 14, z: 2 }).length, 0);
}

// --- run ----------------------------------------------------------------------

checkTables('harvest', HARVEST);
checkTables('lunar', LUNAR);
checkVocabParity();

checkLoop('harvest', HARVEST, { plantId: 'turnip', toolPrepare: 'hoe', toolCharge: 'can' });
checkLoop('lunar', LUNAR, { plantId: 'silicate', toolPrepare: 'scanner', toolCharge: 'cell' });

checkStrike('harvest', HARVEST, { tool: 'axe', needs: 'fell', drops: 'wood' });
checkStrike('lunar', LUNAR, { tool: 'drill', needs: 'break', drops: 'regolith' });

checkEconomy('harvest', HARVEST, { good: 'turnip' });
checkEconomy('lunar', LUNAR, { good: 'silicate' });

checkUpgrades('harvest', HARVEST);
checkUpgrades('lunar', LUNAR);

checkSave('harvest', HARVEST);
checkSave('lunar', LUNAR);
checkLegacySave();
checkPathing();

if (failures) {
  console.error(`\n${failures} of ${checks} checks failed:\n`);
  for (const f of failed) console.error(`  ✖ ${f}`);
  process.exit(1);
}
console.log(`✔ ${checks} checks passed`);
