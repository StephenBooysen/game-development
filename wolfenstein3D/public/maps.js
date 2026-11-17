// The level: the maps in the maps/ folder, drawn as text. Each character is one tile,
// so a map can be edited by hand (or in the map editor, editor.html). parseMap() turns
// the drawing into data the game can use.
import { parseMapFile } from './map-file.js';

/** Wall characters and the texture each one is drawn with. */
export const WALLS = Object.freeze({
  '#': 'stone',
  '=': 'blueStone',
  '%': 'wood',
  '&': 'brick',
  '@': 'moss',
  F: 'stoneFlag',
  X: 'exit', // the elevator switch: use it to finish the map
});

/**
 * A secret push-wall. It looks exactly like the wall next to it, but pressing "use"
 * against it makes it slide back two tiles, opening a hidden room.
 */
export const SECRET = '$';

/** Enemy characters. R is a guard that walks up and down until it notices you. H is a guard dog (a hound). */
export const ENEMIES = Object.freeze({
  G: { type: 'guard', patrol: false },
  R: { type: 'guard', patrol: true },
  S: { type: 'ss', patrol: false },
  B: { type: 'boss', patrol: false },
  H: { type: 'dog', patrol: false },
});

/** Things lying or standing on the floor. */
export const ITEMS = Object.freeze({
  h: 'medkit',
  f: 'food',
  a: 'ammo',
  m: 'machinegun',
  c: 'chaingun',
  k: 'key',
  t: 'treasure',
  u: 'oneup', // an extra life
  o: 'barrel',
  i: 'pillar',
  l: 'lamp',
});

/** Items you cannot walk through. */
export const BLOCKING_ITEMS = new Set(['barrel', 'pillar']);

// Other characters: '.' floor, 'P' player start, 'D' door, 'L' locked door (needs the key),
// '$' a secret push-wall.

/**
 * Reads every .map file in the maps/ folder, in file-name order, so "01-..." is the
 * first map. In the browser the files come from the server (server.js lists the
 * folder at maps/index.json); under Node, in the tests, they are read from disk.
 */
export async function loadMaps() {
  const inNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  let files;
  if (inNode) {
    const { readdir, readFile } = await import('node:fs/promises');
    const folder = new URL('../maps/', import.meta.url);
    const names = (await readdir(folder)).filter((name) => name.endsWith('.map')).sort();
    files = await Promise.all(names.map(async (name) => [name, await readFile(new URL(name, folder), 'utf8')]));
  } else {
    const fetchText = async (name) => {
      const response = await fetch(new URL(`maps/${name}`, import.meta.url));
      if (!response.ok) throw new Error(`Could not load maps/${name} (${response.status})`);
      return response.text();
    };
    const names = JSON.parse(await fetchText('index.json'));
    files = await Promise.all(names.map(async (name) => [name, await fetchText(name)]));
  }
  if (!files.length) throw new Error('There are no .map files in the maps/ folder');
  return files.map(([name, text]) => Object.freeze(parseMapFile(text, name)));
}

// `await` at the top of a module: anything that imports MAPS waits until the files are
// loaded, so the rest of the game can keep using MAPS as a plain list.
// `ceiling` and `floor` are flat colours; `ceilingTexture` and `floorTexture` name the
// patterns in floors.js that are drawn over them when the browser can.
export const MAPS = Object.freeze(await loadMaps());

/**
 * Turns a text map into data: a grid of walls plus lists of doors, items and enemies.
 * Positions are in tiles, measured to the middle of the tile (col + 0.5).
 */
export function parseMap(map) {
  const height = map.rows.length;
  const width = map.rows[0].length;
  const walls = [];
  const doors = [];
  const secrets = [];
  const items = [];
  const enemies = [];
  let start = null;

  const isWallChar = (col, row) => Boolean(WALLS[map.rows[row]?.[col]]);
  // A secret wall borrows the texture of a neighbouring wall, so it does not stand out.
  const disguise = (col, row) => {
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const texture = WALLS[map.rows[row + dr]?.[col + dc]];
      if (texture && texture !== 'exit') return texture;
    }
    return 'stone';
  };

  map.rows.forEach((text, row) => {
    if (text.length !== width) {
      throw new Error(`Map "${map.name}": row ${row} is ${text.length} tiles wide, expected ${width}`);
    }
    const wallRow = [];
    [...text].forEach((char, col) => {
      const x = col + 0.5;
      const y = row + 0.5;
      if (char === SECRET) {
        const texture = disguise(col, row);
        wallRow.push(texture); // until it is pushed, it is an ordinary wall
        secrets.push({ col, row, texture });
        return;
      }
      wallRow.push(WALLS[char] || null);
      if (WALLS[char] || char === '.') return;
      if (char === 'P') {
        start = { x, y, angle: map.facing };
      } else if (char === 'D' || char === 'L') {
        // A door sits between two walls. "vertical" means the walls are above and
        // below it, so you walk through it going east or west.
        const vertical = isWallChar(col, row - 1) && isWallChar(col, row + 1);
        doors.push({ col, row, vertical, locked: char === 'L' });
      } else if (ENEMIES[char]) {
        enemies.push({ ...ENEMIES[char], x, y });
      } else if (ITEMS[char]) {
        items.push({ kind: ITEMS[char], x, y });
      } else {
        throw new Error(`Map "${map.name}": unknown character "${char}" at column ${col}, row ${row}`);
      }
    });
    walls.push(wallRow);
  });

  if (!start) throw new Error(`Map "${map.name}" has no player start (P)`);
  return {
    name: map.name,
    width,
    height,
    walls,
    doors,
    secrets,
    items,
    enemies,
    start,
    ceiling: map.ceiling || '#3a3a3a',
    floor: map.floor || '#6e6e6e',
    ceilingTexture: map.ceilingTexture || null,
    floorTexture: map.floorTexture || null,
  };
}
