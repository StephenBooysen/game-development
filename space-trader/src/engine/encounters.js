'use strict';

const { GOODS, GOODS_BY_ID } = require('../data/goods');
const { SYSTEMS, SYSTEMS_BY_ID } = require('../data/systems');
const { SHIPS } = require('../data/ships');
const { DIFFICULTY, ENCOUNTER_CHANCE } = require('../data/rules');
const F = require('../data/flavour');
const { laneDanger } = require('./galaxy');
const { overdueDays } = require('./bank');
const { netWorth } = require('./commander');
const { quote, cargoValue } = require('./market');
const { shipStats, cargoUsed } = require('./ship');
const { winChance, escapeChance } = require('./combat');

const PIRATE_TIERS = [
  { cls: 'Pirate skiff', hull: 70, shields: 0, weapons: ['pulse'], speed: 5, battle: 2, crew: 1, bounty: 400, threat: 'Low' },
  { cls: 'Pirate raider', hull: 120, shields: 30, weapons: ['pulse', 'pulse'], speed: 6, battle: 3, crew: 3, bounty: 900, threat: 'Medium' },
  { cls: 'Pirate gunship', hull: 170, shields: 60, weapons: ['beam', 'pulse'], speed: 6, battle: 5, crew: 5, bounty: 1600, threat: 'High' },
  { cls: 'Pirate warlord', hull: 240, shields: 80, weapons: ['beam', 'beam'], speed: 7, battle: 7, crew: 8, bounty: 2800, threat: 'Extreme' }
];

const HUNTER = { cls: 'Bounty hunter', hull: 150, shields: 50, weapons: ['beam', 'pulse'], speed: 7, battle: 5, crew: 4, bounty: 0, threat: 'High' };
const TRADER = { cls: 'Free trader', hull: 160, shields: 20, weapons: ['pulse'], speed: 4, battle: 2, crew: 3, bounty: 0, threat: 'Low' };

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));

/** Builds an enemy ship from a template, scaled by difficulty. */
function buildEnemy(template, name, game, extra = {}) {
  const strength = DIFFICULTY[game.difficulty].enemyStrength;
  const hull = Math.round(template.hull * strength);
  const shields = Math.round(template.shields * strength);
  return {
    name,
    cls: template.cls,
    hull,
    hullMax: hull,
    shields,
    shieldMax: shields,
    weapons: [...template.weapons],
    speed: template.speed,
    battle: template.battle,
    crew: template.crew,
    bounty: template.bounty,
    threat: template.threat,
    canFlee: true,
    ...extra
  };
}

function lineVars(game) {
  return {
    ship: SHIPS[game.ship.type].name.split(' ')[0],
    from: SYSTEMS_BY_ID[game.travel ? game.travel.from : game.location].name,
    to: game.travel ? SYSTEMS_BY_ID[game.travel.to].name : '',
    overdue: overdueDays(game)
  };
}

/**
 * Pirate strength scales with the lane's danger and with how rich (and so how
 * well armed) the commander has become: new commanders meet skiffs and raiders.
 */
function makePirate(game, danger, rng) {
  const worth = netWorth(game);
  const base = danger === 0 ? 0 : danger === 1 ? rng.int(0, 1) : 1;
  const progress = (worth >= 20000 ? 1 : 0) + (worth >= 60000 ? 1 : 0);
  const tier = Math.max(0, Math.min(3, base + progress));
  return buildEnemy(PIRATE_TIERS[tier], rng.pick(F.PIRATE_NAMES), game, { tier, kind: 'pirate' });
}

function makeHunter(game, rng) {
  return buildEnemy(HUNTER, rng.pick(F.HUNTER_NAMES), game, { tier: 2, kind: 'hunter', canFlee: false });
}

function makeTrader(game, rng) {
  const used = rng.int(15, 32);
  return buildEnemy(TRADER, rng.pick(F.TRADER_SHIPS), game, {
    tier: 0, kind: 'trader', captain: rng.pick(F.TRADER_CAPTAINS), cargoUsed: used, cargoCap: 35, cls: 'Free trader · Bulk hauler'
  });
}

/**
 * Decides whether something shows up on the scanners during a jump.
 * The contact's nature stays hidden until it is scanned, hailed or forces itself on you.
 * @param {Object} game (game.travel must be set)
 * @param {Object} rng
 * @return {Object|null}
 */
function rollContact(game, rng) {
  const { from, to } = game.travel;
  let kind = null;
  if (overdueDays(game) > 0 && rng.chance(0.45)) {
    kind = 'hunter';
  } else {
    const danger = laneDanger(game, from, to);
    if (!rng.chance(ENCOUNTER_CHANCE[danger] * DIFFICULTY[game.difficulty].encounterMult)) return null;
    kind = rng.chance([0.35, 0.55, 0.8][danger]) ? 'pirate' : 'trader';
  }
  const danger = laneDanger(game, from, to);
  const enemy = kind === 'pirate' ? makePirate(game, danger, rng) : kind === 'hunter' ? makeHunter(game, rng) : makeTrader(game, rng);
  const lines = kind === 'pirate' ? F.PIRATE_LINES : kind === 'hunter' ? F.HUNTER_LINES : F.TRADER_LINES;
  return {
    kind,
    revealed: false,
    resolved: false,
    outcome: null,
    distanceKm: rng.int(30, 60) * 100,
    lineTemplate: rng.pick(lines),
    enemy,
    offers: null,
    odds: null,
    loot: null,
    victory: null
  };
}

/**
 * What the pirates (or hunters) will take to leave you alone.
 * @param {Object} game
 * @param {Object} contact
 * @return {{base: number, cost: number}}
 */
function payOffQuote(game, contact) {
  if (contact.kind === 'hunter') {
    const owed = game.loan ? game.loan.owed : 0;
    const cost = Math.max(100, Math.round((owed * 0.25) / 10) * 10);
    return { base: cost, cost };
  }
  const tierMult = 1 + (contact.enemy.tier || 0) * 0.3;
  const base = Math.round(((200 + cargoValue(game) * 0.2 + game.credits * 0.1) * tierMult) / 10) * 10;
  const discount = Math.min(0.5, shipStats(game).trading * 0.05);
  return { base, cost: Math.max(50, Math.round((base * (1 - discount)) / 10) * 10) };
}

/**
 * Reveals a contact: fixes its transmission, odds and (for traders) offers.
 * @param {Object} game
 * @param {Object} rng
 */
function revealContact(game, rng) {
  const contact = game.travel.contact;
  if (contact.revealed) return;
  contact.revealed = true;
  contact.line = fill(contact.lineTemplate, lineVars(game));
  if (contact.kind === 'trader') {
    contact.offers = makeTraderOffers(game, contact, rng);
  } else {
    refreshOdds(game);
  }
}

/** Recomputes attack/flee/pay odds for a hostile contact. */
function refreshOdds(game) {
  const contact = game.travel.contact;
  const stats = shipStats(game);
  contact.odds = {
    win: winChance(game, contact.enemy),
    flee: escapeChance(stats, contact.enemy),
    pay: payOffQuote(game, contact)
  };
}

/**
 * A free trader's three offers: something to sell you, something to buy from you, and a market tip.
 * @param {Object} game
 * @param {Object} contact
 * @param {Object} rng
 * @return {Array<Object>}
 */
function makeTraderOffers(game, contact, rng) {
  const offers = [];
  const dest = game.travel.to;
  const destName = SYSTEMS_BY_ID[dest].name;

  // 1. They sell: something that sells well where you are going.
  const sellables = GOODS
    .filter((g) => !g.illegal)
    .map((g) => ({ g, q: quote(game, dest, g.id) }))
    .filter(({ q }) => q.sell)
    .sort((a, b) => b.q.sell / b.g.base - a.q.sell / a.g.base)
    .slice(0, 4);
  if (sellables.length) {
    const { g, q } = rng.pick(sellables);
    const price = Math.max(1, Math.round(q.sell * rng.float(0.62, 0.78)));
    const qty = rng.int(3, 8);
    const seen = game.intel[dest] && game.intel[dest].prices[g.id] && game.intel[dest].prices[g.id].sell;
    offers.push({
      id: 'sell', type: 'buy', good: g.id, qty, price, cost: qty * price, status: 'open',
      tag: 'They sell', title: `${g.name} · ${qty} t at ${price}/t`,
      note: seen ? `${destName} last paid ${seen}/t when you were there.` : `They say ${destName} pays about ${Math.round(q.sell / 10) * 10}/t.`
    });
  }

  // 2. They buy: your most valuable legal cargo.
  const lots = Object.entries(game.cargo)
    .filter(([id, lot]) => lot.qty > 0 && !GOODS_BY_ID[id].illegal)
    .sort((a, b) => GOODS_BY_ID[b[0]].base - GOODS_BY_ID[a[0]].base);
  if (lots.length) {
    const [id, lot] = lots[0];
    const good = GOODS_BY_ID[id];
    const avg = lot.qty ? Math.round(lot.cost / lot.qty) : 0;
    const price = Math.max(1, Math.round(Math.max(avg * rng.float(1.12, 1.32), good.base * rng.float(0.85, 1.05))));
    const qty = Math.min(lot.qty, 10);
    const profit = (price - avg) * qty;
    offers.push({
      id: 'buy', type: 'sell', good: id, qty, price, cost: -qty * price, status: 'open',
      tag: 'They buy', title: `Your ${good.name} · ${qty} t at ${price}/t`,
      note: avg > 0 ? `You paid ${avg}/t. ${profit >= 0 ? '+' : '−'}${Math.abs(profit).toLocaleString('en-US')} cr profit now.` : 'Salvaged cargo: all profit.'
    });
  }

  // 3. A market tip for a system you know least about.
  const tipTargets = SYSTEMS
    .filter((s) => s.id !== game.location && s.id !== dest)
    .sort((a, b) => (game.intel[a.id] ? game.intel[a.id].day : -1) - (game.intel[b.id] ? game.intel[b.id].day : -1));
  if (tipTargets.length) {
    const target = tipTargets[0];
    const cost = rng.int(5, 12) * 10;
    offers.push({
      id: 'tip', type: 'tip', system: target.id, cost, status: 'open',
      tag: 'Rumour', title: `Today’s price list for ${target.name}`,
      note: game.intel[target.id] ? `Your prices there are ${game.day - game.intel[target.id].day} days old.` : 'You have no prices for that market yet.'
    });
  }
  return offers;
}

/**
 * Salvage left after a won fight.
 * @param {Object} game
 * @param {Object} contact
 * @param {Object} rng
 * @return {Array<Object>}
 */
function makeLoot(game, contact, rng) {
  const loot = [];
  const enemy = contact.enemy;
  const pool = enemy.kind === 'trader'
    ? ['food', 'textiles', 'machinery', 'medicine', 'entertainment', 'water']
    : ['weapons', 'ore', 'entertainment', 'machinery', 'contraband', 'medicine'];
  const goodsCount = enemy.kind === 'hunter' ? 0 : enemy.kind === 'trader' ? 2 : rng.int(1, 2);
  const picked = new Set();
  for (let i = 0; i < goodsCount; i++) {
    const id = rng.pick(pool.filter((g) => !picked.has(g)));
    picked.add(id);
    const good = GOODS_BY_ID[id];
    const qty = enemy.kind === 'trader' ? rng.int(3, 8) : rng.int(2, 3 + enemy.tier);
    loot.push({ id: `g${i}`, kind: 'good', good: id, qty, tonnes: qty, value: Math.round(good.base * 0.85) * qty, name: `${good.name} · ${qty} t`, note: lootNote(game, id) });
  }
  const fuel = rng.int(2, 4);
  loot.push({ id: 'fuel', kind: 'fuel', qty: fuel, tonnes: 0, value: fuel * 15, name: `Fuel cells · +${fuel} ps`, note: 'Goes straight into your tanks' });
  if (enemy.kind !== 'trader' || rng.chance(0.5)) {
    const credits = rng.int(2, 6 + (enemy.tier || 0) * 2) * 50;
    loot.push({ id: 'cash', kind: 'credits', qty: credits, tonnes: 0, value: credits, name: `Strongbox · ${credits.toLocaleString('en-US')} cr`, note: 'Credits, no hold space needed' });
  }
  return loot;
}

function lootNote(game, goodId) {
  const good = GOODS_BY_ID[goodId];
  let best = null;
  for (const [sys, intel] of Object.entries(game.intel)) {
    const p = intel.prices[goodId] && intel.prices[goodId].sell;
    if (p && (!best || p > best.price)) best = { sys, price: p };
  }
  if (good.illegal) return best ? `Black market: ~${best.price}/t on ${SYSTEMS_BY_ID[best.sys].name}. Police confiscate it.` : 'Illegal. Only black markets buy it.';
  return best ? `Sells for ~${best.price.toLocaleString('en-US')}/t on ${SYSTEMS_BY_ID[best.sys].name}` : `Worth about ${good.base}/t on average`;
}

/** Tonnes and value of everything in the hold (what surrendering costs). */
function surrenderQuote(game) {
  return { tonnes: cargoUsed(game), value: cargoValue(game) };
}

module.exports = {
  PIRATE_TIERS, rollContact, revealContact, refreshOdds, payOffQuote, makeTraderOffers, makeLoot, surrenderQuote
};
