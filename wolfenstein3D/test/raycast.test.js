import test from 'node:test';
import assert from 'node:assert/strict';
import { castRay, tileKey } from '../public/raycast.js';

// A 6x5 room. '#' is wall, 'D' marks where a door can be put (column 3, row 2).
function world(door = null) {
  const rows = ['######', '#..#.#', '#....#', '#..#.#', '######'];
  const result = { width: 6, height: 5, walls: rows.map((row) => [...row].map((char) => (char === '#' ? 'stone' : null))), doors: new Map() };
  if (door) result.doors.set(tileKey(result, 3, 2), { col: 3, row: 2, vertical: true, locked: false, open: 0, ...door });
  return result;
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be ${expected}`);

test('a ray stops at the first wall and reports the distance', () => {
  const east = castRay(world(), 1.5, 2.5, 0);
  near(east.dist, 3.5);
  assert.equal(east.wall, 'stone');
  assert.equal(east.side, 0);
  assert.deepEqual([east.col, east.row], [5, 2]);

  const south = castRay(world(), 1.5, 2.5, Math.PI / 2);
  near(south.dist, 1.5);
  assert.equal(south.side, 1);

  const west = castRay(world(), 1.5, 2.5, Math.PI);
  near(west.dist, 0.5);
});

test('a ray at an angle hits the right tile, and u says where on it', () => {
  const hit = castRay(world(), 1.5, 1.5, Math.atan2(0.25, 1.5)); // towards (3, 1.75)
  assert.deepEqual([hit.col, hit.row], [3, 1]);
  near(hit.u, 0.75);
});

test('a closed door is hit half a tile in', () => {
  const hit = castRay(world({}), 1.5, 2.5, 0);
  near(hit.dist, 2);
  assert.equal(hit.wall, 'door');
  assert.equal(hit.door.col, 3);
  assert.equal(castRay(world({ locked: true }), 1.5, 2.5, 0).wall, 'doorLocked');
});

test('an open door lets the ray through', () => {
  const hit = castRay(world({ open: 1 }), 1.5, 2.5, 0);
  near(hit.dist, 3.5);
  assert.equal(hit.door, null);
});

test('a half-open door blocks only the half that is still closed', () => {
  const half = world({ open: 0.5 });
  assert.equal(castRay(half, 1.5, 2.75, 0).wall, 'door');
  assert.equal(castRay(half, 1.5, 2.25, 0).wall, 'stone');
  near(castRay(half, 1.5, 2.75, 0).u, 0.25); // the texture slides along with the door
});

test('a ray gives up at maxDist', () => {
  const hit = castRay(world(), 1.5, 2.5, 0, 1);
  assert.equal(hit.wall, null);
  assert.equal(hit.dist, 1);
});
