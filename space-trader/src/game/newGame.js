'use strict';

const { DIFFICULTY, SKILLS, HOME_SYSTEM, BANK } = require('../data/rules');
const { SHIPS, STARTER_SHIP } = require('../data/ships');
const { SYSTEMS_BY_ID } = require('../data/systems');
const { initMarkets, recordIntel } = require('../engine/market');
const { spawnMarketEvent, spawnPirateSurge, addLog, addNews, recordWorth } = require('../engine/world');
const { netWorth } = require('../engine/commander');
const { shipStats } = require('../engine/ship');
const { reject } = require('./errors');

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'\-]{0,15}$/u;

/**
 * Checks and normalises the new-commander form.
 * @param {{name: string, difficulty: string, skills: Object}} input
 * @return {{name: string, difficulty: string, skills: {navigation: number, battle: number, trading: number}}}
 * @throws {ClientError} on invalid input
 */
function validateCommander(input) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_PATTERN.test(name)) reject('Commander names are 1–16 letters, numbers, spaces, dots, dashes or apostrophes.');
  if (!DIFFICULTY[input.difficulty]) reject('Choose Easy, Normal or Hard.');
  const skills = {};
  let total = 0;
  for (const def of SKILLS.defs) {
    const v = input.skills ? input.skills[def.id] : undefined;
    if (!Number.isInteger(v) || v < SKILLS.min || v > SKILLS.max) reject(`${def.name} must be between ${SKILLS.min} and ${SKILLS.max}.`);
    skills[def.id] = v;
    total += v;
  }
  if (total > SKILLS.pool) reject(`You only have ${SKILLS.pool} skill points to spend.`);
  return { name, difficulty: input.difficulty, skills };
}

/**
 * Builds a brand-new game state at the home system.
 * @param {{name: string, difficulty: string, skills: Object}} input
 * @param {Object} rng
 * @return {Object} game (without an id yet)
 */
function createGame(input, rng) {
  const { name, difficulty, skills } = validateCommander(input);
  const now = new Date().toISOString();
  const game = {
    version: 1,
    id: null,
    name,
    difficulty,
    createdAt: now,
    updatedAt: now,
    day: 1,
    status: 'docked',
    location: HOME_SYSTEM,
    visited: [HOME_SYSTEM],
    credits: DIFFICULTY[difficulty].credits,
    loan: null,
    creditScore: BANK.startingCreditScore,
    skills,
    battleXp: 0,
    offences: 0,
    ship: { type: STARTER_SHIP.type, equipment: [...STARTER_SHIP.equipment], hull: SHIPS[STARTER_SHIP.type].hull, shields: 0, fuel: SHIPS[STARTER_SHIP.type].fuel },
    cargo: {},
    markets: {},
    intel: {},
    events: [],
    surges: [],
    news: [],
    log: [],
    history: [],
    stats: { trades: 0, bestTrade: 0, piratesBeaten: 0, fled: 0, surrendered: 0, paidOff: 0, tradersAttacked: 0, startWorth: 0 },
    travel: null,
    combat: null,
    over: null
  };
  game.ship.shields = shipStats(game).shieldMax;
  game.markets = initMarkets(game, rng);

  addNews(game, 'Welcome to the lanes, Commander. Trade safely.');
  spawnMarketEvent(game, rng);
  spawnMarketEvent(game, rng);
  if (rng.chance(0.5)) spawnPirateSurge(game, rng);

  recordIntel(game, HOME_SYSTEM);
  addLog(game, `Commander registered at ${SYSTEMS_BY_ID[HOME_SYSTEM].name}. ${SHIPS[STARTER_SHIP.type].name} assigned.`);
  game.stats.startWorth = netWorth(game);
  recordWorth(game);
  return game;
}

module.exports = { createGame, validateCommander, NAME_PATTERN };
