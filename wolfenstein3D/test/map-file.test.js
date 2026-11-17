import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { parseMapFile, mapToFile, nameFromFile, fileNameFor, FACINGS } from '../public/map-file.js';
import { MAPS } from '../public/maps.js';
import { FLOOR_NAMES } from '../public/floors.js';

const mapsDir = new URL('../maps/', import.meta.url);

test('a .map file has settings, comments and rows of tiles', () => {
  const map = parseMapFile([
    '// a tiny test room',
    'name: Tiny Room',
    'Facing: North',
    'ceiling: #111111',
    'floor texture: dirt',
    '',
    '#####',
    '  #P.X#  ',
    '#####',
    '',
  ].join('\r\n'), '09-tiny.map');
  assert.deepEqual(map, {
    name: 'Tiny Room', facing: FACINGS.north, ceiling: '#111111', floorTexture: 'dirt', rows: ['#####', '#P.X#', '#####'],
  });
});

test('a .map file without settings is named after the file and faces east', () => {
  assert.deepEqual(parseMapFile('###\n#P#\n###', '04-the-crypt.map'), { name: 'The crypt', facing: 0, rows: ['###', '#P#', '###'] });
  assert.equal(nameFromFile('my_map.map'), 'My map');
  assert.equal(parseMapFile('facing: 1.5\n#P#').facing, 1.5, 'an angle in radians also works');
});

test('mistakes in a .map file are explained with the file and line', () => {
  assert.throws(() => parseMapFile('name: x\nflor: #000\n#P#', 'bad.map'), /bad\.map, line 2: unknown setting "flor"/);
  assert.throws(() => parseMapFile('facing: up\n#P#', 'bad.map'), /"facing" must be east, south, west or north/);
  assert.throws(() => parseMapFile('name: empty\n// nothing here', 'bad.map'), /no rows of tiles/);
});

test('writing a map to a file and reading it back gives the same map', () => {
  for (const map of MAPS) assert.deepEqual(parseMapFile(mapToFile(map)), { ...map, rows: [...map.rows] }, map.name);
  const turned = { name: 'Odd', facing: 0.3, rows: ['#P#'] };
  assert.deepEqual(parseMapFile(mapToFile(turned)), turned);
  assert.equal(fileNameFor({ name: 'My Map!' }), 'my-map.map');
  assert.equal(fileNameFor({ name: '' }), 'my-map.map');
});

test('the game loads every .map file in maps/, in file-name order', async () => {
  const files = (await readdir(mapsDir)).filter((name) => name.endsWith('.map')).sort();
  assert.equal(MAPS.length, files.length);
  for (const [index, file] of files.entries()) {
    assert.match(file, /^\d\d-[a-z0-9-]+\.map$/, 'files start with a number so their order is clear');
    assert.deepEqual(MAPS[index], parseMapFile(await readFile(new URL(file, mapsDir), 'utf8'), file));
  }
});

test('every map uses floor and ceiling patterns that exist', () => {
  for (const map of MAPS) {
    for (const name of [map.floorTexture, map.ceilingTexture].filter(Boolean)) assert.ok(FLOOR_NAMES.includes(name), `${map.name}: ${name}`);
  }
});
