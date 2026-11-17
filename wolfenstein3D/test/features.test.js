import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, step, carryOver, retryCarry, isSolid, distanceField, ENEMY_TYPES, DIFFICULTIES, MAX_HEALTH, START_LIVES,
} from '../public/game.js';
import { castRay, hitBox } from '../public/raycast.js';
import { testState, place, run } from './helpers.js';

const types = (events) => events.map((event) => event.type);
const near = (actual, expected, within = 1e-6) => assert.ok(Math.abs(actual - expected) < within, `${actual} should be ${expected}`);

// Map 1's secret: a stone wall at 8,15 in the bottom-left room. Behind it, a closet
// at 9..10, 15..16 holds treasure (9,16) and an extra life (10,16).
const SECRET = { col: 8, row: 15 };

// ---------------------------------------------------------------- secret push-walls

test('a secret wall looks like a normal wall until it is pushed', () => {
  const state = place(testState(), 7.5, 15.5, 0);
  assert.equal(state.walls[SECRET.row][SECRET.col], 'stone');
  assert.equal(castRay(state, 7.5, 15.5, 0).wall, 'stone');
  assert.equal(state.stats.secretsTotal, 1);
  assert.equal(state.stats.secrets, 0);
});

test('pushing a secret wall slides it two tiles away and opens a hidden room', () => {
  const state = place(testState(), 7.5, 15.5, 0); // facing east, right at the wall
  state.items = state.items.filter((item) => item.kind !== 'ammo'); // so its pickup message does not get in the way
  const events = run(state, step, 1 / 60, { use: true });
  assert.ok(types(events).includes('secret'));
  assert.equal(state.stats.secrets, 1);
  assert.match(state.message.text, /secret/);
  assert.equal(state.movers.length, 1);
  assert.equal(state.walls[SECRET.row][SECRET.col], null, 'it left the grid and is now sliding');

  run(state, step, 0.5);
  // Half way into its first step: the ray hits its face 0.5 + ~0.6 tiles away.
  const mid = castRay(state, 7.5, 15.5, 0);
  assert.equal(mid.wall, 'stone');
  near(mid.dist, 0.5 + state.movers[0].offset);
  assert.ok(isSolid(state, 9, 15), 'the tile it is sliding into is already blocked');

  run(state, step, 2);
  assert.equal(state.movers.length, 0);
  assert.equal(state.walls[15][10], 'stone', 'it stopped two tiles further on');
  assert.equal(state.walls[15][8], null);
  assert.equal(state.walls[15][9], null);
});

test('the hidden room can then be entered and holds an extra life', () => {
  const state = place(testState(), 7.5, 15.5, 0);
  run(state, step, 1 / 60, { use: true });
  run(state, step, 2.5);
  run(state, step, 0.8, { forward: 1 }); // walk into the gap
  assert.ok(state.player.x > 8.5, `walked in (${state.player.x})`);
  place(state, 10.5, 16.5);
  run(state, step, 0.1);
  assert.equal(state.player.lives, START_LIVES + 1);
});

test('a secret wall cannot be pushed into something, and is only found once', () => {
  const state = place(testState(), 7.5, 15.5, 0);
  state.items.push({ kind: 'barrel', x: 9.5, y: 15.5 });
  const events = run(state, step, 1 / 60, { use: true });
  assert.ok(!types(events).includes('secret'));
  assert.equal(state.walls[SECRET.row][SECRET.col], 'stone');
  assert.equal(state.stats.secrets, 0);
});

test('guards path around a sliding wall, and through the gap once it stops', () => {
  const state = place(testState(), 7.5, 15.5, 0);
  assert.equal(distanceField(state)[16 * state.width + 9], -1, 'the closet is sealed');
  run(state, step, 1 / 60, { use: true });
  run(state, step, 3);
  assert.ok(distanceField(state)[16 * state.width + 9] > 0, 'the closet can now be reached');
});

test('hitBox finds where a ray enters a box, from any side', () => {
  const east = hitBox(0.5, 0.5, 0, 2, 0);
  near(east.dist, 1.5);
  assert.equal(east.side, 0);
  const south = hitBox(2.5, 0.5, Math.PI / 2, 2, 2);
  near(south.dist, 1.5);
  assert.equal(south.side, 1);
  assert.equal(hitBox(0.5, 0.5, Math.PI, 2, 0), null, 'behind the ray');
  assert.equal(hitBox(0.5, 0.5, 0, 2, 3), null, 'off to the side');
});

// ---------------------------------------------------------------- dogs

// Map 3, enemy 0: the dog in the crypt hall at 10.5,2.5.
const CRYPT_DOG = 0;

test('a guard dog runs up and bites instead of shooting', () => {
  const state = place(testState(2, { keep: [CRYPT_DOG], random: () => 0 }), 6.5, 2.5, 0);
  const dog = state.enemies[0];
  assert.equal(dog.type, 'dog');
  dog.state = 'chase';
  const events = run(state, step, 3);
  assert.ok(types(events).includes('bite'));
  assert.ok(!types(events).includes('enemyFire'), 'dogs have no gun');
  assert.ok(state.player.health < MAX_HEALTH);
  assert.ok(Math.hypot(dog.x - state.player.x, dog.y - state.player.y) < 1.3, 'it came right up to you');
});

test('dogs are fast, never flinch, and drop nothing', () => {
  assert.ok(ENEMY_TYPES.dog.speed > ENEMY_TYPES.ss.speed);
  const state = place(testState(2, { keep: [CRYPT_DOG], random: () => 0 }), 8.5, 2.5, 0);
  const dog = state.enemies[0];
  const itemsBefore = state.items.length;
  run(state, step, 1 / 60, { fire: true });
  assert.notEqual(dog.state, 'pain');
  run(state, step, 1, { fire: true });
  assert.equal(dog.state, 'dead');
  assert.equal(state.items.length, itemsBefore, 'no clip or gun left behind');
  assert.equal(state.player.score, ENEMY_TYPES.dog.score);
});

test('backing away from a leaping dog makes it miss', () => {
  const state = place(testState(2, { keep: [CRYPT_DOG], random: () => 0 }), 9.5, 2.5, 0);
  const dog = state.enemies[0];
  dog.state = 'bite';
  dog.timer = 0;
  place(state, 6.5, 2.5, 0); // out of reach before the jaws close
  const events = run(state, step, 0.4);
  assert.ok(types(events).includes('bite'));
  assert.equal(state.player.health, MAX_HEALTH);
});

// ---------------------------------------------------------------- difficulty

test('easy leaves some enemies at home, but never the boss', () => {
  const normal = createState(1);
  const easy = createState(1, { difficulty: 'easy' });
  assert.ok(easy.enemies.length < normal.enemies.length);
  assert.equal(easy.stats.enemies, easy.enemies.length);
  assert.ok(easy.enemies.some((enemy) => enemy.type === 'boss'));
  assert.equal(createState(1, { difficulty: 'hard' }).enemies.length, normal.enemies.length);
});

test('harder settings make the same shot hurt more', () => {
  const damageOn = (difficulty) => {
    const state = createState(0, { random: () => 0, difficulty });
    state.enemies = state.enemies.filter((enemy) => enemy.id === 1);
    place(state, 5.5, 5.5);
    run(state, step, 3);
    return MAX_HEALTH - state.player.health;
  };
  const easy = damageOn('easy');
  const normal = damageOn('normal');
  const hard = damageOn('hard');
  assert.ok(easy > 0 && easy < normal && normal < hard, `${easy} < ${normal} < ${hard}`);
});

test('guards notice you sooner on hard', () => {
  assert.ok(DIFFICULTIES.hard.reaction < DIFFICULTIES.normal.reaction);
  assert.ok(DIFFICULTIES.easy.reaction > DIFFICULTIES.normal.reaction);
  assert.equal(createState(0, { difficulty: 'nonsense' }).difficulty, 'normal');
});

test('the difficulty carries over to the next map', () => {
  const state = createState(0, { difficulty: 'hard' });
  assert.equal(createState(1, { carry: carryOver(state) }).difficulty, 'hard');
});

// ---------------------------------------------------------------- lives

test('you start with three lives, and they carry over between maps', () => {
  const state = createState(0);
  assert.equal(state.player.lives, START_LIVES);
  state.player.lives = 2;
  assert.equal(createState(1, { carry: carryOver(state) }).player.lives, 2);
});

test('dying costs a life and restarts the map with what you entered it with', () => {
  const state = createState(1, { carry: { health: 70, ammo: 40, weapons: ['knife', 'pistol', 'machinegun'], weapon: 'machinegun', score: 900, lives: 3 } });
  const entry = carryOver(state);
  state.player.health = 0;
  state.status = 'dead';
  const carry = retryCarry(state, entry);
  assert.equal(carry.lives, 2);
  const retry = createState(1, { carry });
  assert.equal(retry.player.health, 70);
  assert.equal(retry.player.weapon, 'machinegun');
  assert.equal(retry.player.lives, 2);
  // Dying on the very first map (no carry) restarts with the starting gear.
  assert.equal(createState(0, { carry: retryCarry(createState(0), null) }).player.lives, 2);
});

test('losing your last life is game over', () => {
  const state = createState(0);
  state.player.lives = 1;
  assert.equal(retryCarry(state, null), null);
});

test('an extra life also refills health and adds bullets', () => {
  const state = testState();
  state.items.push({ kind: 'oneup', x: 2.5, y: 2.5 });
  state.player.health = 30;
  place(state, 2.5, 2.5);
  const events = run(state, step, 0.1);
  assert.equal(state.player.lives, START_LIVES + 1);
  assert.equal(state.player.health, MAX_HEALTH);
  assert.equal(state.player.ammo, 16 + 25);
  assert.ok(events.some((event) => event.type === 'pickup' && event.kind === 'oneup'));
});

// ---------------------------------------------------------------- where hits come from

test('a hit remembers the direction it came from', () => {
  const state = place(testState(0, { keep: [1], random: () => 0 }), 5.5, 5.5, 0); // the guard is east of us
  run(state, step, 3);
  assert.ok(state.player.health < MAX_HEALTH);
  near(state.player.hitAngle, 0, 0.05);
});
