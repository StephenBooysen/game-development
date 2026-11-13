'use strict';

const { SYSTEMS, SYSTEMS_BY_ID } = require('../data/systems');
const { GOODS_BY_ID } = require('../data/goods');
const { MARKET_EVENTS } = require('../data/flavour');
const { tickMarkets, tradability } = require('./market');
const { accrueDay } = require('./bank');
const { netWorth } = require('./commander');

const MAX_LOG = 120;
const MAX_NEWS = 12;
const MAX_HISTORY = 90;

/**
 * Adds an entry to the captain's log (newest first).
 * @param {Object} game
 * @param {string} text
 * @param {{value?: string, tone?: string}} [opts]
 */
function addLog(game, text, { value = '', tone = 'neutral' } = {}) {
  game.log.unshift({ day: game.day, text, value, tone });
  if (game.log.length > MAX_LOG) game.log.length = MAX_LOG;
}

/** Adds a galactic news item (newest first). */
function addNews(game, text) {
  game.news.unshift({ day: game.day, text });
  if (game.news.length > MAX_NEWS) game.news.length = MAX_NEWS;
}

/** Records today's net worth for the commander's chart. */
function recordWorth(game) {
  const last = game.history[game.history.length - 1];
  const worth = netWorth(game);
  if (last && last.day === game.day) last.worth = worth;
  else game.history.push({ day: game.day, worth });
  if (game.history.length > MAX_HISTORY) game.history.splice(0, game.history.length - MAX_HISTORY);
}

/**
 * Starts a random market event somewhere it makes sense.
 * @param {Object} game
 * @param {Object} rng
 * @return {Object|null} the event, or null if none fitted
 */
function spawnMarketEvent(game, rng) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const template = rng.pick(MARKET_EVENTS);
    const system = rng.pick(SYSTEMS);
    const good = GOODS_BY_ID[template.good];
    const { canBuy, canSell } = tradability(system, good);
    if (template.mult > 1 ? !canSell : !canBuy) continue;
    if (game.events.some((e) => e.system === system.id && e.good === good.id && e.endDay >= game.day)) continue;
    const event = {
      system: system.id,
      good: good.id,
      mult: template.mult,
      startDay: game.day,
      endDay: game.day + rng.int(6, 12),
      text: template.text.replace('{sys}', system.name)
    };
    game.events.push(event);
    addNews(game, event.text);
    return event;
  }
  return null;
}

/** Starts a pirate surge around a system, announced in the news. */
function spawnPirateSurge(game, rng) {
  const candidates = SYSTEMS.filter((s) => s.id !== game.location && !game.surges.some((x) => x.system === s.id && x.endDay >= game.day));
  if (!candidates.length) return null;
  const system = rng.pick(candidates);
  const surge = { system: system.id, startDay: game.day, endDay: game.day + rng.int(7, 12) };
  game.surges.push(surge);
  addNews(game, `Pirate activity reported on the ${system.name} lane. Travel armed.`);
  return surge;
}

/** Expires old events and maybe starts new ones. */
function tickEvents(game, rng) {
  const ending = game.events.filter((e) => e.endDay === game.day - 1);
  for (const e of ending) {
    addNews(game, `${GOODS_BY_ID[e.good].name} prices on ${SYSTEMS_BY_ID[e.system].name} are returning to normal.`);
  }
  game.events = game.events.filter((e) => e.endDay >= game.day);
  game.surges = game.surges.filter((s) => s.endDay >= game.day);
  const active = game.events.length;
  if (active < 4 && rng.chance(active === 0 ? 0.5 : 0.18)) spawnMarketEvent(game, rng);
  if (game.surges.length < 2 && rng.chance(0.07)) spawnPirateSurge(game, rng);
}

/**
 * Advances the galaxy by one day: markets, events, interest.
 * @param {Object} game
 * @param {Object} rng
 * @return {{overdue: number, seized: boolean}}
 */
function advanceDay(game, rng) {
  game.day += 1;
  tickMarkets(game, rng);
  tickEvents(game, rng);
  const bank = accrueDay(game);
  if (bank.overdue === 1) {
    addLog(game, 'Loan payment missed. The bank has posted a recovery notice.', { tone: 'bad' });
    addNews(game, 'Interstellar Credit Union posts recovery bounty on an overdue trader.');
  }
  recordWorth(game);
  return bank;
}

module.exports = { addLog, addNews, recordWorth, spawnMarketEvent, spawnPirateSurge, tickEvents, advanceDay };
