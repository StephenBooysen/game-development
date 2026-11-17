// The browser side: keyboard and mouse, the menu screens, and the game loop that
// ties the rules (game.js), the picture (render.js) and the sound together.
// It also looks after what is kept between visits: high scores and a saved game.
import { MAPS } from './maps.js';
import { createState, step, carryOver, retryCarry, DIFFICULTIES } from './game.js';
import { createTextures } from './textures.js';
import { createRenderer } from './render.js';
import { readInput, GAME_KEYS } from './input.js';
import { Sound } from './sound.js';
import { browserStorage, readJson, writeJson, remove, KEYS } from './storage.js';
import { recordScore, loadScores, scoreLines } from './scores.js';
import { serializeGame, deserializeGame } from './savegame.js';
import { checkMap } from './editor-core.js';

const MOUSE_SENSITIVITY = 0.0025; // radians turned per pixel of mouse movement

const canvas = document.getElementById('view');
const screen = document.getElementById('screen');
const screenTitle = document.getElementById('screen-title');
const screenText = document.getElementById('screen-text');
const screenStats = document.getElementById('screen-stats');
const screenButtons = document.getElementById('screen-buttons');
const controls = document.getElementById('controls');
const screenKicker = document.getElementById('screen-kicker');
const missionLabel = document.getElementById('mission-label');
const missionStatus = document.getElementById('mission-status');

const textures = createTextures((width, height) => {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  return offscreen;
});
const renderer = createRenderer(canvas, textures);
const sound = new Sound();
const storage = browserStorage();

// The editor sends you here as "index.html?custom" to play the map you just made.
function loadCustomMap() {
  if (!new URLSearchParams(globalThis.location?.search ?? '').has('custom')) return null;
  const map = readJson(storage, KEYS.customMap);
  return map?.rows && checkMap(map).length === 0 ? map : null;
}
const custom = loadCustomMap();
const campaign = custom ? [custom] : MAPS; // the maps this visit plays through
const view = { minimap: true, mapCount: campaign.length };

let difficulty = readJson(storage, KEYS.difficulty, 'normal');
if (!DIFFICULTIES[difficulty]) difficulty = 'normal';
let state = createState(0, { maps: campaign, difficulty });
let mode = 'menu'; // 'menu' (any overlay is showing) or 'playing'
let entryCarry = null; // what the player had when entering this map, for "try again"
let totals = null; // kills, treasure, secrets and time added up over the maps played
let lastFrame = 0;

const held = new Set();
const pressed = new Set();
let look = 0;
let mouseFire = false;

// ---------------------------------------------------------------- screens

function showScreen({ title, text = '', stats = [], buttons, showControls = false, kicker = 'OPERATION: BREAKOUT' }) {
  mode = 'menu';
  held.clear();
  mouseFire = false;
  // Give the mouse pointer back so the buttons can be clicked.
  if (document.pointerLockElement) document.exitPointerLock();
  screenKicker.textContent = kicker;
  missionStatus.textContent = title === 'Castle Noobenstein' ? 'AWAITING DEPLOYMENT' : title.toUpperCase();
  screenTitle.textContent = title;
  screenText.textContent = text;
  screenStats.replaceChildren(...stats.map((line) => Object.assign(document.createElement('li'), { textContent: line })));
  screenButtons.replaceChildren(
    ...buttons.map(([label, action]) => {
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
      button.addEventListener('click', () => {
        sound.unlock();
        action();
      });
      return button;
    }),
  );
  controls.hidden = !showControls;
  screen.hidden = false;
  screenButtons.firstElementChild?.focus();
}

// Pointer lock hides the mouse pointer and reports raw movement, so you can keep
// turning without the pointer leaving the window. Browsers only allow it right
// after a click or key press, and the player can always leave it with Esc.
function lockPointer() {
  try {
    const result = canvas.requestPointerLock?.();
    if (result?.catch) result.catch(() => {}); // refused: the arrow keys still turn
  } catch {
    // Some embedded previews do not allow pointer lock at all.
  }
}

function resume() {
  mode = 'playing';
  screen.hidden = true;
  pressed.clear();
  look = 0;
  missionLabel.textContent = `SECTOR 0${state.mapIndex + 1} / ${state.name.toUpperCase()}`;
  missionStatus.textContent = 'MISSION ACTIVE';
  canvas.focus();
  lockPointer();
}

function startMap(index, carry = null) {
  entryCarry = carry;
  state = createState(index, { carry, difficulty, maps: campaign });
  resume();
}

const TOTAL_KEYS = ['kills', 'enemies', 'treasure', 'treasures', 'secrets', 'secretsTotal'];

function newGame(index) {
  totals = { time: 0 };
  for (const key of TOTAL_KEYS) totals[key] = 0;
  startMap(index);
}

function openEditor() {
  if (globalThis.location) globalThis.location.href = 'editor.html';
}

// The difficulty button steps through easy -> normal -> hard and is remembered.
function cycleDifficulty() {
  const names = Object.keys(DIFFICULTIES);
  difficulty = names[(names.indexOf(difficulty) + 1) % names.length];
  writeJson(storage, KEYS.difficulty, difficulty);
  showTitle();
}

const hasSave = () => !custom && Boolean(readJson(storage, KEYS.save));

function showTitle() {
  state = createState(0, { maps: campaign, difficulty });
  missionLabel.textContent = 'OPERATION: BREAKOUT';
  const buttons = custom
    ? [[`Play your map: ${custom.name}`, () => newGame(0)], ['Back to the map editor', openEditor]]
    : campaign.map((map, index) => [`${index === 0 ? 'Deploy' : 'Skip to'} / 0${index + 1} ${map.name}`, () => newGame(index)]);
  if (hasSave()) buttons.splice(1, 0, ['Continue saved game', loadSavedGame]);
  buttons.push([`Difficulty: ${DIFFICULTIES[difficulty].name}`, cycleDifficulty]);
  if (!custom) buttons.push(['High scores', () => showScores()], ['Map editor', openEditor]);
  showScreen({
    title: 'Castle Noobenstein',
    kicker: custom ? 'CUSTOM MAP' : 'MISSION BRIEFING / 01',
    text: custom
      ? 'Your own map, straight from the editor. Find the exit switch.'
      : 'Break out of the Cell Block, raid the Armory and escape through the Catacombs. Some walls are not what they seem.',
    buttons,
    showControls: true,
  });
}

function showScores(note = '') {
  const lines = scoreLines(loadScores(storage));
  showScreen({
    title: 'High scores',
    kicker: 'HALL OF FAME',
    text: [note, lines.length ? '' : 'No scores yet. Be the first!'].filter(Boolean).join(' '),
    stats: lines,
    buttons: [['Back to title', showTitle]],
  });
}

// ---------------------------------------------------------------- saving

function saveGame() {
  const saved = writeJson(storage, KEYS.save, serializeGame(state, { entryCarry, totals }));
  pause(saved ? 'Game saved. Continue it later from the title screen.' : 'Sorry, this browser would not let the game be saved.');
}

function loadSavedGame() {
  try {
    const loaded = deserializeGame(readJson(storage, KEYS.save));
    state = loaded.state;
    ({ entryCarry, totals } = loaded.extra);
    difficulty = state.difficulty;
    resume();
  } catch (error) {
    remove(storage, KEYS.save);
    showScreen({ title: 'Cannot load', kicker: 'SAVE DAMAGED', text: error.message, buttons: [['Back to title', showTitle]] });
  }
}

function pause(note = '') {
  if (mode !== 'playing' && !note) return;
  const buttons = [['Resume', resume]];
  if (!custom) buttons.push(['Save game', saveGame]);
  if (hasSave()) buttons.push(['Load saved game', loadSavedGame]);
  buttons.push(['Restart this map', () => startMap(state.mapIndex, entryCarry)], ['Quit to title', showTitle]);
  showScreen({
    title: 'Paused',
    kicker: 'MISSION ON HOLD',
    text: note || 'Take a breath. Your mission will be here when you return.',
    buttons,
    showControls: true,
  });
}

// ---------------------------------------------------------------- the end of a map

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function statLines(stats, time, score) {
  const lines = [
    `Enemies defeated: ${stats.kills} of ${stats.enemies}`,
    `Treasure found: ${stats.treasure} of ${stats.treasures}`,
  ];
  if (stats.secretsTotal) lines.push(`Secrets found: ${stats.secrets} of ${stats.secretsTotal}`);
  lines.push(`Time: ${clock(time)}`, `Score: ${score}`);
  return lines;
}

// The run is over (escaped, or no lives left): put it in the high-score table.
function finishRun(escaped) {
  if (custom) return '';
  const rank = recordScore(storage, {
    score: state.player.score,
    time: totals.time + (escaped ? 0 : state.time),
    difficulty: DIFFICULTIES[state.difficulty].name,
    maps: state.mapIndex + 1,
    escaped,
    date: new Date().toISOString().slice(0, 10),
  });
  return rank ? `New high score: number ${rank} in the table!` : '';
}

function onDeath() {
  const carry = retryCarry(state, entryCarry);
  if (carry) {
    showScreen({
      title: 'You died',
      kicker: 'MAN DOWN',
      text: `The guards of the ${state.name} got you. ${carry.lives} ${carry.lives === 1 ? 'life' : 'lives'} left.`,
      stats: statLines(state.stats, state.time, state.player.score),
      buttons: [
        ['Try this map again', () => startMap(state.mapIndex, carry)],
        ['Quit to title', showTitle],
      ],
    });
    return;
  }
  const highScore = finishRun(false);
  showScreen({
    title: 'Game over',
    kicker: 'MISSION FAILED',
    text: ['No lives left. The castle keeps its secrets.', highScore].filter(Boolean).join(' '),
    stats: statLines(state.stats, state.time, state.player.score),
    buttons: [
      ['Back to title', showTitle],
      ...(custom ? [] : [['High scores', () => showScores()]]),
    ],
  });
}

function onMapComplete() {
  for (const key of TOTAL_KEYS) totals[key] += state.stats[key];
  totals.time += state.time;
  const next = state.mapIndex + 1;
  if (next < campaign.length) {
    const carry = carryOver(state);
    showScreen({
      title: `${state.name} cleared`,
      kicker: 'SECTOR SECURED',
      text: 'The elevator hums. Your health, bullets, guns and lives come with you.',
      stats: statLines(state.stats, state.time, state.player.score),
      buttons: [[`Ride the elevator to map ${next + 1}: ${campaign[next].name}`, () => startMap(next, carry)]],
    });
    return;
  }
  const highScore = finishRun(true);
  showScreen({
    title: custom ? 'Map cleared!' : 'You escaped!',
    kicker: 'MISSION ACCOMPLISHED',
    text: [custom ? 'You beat your own map.' : 'The castle is behind you. Level complete.', highScore].filter(Boolean).join(' '),
    stats: statLines(totals, totals.time, state.player.score),
    buttons: [
      ['Play again', showTitle],
      ...(custom ? [['Back to the map editor', openEditor]] : [['High scores', () => showScores()]]),
    ],
  });
}

// ---------------------------------------------------------------- input

window.addEventListener('keydown', (event) => {
  sound.unlock();
  if (mode !== 'playing') return; // let Tab, Enter and Space work the menu buttons
  if (event.code === 'Escape' || event.code === 'KeyP') {
    pause();
    return;
  }
  if (!GAME_KEYS.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault(); // otherwise Space and the arrow keys would scroll the page
  held.add(event.code);
  if (event.repeat) return; // holding a key down sends repeats; only the first counts as a press
  pressed.add(event.code);
  if (event.code === 'KeyM') view.minimap = !view.minimap;
  if (event.code === 'KeyN') sound.toggle();
});

window.addEventListener('keyup', (event) => held.delete(event.code));

// If the window loses focus, key-up events never arrive, so forget what was held.
window.addEventListener('blur', () => {
  held.clear();
  mouseFire = false;
  pause(); // do not leave the player exposed while another window has focus
});

canvas.addEventListener('mousedown', (event) => {
  if (mode !== 'playing' || event.button !== 0) return;
  sound.unlock();
  if (document.pointerLockElement !== canvas) lockPointer();
  mouseFire = true;
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) mouseFire = false;
});

document.addEventListener('mousemove', (event) => {
  if (mode === 'playing' && document.pointerLockElement === canvas) look += event.movementX * MOUSE_SENSITIVITY;
});

canvas.addEventListener('wheel', (event) => {
  if (mode !== 'playing') return;
  event.preventDefault();
  pressed.add('KeyQ'); // the wheel does the same as Q: next weapon
}, { passive: false });

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

// Pressing Esc makes the browser release the mouse; treat that as "pause".
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) pause();
});

// ---------------------------------------------------------------- the game loop

// The browser calls frame() before every repaint, usually 60 times a second.
// Each call advances the game by the time that really passed (dt) and redraws,
// so the game runs at the same speed on a fast and a slow computer.
function frame(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (mode === 'playing') {
    step(state, readInput({ held, pressed, look, mouseFire }), dt);
    pressed.clear();
    look = 0;
    for (const event of state.events) sound.play(event);
    state.events.length = 0;
    if (state.status === 'dead') onDeath();
    else if (state.status === 'complete') onMapComplete();
  }
  renderer.draw(state, view);
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame((now) => {
  lastFrame = now;
  frame(now);
});
