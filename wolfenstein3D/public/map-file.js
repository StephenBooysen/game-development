// The .map file format: one map per file, kept in the maps/ folder.
//
//   // Lines starting with two slashes are comments.
//   name: Cell Block
//   facing: east
//   ceiling: #3a3a3a
//   floor texture: flagstone
//
//   ########
//   #P...kX#
//   ########
//
// Lines with a colon are settings; every other line is one row of tiles. (No tile
// uses a colon, so the two can never be confused.) This file only turns text into
// a map object and back; maps.js does the reading of files.

/** Compass directions you can write after `facing:`, as angles (0 = east, y grows southwards). */
export const FACINGS = Object.freeze({ east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 });

// Setting names as written in the file -> property names on the map object.
// Spaces, dashes and capitals are ignored, so "Floor Texture" and "floorTexture" both work.
const SETTINGS = Object.freeze({
  name: 'name',
  facing: 'facing',
  ceiling: 'ceiling',
  floor: 'floor',
  ceilingtexture: 'ceilingTexture',
  floortexture: 'floorTexture',
});

/** A readable name from a file name: "03-the-catacombs.map" becomes "The catacombs". */
export function nameFromFile(fileName = '') {
  const words = fileName.replace(/\.map$/i, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Untitled map';
}

function readFacing(value, where) {
  const word = value.toLowerCase();
  if (word in FACINGS) return FACINGS[word];
  const number = Number(value);
  if (value !== '' && Number.isFinite(number)) return number; // an angle in radians
  throw new Error(`${where}: "facing" must be east, south, west or north, not "${value}"`);
}

/**
 * Turns the text of a .map file into a map object: { name, facing, rows, ... }.
 * `fileName` is used in error messages and as the name when the file has none.
 */
export function parseMapFile(text, fileName = 'map') {
  const map = { name: nameFromFile(fileName), facing: 0, rows: [] };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const where = `${fileName}, line ${index + 1}`;
    if (!line || line.startsWith('//')) return;
    const colon = line.indexOf(':');
    if (colon === -1) {
      map.rows.push(line);
      return;
    }
    const key = line.slice(0, colon).toLowerCase().replace(/[\s_-]/g, '');
    const value = line.slice(colon + 1).trim();
    const property = SETTINGS[key];
    if (!property) {
      throw new Error(`${where}: unknown setting "${line.slice(0, colon).trim()}". Known settings: name, facing, ceiling, floor, ceiling texture, floor texture`);
    }
    map[property] = property === 'facing' ? readFacing(value, where) : value;
  });
  if (!map.rows.length) throw new Error(`${fileName}: there are no rows of tiles in this file`);
  return map;
}

/** Turns a map object back into the text of a .map file. */
export function mapToFile(map) {
  const compass = Object.keys(FACINGS).find((word) => Math.abs(FACINGS[word] - (map.facing || 0)) < 1e-9);
  const lines = [`name: ${map.name}`, `facing: ${compass ?? map.facing}`];
  if (map.ceiling) lines.push(`ceiling: ${map.ceiling}`);
  if (map.floor) lines.push(`floor: ${map.floor}`);
  if (map.ceilingTexture) lines.push(`ceiling texture: ${map.ceilingTexture}`);
  if (map.floorTexture) lines.push(`floor texture: ${map.floorTexture}`);
  return `${lines.join('\n')}\n\n${map.rows.join('\n')}\n`;
}

/** A file name for a map: "My Map!" becomes "my-map.map". */
export function fileNameFor(map) {
  const slug = String(map.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'my-map'}.map`;
}
