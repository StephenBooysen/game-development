'use strict';

const express = require('express');
const { validate } = require('nooblyjs-core/src/shared/utils/validation');
const { sendSafeError } = require('nooblyjs-core/src/shared/utils/safeError');
const { ClientError } = require('nooblyjs-core/src/shared/utils/httpErrors');
const { DIFFICULTY, SKILLS, HOME_SYSTEM, BANK } = require('../data/rules');
const { SHIPS, EQUIPMENT, STARTER_SHIP } = require('../data/ships');
const { SYSTEMS_BY_ID } = require('../data/systems');

const id = { type: 'string', required: true, maxLength: 40 };
const shortString = { type: 'string', required: true, maxLength: 24 };

/**
 * Player actions exposed over HTTP: [method, path, action name, validation schema, input mapper].
 * The mapper turns the request into the action's input (defaults to the JSON body).
 */
const ACTION_ROUTES = [
  ['post', '/market/buy', 'buy', { body: { good: shortString, qty: { type: 'integer', required: true, min: 1, max: 1000 } } }],
  ['post', '/market/sell', 'sell', { body: { good: shortString, qty: { type: 'integer', required: true, min: 1, max: 1000 } } }],
  ['post', '/shipyard/refuel', 'refuel', { body: { amount: { type: 'integer', min: 1, max: 100 } } }],
  ['post', '/shipyard/repair', 'repair', { body: { amount: { type: 'integer', min: 1, max: 1000 } } }],
  ['post', '/shipyard/ship', 'buyShip', { body: { ship: shortString } }],
  ['post', '/shipyard/equipment', 'buyEquipment', { body: { item: shortString } }],
  ['delete', '/shipyard/equipment/:item', 'sellEquipment', { params: { item: shortString } }, (req) => ({ item: req.params.item })],
  ['post', '/bank/borrow', 'borrow', { body: { amount: { type: 'integer', required: true, min: 100, max: 1000000 }, term: { type: 'integer', required: true, enum: BANK.terms } } }],
  ['post', '/bank/repay', 'repay', { body: {} }, (req) => ({ amount: repayAmount(req.body.amount) })],
  ['post', '/travel', 'travel', { body: { to: shortString } }],
  ['post', '/travel/arrive', 'arrive', {}],
  ['post', '/travel/contact', 'contact', { body: { action: { type: 'string', required: true, enum: ['scan', 'hail', 'evade', 'abort'] } } }],
  ['post', '/encounter', 'encounter', { body: { action: { type: 'string', required: true, enum: ['attack', 'flee', 'pay', 'surrender'] } } }],
  ['post', '/combat', 'combat', { body: { action: { type: 'string', required: true, enum: ['fire', 'evade', 'shield', 'flee'] } } }],
  ['post', '/trader', 'trader', { body: { action: { type: 'string', required: true, enum: ['accept', 'decline', 'attack', 'leave'] }, offer: { type: 'string', maxLength: 12 } } }],
  ['post', '/loot', 'loot', { body: { take: { type: 'array', required: true, maxLength: 10 } } }, (req) => ({ take: req.body.take.filter((t) => typeof t === 'string') })],
  ['post', '/retire', 'retire', {}]
];

function repayAmount(value) {
  if (value === 'all') return 'all';
  if (Number.isInteger(value) && value >= 1 && value <= 10000000) return value;
  throw new ClientError(400, 'Invalid request: body.amount must be a whole number of credits or "all"');
}

/**
 * Static setup data for the new-commander screens.
 * @return {Object}
 */
function setupData() {
  const ship = SHIPS[STARTER_SHIP.type];
  return {
    difficulties: Object.values(DIFFICULTY).map((d) => ({ id: d.id, label: d.label, credits: d.credits, note: d.note })),
    skills: SKILLS,
    home: { id: HOME_SYSTEM, name: SYSTEMS_BY_ID[HOME_SYSTEM].name },
    starterShip: { ...ship, equipment: STARTER_SHIP.equipment.map((e) => ({ id: e, name: EQUIPMENT[e].name, type: EQUIPMENT[e].type })) }
  };
}

/**
 * The game's REST API, mounted at /api.
 * @param {{games: import('../game/GameService').GameService, logger: Object, eventEmitter: Object}} deps
 * @return {express.Router}
 */
function createGameRoutes({ games, logger, eventEmitter }) {
  const router = express.Router();
  const fail = (res, err, operation) => sendSafeError(res, err, { status: 500, logger, eventEmitter, operation });

  router.get('/setup', (req, res) => {
    res.json(setupData());
  });

  router.get('/halloffame', async (req, res) => {
    try {
      res.json({ entries: await games.hallOfFame(10) });
    } catch (err) {
      fail(res, err, 'halloffame');
    }
  });

  router.post('/games', validate({
    body: {
      name: { type: 'string', required: true, maxLength: 40 },
      difficulty: { type: 'string', required: true, enum: Object.keys(DIFFICULTY) },
      skills: { type: 'object', required: true }
    }
  }), async (req, res) => {
    try {
      const { name, difficulty, skills } = req.body;
      const { view, state } = await games.create({ name, difficulty, skills });
      res.status(201).json({ game: view, state });
    } catch (err) {
      fail(res, err, 'create game');
    }
  });

  router.post('/games/restore', validate({
    body: {
      state: { type: 'object', required: true }
    }
  }), async (req, res) => {
    try {
      const { view, state } = await games.restore(req.body.state);
      res.status(200).json({ game: view, state });
    } catch (err) {
      fail(res, err, 'restore game');
    }
  });

  router.get('/games/:id', validate({ params: { id } }), async (req, res) => {
    try {
      const game = await games.load(req.params.id);
      const view = await games.view(req.params.id);
      res.json({ game: view, state: game });
    } catch (err) {
      fail(res, err, 'load game');
    }
  });

  router.get('/games/:id/summary', validate({ params: { id } }), async (req, res) => {
    try {
      const summary = await games.summary(req.params.id);
      if (!summary) throw new ClientError(404, 'Game not found.');
      res.json({ summary });
    } catch (err) {
      fail(res, err, 'game summary');
    }
  });

  for (const [method, path, action, schema, toInput] of ACTION_ROUTES) {
    router[method](`/games/:id${path}`, validate({ ...schema, params: { id, ...(schema.params || {}) } }), async (req, res) => {
      try {
        const input = toInput ? toInput(req) : (req.body || {});
        res.json(await games.act(req.params.id, action, input));
      } catch (err) {
        fail(res, err, action);
      }
    });
  }

  router.use((req, res) => res.status(404).json({ error: 'Not found' }));
  return router;
}

module.exports = { createGameRoutes, ACTION_ROUTES };
