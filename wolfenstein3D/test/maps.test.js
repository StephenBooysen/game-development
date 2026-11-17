import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, parseMap, BLOCKING_ITEMS } from '../public/maps.js';
import { createState, distanceField } from '../public/game.js';
import { checkMap } from '../public/editor-core.js';

const stepsTo = (state, field, thing) => field[Math.floor(thing.y) * state.width + Math.floor(thing.x)];

test('the level has three maps', () => {
  assert.deepEqual(MAPS.map((map) => map.name), ['Cell Block', 'The Armory', 'The Catacombs']);
});

for (const [index, map] of MAPS.entries()) {
  test(`${map.name}: is a rectangle closed in by walls`, () => {
    const level = parseMap(map);
    for (let col = 0; col < level.width; col++) {
      assert.ok(level.walls[0][col], `top edge, column ${col}`);
      assert.ok(level.walls[level.height - 1][col], `bottom edge, column ${col}`);
    }
    for (let row = 0; row < level.height; row++) {
      assert.ok(level.walls[row][0], `left edge, row ${row}`);
      assert.ok(level.walls[row][level.width - 1], `right edge, row ${row}`);
    }
  });

  test(`${map.name}: has guards, pickups, a key, a locked door and an exit`, () => {
    const level = parseMap(map);
    const kinds = level.items.map((item) => item.kind);
    assert.ok(level.enemies.length >= 5);
    for (const kind of ['medkit', 'ammo', 'key', 'treasure']) assert.ok(kinds.includes(kind), kind);
    assert.equal(level.doors.filter((door) => door.locked).length, 1);
    assert.ok(level.walls.flat().includes('exit'));
  });

  test(`${map.name}: every door sits between two walls`, () => {
    const level = parseMap(map);
    for (const { col, row, vertical } of level.doors) {
      const [a, b] = vertical ? [level.walls[row - 1][col], level.walls[row + 1][col]] : [level.walls[row][col - 1], level.walls[row][col + 1]];
      assert.ok(a && b, `door at ${col},${row}`);
    }
  });

  test(`${map.name}: the key can be reached before the locked door, and then everything can`, () => {
    const state = createState(index);
    let field = distanceField(state);
    const key = state.items.find((item) => item.kind === 'key');
    assert.ok(stepsTo(state, field, key) > 0, 'the key is reachable while the door is locked');

    // Then unlock the door and push open the secret walls: now everything must be reachable.
    for (const door of state.doors.values()) door.locked = false;
    for (const secret of state.secrets.values()) state.walls[secret.row][secret.col] = null;
    state.field = null;
    field = distanceField(state);
    for (const thing of [...state.items.filter((item) => !BLOCKING_ITEMS.has(item.kind)), ...state.enemies]) {
      assert.ok(stepsTo(state, field, thing) >= 0, `${thing.kind || thing.type} at ${thing.x},${thing.y}`);
    }
    // The exit switch is a wall, so check that you can stand next to it.
    const row = state.walls.findIndex((line) => line.includes('exit'));
    const col = state.walls[row].indexOf('exit');
    const besides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => field[(row + dr) * state.width + col + dc] ?? -1);
    assert.ok(besides.some((steps) => steps >= 0), 'the exit switch can be reached');
  });

  test(`${map.name}: has a secret wall with something worth finding behind it, and passes the editor's checks`, () => {
    const level = parseMap(map);
    assert.equal(level.secrets.length, 1);
    const kinds = level.items.map((item) => item.kind);
    assert.ok(kinds.includes('oneup'), 'an extra life');
    assert.deepEqual(checkMap(map), []);
  });
}

test('the Catacombs have guard dogs and their own mossy walls', () => {
  const level = parseMap(MAPS[2]);
  assert.ok(level.enemies.filter((enemy) => enemy.type === 'dog').length >= 3);
  assert.ok(level.walls.flat().includes('moss'));
  assert.ok(parseMap(MAPS[1]).enemies.some((enemy) => enemy.type === 'dog'), 'a dog guards the Armory too');
});

test('every map names a floor and ceiling pattern', () => {
  for (const map of MAPS) assert.ok(map.floorTexture && map.ceilingTexture, map.name);
});

test('the machine gun is on map 1 and the chaingun on map 2', () => {
  assert.ok(parseMap(MAPS[0]).items.some((item) => item.kind === 'machinegun'));
  assert.ok(parseMap(MAPS[1]).items.some((item) => item.kind === 'chaingun'));
  assert.ok(parseMap(MAPS[1]).enemies.some((enemy) => enemy.type === 'boss'));
});

test('parseMap explains what is wrong with a bad map', () => {
  assert.throws(() => parseMap({ name: 'Bad', rows: ['###', '#P#', '##'] }), /row 2 is 2 tiles wide/);
  assert.throws(() => parseMap({ name: 'Bad', rows: ['###', '#?#', '###'] }), /unknown character "\?"/);
  assert.throws(() => parseMap({ name: 'Bad', rows: ['###', '#.#', '###'] }), /no player start/);
});
