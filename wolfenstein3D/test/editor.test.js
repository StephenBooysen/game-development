import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WALLS, ENEMIES, ITEMS } from '../public/maps.js';
import { createState } from '../public/game.js';
import { PALETTE, blankMap, paintTile, mapToText, textToMap, checkMap } from '../public/editor-core.js';

test('the palette offers every map character exactly once', () => {
  const chars = PALETTE.map((tile) => tile.char);
  assert.equal(new Set(chars).size, chars.length, 'no duplicates');
  for (const char of ['.', 'P', 'D', 'L', '$', ...Object.keys(WALLS), ...Object.keys(ENEMIES), ...Object.keys(ITEMS)]) {
    assert.ok(chars.includes(char), char);
  }
  assert.ok(PALETTE.every((tile) => tile.name && tile.group && tile.color));
});

test('a blank map is a walled room with a player and needs only an exit', () => {
  const map = blankMap(10, 8);
  assert.equal(map.rows.length, 8);
  assert.ok(map.rows.every((row) => row.length === 10));
  assert.deepEqual(checkMap(map), ['There is no exit switch (X).']);
  const withExit = paintTile(map, 9, 4, 'X');
  assert.deepEqual(checkMap(withExit), []);
});

test('painting changes one tile and there is only ever one player start', () => {
  const map = blankMap(10, 8);
  const painted = paintTile(map, 3, 3, 'G');
  assert.equal(painted.rows[3][3], 'G');
  assert.equal(map.rows[3][3], '.', 'the original is left alone');
  const moved = paintTile(painted, 5, 5, 'P');
  assert.equal(moved.rows.join('').split('P').length - 1, 1);
  assert.equal(moved.rows[5][5], 'P');
  assert.equal(paintTile(map, 99, 0, '#'), map, 'painting off the grid does nothing');
});

test('the text view round-trips, and pasted text is tidied up', () => {
  const map = MAPS[2];
  assert.deepEqual(textToMap(mapToText(map), 'ignored'), { ...map, rows: [...map.rows] }, 'the text is a whole .map file');
  assert.deepEqual(textToMap('  ####\n#P.X  \n\n####\n').rows, ['####', '#P.X', '####']);
  assert.equal(textToMap('####\n#P.X\n####', 'Kept').name, 'Kept', 'text without a name keeps the current one');
});

test('checkMap explains what stops a map from being played', () => {
  assert.deepEqual(checkMap({ name: 'x', rows: [] }), ['The map is empty.']);
  assert.match(checkMap({ name: 'x', rows: ['####', '#P#', '####'] })[0], /row 1 is 3 tiles wide/);
  assert.match(checkMap({ name: 'x', rows: ['#####', '#PX..', '#####'] })[0], /outside edge must be all walls/);

  const lockedNoKey = ['#######', '#P.L..X', '#######'];
  assert.match(checkMap({ name: 'x', rows: lockedNoKey }).join(), /no gold key/);

  const keyBehindDoor = ['########', '#P.#k..X', '#..L...#', '########'];
  assert.match(checkMap({ name: 'x', rows: keyBehindDoor }).join(), /key cannot be reached/);

  const walledIn = ['######', '#P#..X', '######'];
  assert.match(checkMap({ name: 'x', rows: walledIn }).join(), /cannot be reached/);

  const behindSecret = ['######', '#P$..X', '######'];
  assert.deepEqual(checkMap({ name: 'x', rows: behindSecret }), [], 'a secret wall can be pushed out of the way');
});

test('a map made in the editor can be played', () => {
  let map = blankMap(8, 6, 'Tiny');
  map = paintTile(map, 7, 3, 'X');
  map = paintTile(map, 4, 2, 'H');
  const state = createState(0, { maps: [map] });
  assert.equal(state.name, 'Tiny');
  assert.equal(state.enemies[0].type, 'dog');
  assert.equal(state.floorTexture, null, 'custom maps use flat colours');
});
