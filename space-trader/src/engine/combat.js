'use strict';

const { EQUIPMENT } = require('../data/ships');
const { shipStats } = require('./ship');
const { clamp, makeRng } = require('./random');

const SHIELD_BOOST = 15;

/** Player's chance to hit this enemy with a volley. */
function playerHitChance(stats, enemy) {
  return clamp(65 + stats.battle * 3 - enemy.speed * 2, 30, 95) / 100;
}

/** Enemy's chance to hit the player. */
function enemyHitChance(stats, enemy, evading) {
  return clamp(55 + enemy.battle * 3 - stats.navigation * 2 - (evading ? 20 : 0), 10, 90) / 100;
}

/** Odds of escaping this enemy, as a fraction. */
function escapeChance(stats, enemy) {
  return clamp(45 + stats.navigation * 4 + stats.speed * 3 - enemy.speed * 4, 10, 95) / 100;
}

/**
 * Rolls one volley from a set of weapons.
 * @param {Array<string>} weaponIds
 * @param {number} battle
 * @param {Object} rng
 * @return {{normal: number, piercing: number, total: number}}
 */
function rollVolley(weaponIds, battle, rng) {
  let normal = 0;
  let piercing = 0;
  for (const id of weaponIds) {
    const w = EQUIPMENT[id];
    const dmg = rng.int(w.damage[0], w.damage[1]);
    if (w.piercing) piercing += dmg;
    else normal += dmg;
  }
  if (weaponIds.length) normal += battle;
  return { normal, piercing, total: normal + piercing };
}

/**
 * Applies a volley to a target. Shields soak normal damage first; piercing goes straight to the hull.
 * @param {{shields: number, hull: number}} target mutated
 * @param {{normal: number, piercing: number}} volley
 * @return {{toShields: number, toHull: number}}
 */
function applyVolley(target, volley) {
  const toShields = Math.min(target.shields, volley.normal);
  target.shields -= toShields;
  const toHull = Math.min(target.hull, volley.normal - toShields + volley.piercing);
  target.hull -= toHull;
  return { toShields, toHull };
}

/** Describes a hit for the combat log. */
function describeHit(who, total, result) {
  if (result.toHull === 0) return `${who} for ${total}. Shields absorb it.`;
  if (result.toShields === 0) return `${who} for ${total}, straight into the hull.`;
  return `${who} for ${total}: ${result.toShields} to shields, ${result.toHull} to hull.`;
}

/**
 * Begins a fight with the current contact.
 * @param {Object} game
 * @param {Array<Object>} [openingLog] entries to start the log with
 */
function startCombat(game, openingLog = []) {
  const enemy = game.travel.contact.enemy;
  game.combat = {
    turn: 1,
    startHull: game.ship.hull,
    last: { player: null, enemy: null },
    log: [...openingLog, { turn: 0, text: `Combat begins. ${enemy.name} powers weapons.`, tone: 'info' }]
  };
  game.status = 'combat';
}

/**
 * The enemy's turn: maybe flee, otherwise fire.
 * @return {{fled: boolean, shot: boolean, entry: Object}}
 */
function enemyTurn(game, stats, enemy, evading, rng, turn) {
  if (enemy.canFlee && enemy.hull < enemy.hullMax * 0.3 && rng.chance(0.3)) {
    return { fled: true, shot: false, entry: { turn, text: `${enemy.name} breaks off and runs for it.`, tone: 'info' } };
  }
  if (!rng.chance(enemyHitChance(stats, enemy, evading))) {
    return { fled: false, shot: false, entry: { turn, text: `${enemy.name} fires and misses.`, tone: 'enemy' } };
  }
  const volley = rollVolley(enemy.weapons, enemy.battle, rng);
  if (evading) {
    volley.normal = Math.floor(volley.normal / 2);
    volley.piercing = Math.floor(volley.piercing / 2);
    volley.total = volley.normal + volley.piercing;
  }
  const me = { shields: game.ship.shields, hull: game.ship.hull };
  const result = applyVolley(me, volley);
  game.ship.shields = me.shields;
  game.ship.hull = me.hull;
  return { fled: false, shot: true, entry: { turn, text: describeHit(`${enemy.name} hits you`, volley.total, result), tone: 'enemy' } };
}

/**
 * The enemy gets a free shot (failed flee from an encounter). Mutates the ship.
 * @param {Object} game
 * @param {Object} rng
 * @return {Object} log entry
 */
function freeShot(game, rng) {
  const stats = shipStats(game);
  const enemy = game.travel.contact.enemy;
  return enemyTurn(game, stats, { ...enemy, canFlee: false }, false, rng, 0).entry;
}

/**
 * Plays one combat turn.
 * @param {Object} game
 * @param {'fire'|'evade'|'shield'|'flee'} action
 * @param {Object} rng
 * @return {{outcome: (null|'won'|'lost'|'fled'|'enemyFled')}}
 */
function playRound(game, action, rng) {
  const stats = shipStats(game);
  const enemy = game.travel.contact.enemy;
  const combat = game.combat;
  const turn = combat.turn;
  const entries = [];
  combat.last = { player: null, enemy: null };
  let evading = false;

  if (action === 'fire') {
    if (!stats.weapons.length) {
      entries.push({ turn, text: 'You have no weapons fitted.', tone: 'info' });
    } else if (rng.chance(playerHitChance(stats, enemy))) {
      const volley = rollVolley(game.ship.equipment.filter((id) => EQUIPMENT[id].type === 'weapon'), stats.battle, rng);
      const result = applyVolley(enemy, volley);
      entries.push({ turn, text: describeHit('Your volley hits', volley.total, result), tone: 'me' });
      combat.last.player = 'hit';
    } else {
      entries.push({ turn, text: 'Your shots go wide.', tone: 'me' });
      combat.last.player = 'miss';
    }
  } else if (action === 'evade') {
    evading = true;
    entries.push({ turn, text: 'Evasive manoeuvres. Harder to hit this turn.', tone: 'shield' });
  } else if (action === 'shield') {
    game.ship.shields = Math.min(stats.shieldMax, game.ship.shields + SHIELD_BOOST);
    entries.push({ turn, text: `Power diverted. Shields at ${game.ship.shields}.`, tone: 'shield' });
  } else if (action === 'flee') {
    if (rng.chance(escapeChance(stats, enemy))) {
      entries.push({ turn, text: 'You punch the warp drive and break away.', tone: 'good' });
      combat.log = [...entries.reverse(), ...combat.log];
      return { outcome: 'fled' };
    }
    entries.push({ turn, text: 'Escape attempt fails. They are still on you.', tone: 'info' });
  }

  let outcome = null;
  if (enemy.hull <= 0) {
    entries.push({ turn, text: `${enemy.name} breaks apart. Target destroyed.`, tone: 'good' });
    outcome = 'won';
  } else {
    const reply = enemyTurn(game, stats, enemy, evading, rng, turn);
    entries.push(reply.entry);
    combat.last.enemy = reply.shot ? 'hit' : null;
    if (reply.fled) outcome = 'enemyFled';
    else if (game.ship.hull <= 0) {
      entries.push({ turn, text: 'Hull breach. Your ship is lost.', tone: 'enemy' });
      outcome = 'lost';
    }
  }

  if (!outcome && stats.shieldRegen && game.ship.shields < stats.shieldMax) {
    game.ship.shields = Math.min(stats.shieldMax, game.ship.shields + stats.shieldRegen);
  }

  combat.turn += 1;
  combat.log = [...entries.reverse(), ...combat.log].slice(0, 40);
  return { outcome };
}

/**
 * Monte Carlo estimate of winning a straight fight (always firing) from the current state.
 * @param {Object} game
 * @param {Object} enemy
 * @param {number} [runs=300]
 * @param {function(): number} [source] random source for the simulation
 * @return {number} fraction 0..1
 */
function winChance(game, enemy, runs = 300, source = Math.random) {
  const stats = shipStats(game);
  if (!stats.weapons.length) return 0;
  const rng = makeRng(source);
  const weaponIds = game.ship.equipment.filter((id) => EQUIPMENT[id].type === 'weapon');
  const pHit = playerHitChance(stats, enemy);
  const eHit = enemyHitChance(stats, enemy, false);
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const me = { shields: game.ship.shields, hull: game.ship.hull };
    const them = { shields: enemy.shields, hull: enemy.hull };
    for (let turn = 0; turn < 60; turn++) {
      if (rng.chance(pHit)) applyVolley(them, rollVolley(weaponIds, stats.battle, rng));
      if (them.hull <= 0) { wins++; break; }
      if (rng.chance(eHit)) applyVolley(me, rollVolley(enemy.weapons, enemy.battle, rng));
      if (me.hull <= 0) break;
      if (stats.shieldRegen) me.shields = Math.min(stats.shieldMax, me.shields + stats.shieldRegen);
    }
  }
  return wins / runs;
}

module.exports = {
  SHIELD_BOOST, playerHitChance, enemyHitChance, escapeChance, rollVolley, applyVolley,
  startCombat, freeShot, playRound, winChance
};
