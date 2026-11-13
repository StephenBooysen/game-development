'use strict';

const { SYSTEMS_BY_ID, UNITS_PER_PARSEC } = require('../data/systems');

/**
 * Parsecs between two systems (at least 1).
 * @param {string} fromId
 * @param {string} toId
 * @return {number}
 */
function distance(fromId, toId) {
  if (fromId === toId) return 0;
  const a = SYSTEMS_BY_ID[fromId];
  const b = SYSTEMS_BY_ID[toId];
  return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / UNITS_PER_PARSEC));
}

/** Days a jump takes. */
function travelDays(dist) {
  return dist === 0 ? 0 : Math.max(1, Math.ceil(dist / 3));
}

/** Danger of the lane between two systems: the worse of its two ends, raised by pirate rumours. */
function laneDanger(game, fromId, toId) {
  const base = Math.max(SYSTEMS_BY_ID[fromId].danger, SYSTEMS_BY_ID[toId].danger);
  return Math.min(2, base + (pirateSurge(game, toId) ? 1 : 0));
}

/** Is there an active pirate surge at this system? */
function pirateSurge(game, systemId) {
  return (game.surges || []).some((s) => s.system === systemId && s.endDay >= game.day);
}

module.exports = { distance, travelDays, laneDanger, pirateSurge };
