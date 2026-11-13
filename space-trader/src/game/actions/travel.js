'use strict';

const { GOODS_BY_ID } = require('../../data/goods');
const { SYSTEMS_BY_ID } = require('../../data/systems');
const { distance, travelDays } = require('../../engine/galaxy');
const { recordIntel } = require('../../engine/market');
const { shipStats, cargoUsed } = require('../../engine/ship');
const { advanceDay, addLog, recordWorth } = require('../../engine/world');
const { rollContact, revealContact, makeLoot, surrenderQuote } = require('../../engine/encounters');
const { startCombat, freeShot, playRound, escapeChance } = require('../../engine/combat');
const { endGame } = require('./endings');
const { reject, requireStatus } = require('../errors');

const fmt = (n) => n.toLocaleString('en-US');
const name = (id) => SYSTEMS_BY_ID[id].name;

function travelLog(game, text, tone = 'neutral') {
  game.travel.log.push({ day: game.day, text, tone });
}

function cargoSummary(game) {
  const lots = Object.entries(game.cargo).filter(([, lot]) => lot.qty > 0);
  if (!lots.length) return 'an empty hold';
  return lots.map(([id, lot]) => `${lot.qty} t ${GOODS_BY_ID[id].name}`).join(', ');
}

/**
 * Starts a jump to another system. Fuel is spent up front; the jump may be interrupted by a contact.
 * @param {Object} game
 * @param {{to: string}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function travel(game, { to }, rng) {
  requireStatus(game, 'docked');
  if (!SYSTEMS_BY_ID[to]) reject('Unknown system.');
  if (to === game.location) reject('You are already docked there.');
  const dist = distance(game.location, to);
  if (dist > game.ship.fuel) reject(`${name(to)} is ${dist} parsecs away; you have fuel for ${game.ship.fuel}.`);

  let fuelUsed = dist;
  const nav = shipStats(game).navigation;
  const saved = dist > 1 && rng.chance(nav * 0.04);
  if (saved) fuelUsed -= 1;
  game.ship.fuel -= fuelUsed;

  game.status = 'travel';
  game.travel = { from: game.location, to, dist, days: travelDays(dist), departDay: game.day, fuelUsed, log: [], contact: null };
  travelLog(game, `Departed ${name(game.location)} with ${cargoSummary(game)}.`);
  travelLog(game, `Warp drive engaged. Heading for ${name(to)}, ${dist} parsecs.`);
  if (saved) travelLog(game, 'Mid-course correction. Navigation skill saved 1 ps of fuel.', 'good');

  const contact = rollContact(game, rng);
  if (contact) {
    game.travel.contact = contact;
    travelLog(game, 'Sensor contact on long-range scanner. Transponder off.', 'bad');
  } else {
    travelLog(game, 'Lanes are clear. No contacts on the scanner.', 'good');
  }
  return {};
}

/**
 * Drops out of warp at the destination: days pass, then customs may inspect the hold.
 * @param {Object} game
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function arrive(game, rng) {
  const t = game.travel;
  for (let i = 0; i < t.days; i++) {
    const result = advanceDay(game, rng);
    if (result.seized) {
      game.location = t.to;
      endGame(game, 'seized');
      return { notice: { tone: 'bad', text: 'Bank recovery agents were waiting at the dock.' } };
    }
  }
  game.location = t.to;
  game.status = 'docked';
  game.travel = null;
  game.combat = null;
  game.ship.shields = shipStats(game).shieldMax;
  if (!game.visited.includes(t.to)) game.visited.push(t.to);
  recordIntel(game, t.to);
  addLog(game, `Docked at ${name(t.to)} after ${t.days} day${t.days === 1 ? '' : 's'} in warp.`);

  const notice = customsInspection(game, rng);
  recordWorth(game);
  return { notice: notice || { tone: 'info', text: `Docked at ${name(t.to)}.` } };
}

/** Police may scan your hold on arrival and confiscate contraband. */
function customsInspection(game, rng) {
  const system = SYSTEMS_BY_ID[game.location];
  if (!system.police) return null;
  const chance = system.police * 0.08 * (1 + game.offences * 0.5);
  if (!rng.chance(chance)) return null;
  const lot = game.cargo.contraband;
  if (!lot || lot.qty <= 0) {
    return { tone: 'info', text: `${system.name} customs scanned your hold. All clear.` };
  }
  const value = lot.qty * GOODS_BY_ID.contraband.base;
  const fine = Math.min(game.credits, Math.max(500, Math.round(value * 0.5)));
  delete game.cargo.contraband;
  game.credits -= fine;
  game.offences += 1;
  addLog(game, `Customs on ${system.name} seized ${lot.qty} t of contraband.`, { value: `−${fmt(fine)} cr fine`, tone: 'bad' });
  return { tone: 'bad', text: `Customs seized ${lot.qty} t of contraband and fined you ${fmt(fine)} cr. Your police record suffers.` };
}

function requireContact(game, { revealed } = {}) {
  const contact = game.travel && game.travel.contact;
  if (!contact || contact.resolved) reject('There is no contact on your scanner.');
  if (revealed === false && contact.revealed) reject('You have already made contact.');
  return contact;
}

function resolveContact(game, outcome) {
  const contact = game.travel.contact;
  contact.resolved = true;
  contact.outcome = outcome;
  game.status = 'travel';
  game.combat = null;
}

/**
 * Responds to an unidentified contact while in warp.
 * @param {Object} game
 * @param {{action: 'scan'|'hail'|'evade'|'abort'}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function contactAction(game, { action }, rng) {
  requireStatus(game, 'travel');
  if (action === 'abort') return abortJump(game, rng);
  const contact = requireContact(game, { revealed: false });

  if (action === 'scan' || action === 'hail') {
    revealContact(game, rng);
    contact.via = action;
    game.status = 'encounter';
    travelLog(game, action === 'scan' ? `Scan complete: ${contact.enemy.cls}, the ${contact.enemy.name}.` : `The ${contact.enemy.name} answers your hail.`, contact.kind === 'trader' ? 'good' : 'bad');
    return {};
  }

  if (action === 'evade') {
    if (contact.kind === 'trader') {
      resolveContact(game, 'evaded');
      travelLog(game, 'You alter course. The contact keeps its distance and fades from the scanner.', 'good');
      return { notice: { tone: 'good', text: 'Contact lost. Course clear.' } };
    }
    const odds = escapeChance(shipStats(game), contact.enemy);
    if (rng.chance(odds)) {
      resolveContact(game, 'evaded');
      game.stats.fled += 1;
      travelLog(game, 'Hard burn on a new heading. The contact loses your trail.', 'good');
      return { notice: { tone: 'good', text: 'You gave them the slip.' } };
    }
    revealContact(game, rng);
    contact.via = 'forced';
    game.status = 'encounter';
    travelLog(game, `The contact matches your course. It's the ${contact.enemy.name}, and it's closing.`, 'bad');
    return { notice: { tone: 'bad', text: 'They matched your course!' } };
  }
  reject('Unknown action.');
}

/** Turns back to the departure system; half the fuel is recovered. */
function abortJump(game, rng) {
  const t = game.travel;
  if (t.contact && t.contact.revealed && !t.contact.resolved) reject('Too late to turn back now.');
  const refund = Math.floor(t.fuelUsed / 2);
  game.ship.fuel = Math.min(shipStats(game).fuelMax, game.ship.fuel + refund);
  advanceDay(game, rng);
  game.location = t.from;
  game.status = 'docked';
  game.travel = null;
  game.ship.shields = shipStats(game).shieldMax;
  addLog(game, `Aborted the jump to ${name(t.to)} and returned to ${name(t.from)}.`, { tone: 'warn' });
  recordIntel(game, t.from);
  return { notice: { tone: 'warn', text: `Jump aborted. Back at ${name(t.from)} with ${refund} ps recovered.` } };
}

/**
 * Pirate or bounty-hunter encounter choices.
 * @param {Object} game
 * @param {{action: 'attack'|'flee'|'pay'|'surrender'}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function encounterAction(game, { action }, rng) {
  requireStatus(game, 'encounter');
  const contact = requireContact(game);
  if (contact.kind === 'trader') reject('This contact is a trader.');
  const enemy = contact.enemy;

  if (action === 'attack') {
    startCombat(game);
    return {};
  }

  if (action === 'flee') {
    if (rng.chance(contact.odds.flee)) {
      resolveContact(game, 'fled');
      game.stats.fled += 1;
      travelLog(game, `Escaped from the ${enemy.name}.`, 'good');
      return { notice: { tone: 'good', text: `You outran the ${enemy.name}.` } };
    }
    const entry = freeShot(game, rng);
    if (game.ship.hull <= 0) {
      endGame(game, 'destroyed', { enemy: `the ${enemy.name}` });
      return {};
    }
    startCombat(game, [entry, { turn: 0, text: 'Escape failed. They got a free shot as you turned.', tone: 'info' }]);
    return { notice: { tone: 'bad', text: 'Escape failed. They opened fire as you turned.' } };
  }

  if (action === 'pay') {
    const cost = contact.odds.pay.cost;
    if (cost > game.credits) reject(`They want ${fmt(cost)} cr; you have ${fmt(game.credits)} cr.`);
    game.credits -= cost;
    game.stats.paidOff += 1;
    if (contact.kind === 'hunter' && game.loan) {
      game.loan.owed = Math.max(0, game.loan.owed - cost);
      game.loan.principal = Math.min(game.loan.principal, game.loan.owed);
      game.loan.dueDay = game.day + 10;
      if (game.loan.owed === 0) game.loan = null;
      addLog(game, `Paid ${fmt(cost)} cr to bank recovery agents. Loan extended.`, { value: `−${fmt(cost)} cr`, tone: 'warn' });
    } else {
      addLog(game, `Paid off the pirate ${enemy.name}.`, { value: `−${fmt(cost)} cr`, tone: 'bad' });
    }
    resolveContact(game, 'paid');
    const arrival = arrive(game, rng);
    return { notice: { tone: 'warn', text: `You paid ${fmt(cost)} cr and they let you pass. ${arrival.notice ? arrival.notice.text : ''}`.trim() } };
  }

  if (action === 'surrender') {
    const { tonnes, value } = surrenderQuote(game);
    if (tonnes <= 0) reject('Your hold is empty. There is nothing to surrender.');
    game.cargo = {};
    game.stats.surrendered += 1;
    if (contact.kind === 'hunter' && game.loan) {
      game.loan.owed = Math.max(0, game.loan.owed - Math.round(value * 0.6));
      game.loan.principal = Math.min(game.loan.principal, game.loan.owed);
      if (game.loan.owed === 0) game.loan = null;
    }
    addLog(game, `Surrendered ${tonnes} t of cargo to the ${enemy.name}.`, { value: `−${tonnes} t`, tone: 'bad' });
    resolveContact(game, 'surrendered');
    const arrival = arrive(game, rng);
    return { notice: { tone: 'warn', text: `They took your cargo and left. ${arrival.notice ? arrival.notice.text : ''}`.trim() } };
  }
  reject('Unknown action.');
}

/**
 * One turn of combat.
 * @param {Object} game
 * @param {{action: 'fire'|'evade'|'shield'|'flee'}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function combatAction(game, { action }, rng) {
  requireStatus(game, 'combat');
  const contact = requireContact(game);
  const enemy = contact.enemy;
  if (action === 'shield' && shipStats(game).shieldMax === 0) reject('You have no shield generator fitted.');

  const { outcome } = playRound(game, action, rng);
  if (outcome === 'lost') {
    endGame(game, 'destroyed', { enemy: `the ${enemy.name}` });
    return {};
  }
  if (outcome === 'fled') {
    resolveContact(game, 'fled');
    game.stats.fled += 1;
    travelLog(game, `Broke away from the ${enemy.name} mid-fight.`, 'good');
    return { notice: { tone: 'good', text: 'You broke away.' } };
  }
  if (outcome === 'enemyFled') {
    resolveContact(game, 'enemyFled');
    travelLog(game, `The ${enemy.name} broke off and fled.`, 'good');
    return { notice: { tone: 'info', text: `The ${enemy.name} fled. No bounty this time.` } };
  }
  if (outcome === 'won') return winFight(game, rng);
  return {};
}

/** Pays any bounty, grants battle experience and lays out the salvage. */
function winFight(game, rng) {
  const contact = game.travel.contact;
  const enemy = contact.enemy;
  const bounty = enemy.bounty || 0;
  game.credits += bounty;
  if (enemy.kind === 'pirate') game.stats.piratesBeaten += 1;

  let leveled = false;
  if (game.skills.battle < 10) {
    game.battleXp += 1;
    if (game.battleXp >= game.skills.battle) {
      game.skills.battle += 1;
      game.battleXp = 0;
      leveled = true;
    }
  }
  contact.loot = makeLoot(game, contact, rng);
  contact.victory = {
    bounty,
    damageTaken: Math.max(0, game.combat.startHull - game.ship.hull),
    turns: game.combat.turn - 1,
    leveled,
    battle: game.skills.battle
  };
  game.status = 'victory';
  const label = enemy.kind === 'pirate' ? 'pirate' : enemy.kind === 'hunter' ? 'bounty hunter' : 'trader';
  addLog(game, `Destroyed the ${label} "${enemy.name}" near ${name(game.travel.to)}.`, { value: bounty ? `+${fmt(bounty)} bounty` : '', tone: enemy.kind === 'trader' ? 'bad' : 'good' });
  if (leveled) addLog(game, `Battle skill increased to ${game.skills.battle}.`, { tone: 'good' });
  return {};
}

/**
 * Takes the chosen salvage and resumes the jump to the destination.
 * @param {Object} game
 * @param {{take: Array<string>}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function takeLoot(game, { take }, rng) {
  requireStatus(game, 'victory');
  const contact = game.travel.contact;
  const chosen = contact.loot.filter((item) => take.includes(item.id));
  const stats = shipStats(game);
  const tonnes = chosen.reduce((t, item) => t + item.tonnes, 0);
  const free = stats.cargoCap - cargoUsed(game);
  if (tonnes > free) reject(`That salvage needs ${tonnes} t; you have ${free} t free.`);
  for (const item of chosen) {
    if (item.kind === 'good') {
      const lot = game.cargo[item.good] || { qty: 0, cost: 0 };
      lot.qty += item.qty;
      game.cargo[item.good] = lot;
    } else if (item.kind === 'fuel') {
      game.ship.fuel = Math.min(stats.fuelMax, game.ship.fuel + item.qty);
    } else if (item.kind === 'credits') {
      game.credits += item.qty;
    }
  }
  if (chosen.length) addLog(game, `Salvaged ${chosen.map((i) => i.name).join(', ')}.`, { tone: 'good' });
  resolveContact(game, 'destroyed');
  return arrive(game, rng);
}

/**
 * Free-trader encounter: accept or decline offers, attack them, or move on.
 * @param {Object} game
 * @param {{action: 'accept'|'decline'|'attack'|'leave', offer?: string}} input
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function traderAction(game, { action, offer: offerId }, rng) {
  requireStatus(game, 'encounter');
  const contact = requireContact(game);
  if (contact.kind !== 'trader') reject('This contact isn’t a trader.');

  if (action === 'leave') {
    resolveContact(game, 'parted');
    return arrive(game, rng);
  }
  if (action === 'attack') {
    game.offences += 1;
    game.stats.tradersAttacked += 1;
    addLog(game, `Opened fire on the free trader ${contact.enemy.name}.`, { tone: 'bad' });
    contact.enemy.canFlee = true;
    startCombat(game, [{ turn: 0, text: `${contact.enemy.name}: “Mayday, mayday! Unprovoked attack!”`, tone: 'info' }]);
    return { notice: { tone: 'bad', text: 'Your police record drops.' } };
  }

  const offer = (contact.offers || []).find((o) => o.id === offerId);
  if (!offer) reject('Unknown offer.');
  if (offer.status !== 'open') reject('You have already answered that offer.');
  if (action === 'decline') {
    offer.status = 'declined';
    return {};
  }
  if (action !== 'accept') reject('Unknown action.');

  if (offer.type === 'buy') {
    const free = shipStats(game).cargoCap - cargoUsed(game);
    if (offer.qty > free) reject(`You need ${offer.qty} t free; you have ${free} t.`);
    if (offer.cost > game.credits) reject(`That costs ${fmt(offer.cost)} cr.`);
    game.credits -= offer.cost;
    const lot = game.cargo[offer.good] || { qty: 0, cost: 0 };
    lot.qty += offer.qty;
    lot.cost += offer.cost;
    game.cargo[offer.good] = lot;
    addLog(game, `Bought ${offer.qty} t ${GOODS_BY_ID[offer.good].name} from the trader ${contact.enemy.name}.`, { value: `−${fmt(offer.cost)} cr`, tone: 'bad' });
  } else if (offer.type === 'sell') {
    const lot = game.cargo[offer.good];
    if (!lot || lot.qty < offer.qty) reject('You no longer have that cargo.');
    const revenue = offer.qty * offer.price;
    const basis = Math.round((lot.cost / lot.qty) * offer.qty);
    game.credits += revenue;
    lot.qty -= offer.qty;
    lot.cost -= basis;
    if (lot.qty <= 0) delete game.cargo[offer.good];
    game.stats.trades += 1;
    game.stats.bestTrade = Math.max(game.stats.bestTrade, revenue - basis);
    addLog(game, `Sold ${offer.qty} t ${GOODS_BY_ID[offer.good].name} to the trader ${contact.enemy.name}.`, { value: `+${fmt(revenue)} cr`, tone: 'good' });
  } else if (offer.type === 'tip') {
    if (offer.cost > game.credits) reject(`The tip costs ${fmt(offer.cost)} cr.`);
    game.credits -= offer.cost;
    recordIntel(game, offer.system, 'tip');
    addLog(game, `Bought a price list for ${name(offer.system)}.`, { value: `−${fmt(offer.cost)} cr`, tone: 'neutral' });
  }
  offer.status = 'accepted';
  return { notice: { tone: 'good', text: 'Deal done.' } };
}

/**
 * Finishes a jump whose contact (if any) has been dealt with.
 * @param {Object} game
 * @param {Object} rng
 * @return {{notice?: Object}}
 */
function arriveAction(game, _input, rng) {
  requireStatus(game, 'travel');
  const contact = game.travel.contact;
  if (contact && !contact.resolved) reject('Deal with the contact on your scanner first.');
  return arrive(game, rng);
}

module.exports = { travel, arrive, arriveAction, contactAction, encounterAction, combatAction, traderAction, takeLoot };
