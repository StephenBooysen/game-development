import test from 'node:test';
import assert from 'node:assert/strict';
import { step, doorAt } from '../public/game.js';
import { serializeGame, deserializeGame } from '../public/savegame.js';
import { addScore, loadScores, recordScore, scoreLines, MAX_SCORES } from '../public/scores.js';
import { memoryStorage, readJson, writeJson, remove, KEYS } from '../public/storage.js';
import { testState, place, run } from './helpers.js';

// ---------------------------------------------------------------- storage

test('storage keeps JSON values and shrugs off broken or missing ones', () => {
  const storage = memoryStorage();
  assert.equal(readJson(storage, 'missing', 'fallback'), 'fallback');
  assert.equal(writeJson(storage, 'value', { a: [1, 2] }), true);
  assert.deepEqual(readJson(storage, 'value'), { a: [1, 2] });
  storage.setItem('broken', '{not json');
  assert.equal(readJson(storage, 'broken', 'fallback'), 'fallback');
  remove(storage, 'value');
  assert.equal(readJson(storage, 'value'), null);
  assert.equal(writeJson(null, 'value', 1), false, 'no storage at all');
  const full = { setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(writeJson(full, 'value', 1), false, 'storage full');
});

// ---------------------------------------------------------------- high scores

const entry = (score, time = 100) => ({ score, time, difficulty: 'Normal', maps: 3, escaped: true, date: '2026-11-12' });

test('high scores are sorted best first, and a faster run wins a tie', () => {
  let scores = [];
  for (const run of [entry(500), entry(9000), entry(500, 50)]) scores = addScore(scores, run).scores;
  assert.deepEqual(scores.map((s) => [s.score, s.time]), [[9000, 100], [500, 50], [500, 100]]);
});

test('the table keeps the ten best and tells you your rank', () => {
  let scores = [];
  for (let i = 1; i <= MAX_SCORES; i++) scores = addScore(scores, entry(i * 100)).scores;
  const best = addScore(scores, entry(5000));
  assert.equal(best.rank, 1);
  assert.equal(best.scores.length, MAX_SCORES);
  assert.equal(addScore(scores, entry(1)).rank, 0, 'too low to make the table');
});

test('recorded scores are kept in storage between visits', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadScores(storage), []);
  assert.equal(recordScore(storage, entry(700)), 1);
  assert.equal(recordScore(storage, entry(900)), 1);
  assert.equal(recordScore(storage, entry(800)), 2);
  assert.deepEqual(loadScores(storage).map((s) => s.score), [900, 800, 700]);
  assert.match(scoreLines(loadScores(storage))[0], /^1\. 900 pts \/ 1:40 \/ Normal \/ escaped/);
  storage.setItem(KEYS.scores, '"not a list"');
  assert.deepEqual(loadScores(storage), [], 'a damaged table is ignored');
});

// ---------------------------------------------------------------- save and load

test('a saved game loads back exactly as it was, and carries on running', () => {
  const state = place(testState(0, { keep: [1] }), 3.5, 2.5);
  run(state, step, 0.2, { use: true }); // open the cell door
  state.player.score = 1234;
  const text = serializeGame(state, { totals: { kills: 2 }, entryCarry: null });
  assert.equal(typeof text, 'string');

  const { state: loaded, extra } = deserializeGame(text, { random: () => 0.5 });
  assert.deepEqual(extra, { totals: { kills: 2 }, entryCarry: null });
  assert.equal(loaded.player.score, 1234);
  assert.deepEqual(loaded.player, state.player);
  assert.ok(loaded.doors instanceof Map, 'doors are a Map again');
  assert.equal(doorAt(loaded, 4, 2).phase, doorAt(state, 4, 2).phase);
  assert.ok(loaded.secrets instanceof Map && loaded.secrets.size === 1);
  assert.equal(loaded.enemies.length, 1);
  assert.equal(typeof loaded.random, 'function');

  // Both copies now play on identically.
  run(state, step, 1, { forward: 1 });
  run(loaded, step, 1, { forward: 1 });
  assert.equal(loaded.player.x, state.player.x);
  assert.equal(doorAt(loaded, 4, 2).open, doorAt(state, 4, 2).open);
});

test('a game saved while a secret wall slides finishes the slide after loading', () => {
  const state = place(testState(), 7.5, 15.5, 0);
  run(state, step, 1 / 60, { use: true });
  run(state, step, 0.3);
  const { state: loaded } = deserializeGame(serializeGame(state));
  assert.equal(loaded.movers.length, 1);
  run(loaded, step, 3);
  assert.equal(loaded.walls[15][10], 'stone');
});

test('a damaged or foreign save gives a friendly error', () => {
  assert.throws(() => deserializeGame('{oops'), /damaged/);
  assert.throws(() => deserializeGame(JSON.stringify({ version: 999, state: { player: {} } })), /another version/);
  assert.throws(() => deserializeGame(null), /another version/);
});
