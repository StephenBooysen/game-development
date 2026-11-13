'use strict';

const { GOODS_BY_ID } = require('../../data/goods');
const { SYSTEMS_BY_ID } = require('../../data/systems');
const { quote, applyImpact, recordIntel } = require('../../engine/market');
const { shipStats, cargoUsed } = require('../../engine/ship');
const { addLog } = require('../../engine/world');
const { reject, requireStatus } = require('../errors');

const fmt = (n) => n.toLocaleString('en-US');

function requireGood(id) {
  const good = GOODS_BY_ID[id];
  if (!good) reject('Unknown trade good.');
  return good;
}

/**
 * Largest quantity of a good the commander can buy right now.
 * @param {Object} game
 * @param {string} goodId
 * @return {number}
 */
function maxBuyable(game, goodId) {
  const q = quote(game, game.location, goodId);
  if (!q.canBuy || !q.buy) return 0;
  const free = shipStats(game).cargoCap - cargoUsed(game);
  return Math.max(0, Math.min(q.stock, free, Math.floor(game.credits / q.buy)));
}

/**
 * Buys `qty` tonnes at the local market.
 * @param {Object} game
 * @param {{good: string, qty: number}} input
 * @return {{notice: Object}}
 */
function buy(game, { good: goodId, qty }) {
  requireStatus(game, 'docked');
  const good = requireGood(goodId);
  const q = quote(game, game.location, goodId);
  if (!q.canBuy) reject(`${good.name} isn't sold on ${SYSTEMS_BY_ID[game.location].name}.`);
  if (qty > q.stock) reject(`Only ${q.stock} t of ${good.name} in stock.`);
  const free = shipStats(game).cargoCap - cargoUsed(game);
  if (qty > free) reject(`Not enough hold space: ${free} t free.`);
  const cost = q.buy * qty;
  if (cost > game.credits) reject(`That costs ${fmt(cost)} cr; you have ${fmt(game.credits)} cr.`);

  game.credits -= cost;
  const lot = game.cargo[goodId] || { qty: 0, cost: 0 };
  lot.qty += qty;
  lot.cost += cost;
  game.cargo[goodId] = lot;
  game.markets[game.location][goodId].stock -= qty;
  applyImpact(game, game.location, goodId, qty);
  recordIntel(game, game.location);
  addLog(game, `Bought ${qty} t ${good.name} at ${SYSTEMS_BY_ID[game.location].name}.`, { value: `−${fmt(cost)} cr`, tone: 'bad' });
  return { notice: { tone: 'info', text: `Bought ${qty} t ${good.name} for ${fmt(cost)} cr.` } };
}

/**
 * Sells `qty` tonnes at the local market.
 * @param {Object} game
 * @param {{good: string, qty: number}} input
 * @return {{notice: Object}}
 */
function sell(game, { good: goodId, qty }) {
  requireStatus(game, 'docked');
  const good = requireGood(goodId);
  const q = quote(game, game.location, goodId);
  if (!q.canSell) reject(good.illegal ? 'Contraband can only be sold on a black market.' : `Nobody on ${SYSTEMS_BY_ID[game.location].name} buys ${good.name}.`);
  const lot = game.cargo[goodId];
  if (!lot || lot.qty < qty) reject(`You only have ${lot ? lot.qty : 0} t of ${good.name}.`);

  const revenue = q.sell * qty;
  const costBasis = Math.round((lot.cost / lot.qty) * qty);
  const profit = revenue - costBasis;
  game.credits += revenue;
  lot.qty -= qty;
  lot.cost -= costBasis;
  if (lot.qty <= 0) delete game.cargo[goodId];
  game.markets[game.location][goodId].stock += qty;
  applyImpact(game, game.location, goodId, -qty);
  recordIntel(game, game.location);
  game.stats.trades += 1;
  game.stats.bestTrade = Math.max(game.stats.bestTrade, profit);
  addLog(game, `Sold ${qty} t ${good.name} at ${SYSTEMS_BY_ID[game.location].name}.`, { value: `+${fmt(revenue)} cr`, tone: 'good' });
  const p = profit >= 0 ? `+${fmt(profit)}` : `−${fmt(-profit)}`;
  return { notice: { tone: profit >= 0 ? 'good' : 'warn', text: `Sold ${qty} t ${good.name} for ${fmt(revenue)} cr (${p} cr profit).` } };
}

module.exports = { buy, sell, maxBuyable };
