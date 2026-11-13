'use strict';

const { buy, sell } = require('./trade');
const { refuel, repair, buyShip, buyEquipment, sellEquipment } = require('./shipyard');
const { borrow, repay } = require('./bank');
const { travel, arriveAction, contactAction, encounterAction, combatAction, traderAction, takeLoot } = require('./travel');
const { retire } = require('./endings');

/**
 * Every player action, keyed by the name used in the API.
 * Each takes (game, input, rng), mutates the game, and returns `{ notice? }`.
 */
module.exports = {
  buy,
  sell,
  refuel,
  repair,
  buyShip,
  buyEquipment,
  sellEquipment,
  borrow,
  repay,
  travel,
  arrive: arriveAction,
  contact: contactAction,
  encounter: encounterAction,
  combat: combatAction,
  trader: traderAction,
  loot: takeLoot,
  retire
};
