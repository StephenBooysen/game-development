'use strict';

const { DIFFICULTY, SKILLS, HOME_SYSTEM, BANK } = require('../data/rules');
const { SHIPS, EQUIPMENT, STARTER_SHIP } = require('../data/ships');
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ['docked', 'travel', 'encounter', 'combat', 'victory', 'over'];

/**
 * Validates and normalises a saved game state restored from client localStorage.
 * @param {Object} raw
 * @return {Object} a clean, safe game state
 */
function validateSavedGame(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    reject('Invalid save state: expected a game object.');
  }
  const id = String(raw.id || '').trim();
  if (!UUID_PATTERN.test(id)) {
    reject('Invalid save state: missing or invalid game ID.');
  }
  const name = String(raw.name || '').trim();
  if (!name) reject('Invalid save state: missing commander name.');

  if (!DIFFICULTY[raw.difficulty]) reject('Invalid save state: unknown difficulty.');
  if (!ALLOWED_STATUSES.includes(raw.status)) reject('Invalid save state: unknown game status.');
  if (!SYSTEMS_BY_ID[raw.location]) reject('Invalid save state: unknown system location.');

  if (!raw.ship || typeof raw.ship !== 'object' || !SHIPS[raw.ship.type]) {
    reject('Invalid save state: missing or unknown ship hull.');
  }

  if (!raw.skills || typeof raw.skills !== 'object') {
    reject('Invalid save state: missing skills.');
  }

  const game = {
    version: Number(raw.version) || 1,
    id,
    name,
    difficulty: raw.difficulty,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    day: Math.max(1, Number(raw.day) || 1),
    status: raw.status,
    location: raw.location,
    visited: Array.isArray(raw.visited) && raw.visited.length ? raw.visited.filter((s) => SYSTEMS_BY_ID[s]) : [raw.location],
    credits: Math.max(0, Number(raw.credits) || 0),
    loan: raw.loan && typeof raw.loan === 'object' ? {
      principal: Math.max(0, Number(raw.loan.principal) || 0),
      owed: Math.max(0, Number(raw.loan.owed) || 0),
      rate: Number(raw.loan.rate) || DIFFICULTY[raw.difficulty].interest,
      takenDay: Number(raw.loan.takenDay) || 1,
      dueDay: Number(raw.loan.dueDay) || 20
    } : null,
    creditScore: typeof raw.creditScore === 'number' ? raw.creditScore : BANK.startingCreditScore,
    skills: {
      navigation: Math.max(SKILLS.min, Math.min(SKILLS.max, Number(raw.skills.navigation) || 1)),
      battle: Math.max(SKILLS.min, Math.min(SKILLS.max, Number(raw.skills.battle) || 1)),
      trading: Math.max(SKILLS.min, Math.min(SKILLS.max, Number(raw.skills.trading) || 1))
    },
    battleXp: Math.max(0, Number(raw.battleXp) || 0),
    offences: Math.max(0, Number(raw.offences) || 0),
    ship: {
      type: raw.ship.type,
      equipment: Array.isArray(raw.ship.equipment) ? raw.ship.equipment.filter((e) => EQUIPMENT[e]) : [],
      hull: Math.max(0, Number(raw.ship.hull) || SHIPS[raw.ship.type].hull),
      shields: Math.max(0, Number(raw.ship.shields) || 0),
      fuel: Math.max(0, Number(raw.ship.fuel) || SHIPS[raw.ship.type].fuel)
    },
    cargo: raw.cargo && typeof raw.cargo === 'object' ? raw.cargo : {},
    markets: raw.markets && typeof raw.markets === 'object' ? raw.markets : {},
    intel: raw.intel && typeof raw.intel === 'object' ? raw.intel : {},
    events: Array.isArray(raw.events) ? raw.events : [],
    surges: Array.isArray(raw.surges) ? raw.surges : [],
    news: Array.isArray(raw.news) ? raw.news : [],
    log: Array.isArray(raw.log) ? raw.log : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    stats: raw.stats && typeof raw.stats === 'object' ? raw.stats : {
      trades: 0, bestTrade: 0, piratesBeaten: 0, fled: 0, surrendered: 0, paidOff: 0, tradersAttacked: 0, startWorth: 0
    },
    travel: raw.travel || null,
    combat: raw.combat || null,
    over: raw.over || null
  };

  return game;
}

module.exports = { createGame, validateCommander, validateSavedGame, NAME_PATTERN };
