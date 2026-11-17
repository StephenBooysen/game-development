// The map editor's rules, kept apart from the page (editor.js) so they can be tested.
// A map is the same object as in MAPS (maps.js): { name, facing, rows: ['####', ...] },
// and as text it is a .map file (see map-file.js), so a map made here can be saved
// straight into the maps/ folder.
import { WALLS, ENEMIES, ITEMS, SECRET, BLOCKING_ITEMS, parseMap } from './maps.js';
import { mapToFile, parseMapFile } from './map-file.js';
import { createState, distanceField } from './game.js';

const ITEM_NAMES = {
  medkit: 'First aid kit', food: 'Hot meal', ammo: 'Ammo box', machinegun: 'Machine gun', chaingun: 'Chaingun',
  key: 'Gold key', treasure: 'Treasure', oneup: 'Extra life', barrel: 'Barrel', pillar: 'Pillar', lamp: 'Lamp',
};
const WALL_NAMES = { stone: 'Stone wall', blueStone: 'Blue wall', wood: 'Wood wall', brick: 'Brick wall', moss: 'Mossy wall', stoneFlag: 'Banner wall', exit: 'Exit switch' };
const ENEMY_NAMES = { G: 'Guard', R: 'Patrolling guard', S: 'SS officer', B: 'Boss', H: 'Guard dog' };

/**
 * Everything that can be placed, in groups for the palette: { char, name, group, color }.
 * The colours are only for the editor's grid, not the game.
 */
export const PALETTE = Object.freeze([
  { char: '.', name: 'Floor', group: 'Basics', color: '#2a2f28' },
  { char: 'P', name: 'Player start', group: 'Basics', color: '#ffffff' },
  { char: 'D', name: 'Door', group: 'Basics', color: '#3fa8a0' },
  { char: 'L', name: 'Locked door', group: 'Basics', color: '#e0b020' },
  { char: SECRET, name: 'Secret push-wall', group: 'Basics', color: '#b070e0' },
  ...Object.entries(WALLS).map(([char, texture]) => ({
    char, name: WALL_NAMES[texture] || texture, group: 'Walls', color: texture === 'exit' ? '#40e060' : '#8a8a96',
  })),
  ...Object.keys(ENEMIES).map((char) => ({ char, name: ENEMY_NAMES[char] || char, group: 'Enemies', color: '#ff5050' })),
  ...Object.entries(ITEMS).map(([char, kind]) => ({
    char, name: ITEM_NAMES[kind] || kind, group: 'Items', color: BLOCKING_ITEMS.has(kind) ? '#a08060' : '#f0c830',
  })),
]);

/** A new map: an empty room with walls round the edge and the player in the corner. */
export function blankMap(width = 24, height = 18, name = 'My map') {
  const rows = Array.from({ length: height }, (_, row) => {
    if (row === 0 || row === height - 1) return '#'.repeat(width);
    return `#${'.'.repeat(width - 2)}#`;
  });
  rows[1] = `#P${rows[1].slice(2)}`;
  return { name, facing: 0, rows };
}

/**
 * Returns a copy of the map with one tile changed. Placing the player start
 * removes the old one, since a map has exactly one.
 */
export function paintTile(map, col, row, char) {
  if (row < 0 || row >= map.rows.length || col < 0 || col >= map.rows[0].length) return map;
  let rows = map.rows;
  if (char === 'P') rows = rows.map((text) => text.replaceAll('P', '.'));
  rows = rows.map((text, r) => (r === row ? text.slice(0, col) + char + text.slice(col + 1) : text));
  return { ...map, rows };
}

/** The map as the text of a .map file: settings, a blank line, then the rows. */
export function mapToText(map) {
  return mapToFile(map);
}

/**
 * Builds a map from .map text typed or pasted into the editor. Blank lines and spaces
 * at the ends are ignored, and a text without a `name:` line keeps the name given.
 * Throws a friendly error if a setting is misspelled or there are no rows.
 */
export function textToMap(text, name = 'My map') {
  const map = parseMapFile(text, 'The text');
  return /^\s*name\s*:/im.test(text) ? map : { ...map, name };
}

/**
 * Everything that would stop this map from being played, as friendly sentences.
 * An empty list means the map is good to go. It checks the same things as the
 * tests in test/maps.test.js: the shape, a closed edge, an exit you can reach,
 * and a key you can get before the locked door.
 */
export function checkMap(map) {
  let level;
  try {
    if (!map.rows.length) return ['The map is empty.'];
    level = parseMap(map);
  } catch (error) {
    return [error.message];
  }
  const problems = [];
  const { width, height, walls } = level;
  const edgeOpen = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const edge = row === 0 || col === 0 || row === height - 1 || col === width - 1;
      if (edge && !walls[row][col]) edgeOpen.push(`${col},${row}`);
    }
  }
  if (edgeOpen.length) problems.push(`The outside edge must be all walls. Open at: ${edgeOpen.slice(0, 5).join(' ')}${edgeOpen.length > 5 ? ' ...' : ''}`);

  const locked = level.doors.filter((door) => door.locked).length;
  const keys = level.items.filter((item) => item.kind === 'key').length;
  if (locked > 0 && keys === 0) problems.push('There is a locked door (L) but no gold key (k) to open it.');
  if (!walls.flat().includes('exit')) problems.push('There is no exit switch (X).');
  if (problems.length) return problems;

  // Walk the map the way the guards do (see distanceField in game.js). Secret walls
  // are treated as open, since the player can push them.
  const state = createState(0, { maps: [map] });
  for (const secret of state.secrets.values()) state.walls[secret.row][secret.col] = null;
  const stepsTo = (field, col, row) => (col < 0 || row < 0 || col >= width || row >= height ? -1 : field[row * width + col]);
  if (keys > 0) {
    const field = distanceField(state);
    const reachable = state.items.some((item) => item.kind === 'key' && stepsTo(field, Math.floor(item.x), Math.floor(item.y)) >= 0);
    if (!reachable) problems.push('The gold key cannot be reached without going through the locked door.');
  }
  for (const door of state.doors.values()) door.locked = false;
  state.field = null;
  const field = distanceField(state);
  let exitReachable = false;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (walls[row][col] !== 'exit') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => stepsTo(field, col + dc, row + dr) >= 0)) exitReachable = true;
    }
  }
  if (!exitReachable) problems.push('The exit switch (X) cannot be reached from the player start.');
  return problems;
}
