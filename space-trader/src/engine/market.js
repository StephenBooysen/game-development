'use strict';

const { GOODS, GOODS_BY_ID } = require('../data/goods');
const { SYSTEMS, SYSTEMS_BY_ID } = require('../data/systems');
const { DIFFICULTY } = require('../data/rules');
const { shipStats } = require('./ship');
const { clamp } = require('./random');

/** How far one tonne bought (or sold) nudges the local price up (or down). */
const PRICE_IMPACT = 0.004;

/**
 * Can the player buy this good here (the system sells it) and sell it here (the system buys it)?
 * @param {Object} system
 * @param {Object} good
 * @return {{canBuy: boolean, canSell: boolean}}
 */
function tradability(system, good) {
  if (good.illegal) {
    return { canBuy: Boolean(system.blackMarket && system.cheap.includes(good.id)), canSell: Boolean(system.blackMarket) };
  }
  return { canBuy: system.tech >= good.produceTech, canSell: system.tech >= good.useTech };
}

/** Multiplier from world events currently affecting this good here. */
function eventMultiplier(game, systemId, goodId) {
  return (game.events || [])
    .filter((e) => e.system === systemId && e.good === goodId && e.endDay >= game.day)
    .reduce((m, e) => m * e.mult, 1);
}

/**
 * A system's usual price for a good, from its economy and tech level alone
 * (no world events, no daily drift).
 * @param {Object} system
 * @param {Object} good
 * @return {number}
 */
function typicalPrice(system, good) {
  let price = good.base;
  if (system.cheap.includes(good.id)) price *= 0.62;
  else if (system.dear.includes(good.id)) price *= 1.45;
  const { canBuy } = tradability(system, good);
  if (good.illegal) {
    // Black-market pricing is all supply and demand.
  } else if (canBuy) {
    price *= Math.max(0.85, 1 - 0.03 * (system.tech - good.produceTech));
  } else {
    price *= 1.12;
  }
  return price;
}

/**
 * The price this system's market drifts towards: its typical price, moved by current events.
 * @param {Object} game
 * @param {Object} system
 * @param {Object} good
 * @return {number}
 */
function targetPrice(game, system, good) {
  return typicalPrice(system, good) * eventMultiplier(game, system.id, good.id);
}

/** Typical stock level for a good at a system. */
function baselineStock(system, good) {
  const { canBuy } = tradability(system, good);
  if (!canBuy) return 0;
  let stock = good.stock;
  if (system.cheap.includes(good.id)) stock *= 1.6;
  else if (system.dear.includes(good.id)) stock *= 0.5;
  return Math.max(2, Math.round(stock));
}

/**
 * Builds every system's market for a new game.
 * @param {Object} game
 * @param {Object} rng
 * @return {Object<string, Object<string, {mid: number, stock: number}>>}
 */
function initMarkets(game, rng) {
  const markets = {};
  for (const system of SYSTEMS) {
    markets[system.id] = {};
    for (const good of GOODS) {
      const mid = targetPrice(game, system, good) * (1 + rng.float(-good.variance, good.variance));
      markets[system.id][good.id] = {
        mid: Math.round(mid),
        stock: Math.round(baselineStock(system, good) * rng.float(0.7, 1.2))
      };
    }
  }
  return markets;
}

/**
 * One day of price drift and restocking across the galaxy.
 * @param {Object} game
 * @param {Object} rng
 */
function tickMarkets(game, rng) {
  const volatility = DIFFICULTY[game.difficulty].volatility;
  for (const system of SYSTEMS) {
    for (const good of GOODS) {
      const entry = game.markets[system.id][good.id];
      const target = targetPrice(game, system, good);
      let mid = entry.mid + (target - entry.mid) * 0.25;
      mid *= 1 + rng.float(-good.variance, good.variance) * 0.6 * volatility;
      entry.mid = Math.round(clamp(mid, good.base * 0.25, good.base * 4));
      const base = baselineStock(system, good);
      entry.stock = Math.max(0, Math.round(entry.stock + (base - entry.stock) * 0.25 + (base ? rng.int(-1, 1) : 0)));
    }
  }
}

/** Trading skill discount, as a fraction (0 to 0.08). */
function tradingDiscount(game) {
  return Math.min(0.08, Math.max(0, shipStats(game).trading - 2) * 0.01);
}

/** Buy and sell prices around a market's mid price, after the Trading discount. */
function priced(game, mid, canBuy, canSell) {
  const discount = tradingDiscount(game);
  return {
    buy: canBuy ? Math.max(1, Math.round(mid * (1 - discount))) : null,
    sell: canSell ? Math.max(1, Math.round(mid * (0.88 + discount / 3))) : null
  };
}

/**
 * What the player pays to buy and receives to sell one tonne here.
 * @param {Object} game
 * @param {string} systemId
 * @param {string} goodId
 * @return {{buy: (number|null), sell: (number|null), stock: number, canBuy: boolean, canSell: boolean}}
 */
function quote(game, systemId, goodId) {
  const system = SYSTEMS_BY_ID[systemId];
  const good = GOODS_BY_ID[goodId];
  const { canBuy, canSell } = tradability(system, good);
  const entry = game.markets[systemId][goodId];
  return { ...priced(game, entry.mid, canBuy, canSell), stock: canBuy ? entry.stock : 0, canBuy, canSell };
}

/**
 * The buy and sell prices a system usually has for a good. Used where the
 * player has no price intel, so it reveals nothing about today's market.
 * @param {Object} game
 * @param {string} systemId
 * @param {string} goodId
 * @return {{buy: (number|null), sell: (number|null)}}
 */
function typicalQuote(game, systemId, goodId) {
  const system = SYSTEMS_BY_ID[systemId];
  const good = GOODS_BY_ID[goodId];
  const { canBuy, canSell } = tradability(system, good);
  return priced(game, typicalPrice(system, good), canBuy, canSell);
}

/** Moves the local price after a trade of `qty` tonnes (positive = bought). */
function applyImpact(game, systemId, goodId, qty) {
  const entry = game.markets[systemId][goodId];
  const good = GOODS_BY_ID[goodId];
  entry.mid = Math.round(clamp(entry.mid * Math.pow(1 + PRICE_IMPACT * Math.sign(qty), Math.abs(qty)), good.base * 0.25, good.base * 4));
}

/**
 * Snapshots the prices at a system into the player's price intel.
 * @param {Object} game
 * @param {string} systemId
 * @param {string} [source='visit'] 'visit' or 'tip'
 */
function recordIntel(game, systemId, source = 'visit') {
  const prices = {};
  for (const good of GOODS) {
    const q = quote(game, systemId, good.id);
    prices[good.id] = { buy: q.buy, sell: q.sell };
  }
  game.intel[systemId] = { day: game.day, source, prices };
}

/**
 * Value of the hold at galactic average prices (used for net worth and threats).
 * @param {Object} game
 * @return {number}
 */
function cargoValue(game) {
  return Object.entries(game.cargo).reduce((t, [id, lot]) => t + lot.qty * Math.round(GOODS_BY_ID[id].base * 0.85), 0);
}

module.exports = {
  PRICE_IMPACT, tradability, typicalPrice, targetPrice, baselineStock, initMarkets, tickMarkets,
  tradingDiscount, quote, typicalQuote, applyImpact, recordIntel, cargoValue, eventMultiplier
};
