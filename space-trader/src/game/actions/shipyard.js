'use strict';

const { SHIPS, EQUIPMENT } = require('../../data/ships');
const { SYSTEMS_BY_ID } = require('../../data/systems');
const { SHIPYARD } = require('../../data/rules');
const { shipStats, cargoUsed, hullTradeIn, equipmentResale } = require('../../engine/ship');
const { addLog } = require('../../engine/world');
const { reject, requireStatus } = require('../errors');

const fmt = (n) => n.toLocaleString('en-US');

/** Fuel price per parsec at the current system. */
function fuelPrice(game) {
  return SYSTEMS_BY_ID[game.location].fuelPrice;
}

/**
 * Buys fuel: `amount` parsecs, or as much as fits/affords when omitted.
 * @param {Object} game
 * @param {{amount?: number}} input
 * @return {{notice: Object}}
 */
function refuel(game, { amount } = {}) {
  requireStatus(game, 'docked');
  const stats = shipStats(game);
  const missing = stats.fuelMax - game.ship.fuel;
  if (missing <= 0) reject('Your tanks are already full.');
  const price = fuelPrice(game);
  const want = amount === undefined ? missing : Math.min(amount, missing);
  const units = Math.min(want, Math.floor(game.credits / price));
  if (units <= 0) reject(`Fuel costs ${price} cr per parsec; you can't afford any.`);
  game.credits -= units * price;
  game.ship.fuel += units;
  return { notice: { tone: 'info', text: `Refuelled ${units} ps for ${fmt(units * price)} cr.` } };
}

/**
 * Repairs the hull: `amount` points, or as much as needed/affordable when omitted.
 * @param {Object} game
 * @param {{amount?: number}} input
 * @return {{notice: Object}}
 */
function repair(game, { amount } = {}) {
  requireStatus(game, 'docked');
  const stats = shipStats(game);
  const missing = stats.hullMax - game.ship.hull;
  if (missing <= 0) reject('Your hull is in perfect condition.');
  const price = SHIPYARD.repairPerPoint;
  const want = amount === undefined ? missing : Math.min(amount, missing);
  const points = Math.min(want, Math.floor(game.credits / price));
  if (points <= 0) reject(`Repairs cost ${price} cr per point; you can't afford any.`);
  game.credits -= points * price;
  game.ship.hull += points;
  return { notice: { tone: 'info', text: `Repaired ${points} hull points for ${fmt(points * price)} cr.` } };
}

/**
 * Works out a ship purchase: which fittings move across and what the trade-in is worth.
 * @param {Object} game
 * @param {string} shipId
 * @return {{def: Object, kept: Array<string>, sold: Array<string>, tradeIn: number, net: number, blockers: Array<string>}}
 */
function shipDeal(game, shipId) {
  const def = SHIPS[shipId];
  const counts = { weapon: 0, shield: 0, gadget: 0 };
  const kept = [];
  const sold = [];
  for (const id of game.ship.equipment) {
    const type = EQUIPMENT[id].type;
    if (counts[type] < def.slots[type]) {
      counts[type] += 1;
      kept.push(id);
    } else {
      sold.push(id);
    }
  }
  const tradeIn = hullTradeIn(game) + sold.reduce((t, id) => t + equipmentResale(id), 0);
  const net = def.price - tradeIn;
  const cargoAfter = def.cargo + kept.reduce((t, id) => t + (EQUIPMENT[id].cargo || 0), 0);
  const blockers = [];
  const system = SYSTEMS_BY_ID[game.location];
  if (shipId === game.ship.type) blockers.push('Your ship');
  else if (system.tech < def.minTech) blockers.push('Not sold here');
  else if (cargoUsed(game) > cargoAfter) blockers.push(`Sell ${cargoUsed(game) - cargoAfter} t first`);
  else if (net > game.credits) blockers.push(`Need ${fmt(net - game.credits)} cr more`);
  return { def, kept, sold, tradeIn, net, blockers };
}

/**
 * Trades in the current ship for a new hull. Fittings that fit move across; the rest are sold.
 * @param {Object} game
 * @param {{ship: string}} input
 * @return {{notice: Object}}
 */
function buyShip(game, { ship: shipId }) {
  requireStatus(game, 'docked');
  if (!SHIPS[shipId]) reject('Unknown ship.');
  const deal = shipDeal(game, shipId);
  if (deal.blockers.length) reject(deal.blockers[0] === 'Your ship' ? 'You already fly that ship.' : deal.blockers[0] + '.');
  const oldName = SHIPS[game.ship.type].name;
  game.credits -= deal.net;
  game.ship = { type: shipId, equipment: deal.kept, hull: deal.def.hull, shields: 0, fuel: Math.min(game.ship.fuel, deal.def.fuel) };
  game.ship.shields = shipStats(game).shieldMax;
  const value = deal.net >= 0 ? `−${fmt(deal.net)} cr` : `+${fmt(-deal.net)} cr`;
  addLog(game, `Traded in the ${oldName} for a ${deal.def.name}.`, { value, tone: deal.net >= 0 ? 'bad' : 'good' });
  const soldNote = deal.sold.length ? ` Sold ${deal.sold.map((id) => EQUIPMENT[id].name).join(', ')} that didn't fit.` : '';
  return { notice: { tone: 'good', text: `The ${deal.def.name} is yours.${soldNote}` } };
}

/**
 * Fits a piece of equipment into a free slot.
 * @param {Object} game
 * @param {{item: string}} input
 * @return {{notice: Object}}
 */
function buyEquipment(game, { item }) {
  requireStatus(game, 'docked');
  const eq = EQUIPMENT[item];
  if (!eq) reject('Unknown equipment.');
  if (SYSTEMS_BY_ID[game.location].tech < eq.minTech) reject(`${eq.name} isn't sold at this shipyard.`);
  const stats = shipStats(game);
  if (stats.slotsFree[eq.type] <= 0) reject(`No free ${eq.type} slot. Sell something first.`);
  if (eq.price > game.credits) reject(`${eq.name} costs ${fmt(eq.price)} cr.`);
  game.credits -= eq.price;
  game.ship.equipment.push(item);
  if (eq.shield) game.ship.shields += eq.shield;
  addLog(game, `Fitted a ${eq.name} at ${SYSTEMS_BY_ID[game.location].name}.`, { value: `−${fmt(eq.price)} cr`, tone: 'bad' });
  return { notice: { tone: 'good', text: `${eq.name} fitted.` } };
}

/**
 * Sells one fitted item of equipment at half price.
 * @param {Object} game
 * @param {{item: string}} input
 * @return {{notice: Object}}
 */
function sellEquipment(game, { item }) {
  requireStatus(game, 'docked');
  const index = game.ship.equipment.indexOf(item);
  if (index === -1) reject('That item isn’t fitted to your ship.');
  const eq = EQUIPMENT[item];
  if (eq.cargo) {
    const capAfter = shipStats(game).cargoCap - eq.cargo;
    if (cargoUsed(game) > capAfter) reject(`Unload ${cargoUsed(game) - capAfter} t of cargo before removing the pods.`);
  }
  const price = equipmentResale(item);
  game.ship.equipment.splice(index, 1);
  game.credits += price;
  game.ship.shields = Math.min(game.ship.shields, shipStats(game).shieldMax);
  addLog(game, `Sold a ${eq.name}.`, { value: `+${fmt(price)} cr`, tone: 'good' });
  return { notice: { tone: 'info', text: `Sold the ${eq.name} for ${fmt(price)} cr.` } };
}

module.exports = { fuelPrice, refuel, repair, shipDeal, buyShip, buyEquipment, sellEquipment };
