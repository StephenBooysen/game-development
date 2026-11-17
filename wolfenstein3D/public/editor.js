// The map editor page: a grid you paint tiles onto, then play straight away.
// The rules (what a tile is, whether the map can be played) are in editor-core.js;
// this file only connects them to the page.
import { MAPS } from './maps.js';
import { fileNameFor } from './map-file.js';
import { PALETTE, blankMap, paintTile, mapToText, textToMap, checkMap } from './editor-core.js';
import { browserStorage, readJson, writeJson, KEYS } from './storage.js';

const TILE = 24; // pixels per tile on the editor grid

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const palette = document.getElementById('palette');
const problems = document.getElementById('problems');
const text = document.getElementById('map-text');
const nameInput = document.getElementById('map-name');
const hoverInfo = document.getElementById('hover-info');
const storage = browserStorage();

const byChar = new Map(PALETTE.map((tile) => [tile.char, tile]));
const saved = readJson(storage, KEYS.customMap);
let map = Array.isArray(saved?.rows) ? saved : { ...MAPS[0], name: 'My map' };
let selected = '#';
let painting = null; // the character being painted while the mouse button is down

// ---------------------------------------------------------------- drawing

function drawBoard() {
  const width = map.rows[0]?.length ?? 0;
  board.width = width * TILE;
  board.height = map.rows.length * TILE;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  map.rows.forEach((row, r) => {
    [...row].forEach((char, c) => {
      const tile = byChar.get(char);
      ctx.fillStyle = char === '.' ? '#1b2019' : tile?.color ?? '#ff00ff'; // magenta = unknown character
      ctx.fillRect(c * TILE, r * TILE, TILE - 1, TILE - 1);
      if (char !== '.') {
        ctx.fillStyle = tile?.group === 'Walls' && char !== 'X' ? '#2a2f28' : '#101411';
        ctx.fillText(char, c * TILE + TILE / 2, r * TILE + TILE / 2 + 1);
      }
    });
  });
}

// Everything on the page that depends on the map is refreshed after each change.
function refresh({ keepText = false } = {}) {
  drawBoard();
  if (!keepText) text.value = mapToText(map);
  nameInput.value = map.name;
  const found = checkMap(map);
  problems.replaceChildren(
    ...(found.length ? found : ['Ready to play!']).map((line) => Object.assign(document.createElement('li'), { textContent: line })),
  );
  problems.classList.toggle('ok', found.length === 0);
  writeJson(storage, KEYS.customMap, map); // keep the work, even if the page is closed
}

function buildPalette() {
  const groups = new Map();
  for (const tile of PALETTE) {
    if (!groups.has(tile.group)) groups.set(tile.group, []);
    groups.get(tile.group).push(tile);
  }
  const sections = [...groups].map(([group, tiles]) => {
    const section = document.createElement('div');
    section.className = 'palette-group';
    const heading = Object.assign(document.createElement('h3'), { textContent: group });
    const buttons = tiles.map((tile) => {
      const button = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'tile-button',
        textContent: `${tile.char}  ${tile.name}`,
        title: tile.name,
      });
      button.setAttribute('aria-pressed', String(tile.char === selected));
      button.addEventListener('click', () => {
        selected = tile.char;
        for (const other of palette.querySelectorAll('.tile-button')) other.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
      });
      return button;
    });
    section.replaceChildren(heading, ...buttons);
    return section;
  });
  palette.replaceChildren(...sections);
}

// ---------------------------------------------------------------- the mouse

function tileUnder(event) {
  const rect = board.getBoundingClientRect();
  // The canvas may be shown smaller than its real size, so scale the mouse position.
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * board.width / TILE);
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * board.height / TILE);
  return { col, row };
}

function paintAt(event) {
  const { col, row } = tileUnder(event);
  const before = map;
  map = paintTile(map, col, row, painting);
  if (map !== before && map.rows[row]?.[col] !== before.rows[row]?.[col]) refresh();
}

board.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  painting = event.button === 2 ? '.' : selected;
  board.setPointerCapture?.(event.pointerId);
  paintAt(event);
});
board.addEventListener('pointermove', (event) => {
  const { col, row } = tileUnder(event);
  const tile = byChar.get(map.rows[row]?.[col]);
  hoverInfo.textContent = tile ? `${col},${row}: ${tile.name.toUpperCase()}` : '';
  if (painting) paintAt(event);
});
board.addEventListener('pointerup', () => {
  painting = null;
});
board.addEventListener('contextmenu', (event) => event.preventDefault());

// ---------------------------------------------------------------- the buttons

nameInput.addEventListener('change', () => {
  map = { ...map, name: nameInput.value.trim() || 'My map' };
  refresh();
});

document.getElementById('apply-text').addEventListener('click', () => {
  try {
    map = textToMap(text.value, map.name);
  } catch (error) {
    problems.replaceChildren(Object.assign(document.createElement('li'), { textContent: error.message }));
    problems.classList.toggle('ok', false);
    return;
  }
  refresh({ keepText: true });
});

// Saves the map as a .map file. Put it in the game's maps/ folder to add it to the game.
document.getElementById('download-map').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([mapToText(map)], { type: 'text/plain' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileNameFor(map) });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById('new-map').addEventListener('click', () => {
  const size = (id) => Math.max(6, Math.min(64, Number(document.getElementById(id).value) || 6));
  map = blankMap(size('new-width'), size('new-height'), map.name);
  refresh();
});

const loadMap = document.getElementById('load-map');
loadMap.replaceChildren(
  Object.assign(document.createElement('option'), { value: '', textContent: 'Choose a map...' }),
  ...MAPS.map((builtIn, index) => Object.assign(document.createElement('option'), { value: String(index), textContent: builtIn.name })),
);
loadMap.addEventListener('change', () => {
  if (loadMap.value === '') return;
  const builtIn = MAPS[Number(loadMap.value)];
  map = { ...builtIn, rows: [...builtIn.rows], name: `My ${builtIn.name}` };
  loadMap.value = '';
  refresh();
});

document.getElementById('play').addEventListener('click', () => {
  if (checkMap(map).length) {
    problems.focus?.();
    return;
  }
  writeJson(storage, KEYS.customMap, map);
  location.href = './?custom';
});

buildPalette();
refresh();
