'use strict';

const { SHIPS, EQUIPMENT } = require('../data/ships');

const SLOT_TYPES = ['weapon', 'shield', 'gadget'];

/**
 * Derived stats for the commander's ship: capacities, fittings and
 * effective skills (base skills plus gadget bonuses).
 *
 * @param {Object} game
 * @return {Object}
 */
function shipStats(game) {
  const def = SHIPS[game.ship.type];
  const gear = game.ship.equipment.map((id) => EQUIPMENT[id]).filter(Boolean);
  const sum = (key) => gear.reduce((total, item) => total + (item[key] || 0), 0);
  const weapons = gear.filter((item) => item.type === 'weapon');

  const slotsUsed = { weapon: 0, shield: 0, gadget: 0 };
  for (const item of gear) slotsUsed[item.type] += 1;
  const slotsFree = {};
  for (const type of SLOT_TYPES) slotsFree[type] = def.slots[type] - slotsUsed[type];

  const navigation = game.skills.navigation + sum('navigation');
  const battle = game.skills.battle + sum('battle');

  return {
    def,
    gear,
    weapons,
    hullMax: def.hull,
    shieldMax: sum('shield'),
    shieldRegen: sum('regen'),
    cargoCap: def.cargo + sum('cargo'),
    fuelMax: def.fuel,
    speed: def.speed,
    slotsUsed,
    slotsFree,
    navigation,
    battle,
    trading: game.skills.trading,
    damage: damageRange(weapons, battle)
  };
}

/**
 * Min/max damage of one full volley, including the Battle skill bonus.
 * @param {Array<Object>} weapons
 * @param {number} battle
 * @return {[number, number]}
 */
function damageRange(weapons, battle) {
  if (!weapons.length) return [0, 0];
  const min = weapons.reduce((t, w) => t + w.damage[0], 0) + battle;
  const max = weapons.reduce((t, w) => t + w.damage[1], 0) + battle;
  return [min, max];
}

/** Tonnes of cargo in the hold. */
function cargoUsed(game) {
  return Object.values(game.cargo).reduce((total, lot) => total + lot.qty, 0);
}

/** What a shipyard pays for an item of equipment. */
function equipmentResale(id) {
  return Math.round(EQUIPMENT[id].price / 2);
}

/**
 * Value of the hull alone on trade-in, scaled by its condition.
 * @param {Object} game
 * @return {number}
 */
function hullTradeIn(game) {
  const def = SHIPS[game.ship.type];
  const condition = game.ship.hull / def.hull;
  return Math.round(def.price * 0.85 * (0.5 + 0.5 * condition));
}

/** Trade-in value of the ship with everything fitted to it. */
function tradeInValue(game) {
  return hullTradeIn(game) + game.ship.equipment.reduce((t, id) => t + equipmentResale(id), 0);
}

/** A stable, readable registration code derived from the game id. */
function registration(gameId) {
  let hash = 0;
  for (const ch of String(gameId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 'VM-' + String(hash % 10000).padStart(4, '0');
}

module.exports = { shipStats, damageRange, cargoUsed, equipmentResale, hullTradeIn, tradeInValue, registration, SLOT_TYPES };
