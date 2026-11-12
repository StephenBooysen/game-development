/**
 * Every word Harvest Hollow puts on screen.
 *
 * The shared systems ask for a phrase by name and never build one themselves,
 * which is what lets the same watering code say "the can is empty" here and
 * "the cell is flat" on the Moon. Anything with a number in it is a function so
 * the plural is the game's problem, not a template's.
 */

const s = (n) => (n === 1 ? '' : 's');

const TOOL_NAMES = { fell: 'an axe', break: 'a pickaxe', clear: 'a scythe' };
const TOOL_SHORT = { fell: 'needs an axe', break: 'needs a pickaxe', clear: 'needs a scythe' };

export const VOCAB = {
  id: 'harvest',

  opening: 'Your grandfather left you this plot. Make something of it.',
  welcomeBack: (state) => `Welcome back — day ${state.day}, ${state.phase.name.toLowerCase()}.`,
  saved: 'Farm saved.',
  saveFailed: 'Could not save the farm.',

  // --- denials -------------------------------------------------------------
  tooTired: 'Too tired — get some sleep.',
  cantPrepare: 'You can only till open ground.',
  nothingToCharge: 'Nothing here needs watering.',
  reserveEmpty: 'The can is empty — refill at the pond.',
  reserveFull: 'The can is already full.',
  refilled: 'Refilled',
  nothingHere: 'Nothing here to use that on.',
  noRoom: 'Not enough room for a tree.',
  tooClose: 'Too close to another tree.',
  needsOpenGround: 'Saplings need open ground.',
  outOfSeed: 'Out of those seeds.',
  outOfSapling: 'You have no saplings.',
  needsPrepared: 'needs tilled soil',
  alreadyPlanted: 'already planted',
  wrongPhase: (def, phase) => `${def.name} won't grow in ${phase.name.toLowerCase()}`,
  notGrownYet: (left) => `Not grown yet — ${left} day${s(left)}.`,
  nothingRipe: 'No fruit ripe yet.',
  needsTool: (need) => `You need ${TOOL_NAMES[need]} for that.`,
  needsToolShort: (need) => TOOL_SHORT[need],

  binOnlySellable: 'The bin only takes goods you can sell.',
  nothingToShip: 'Nothing to ship.',
  shipped: (count, name) => `Shipped ${count} × ${name} — paid at dawn.`,

  // --- the strip under the cursor ------------------------------------------
  readout: {
    shop: '<b>General store</b> · click to browse',
    bin: '<b>Shipping bin</b> · click to sell what you hold',
    door: '<b>Cabin</b> · click to sleep',
    gatherHint: ' · click to gather',
    perennialRipe: (def) => `<b>${def.name.replace(' Sapling', '')}</b> · fruit ready`,
    perennialGrowing: (def, left) => `<b>${def.name}</b> · ${left} day${s(left)} to grow`,
    perennialRipening: (def) => `<b>${def.name.replace(' Sapling', '')}</b> · ripening`,
    plotReady: (def) => `<b>${def.name}</b> · ready to harvest`,
    plotGrowing: (def, left, dry) =>
      `<b>${def.name}</b> · ${left} day${s(left)} left${dry ? ' <span class="warn">· thirsty</span>' : ''}`,
    preparedCharged: '<b>Watered soil</b> · ready for seed',
    preparedFlat: '<b>Dry soil</b> · needs water',
    source: '<b>Water</b> · refill your can here',
    openGround: 'Open grass · <b>hoe</b> to till',
  },

  // --- the glass -----------------------------------------------------------
  hud: {
    energy: 'Energy',
    reserve: 'Water',
    currency: 'g',
    dayWord: 'Day',
    emptyHand: 'Empty hand',
    toastIcon: '🌿',
  },

  dial: {
    track: '#16241a',
    ticks: 'rgba(246, 234, 210, 0.28)',
    dayArc: '#e8a33d',
    nightArc: '#7fa8d8',
    dayHead: '#ffc978',
    nightHead: '#dbe9ff',
    outline: '#241a12',
  },

  // --- the modals ----------------------------------------------------------
  panels: {
    titles: {
      inventory: 'Backpack',
      shop: 'Hollow General Store',
      almanac: "Farmer's Almanac",
      map: 'The Hollow',
      menu: 'Menu',
    },
    shopTabs: { grow: 'Seeds', perennial: 'Orchard', upgrade: 'Upgrades', sell: 'Sell' },
    mapFoot: 'Your farm from above. Hold <b>Tab</b> to peek.',
    invFoot: 'Click a stack to put it on your hotbar. Shift-click to drop it.',
    menu: { save: 'Save farm', sleep: 'Sleep until morning', quit: 'Abandon & restart' },

    buy: 'Buy',
    sell: 'Sell',
    each: 'each',
    dayUnit: 'days',
    sellsFor: 'sells for',
    nothingToSell: 'Nothing in your pack worth selling.',
    nothingToBuy: 'Nothing left to buy here.',
    cantAfford: "You can't afford that.",
    perennialDesc: (def, phases) => `Fruits every ${def.yieldEvery} days in ${phases}.`,
    sellDesc: (count) => `You have ${count} · shift-click to sell all`,
    sold: (qty, name, gold) => `Sold ${qty} × ${name} for ${gold}g.`,
    bought: (qty, name, total) => `Bought ${qty} × ${name} for ${total}g.`,
    acquired: (name) => `${name} acquired.`,

    guide: {
      stock: 'Seed',
      sells: 'Sells for',
      takes: 'Grows in',
      yield: 'Yield',
      regrow: 'Regrows',
      perDay: 'Profit/day',
      ledger: 'Ledger',
    },
    ledger: [
      ['Day', 'day'],
      ['Year', 'year'],
      ['Crops picked', 'harvested'],
      ['Trees felled', 'cleared'],
      ['Rocks broken', 'broken'],
      ['Total earned', 'earned'],
    ],
  },

  // --- the morning card ----------------------------------------------------
  morning: {
    shipped: (count, gold) => `Shipped ${count} item${s(count)} for ${gold}g`,
    phaseArrived: (phase) => `${phase.name} has arrived`,
    charged: 'The rain watered every bed',
    grown: (n) => `${n} crop${s(n)} grew`,
    ready: (n) => `${n} ready to harvest`,
    yielded: (n) => `${n} tree${s(n)} bore fruit`,
    matured: (n) => `${n} sapling${s(n)} came of age`,
    withered: (n) => `${n} crop${s(n)} withered out of season`,
    collapsed: 'You collapsed in the field — a rough night',
    quiet: 'A quiet night on the farm',
  },
};
