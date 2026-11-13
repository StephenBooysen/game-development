'use strict';

const { DIFFICULTY, BANK } = require('../../data/rules');
const { SHIPS } = require('../../data/ships');
const { SYSTEMS_BY_ID } = require('../../data/systems');
const { endingWorth, finalScore, ENDING_MULT, PIRATE_BONUS } = require('../../engine/commander');
const { addLog } = require('../../engine/world');
const { requireStatus } = require('../errors');

const fmt = (n) => n.toLocaleString('en-US');
const signed = (n) => (n < 0 ? `−${fmt(-n)}` : fmt(n));

/**
 * Ends the game and fixes the final score.
 * @param {Object} game
 * @param {'destroyed'|'seized'|'retired'|'bankrupt'} ending
 * @param {{enemy?: string}} [context]
 */
function endGame(game, ending, context = {}) {
  const system = SYSTEMS_BY_ID[game.location].name;
  const ship = SHIPS[game.ship.type].name;
  const lane = game.travel ? `${SYSTEMS_BY_ID[game.travel.from].name} → ${SYSTEMS_BY_ID[game.travel.to].name}` : system;
  const copy = {
    destroyed: { title: 'SHIP\nDESTROYED', tag: 'Destroyed', tone: 'bad', body: `The ${ship} was lost to ${context.enemy || 'raiders'} on the ${lane} lane. Your escape pod drifted home, but your trading days are over.` },
    seized: { title: 'SHIP\nSEIZED', tag: 'Seized', tone: 'bad', body: `Your loan went ${BANK.graceDays} days overdue. The Interstellar Credit Union impounded your ship and cargo at ${system}.` },
    retired: { title: 'RETIRED\nIN STYLE', tag: 'Retired', tone: 'good', body: `Debt paid and accounts settled. You sold the ${ship} at ${system} and left the lanes on your own terms.` },
    bankrupt: { title: 'OUT OF\nBUSINESS', tag: 'Bankrupt', tone: 'bad', body: `With debts you couldn’t cover, you sold the ${ship} at ${system} and walked away from the lanes.` }
  }[ending];

  const worth = endingWorth(game, ending);
  const owed = game.loan ? game.loan.owed : 0;
  const diff = DIFFICULTY[game.difficulty];
  const beaten = game.stats.piratesBeaten;
  const score = finalScore(game, ending);

  game.status = 'over';
  game.combat = null;
  game.over = {
    ending,
    tag: copy.tag,
    title: copy.title,
    tone: copy.tone,
    body: copy.body,
    day: game.day,
    score,
    rows: [
      { label: 'Final worth', value: `${signed(worth)} cr`, tone: worth >= 0 ? 'strong' : 'bad' },
      { label: 'Outstanding debt', value: ending === 'seized' ? 'Settled by seizure' : `${owed ? '−' : ''}${fmt(owed)} cr`, tone: owed && ending !== 'seized' ? 'bad' : 'good' },
      { label: 'Pirates beaten', value: `${beaten} · +${fmt(beaten * PIRATE_BONUS)}`, tone: 'strong' },
      { label: 'Difficulty', value: `${diff.label} ×${diff.scoreMult.toFixed(2).replace(/0$/, '')}`, tone: 'strong' },
      { label: 'Ending', value: `${copy.tag} ×${ENDING_MULT[ending]}`, tone: 'strong' }
    ],
    recorded: false
  };
  addLog(game, `Game over: ${copy.tag.toLowerCase()}. Final score ${fmt(score)}.`, { tone: copy.tone });
}

/**
 * Sells up and retires. Debt-free commanders retire in style; anyone else goes out of business.
 * @param {Object} game
 * @return {{notice: Object}}
 */
function retire(game) {
  requireStatus(game, 'docked');
  const ending = game.loan && game.loan.owed > 0 ? 'bankrupt' : 'retired';
  endGame(game, ending);
  return { notice: { tone: ending === 'retired' ? 'good' : 'warn', text: ending === 'retired' ? 'You hang up your flight jacket.' : 'You close the books for good.' } };
}

module.exports = { endGame, retire };
