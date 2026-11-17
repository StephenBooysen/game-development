import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fakeCanvas } from './helpers.js';
import { memoryStorage, readJson, KEYS } from '../public/storage.js';

// Like app.test.js: a minimal pretend DOM, enough to check that the editor page's
// wiring works (painting, buttons, saving the map) without a real browser.
test('the editor paints tiles, checks the map and sends it to the game', async (t) => {
  const html = await readFile(new URL('../public/editor.html', import.meta.url), 'utf8');
  function element(tag = 'div') {
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    return {
      tag, textContent: '', value: '', children: [],
      classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: (name) => classes.has(name) },
      addEventListener(type, callback) { listeners.set(type, callback); },
      emit(type, event = {}) { listeners.get(type)?.({ preventDefault() {}, ...event }); },
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name); },
      replaceChildren(...children) { this.children = children; },
      querySelectorAll(selector) {
        const found = [];
        const walk = (node) => {
          for (const child of node.children || []) {
            if (selector === `.${child.className}`) found.push(child);
            walk(child);
          }
        };
        walk(this);
        return found;
      },
    };
  }
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  const board = Object.assign(elements.get('board'), fakeCanvas());
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width: board.width, height: board.height });
  elements.get('new-width').value = '10';
  elements.get('new-height').value = '8';
  const storage = memoryStorage();
  const location = { href: 'editor.html' };
  const document = {
    getElementById(id) {
      assert.ok(elements.has(id), `the page contains #${id}`);
      return elements.get(id);
    },
    createElement: (tag) => element(tag),
  };
  for (const [key, value] of Object.entries({ document, localStorage: storage, location })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  await import('../public/editor.js');
  const get = (id) => elements.get(id);
  const problems = () => get('problems').children.map((item) => item.textContent);

  // It starts from map 1, which is ready to play, and shows it as text.
  assert.deepEqual(problems(), ['Ready to play!']);
  assert.match(get('map-text').value, /^name: My map\nfacing: east\n[\s\S]*\n\n#{24}\n#\.\.a#/);
  assert.equal(board.width, 24 * 24);
  const tileButtons = get('palette').querySelectorAll('.tile-button');
  assert.ok(tileButtons.length > 25);

  // A new 10x8 room has no exit yet.
  get('new-map').emit('click');
  assert.equal(board.width, 10 * 24);
  assert.deepEqual(problems(), ['There is no exit switch (X).']);
  get('play').emit('click');
  assert.equal(location.href, 'editor.html', 'a broken map is not played');

  // Pick the exit switch and paint it on the right-hand wall (tile 9,3).
  tileButtons.find((button) => button.textContent.startsWith('X')).emit('click');
  get('board').emit('pointerdown', { button: 0, clientX: 9 * 24 + 5, clientY: 3 * 24 + 5 });
  get('board').emit('pointerup');
  assert.deepEqual(problems(), ['Ready to play!']);
  assert.equal(readJson(storage, KEYS.customMap).rows[3][9], 'X', 'the work is kept in the browser');

  // Right-click erases (back to floor).
  get('board').emit('pointerdown', { button: 2, clientX: 9 * 24 + 5, clientY: 3 * 24 + 5 });
  get('board').emit('pointerup');
  assert.deepEqual(problems(), ['The outside edge must be all walls. Open at: 9,3', 'There is no exit switch (X).']);

  // Editing the text and pressing "Use this text" replaces the map.
  get('map-text').value = '#####\n#P.X#\n#####';
  get('apply-text').emit('click');
  assert.deepEqual(problems(), ['Ready to play!']);
  get('play').emit('click');
  assert.equal(location.href, './?custom');
  assert.deepEqual(readJson(storage, KEYS.customMap).rows, ['#####', '#P.X#', '#####']);

  // A typo in a setting is reported instead of breaking the map.
  get('map-text').value = 'flor: #000\n#####\n#P.X#\n#####';
  get('apply-text').emit('click');
  assert.match(problems()[0], /unknown setting "flor"/);
  assert.deepEqual(readJson(storage, KEYS.customMap).rows, ['#####', '#P.X#', '#####'], 'the last good map is kept');
});
