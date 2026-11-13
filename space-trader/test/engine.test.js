'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeRng, seeded } = require('../src/engine/random');
const { createGame } = require('../src/game/newGame');
const actions = require('../src/game/actions');
const { buildView } = require('../src/game/view');
const { quote } = require('../src/engine/market');
const { distance } = require('../src/engine/galaxy');
const { applyVolley, winChance } = require('../src/engine/combat');
const { finalScore } = require('../src/engine/commander');

const rng = () => makeRng(seeded(42));
const always = makeRng(() => 0);
const never = makeRng(() => 0.999);

function newGame(overrides = {}) {
  const game = createGame({ name: 'Tester', difficulty: 'normal', skills: { navigation: 6, battle: 6, trading: 6 }, ...overrides }, rng());
  game.id = '00000000-0000-4000-8000-000000000000';
  return game;
}

test('new games start at Solace with difficulty credits and the starter ship', () => {
  const game = newGame();
  assert.equal(game.location, 'solace');
  assert.equal(game.credits, 1000);
  assert.equal(game.ship.type, 'kestrel');
  assert.deepEqual(game.ship.equipment, ['pulse', 'deflector1']);
  assert.equal(game.ship.shields, 40);
  assert.equal(newGame({ difficulty: 'easy' }).credits, 2000);
});

test('commander validation rejects bad names and overspent skills', () => {
  assert.throws(() => newGame({ name: '' }), /Commander names/);
  assert.throws(() => newGame({ name: '<script>' }), /Commander names/);
  assert.throws(() => newGame({ skills: { navigation: 10, battle: 10, trading: 1 } }), /18 skill points/);
  assert.throws(() => newGame({ skills: { navigation: 0, battle: 6, trading: 6 } }), /between 1 and 10/);
});

test('buying and selling moves credits, stock and cargo', () => {
  const game = newGame();
  const before = quote(game, 'solace', 'food');
  actions.buy(game, { good: 'food', qty: 5 });
  assert.equal(game.credits, 1000 - before.buy * 5);
  assert.equal(game.cargo.food.qty, 5);
  assert.equal(game.markets.solace.food.stock, before.stock - 5);

  const sellPrice = quote(game, 'solace', 'food').sell;
  const credits = game.credits;
  actions.sell(game, { good: 'food', qty: 2 });
  assert.equal(game.credits, credits + sellPrice * 2);
  assert.equal(game.cargo.food.qty, 3);
  assert.ok(sellPrice < before.buy, 'selling straight back is never profitable');
});

test('trades respect the hold, credits and what the market deals in', () => {
  const game = newGame();
  assert.throws(() => actions.buy(game, { good: 'water', qty: 16 }), /hold space|in stock/);
  game.credits = 10;
  assert.throws(() => actions.buy(game, { good: 'food', qty: 1 }), /That costs/);
  game.credits = 5000;
  assert.throws(() => actions.buy(game, { good: 'robotics', qty: 1 }), /isn't sold/);
  game.cargo.contraband = { qty: 1, cost: 0 };
  assert.throws(() => actions.sell(game, { good: 'contraband', qty: 1 }), /black market/);
});

test('better Trading skill means cheaper prices', () => {
  const low = newGame({ skills: { navigation: 8, battle: 8, trading: 2 } });
  const high = newGame({ skills: { navigation: 1, battle: 7, trading: 10 } });
  high.markets = low.markets;
  assert.ok(quote(high, 'solace', 'machinery').buy < quote(low, 'solace', 'machinery').buy);
});

test('a jump spends fuel, takes days, and docks at the destination', () => {
  const game = newGame();
  const dist = distance('solace', 'kordo');
  actions.travel(game, { to: 'kordo' }, never);
  assert.equal(game.status, 'travel');
  assert.equal(game.ship.fuel, 12 - dist);
  assert.equal(game.travel.contact, null);
  actions.arrive(game, {}, never);
  assert.equal(game.status, 'docked');
  assert.equal(game.location, 'kordo');
  assert.equal(game.day, 1 + Math.ceil(dist / 3));
  assert.ok(game.intel.kordo, 'docking records price intel');
  assert.ok(game.visited.includes('kordo'));
});

test('systems beyond fuel range cannot be reached', () => {
  const game = newGame();
  assert.throws(() => actions.travel(game, { to: 'ostara' }, never), /parsecs away/);
  game.ship.fuel = 2;
  assert.throws(() => actions.travel(game, { to: 'kordo' }, never), /fuel for 2/);
});

test('an unscanned contact stays hidden from the client', () => {
  const game = newGame();
  actions.travel(game, { to: 'thrane' }, always);
  assert.equal(game.travel.contact.kind, 'pirate');
  const view = buildView(game);
  assert.deepEqual(Object.keys(view.travel.contact).sort(), ['distanceKm', 'outcome', 'resolved', 'revealed']);
  assert.ok(!JSON.stringify(view).includes('"pirate"'));

  actions.contact(game, { action: 'scan' }, rng());
  assert.equal(game.status, 'encounter');
  assert.equal(buildView(game).encounter.kind, 'pirate');
});

test('fighting a pirate ends in salvage or game over', () => {
  const game = newGame();
  game.ship.equipment.push('pulse');
  actions.travel(game, { to: 'kordo' }, always);
  actions.contact(game, { action: 'scan' }, rng());
  actions.encounter(game, { action: 'attack' }, rng());
  assert.equal(game.status, 'combat');
  const r = rng();
  for (let i = 0; i < 80 && game.status === 'combat'; i++) actions.combat(game, { action: 'fire' }, r);
  assert.ok(['victory', 'over', 'travel'].includes(game.status));
  if (game.status === 'victory') {
    assert.ok(game.travel.contact.loot.length > 0);
    actions.loot(game, { take: game.travel.contact.loot.map((l) => l.id).filter((id) => id !== 'g0' && id !== 'g1') }, r);
    assert.equal(game.status, 'docked');
    assert.equal(game.location, 'kordo');
  }
});

test('actions are refused in the wrong state', () => {
  const game = newGame();
  assert.throws(() => actions.combat(game, { action: 'fire' }, rng()), (err) => err.statusCode === 409);
  actions.travel(game, { to: 'kordo' }, never);
  assert.throws(() => actions.buy(game, { good: 'food', qty: 1 }), (err) => err.statusCode === 409);
});

test('shields soak normal damage first; piercing damage goes to the hull', () => {
  const target = { shields: 10, hull: 50 };
  assert.deepEqual(applyVolley(target, { normal: 15, piercing: 0 }), { toShields: 10, toHull: 5 });
  assert.deepEqual(target, { shields: 0, hull: 45 });
  const shielded = { shields: 40, hull: 50 };
  applyVolley(shielded, { normal: 0, piercing: 12 });
  assert.deepEqual(shielded, { shields: 40, hull: 38 });
});

test('more guns win more fights', () => {
  const game = newGame();
  const enemy = { hull: 120, shields: 30, weapons: ['pulse', 'pulse'], speed: 6, battle: 3 };
  const one = winChance(game, enemy, 400, seeded(1));
  game.ship.equipment.push('beam');
  const two = winChance(game, enemy, 400, seeded(1));
  assert.ok(two > one, `expected ${two} > ${one}`);
});

test('loans accrue simple daily interest and can be repaid', () => {
  const game = newGame();
  actions.borrow(game, { amount: 2500, term: 10 }, rng());
  assert.equal(game.credits, 3500);
  assert.equal(game.loan.owed, 2500);
  actions.travel(game, { to: 'kordo' }, never);
  actions.arrive(game, {}, never);
  const days = game.day - 1;
  assert.equal(game.loan.owed, 2500 + days * Math.round(2500 * game.loan.rate));
  actions.repay(game, { amount: 'all' }, rng());
  assert.equal(game.loan, null);
  assert.ok(game.creditScore > 70, 'repaying on time improves the rating');
});

test('a loan ten days overdue gets the ship seized', () => {
  const game = newGame();
  actions.borrow(game, { amount: 1000, term: 10 }, rng());
  game.loan.dueDay = 0;
  game.day = 9;
  actions.travel(game, { to: 'kordo' }, never);
  game.travel.contact = null;
  actions.arrive(game, {}, never);
  assert.equal(game.status, 'over');
  assert.equal(game.over.ending, 'seized');
});

test('retiring debt-free scores better than being destroyed', () => {
  const game = newGame();
  assert.ok(finalScore(game, 'retired') > finalScore(game, 'destroyed'));
  actions.retire(game, {}, rng());
  assert.equal(game.status, 'over');
  assert.equal(game.over.ending, 'retired');
});

test('the map prices every good for a run, from intel or typical prices', () => {
  const game = newGame();
  const kordo = () => buildView(game).galaxy.systems.find((s) => s.id === 'kordo').prices;
  const typical = kordo();
  assert.equal(typical.source, 'typical');
  assert.equal(typical.rows.length, 10);
  // Unvisited markets show their usual prices, not today's live ones.
  game.markets.kordo.food.mid = 9999;
  assert.notEqual(kordo().rows.find((r) => r.id === 'food').sellThere, quote(game, 'kordo', 'food').sell);

  for (const row of typical.rows) {
    if (row.buyHere && row.sellThere) assert.equal(row.margin, row.sellThere - row.buyHere);
    else assert.equal(row.margin, null);
  }
  if (typical.best) assert.equal(typical.best.profit, typical.best.qty * typical.best.margin);

  actions.travel(game, { to: 'kordo' }, never);
  actions.arrive(game, {}, never);
  game.ship.fuel = 12;
  actions.travel(game, { to: 'solace' }, never);
  actions.arrive(game, {}, never);
  const seen = kordo();
  assert.equal(seen.source, 'seen');
  assert.equal(seen.rows.find((r) => r.id === 'food').sellThere, game.intel.kordo.prices.food.sell);
});
