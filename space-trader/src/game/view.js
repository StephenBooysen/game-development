'use strict';

const { GOODS, GOODS_BY_ID } = require('../data/goods');
const { SYSTEMS, SYSTEMS_BY_ID, LANES, TECH_NAMES, POLICE_NAMES, DANGER_NAMES, UNITS_PER_PARSEC } = require('../data/systems');
const { SHIP_ORDER, EQUIPMENT, EQUIPMENT_ORDER } = require('../data/ships');
const { DIFFICULTY, SKILLS, BANK, SHIPYARD } = require('../data/rules');
const { quote, typicalQuote, tradingDiscount } = require('../engine/market');
const { shipStats, cargoUsed, tradeInValue, equipmentResale, registration } = require('../engine/ship');
const { distance, travelDays, laneDanger, pirateSurge } = require('../engine/galaxy');
const bank = require('../engine/bank');
const { netWorth, rankFor, reputation } = require('../engine/commander');
const { surrenderQuote } = require('../engine/encounters');
const { playerHitChance, escapeChance, SHIELD_BOOST } = require('../engine/combat');
const { maxBuyable } = require('./actions/trade');
const { fuelPrice, shipDeal } = require('./actions/shipyard');

const fmt = (n) => n.toLocaleString('en-US');
const pct = (f) => Math.round(f * 100);
const age = (days) => (days <= 0 ? 'today' : `${days}d`);
const SKILL_COLORS = { navigation: '#5CC8FF', battle: '#FF7A6B', trading: '#FFB547' };

function systemRef(id) {
  return { id, name: SYSTEMS_BY_ID[id].name };
}

function headerView(game, stats) {
  return {
    day: game.day,
    credits: game.credits,
    debt: game.loan ? game.loan.owed : 0,
    fuel: game.ship.fuel,
    fuelMax: stats.fuelMax,
    cargoUsed: cargoUsed(game),
    cargoCap: stats.cargoCap,
    hull: game.ship.hull,
    hullMax: stats.hullMax,
    hullPct: Math.round((game.ship.hull / stats.hullMax) * 100),
    shields: game.ship.shields,
    shieldMax: stats.shieldMax,
    navigation: stats.navigation
  };
}

function shipView(game, stats) {
  const def = stats.def;
  return {
    type: def.id,
    name: def.name,
    cls: def.cls,
    maker: def.maker,
    registration: registration(game.id),
    value: def.price,
    tradeIn: tradeInValue(game),
    hull: game.ship.hull,
    hullMax: stats.hullMax,
    shields: game.ship.shields,
    shieldMax: stats.shieldMax,
    cargoCap: stats.cargoCap,
    fuel: game.ship.fuel,
    fuelMax: stats.fuelMax,
    speed: stats.speed,
    crew: def.crew,
    slots: def.slots,
    slotsFree: stats.slotsFree,
    damage: stats.damage,
    equipment: game.ship.equipment.map((id) => ({ id, name: EQUIPMENT[id].name, type: EQUIPMENT[id].type, desc: EQUIPMENT[id].desc }))
  };
}

function cargoView(game) {
  return Object.entries(game.cargo)
    .filter(([, lot]) => lot.qty > 0)
    .map(([id, lot]) => ({ id, name: GOODS_BY_ID[id].name, qty: lot.qty, avgPaid: lot.qty ? Math.round(lot.cost / lot.qty) : 0, illegal: Boolean(GOODS_BY_ID[id].illegal) }));
}

function newsView(game, limit) {
  return game.news.slice(0, limit).map((n) => ({ when: n.day === game.day ? 'Today' : `Day ${n.day}`, text: n.text }));
}

/** Prices the player has seen elsewhere for one good, best first. */
function intelFor(game, goodId, excludeId) {
  return Object.entries(game.intel)
    .filter(([sys, info]) => sys !== excludeId && info.prices[goodId] && info.prices[goodId].sell)
    .map(([sys, info]) => ({ system: SYSTEMS_BY_ID[sys].name, systemId: sys, price: info.prices[goodId].sell, age: age(game.day - info.day), tip: info.source === 'tip' }))
    .sort((a, b) => b.price - a.price);
}

function marketView(game) {
  const here = game.location;
  const rows = GOODS.map((good) => {
    const q = quote(game, here, good.id);
    const lot = game.cargo[good.id];
    const intel = intelFor(game, good.id, here);
    const best = intel[0] || null;
    const event = game.events.find((e) => e.system === here && e.good === good.id && e.endDay >= game.day);
    return {
      id: good.id,
      name: good.name,
      illegal: Boolean(good.illegal),
      buy: q.buy,
      sell: q.sell,
      stock: q.stock,
      canBuy: q.canBuy,
      canSell: q.canSell,
      held: lot ? lot.qty : 0,
      avgPaid: lot && lot.qty ? Math.round(lot.cost / lot.qty) : null,
      maxBuy: maxBuyable(game, good.id),
      vsAverage: q.buy ? Math.round((q.buy / good.base - 1) * 100) : (q.sell ? Math.round((q.sell / good.base - 1) * 100) : null),
      event: event ? (event.mult > 1 ? 'shortage' : 'glut') : null,
      best,
      margin: best && q.buy ? best.price - q.buy : null,
      intel: intel.slice(0, 4)
    };
  });
  return {
    rows,
    trading: shipStats(game).trading,
    discountPct: pct(tradingDiscount(game)),
    freeCargo: shipStats(game).cargoCap - cargoUsed(game)
  };
}

function shipyardView(game, stats) {
  const system = SYSTEMS_BY_ID[game.location];
  const price = fuelPrice(game);
  const fuelMissing = stats.fuelMax - game.ship.fuel;
  const hullMissing = stats.hullMax - game.ship.hull;
  return {
    fuel: { current: game.ship.fuel, max: stats.fuelMax, price, missing: fuelMissing, cost: fuelMissing * price },
    repair: { current: game.ship.hull, max: stats.hullMax, price: SHIPYARD.repairPerPoint, missing: hullMissing, cost: hullMissing * SHIPYARD.repairPerPoint },
    tradeIn: tradeInValue(game),
    shipName: stats.def.name,
    ships: SHIP_ORDER.map((id) => {
      const deal = shipDeal(game, id);
      const def = deal.def;
      return {
        id, name: def.name, cls: def.cls, cargo: def.cargo, hull: def.hull, range: def.fuel, speed: def.speed,
        slots: def.slots, price: def.price, net: deal.net, owned: id === game.ship.type,
        sold: deal.sold.map((e) => EQUIPMENT[e].name), blocker: deal.blockers[0] || null
      };
    }),
    equipment: EQUIPMENT_ORDER.map((id) => {
      const eq = EQUIPMENT[id];
      let blocker = null;
      if (system.tech < eq.minTech) blocker = 'Not sold here';
      else if (stats.slotsFree[eq.type] <= 0) blocker = `No ${eq.type} slot`;
      else if (eq.price > game.credits) blocker = 'Too expensive';
      return { id, name: eq.name, type: eq.type, desc: eq.desc, price: eq.price, blocker };
    }),
    installed: game.ship.equipment.map((id, index) => ({ id, index, name: EQUIPMENT[id].name, type: EQUIPMENT[id].type, desc: EQUIPMENT[id].desc, resale: equipmentResale(id) })),
    slots: stats.def.slots,
    slotsFree: stats.slotsFree
  };
}

function bankView(game) {
  const rating = bank.creditRating(game);
  const rate = bank.dailyRate(game);
  const available = bank.availableCredit(game);
  const overdue = bank.overdueDays(game);
  const loan = game.loan;
  const amounts = [...new Set([...BANK.amounts.filter((a) => a < available), Math.floor(available / 100) * 100])].filter((a) => a >= 100);
  const quotes = {};
  for (const a of amounts) for (const t of BANK.terms) quotes[`${a}:${t}`] = bank.interestQuote(game, a, t);
  return {
    loan: loan ? {
      owed: loan.owed,
      principal: loan.principal,
      ratePct: +(loan.rate * 100).toFixed(2),
      takenDay: loan.takenDay,
      dueDay: loan.dueDay,
      daysLeft: loan.dueDay - game.day,
      overdue,
      graceLeft: overdue > 0 ? BANK.graceDays - overdue : null,
      progressPct: Math.max(0, Math.min(100, Math.round(((game.day - loan.takenDay) / Math.max(1, loan.dueDay - loan.takenDay)) * 100)))
    } : null,
    rating: { grade: rating.grade, label: rating.label, tone: rating.tone },
    limit: bank.creditLimit(game),
    available,
    ratePct: +(rate * 100).toFixed(2),
    baseRatePct: +(DIFFICULTY[game.difficulty].interest * 100).toFixed(2),
    tradingDiscountPct: +(bank.tradingRateDiscount(game) * 100).toFixed(2),
    trading: shipStats(game).trading,
    canBorrow: overdue === 0 && available >= 100,
    amounts,
    terms: BANK.terms,
    quotes,
    repayOptions: BANK.repayOptions,
    graceDays: BANK.graceDays
  };
}

/**
 * Every good priced for a run from here to another system: the live buy price
 * here against the sell price there. "There" comes from the player's price
 * intel (a visit or a trader's tip); without intel it is the system's typical
 * price, so the map never shows a market's live prices unseen.
 */
function destinationPrices(game, here, systemId) {
  const info = game.intel[systemId];
  const cargo = Object.fromEntries(cargoView(game).map((c) => [c.id, c]));
  const rows = GOODS.map((g) => {
    const local = quote(game, here, g.id);
    const there = info ? (info.prices[g.id] || { buy: null, sell: null }) : typicalQuote(game, systemId, g.id);
    const buyHere = local.canBuy && local.stock > 0 ? local.buy : null;
    const margin = buyHere && there.sell ? there.sell - buyHere : null;
    const lot = cargo[g.id];
    return {
      id: g.id,
      name: g.name,
      illegal: Boolean(g.illegal),
      buyHere,
      stockHere: local.stock,
      sellThere: there.sell,
      buyThere: there.buy,
      margin,
      maxQty: margin !== null ? maxBuyable(game, g.id) : 0,
      aboard: lot ? lot.qty : 0,
      paid: lot ? lot.avgPaid : null
    };
  });
  rows.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity) || a.name.localeCompare(b.name));

  // The run that makes the most money with the credits and hold space on hand.
  const best = rows
    .filter((r) => r.margin > 0)
    .map((r) => ({ good: r.name, illegal: r.illegal, margin: r.margin, qty: r.maxQty, profit: r.maxQty * r.margin }))
    .sort((a, b) => b.profit - a.profit || b.margin - a.margin)[0] || null;

  return {
    source: info ? (info.source === 'tip' ? 'tip' : 'seen') : 'typical',
    ageDays: info ? game.day - info.day : null,
    rows,
    best
  };
}

function galaxyView(game) {
  const here = game.location;
  return {
    here,
    fuel: game.ship.fuel,
    fuelMax: shipStats(game).fuelMax,
    rangeUnits: game.ship.fuel * UNITS_PER_PARSEC,
    lanes: LANES,
    free: shipStats(game).cargoCap - cargoUsed(game),
    systems: SYSTEMS.map((s) => {
      const dist = distance(here, s.id);
      const danger = s.id === here ? s.danger : laneDanger(game, here, s.id);
      return {
        id: s.id, name: s.name, x: s.x, y: s.y, color: s.color,
        economy: s.economy, government: s.government, techName: TECH_NAMES[s.tech],
        here: s.id === here, dist, days: travelDays(dist),
        inRange: s.id !== here && dist <= game.ship.fuel,
        fuelAfter: game.ship.fuel - dist,
        visited: game.visited.includes(s.id),
        blackMarket: Boolean(s.blackMarket),
        danger, dangerName: DANGER_NAMES[danger],
        pirate: pirateSurge(game, s.id),
        prices: s.id === here ? null : destinationPrices(game, here, s.id)
      };
    })
  };
}

function stationView(game, stats) {
  const s = SYSTEMS_BY_ID[game.location];
  const rows = GOODS.map((g) => ({ g, q: quote(game, s.id, g.id) }));
  const cheapest = rows.filter((r) => r.q.canBuy && r.q.stock > 0 && r.q.buy)
    .map((r) => ({ name: r.g.name, d: Math.round((r.q.buy / r.g.base - 1) * 100) }))
    .sort((a, b) => a.d - b.d)[0];
  let marketHint = { text: 'Trade goods', tone: 'neutral' };
  if (cheapest && cheapest.d < 0) marketHint = { text: `${cheapest.name} ${Math.abs(cheapest.d)}% below avg`, tone: 'good' };
  const fuelMissing = stats.fuelMax - game.ship.fuel;
  const loan = game.loan;
  const overdue = bank.overdueDays(game);
  const inRange = SYSTEMS.filter((x) => x.id !== s.id && distance(s.id, x.id) <= game.ship.fuel).length;
  return {
    system: {
      id: s.id, name: s.name, color: s.color, economy: s.economy, government: s.government, description: s.description,
      sector: s.sector, tech: s.tech, techName: TECH_NAMES[s.tech], population: s.population,
      police: POLICE_NAMES[s.police], danger: DANGER_NAMES[s.danger], blackMarket: Boolean(s.blackMarket)
    },
    news: newsView(game, 4),
    tiles: {
      market: marketHint,
      shipyard: fuelMissing > 0 ? { text: `Refuel ${fuelMissing} ps · ${fmt(fuelMissing * fuelPrice(game))} cr`, tone: 'neutral' } : (game.ship.hull < stats.hullMax ? { text: `Hull at ${Math.round((game.ship.hull / stats.hullMax) * 100)}%`, tone: 'warn' } : { text: 'Tanks full, hull sound', tone: 'neutral' }),
      bank: !loan ? { text: 'No debt', tone: 'neutral' } : overdue > 0 ? { text: `Overdue ${overdue} day${overdue === 1 ? '' : 's'}!`, tone: 'bad' } : { text: `Repay due in ${loan.dueDay - game.day} days`, tone: 'bad' },
      nav: { text: `${inRange} system${inRange === 1 ? '' : 's'} in range`, tone: inRange ? 'neutral' : 'bad' }
    }
  };
}

function commanderView(game, stats) {
  const worth = netWorth(game);
  const start = game.stats.startWorth || 1;
  const change = Math.round(((worth - start) / Math.abs(start)) * 100);
  const unseen = SYSTEMS.filter((s) => !game.visited.includes(s.id)).map((s) => s.name);
  const eff = { navigation: stats.navigation, battle: stats.battle, trading: stats.trading };
  return {
    name: game.name,
    difficulty: DIFFICULTY[game.difficulty].label,
    rank: rankFor(worth),
    netWorth: worth,
    skills: SKILLS.defs.map((d) => ({ id: d.id, name: d.name, base: game.skills[d.id], eff: eff[d.id], color: SKILL_COLORS[d.id] })),
    battleXp: { now: game.battleXp, need: game.skills.battle },
    reputation: reputation(game),
    stats: [
      { k: 'Net worth', v: fmt(worth), n: `${change >= 0 ? '+' : ''}${change}% since day 1`, tone: 'amber' },
      { k: 'Trades', v: fmt(game.stats.trades), n: game.stats.bestTrade > 0 ? `Best: +${fmt(game.stats.bestTrade)} cr` : 'No profitable sale yet', tone: 'strong' },
      { k: 'Systems seen', v: `${game.visited.length} / ${SYSTEMS.length}`, n: unseen.length ? `${unseen.slice(0, 3).join(', ')}${unseen.length > 3 ? '…' : ''} left` : 'The whole galaxy', tone: 'strong' },
      { k: 'Pirates beaten', v: fmt(game.stats.piratesBeaten), n: `Fled ${game.stats.fled}, surrendered ${game.stats.surrendered}`, tone: 'red' }
    ],
    history: game.history.slice(-30),
    log: game.log.slice(0, 40),
    retireEnding: game.loan && game.loan.owed > 0 ? 'bankrupt' : 'retired'
  };
}

function contactView(contact) {
  if (!contact) return null;
  if (!contact.revealed) return { revealed: false, resolved: contact.resolved, outcome: contact.outcome, distanceKm: contact.distanceKm };
  const e = contact.enemy;
  return {
    revealed: true,
    resolved: contact.resolved,
    outcome: contact.outcome,
    kind: contact.kind,
    via: contact.via || null,
    line: contact.line,
    distanceKm: contact.distanceKm,
    enemy: {
      name: e.name, cls: e.cls, kind: e.kind, hull: e.hull, hullMax: e.hullMax, shields: e.shields, shieldMax: e.shieldMax,
      weapons: summariseWeapons(e.weapons), speed: e.speed, crew: e.crew, bounty: e.bounty, threat: e.threat,
      captain: e.captain || null, cargoUsed: e.cargoUsed || null, cargoCap: e.cargoCap || null
    }
  };
}

function summariseWeapons(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return Object.entries(counts).map(([id, n]) => `${n}× ${EQUIPMENT[id].name.split(' ')[0].toLowerCase()}`).join(', ');
}

function travelView(game) {
  const t = game.travel;
  return {
    from: systemRef(t.from),
    to: systemRef(t.to),
    dist: t.dist,
    days: t.days,
    departDay: t.departDay,
    fuelUsed: t.fuelUsed,
    log: t.log,
    contact: contactView(t.contact),
    canArrive: !t.contact || t.contact.resolved,
    canAbort: !t.contact || !t.contact.revealed || t.contact.resolved
  };
}

function encounterView(game, stats) {
  const contact = game.travel.contact;
  const base = { ...contactView(contact), me: { name: stats.def.name, hull: game.ship.hull, hullMax: stats.hullMax, shields: game.ship.shields, shieldMax: stats.shieldMax } };
  if (contact.kind === 'trader') {
    const free = stats.cargoCap - cargoUsed(game);
    return {
      ...base,
      offers: contact.offers.map((o) => {
        let blocker = null;
        if (o.status === 'open') {
          if (o.type === 'buy' && o.qty > free) blocker = `Need ${o.qty} t free`;
          else if (o.type === 'buy' && o.cost > game.credits) blocker = 'Not enough credits';
          else if (o.type === 'sell' && (!game.cargo[o.good] || game.cargo[o.good].qty < o.qty)) blocker = 'Cargo gone';
          else if (o.type === 'tip' && o.cost > game.credits) blocker = 'Not enough credits';
        }
        return { id: o.id, type: o.type, tag: o.tag, title: o.title, note: o.note, cost: o.cost, status: o.status, blocker };
      })
    };
  }
  const odds = contact.odds;
  const sq = surrenderQuote(game);
  return {
    ...base,
    options: {
      attack: { winPct: pct(odds.win), battle: stats.battle, weapons: stats.weapons.length },
      flee: { pct: pct(odds.flee), navigation: stats.navigation, enemySpeed: contact.enemy.speed },
      pay: { cost: odds.pay.cost, base: odds.pay.base, affordable: odds.pay.cost <= game.credits, trading: stats.trading, hunter: contact.kind === 'hunter' },
      surrender: { tonnes: sq.tonnes, value: sq.value, possible: sq.tonnes > 0 }
    }
  };
}

function combatView(game, stats) {
  const contact = game.travel.contact;
  const e = contact.enemy;
  return {
    turn: game.combat.turn,
    log: game.combat.log,
    last: game.combat.last,
    me: { name: stats.def.name, hull: game.ship.hull, hullMax: stats.hullMax, shields: game.ship.shields, shieldMax: stats.shieldMax, battle: stats.battle },
    enemy: { name: e.name, cls: e.cls, kind: e.kind, hull: e.hull, hullMax: e.hullMax, shields: e.shields, shieldMax: e.shieldMax, bounty: e.bounty },
    actions: {
      fire: { possible: stats.weapons.length > 0, damage: stats.damage, hitPct: pct(playerHitChance(stats, e)) },
      evade: { possible: true },
      shield: { possible: stats.shieldMax > 0 && game.ship.shields < stats.shieldMax, boost: SHIELD_BOOST, none: stats.shieldMax === 0 },
      flee: { possible: true, pct: pct(escapeChance(stats, e)) }
    }
  };
}

function victoryView(game, stats) {
  const contact = game.travel.contact;
  return {
    enemy: { name: contact.enemy.name, cls: contact.enemy.cls, kind: contact.enemy.kind },
    ...contact.victory,
    xp: { now: game.battleXp, need: game.skills.battle, maxed: game.skills.battle >= 10 },
    loot: contact.loot,
    cargoUsed: cargoUsed(game),
    cargoCap: stats.cargoCap,
    fuel: game.ship.fuel,
    fuelMax: stats.fuelMax,
    destination: systemRef(game.travel.to)
  };
}

/**
 * Everything the browser needs to draw the current game. Hidden information
 * (what an unscanned contact really is) never leaves the server.
 * @param {Object} game
 * @return {Object}
 */
function buildView(game) {
  const stats = shipStats(game);
  const view = {
    id: game.id,
    name: game.name,
    difficulty: { id: game.difficulty, label: DIFFICULTY[game.difficulty].label },
    day: game.day,
    status: game.status,
    location: systemRef(game.location),
    header: headerView(game, stats),
    ship: shipView(game, stats),
    cargo: cargoView(game),
    commander: commanderView(game, stats)
  };
  if (game.status === 'docked') {
    view.station = stationView(game, stats);
    view.market = marketView(game);
    view.shipyard = shipyardView(game, stats);
    view.bank = bankView(game);
    view.galaxy = galaxyView(game);
  }
  if (game.travel) view.travel = travelView(game);
  if (game.status === 'encounter') view.encounter = encounterView(game, stats);
  if (game.status === 'combat') view.combat = combatView(game, stats);
  if (game.status === 'victory') view.victory = victoryView(game, stats);
  if (game.status === 'over') view.over = { ...game.over };
  return view;
}

/** A short summary for the title screen's Continue button. */
function summaryView(game) {
  return { id: game.id, name: game.name, day: game.day, status: game.status, location: SYSTEMS_BY_ID[game.location].name, over: game.status === 'over' };
}

module.exports = { buildView, summaryView };
