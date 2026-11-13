'use strict';

const { RANKS, DIFFICULTY } = require('../data/rules');
const { cargoValue } = require('./market');
const { tradeInValue } = require('./ship');

/**
 * Credits + cargo + ship - debt.
 * @param {Object} game
 * @return {number}
 */
function netWorth(game) {
  return game.credits + cargoValue(game) + tradeInValue(game) - (game.loan ? game.loan.owed : 0);
}

/**
 * Rank for a net worth, with progress towards the next one.
 * @param {number} worth
 * @return {{name: string, next: (string|null), progress: number}}
 */
function rankFor(worth) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (worth >= RANKS[i].min) index = i;
  const current = RANKS[index];
  const next = RANKS[index + 1] || null;
  if (!next) return { name: current.name, next: null, progress: 100 };
  const floor = Number.isFinite(current.min) ? current.min : 0;
  const progress = Math.max(0, Math.min(100, Math.round(((worth - floor) / (next.min - floor)) * 100)));
  return { name: current.name, next: next.name, progress };
}

/** Police record score: pirates beaten earn credit, offences take it away. */
function policeScore(game) {
  return Math.min(2, Math.floor(game.stats.piratesBeaten / 3)) - game.offences;
}

/**
 * Standing with the police, pirates and the traders' guild.
 * @param {Object} game
 * @return {{police: {label: string, tone: string}, pirates: {label: string, tone: string}, guild: {label: string, tone: string}}}
 */
function reputation(game) {
  const p = policeScore(game);
  const police = p >= 2 ? { label: 'Hero', tone: 'good' }
    : p === 1 ? { label: 'Lawful', tone: 'good' }
      : p === 0 ? { label: 'Clean', tone: 'good' }
        : p === -1 ? { label: 'Suspect', tone: 'warn' }
          : p === -2 ? { label: 'Criminal', tone: 'bad' }
            : { label: 'Wanted', tone: 'bad' };

  const kills = game.stats.piratesBeaten;
  const pirates = kills === 0 ? { label: 'Unknown', tone: 'neutral' }
    : kills < 3 ? { label: 'Noticed', tone: 'neutral' }
      : kills < 6 ? { label: 'Feared', tone: 'warn' }
        : { label: 'Hunted', tone: 'bad' };

  const guild = game.stats.tradersAttacked > 0 ? { label: 'Distrusted', tone: 'bad' }
    : game.stats.trades >= 30 ? { label: 'Respected', tone: 'info' }
      : game.stats.trades >= 10 ? { label: 'Known', tone: 'neutral' }
        : { label: 'Newcomer', tone: 'neutral' };

  return { police, pirates, guild };
}

const ENDING_MULT = { retired: 1, bankrupt: 0.8, destroyed: 0.6, seized: 0.4 };
const PIRATE_BONUS = 300;

/**
 * Worth counted towards the final score for an ending.
 * Destroyed: the ship and cargo are gone, debt remains. Seized: the bank takes
 * ship and cargo against the debt. Retired: everything is sold.
 * @param {Object} game
 * @param {string} ending
 * @return {number}
 */
function endingWorth(game, ending) {
  const owed = game.loan ? game.loan.owed : 0;
  if (ending === 'destroyed') return game.credits - owed;
  if (ending === 'seized') return game.credits;
  return netWorth(game);
}

/**
 * Final score: worth plus a bounty bonus, scaled by difficulty and ending.
 * @param {Object} game
 * @param {string} ending
 * @return {number}
 */
function finalScore(game, ending) {
  const base = Math.max(0, endingWorth(game, ending)) + game.stats.piratesBeaten * PIRATE_BONUS;
  return Math.round(base * DIFFICULTY[game.difficulty].scoreMult * ENDING_MULT[ending]);
}

module.exports = { netWorth, rankFor, policeScore, reputation, endingWorth, finalScore, ENDING_MULT, PIRATE_BONUS };
