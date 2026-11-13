'use strict';

const { ClientError } = require('nooblyjs-core/src/shared/utils/httpErrors');

/**
 * Throws a client-safe 400 for a move the rules don't allow.
 * @param {string} message
 * @throws {ClientError}
 */
function reject(message) {
  throw new ClientError(400, message);
}

/**
 * Throws a 409 when an action doesn't fit the game's current state.
 * @param {Object} game
 * @param {...string} statuses allowed statuses
 * @throws {ClientError}
 */
function requireStatus(game, ...statuses) {
  if (!statuses.includes(game.status)) {
    throw new ClientError(409, `That can't be done right now (${game.status === 'over' ? 'the game is over' : `you are ${describe(game.status)}`}).`);
  }
}

function describe(status) {
  return { docked: 'docked', travel: 'in warp', encounter: 'in an encounter', combat: 'in combat', victory: 'collecting salvage' }[status] || status;
}

module.exports = { ClientError, reject, requireStatus };
