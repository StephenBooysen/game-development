/**
 * Every word Mare Copernicus puts on screen.
 *
 * The shared systems ask for a phrase by name and never build one themselves,
 * which is what lets the same watering code say "the can is empty" on the farm
 * and "the cell is flat" up here.
 */

const s = (n) => (n === 1 ? '' : 's');

const TOOL_NAMES = { fell: 'the laser cutter', break: 'the rock drill', clear: 'the grinder' };
const TOOL_SHORT = { fell: 'needs the cutter', break: 'needs the drill', clear: 'needs the grinder' };

export const VOCAB = {
  id: 'lunar',

  opening: 'Copernicus Station is yours now. The mare is not going to mine itself.',
  welcomeBack: (state) => `Suit sealed — sol ${state.day}, ${state.phase.name.toLowerCase()}.`,
  saved: 'Station log written.',
  saveFailed: 'Could not write the station log.',

  // --- denials -------------------------------------------------------------
  tooTired: 'O₂ low — get back to the bunk.',
  cantPrepare: 'You can only survey open regolith.',
  nothingToCharge: 'Nothing here is drawing power.',
  reserveEmpty: 'The cell is flat — recharge at the array.',
  reserveFull: 'The cell is already topped up.',
  refilled: 'Recharged',
  nothingHere: 'Nothing here to use that on.',
  noRoom: 'No clearance for a well head.',
  tooClose: 'Too close to another well.',
  needsOpenGround: 'Wells need open regolith.',
  outOfSeed: 'No rigs of that type in the pack.',
  outOfSapling: 'You have no well kits.',
  needsPrepared: 'needs a surveyed seam',
  alreadyPlanted: 'a rig is already working this seam',
  wrongPhase: (def, phase) => `${def.name} won't run through ${phase.name.toLowerCase()}`,
  notGrownYet: (left) => `Still boring — ${left} cycle${s(left)}.`,
  nothingRipe: 'Nothing in the hopper yet.',
  needsTool: (need) => `You need ${TOOL_NAMES[need]} for that.`,
  needsToolShort: (need) => TOOL_SHORT[need],

  binOnlySellable: 'The launcher only takes cargo worth selling.',
  nothingToShip: 'Nothing to load.',
  shipped: (count, name) => `Loaded ${count} × ${name} — settles next sol.`,

  // --- the strip under the cursor ------------------------------------------
  readout: {
    shop: '<b>Supply depot</b> · click to browse',
    bin: '<b>Cargo launcher</b> · click to load what you hold',
    door: '<b>Habitat airlock</b> · click to turn in',
    gatherHint: ' · click to collect',
    perennialRipe: (def) => `<b>${def.name}</b> · hopper full`,
    perennialGrowing: (def, left) => `<b>${def.name}</b> · ${left} cycle${s(left)} to bore`,
    perennialRipening: (def) => `<b>${def.name}</b> · pumping`,
    plotReady: (def) => `<b>${def.name}</b> · ready to collect`,
    plotGrowing: (def, left, flat) =>
      `<b>${def.name}</b> · ${left} cycle${s(left)} left${flat ? ' <span class="warn">· no power</span>' : ''}`,
    preparedCharged: '<b>Powered seam</b> · ready for a rig',
    preparedFlat: '<b>Dead seam</b> · needs power',
    source: '<b>Solar array</b> · recharge your cell here',
    openGround: 'Open regolith · <b>scan</b> to survey',
  },

  // --- the glass -----------------------------------------------------------
  hud: {
    energy: 'Suit O₂',
    reserve: 'Cell',
    currency: '¢',
    dayWord: 'Sol',
    emptyHand: 'Empty glove',
    toastIcon: '📡',
  },

  dial: {
    track: '#141821',
    ticks: 'rgba(206, 224, 246, 0.26)',
    dayArc: '#f0c44e',
    nightArc: '#5f7fc4',
    dayHead: '#fff4cf',
    nightHead: '#c9dcff',
    outline: '#0a0d14',
  },

  // --- the modals ----------------------------------------------------------
  panels: {
    titles: {
      inventory: 'Suit Pack',
      shop: 'Copernicus Supply Depot',
      almanac: 'Survey Register',
      map: 'Mare Copernicus',
      menu: 'Station',
    },
    shopTabs: { grow: 'Rigs', perennial: 'Wells', upgrade: 'Refits', sell: 'Assay' },
    mapFoot: 'The claim from orbit. Hold <b>Tab</b> to peek.',
    invFoot: 'Click a stack to put it on your belt. Shift-click to jettison it.',
    menu: { save: 'Write log', sleep: 'Sleep until sunrise', quit: 'Abandon station' },

    buy: 'Buy',
    sell: 'Assay',
    each: 'each',
    dayUnit: 'cycles',
    sellsFor: 'assays at',
    nothingToSell: 'Nothing in the pack worth assaying.',
    nothingToBuy: 'The depot is cleaned out.',
    cantAfford: "Station credit won't cover that.",
    perennialDesc: (def, phases) => `Produces every ${def.yieldEvery} cycles in ${phases}.`,
    sellDesc: (count) => `You have ${count} · shift-click to assay all`,
    sold: (qty, name, gold) => `Assayed ${qty} × ${name} for ${gold}¢.`,
    bought: (qty, name, total) => `Bought ${qty} × ${name} for ${total}¢.`,
    acquired: (name) => `${name} fitted.`,

    guide: {
      stock: 'Rig cost',
      sells: 'Assays at',
      takes: 'Bores in',
      yield: 'Yield',
      regrow: 'Re-bores',
      perDay: 'Margin/cycle',
      ledger: 'Station Log',
    },
    ledger: [
      ['Sol', 'day'],
      ['Rotation', 'year'],
      ['Ore collected', 'harvested'],
      ['Spires cut', 'cleared'],
      ['Boulders split', 'broken'],
      ['Total earned', 'earned'],
    ],
  },

  // --- the morning card ----------------------------------------------------
  morning: {
    shipped: (count, gold) => `Launched ${count} crate${s(count)} for ${gold}¢`,
    phaseArrived: (phase) => `${phase.name} has begun`,
    charged: 'The flare charged every rig on the claim',
    grown: (n) => `${n} rig${s(n)} advanced`,
    ready: (n) => `${n} ready to collect`,
    yielded: (n) => `${n} well${s(n)} filled its hopper`,
    matured: (n) => `${n} bore${s(n)} reached the seam`,
    withered: (n) => `${n} rig${s(n)} seized in the wrong phase`,
    collapsed: 'You blacked out on the mare — the suit got you home',
    quiet: 'A quiet sol on the mare',
  },
};
