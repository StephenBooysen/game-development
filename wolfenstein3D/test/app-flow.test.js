import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fakeCanvas } from './helpers.js';
import { createState } from '../public/game.js';
import { serializeGame } from '../public/savegame.js';
import { memoryStorage, readJson, writeJson, KEYS } from '../public/storage.js';

// The same pretend page as app.test.js, this time with localStorage, to follow a run
// through saving, loading, losing lives, game over and the high-score table.
// A saved game is a convenient way to put the game into any situation: save a
// state where the player has just died (or won) and load it.
test('lives, game over, victory, saving and high scores work from the menus', async (t) => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  function element() {
    const listeners = new Map();
    return {
      textContent: '', hidden: false, children: [],
      addEventListener(type, callback) { listeners.set(type, callback); },
      emit(type, event = {}) { listeners.get(type)?.(event); },
      replaceChildren(...children) { this.children = children; },
      get firstElementChild() { return this.children[0]; },
      focus() {},
    };
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  const canvas = Object.assign(elements.get('view'), fakeCanvas());
  const document = Object.assign(element(), {
    pointerLockElement: null,
    getElementById: (id) => elements.get(id),
    createElement(tag) { return tag === 'canvas' ? fakeCanvas() : element(); },
    exitPointerLock() { this.pointerLockElement = null; },
  });
  canvas.requestPointerLock = () => { document.pointerLockElement = canvas; };
  const storage = memoryStorage();
  const window = element();
  let frame;
  const globals = { document, window, localStorage: storage, location: { search: '', href: '' }, requestAnimationFrame: (callback) => { frame = callback; } };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  await import('../public/app.js');
  const get = (id) => elements.get(id);
  const title = () => get('screen-title').textContent;
  const labels = () => get('screen-buttons').children.map((button) => button.textContent);
  const click = (label) => {
    const button = get('screen-buttons').children.find((b) => b.textContent === label);
    assert.ok(button, `there is a "${label}" button (have: ${labels().join(', ')})`);
    button.emit('click');
  };
  let now = 0;
  const tick = () => frame((now += 16));

  // Save from the pause menu; the title then offers to continue.
  click('Deploy / 01 Cell Block');
  tick();
  window.emit('keydown', { code: 'KeyP' });
  click('Save game');
  assert.match(get('screen-text').textContent, /Game saved/);
  assert.ok(labels().includes('Load saved game'));
  click('Quit to title');
  assert.equal(labels()[1], 'Continue saved game');
  click('Continue saved game');
  assert.equal(get('screen').hidden, true);
  assert.match(get('mission-label').textContent, /CELL BLOCK/);

  // A death with lives to spare: "try again" costs a life.
  const plant = (state, totals = { time: 60, kills: 3, enemies: 10, treasure: 1, treasures: 4, secrets: 1, secretsTotal: 2 }) => {
    writeJson(storage, KEYS.save, serializeGame(state, { entryCarry: null, totals }));
    window.emit('keydown', { code: 'KeyP' });
    click('Load saved game');
    tick();
  };
  const dying = createState(0);
  dying.status = 'dead';
  plant(dying);
  assert.equal(title(), 'You died');
  assert.match(get('screen-text').textContent, /2 lives left/);
  click('Try this map again');
  assert.equal(get('screen').hidden, true);

  // Losing the last life is game over, and the score goes in the table.
  const last = createState(1, { carry: { lives: 1, score: 4321 } });
  last.status = 'dead';
  plant(last);
  assert.equal(title(), 'Game over');
  assert.match(get('screen-text').textContent, /New high score: number 1/);
  click('High scores');
  assert.match(get('screen-stats').children[0].textContent, /^1\. 4321 pts .* Normal \/ reached map 2/);
  click('Back to title');

  // Escaping from the last map is a victory, with secrets in the totals.
  click('Deploy / 01 Cell Block');
  tick();
  const won = createState(2, { carry: { score: 9999, difficulty: 'hard' } });
  won.status = 'complete';
  plant(won);
  assert.equal(title(), 'You escaped!');
  assert.ok(get('screen-stats').children.some((item) => /Secrets found: 1 of 3/.test(item.textContent)));
  const scores = readJson(storage, KEYS.scores);
  assert.deepEqual(scores.map((s) => [s.score, s.difficulty, s.escaped]), [[9999, 'Hard', true], [4321, 'Normal', false]]);

  // A damaged save is reported and thrown away.
  click('Play again');
  storage.setItem(KEYS.save, '"garbage"');
  click('Continue saved game');
  assert.equal(title(), 'Cannot load');
  click('Back to title');
  assert.ok(!labels().includes('Continue saved game'));
});
