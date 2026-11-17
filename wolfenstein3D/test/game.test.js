import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, carryOver, doorAt, selectWeapon, aimTarget, distanceField, MAX_HEALTH } from '../public/game.js';
import { testState, place, run, HALL_GUARD, PATROL_GUARD } from './helpers.js';

const SOUTH = Math.PI / 2;
const types = (events) => events.map((event) => event.type);

// Map 1 landmarks used below (see public/maps.js):
//   start cell: player at 1.5,2.5 facing the door at column 4
//   the hall guard stands at 8.5,5.5 looking west down the hall
//   locked door at 18,14; exit switch at 23,15

test('a new game starts with a knife, a pistol and a few bullets', () => {
  const { player, stats } = createState(0);
  assert.deepEqual(player.weapons, ['knife', 'pistol']);
  assert.equal(player.weapon, 'pistol');
  assert.equal(player.health, MAX_HEALTH);
  assert.equal(player.ammo, 16);
  assert.equal(stats.enemies, 7);
});

test('the player walks forward until a closed door stops them', () => {
  const state = testState();
  run(state, step, 0.5, { forward: 1 });
  assert.ok(state.player.x > 2.5, 'moved east');
  run(state, step, 2, { forward: 1 });
  assert.ok(state.player.x < 4 && state.player.x > 3.7, `stopped at the door (${state.player.x})`);
  assert.equal(state.player.y, 2.5);
});

test('running is faster than walking, and sidestepping moves sideways', () => {
  const walk = testState();
  const sprint = testState();
  run(walk, step, 0.3, { forward: 1 });
  run(sprint, step, 0.3, { forward: 1, run: true });
  assert.ok(sprint.player.x > walk.player.x);
  const side = testState();
  run(side, step, 0.2, { strafe: 1 });
  assert.ok(side.player.y > 2.5 && side.player.x === 1.5, 'facing east, "right" is south');
});

test('using a door opens it, and it closes again by itself', () => {
  const state = place(testState(), 3.5, 2.5);
  const door = doorAt(state, 4, 2);
  const events = run(state, step, 1 / 60, { use: true });
  assert.ok(types(events).includes('door'));
  assert.equal(door.phase, 'opening');
  run(state, step, 1.5, { forward: 1 });
  assert.ok(state.player.x > 5, 'walked through the open door');
  run(state, step, 6);
  assert.equal(door.phase, 'closed');
  assert.equal(door.open, 0);
});

test('a door does not close on someone standing in it', () => {
  const state = place(testState(), 3.5, 2.5);
  run(state, step, 1, { use: true });
  place(state, 4.5, 2.5);
  run(state, step, 8);
  assert.equal(doorAt(state, 4, 2).open, 1);
});

test('walking over ammo picks it up', () => {
  const state = place(testState(), 3.4, 1.6);
  const events = run(state, step, 1 / 60);
  assert.equal(state.player.ammo, 24);
  assert.deepEqual(events.filter((event) => event.type === 'pickup'), [{ type: 'pickup', kind: 'ammo' }]);
  assert.ok(!state.items.some((item) => item.x === 3.5 && item.y === 1.5));
  assert.match(state.message.text, /8 bullets/);
});

test('a first aid kit is left on the floor until you need it', () => {
  const state = place(testState(), 12.5, 1.5); // the medkit in the storage room
  run(state, step, 0.1);
  assert.ok(state.items.some((item) => item.kind === 'medkit' && item.x === 12.5));
  state.player.health = 60;
  run(state, step, 0.1);
  assert.equal(state.player.health, 85);
  assert.ok(!state.items.some((item) => item.kind === 'medkit' && item.x === 12.5));
});

test('picking up the machine gun adds it and switches to it', () => {
  const state = place(testState(), 14.5, 4.5);
  run(state, step, 0.1);
  assert.deepEqual(state.player.weapons, ['knife', 'pistol', 'machinegun']);
  assert.equal(state.player.weapon, 'machinegun');
  assert.equal(state.player.ammo, 22);
});

test('treasure scores points and the key is kept', () => {
  const state = place(testState(), 22.5, 1.5);
  run(state, step, 0.1);
  assert.equal(state.player.score, 500);
  assert.equal(state.stats.treasure, 1);
  place(state, 22.5, 2.5);
  run(state, step, 0.1);
  assert.equal(state.player.keys, 1);
});

test('shooting uses bullets, and two pistol shots kill a guard', () => {
  const state = place(testState(0, { keep: [HALL_GUARD] }), 5.5, 5.5);
  const guard = state.enemies[0];
  assert.equal(aimTarget(state).enemy, guard);
  const events = run(state, step, 0.6, { fire: true }); // the pistol fires every 0.38s
  assert.equal(state.player.ammo, 14);
  assert.equal(guard.state, 'dead');
  assert.equal(state.stats.kills, 1);
  assert.equal(state.player.score, 100);
  assert.ok(types(events).includes('enemyDie'));
  assert.ok(state.items.some((item) => item.kind === 'clip' && item.x === guard.x), 'the guard dropped a clip');
  assert.equal(aimTarget(state).enemy, null, 'a dead guard no longer stops bullets');
});

test('the machine gun fires much faster than the pistol', () => {
  const shots = (weapon) => {
    const state = place(testState(), 5.5, 5.5);
    state.player.weapons.push('machinegun');
    state.player.weapon = weapon;
    run(state, step, 1, { fire: true });
    return state.stats.shots;
  };
  assert.ok(shots('machinegun') > shots('pistol') * 2);
});

test('the knife needs no bullets but only reaches a guard right in front of you', () => {
  const state = place(testState(0, { keep: [HALL_GUARD] }), 5.5, 5.5);
  state.player.weapon = 'knife';
  run(state, step, 0.1, { fire: true });
  assert.equal(state.enemies[0].health, 25, 'too far away');
  assert.equal(state.player.ammo, 16);
  place(state, 7.6, 5.5);
  state.player.cooldown = 0;
  run(state, step, 1 / 60, { fire: true });
  assert.ok(state.enemies[0].health < 25);
});

test('with no bullets left the knife comes out, and new bullets bring the gun back', () => {
  const state = place(testState(), 5.5, 5.5);
  state.player.ammo = 1;
  run(state, step, 1, { fire: true });
  assert.equal(state.player.ammo, 0);
  assert.equal(state.player.weapon, 'knife');
  assert.equal(selectWeapon(state, 'pistol'), false, 'an empty gun cannot be chosen');
  place(state, 3.5, 1.5); // the ammo box in the start cell
  run(state, step, 0.1);
  assert.equal(state.player.weapon, 'pistol');
});

test('number keys and "next weapon" only choose weapons you own', () => {
  const state = testState();
  run(state, step, 1 / 60, { weapon: 'chaingun' });
  assert.equal(state.player.weapon, 'pistol');
  run(state, step, 1 / 60, { weapon: 'knife' });
  assert.equal(state.player.weapon, 'knife');
  run(state, step, 1 / 60, { nextWeapon: true });
  assert.equal(state.player.weapon, 'pistol');
});

test('a guard that sees the player raises the alarm, aims and shoots', () => {
  // random = 0 makes every guard shot a hit.
  const state = place(testState(0, { keep: [HALL_GUARD], random: () => 0 }), 5.5, 5.5);
  const events = run(state, step, 3);
  assert.deepEqual(types(events).filter((type) => type === 'alert'), ['alert']);
  assert.ok(types(events).includes('enemyFire'));
  assert.ok(types(events).includes('hurt'));
  assert.ok(state.player.health < MAX_HEALTH);
});

test('a guard does not notice a quiet player behind its back', () => {
  const state = place(testState(0, { keep: [HALL_GUARD] }), 10.5, 5.5); // the guard looks west, we are east
  run(state, step, 3);
  assert.equal(state.enemies[0].state, 'stand');
  assert.equal(state.player.health, MAX_HEALTH);
});

test('a gunshot is heard nearby, but a knife is silent', () => {
  const knife = place(testState(0, { keep: [HALL_GUARD] }), 10.5, 5.5);
  knife.player.weapon = 'knife';
  run(knife, step, 0.1, { fire: true });
  assert.equal(knife.enemies[0].state, 'stand');

  const pistol = place(testState(0, { keep: [HALL_GUARD] }), 10.5, 5.5);
  run(pistol, step, 1 / 60, { fire: true });
  assert.equal(pistol.enemies[0].state, 'chase');
});

test('a chasing guard finds its way round corners and opens doors', () => {
  const state = testState(0, { keep: [HALL_GUARD] }); // the player waits in the start cell
  const guard = state.enemies[0];
  guard.state = 'chase';
  const events = run(state, step, 8);
  assert.ok(types(events).includes('door'), 'the guard opened the cell door');
  assert.ok(Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < 5, 'the guard came to the player');
  assert.ok(types(events).includes('enemyFire'));
});

test('guards cannot walk through the player or through each other', () => {
  const state = place(testState(0, { keep: [HALL_GUARD, PATROL_GUARD], random: () => 0.99 }), 3.5, 5.5);
  for (const guard of state.enemies) guard.state = 'chase';
  run(state, step, 6);
  const [a, b] = state.enemies;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 0.59);
  for (const guard of state.enemies) {
    assert.ok(Math.hypot(guard.x - state.player.x, guard.y - state.player.y) >= 0.54);
  }
});

test('the locked door needs the gold key', () => {
  const state = place(testState(), 18.5, 13.5, SOUTH);
  const door = doorAt(state, 18, 14);
  let events = run(state, step, 1 / 60, { use: true });
  assert.ok(types(events).includes('locked'));
  assert.equal(door.phase, 'closed');
  assert.equal(distanceField(state)[15 * state.width + 18], -1, 'guards cannot path through it either');

  state.player.keys = 1;
  events = run(state, step, 1 / 60, { use: true });
  assert.ok(types(events).includes('door'));
  assert.equal(door.locked, false);
  assert.ok(distanceField(state)[15 * state.width + 18] > 0);
});

test('using the elevator switch completes the map, and your gear carries over', () => {
  const state = place(testState(), 22.5, 15.5);
  Object.assign(state.player, { health: 64, ammo: 30, score: 1200, keys: 1, weapons: ['knife', 'pistol', 'machinegun'], weapon: 'machinegun' });
  const events = run(state, step, 1 / 60, { use: true });
  assert.equal(state.status, 'complete');
  assert.ok(types(events).includes('exit'));

  const next = createState(1, { carry: carryOver(state) });
  assert.equal(next.name, 'The Armory');
  assert.equal(next.player.health, 64);
  assert.equal(next.player.ammo, 30);
  assert.equal(next.player.score, 1200);
  assert.equal(next.player.weapon, 'machinegun');
  assert.equal(next.player.keys, 0, 'keys stay behind');
});

test('"use" does nothing from too far away', () => {
  const state = place(testState(), 20.5, 15.5);
  run(state, step, 1 / 60, { use: true });
  assert.equal(state.status, 'playing');
});

test('when health runs out the game stops', () => {
  const state = place(testState(0, { keep: [HALL_GUARD], random: () => 0 }), 5.5, 5.5);
  state.player.health = 1;
  const events = run(state, step, 3);
  assert.equal(state.status, 'dead');
  assert.equal(state.player.health, 0);
  assert.ok(types(events).includes('die'));
  const time = state.time;
  step(state, { forward: 1 }, 1 / 60);
  assert.equal(state.time, time, 'nothing moves after death');
});

test('the boss is tougher than an officer, who is tougher than a guard', () => {
  const state = createState(1);
  const health = (type) => state.enemies.find((enemy) => enemy.type === type).health;
  assert.ok(health('boss') > health('ss') && health('ss') > health('guard'));
});
