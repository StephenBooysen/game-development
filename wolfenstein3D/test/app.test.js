import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fakeCanvas } from './helpers.js';

// A minimal DOM exercises the menu wiring without needing a browser or a GPU.
// Layout and visual appearance still need a real-browser check.
test('briefing, deployment, pause, resume and map selection stay connected', async (t) => {
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
    getElementById(id) {
      assert.ok(elements.has(id), `the page contains #${id}`);
      return elements.get(id);
    },
    createElement(tag) { return tag === 'canvas' ? fakeCanvas() : element(); },
    exitPointerLock() { this.pointerLockElement = null; },
  });
  canvas.requestPointerLock = () => { document.pointerLockElement = canvas; };
  const window = element();
  let frame;
  for (const [key, value] of Object.entries({ document, window, requestAnimationFrame: (callback) => { frame = callback; } })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  await import('../public/app.js');
  const get = (id) => elements.get(id);
  const clickButton = (index) => get('screen-buttons').children[index].emit('click');
  const labels = () => get('screen-buttons').children.map((button) => button.textContent);
  assert.equal(get('screen-title').textContent, 'Castle Noobenstein');
  assert.deepEqual(labels(), [
    'Deploy / 01 Cell Block', 'Skip to / 02 The Armory', 'Skip to / 03 The Catacombs',
    'Difficulty: Normal', 'High scores', 'Map editor',
  ]);
  assert.equal(get('controls').hidden, false);
  assert.equal(get('mission-status').textContent, 'AWAITING DEPLOYMENT');
  assert.doesNotMatch(html, /third.person|<kbd>V<\/kbd>/i);

  clickButton(0);
  assert.equal(get('screen').hidden, true);
  assert.match(get('mission-label').textContent, /CELL BLOCK/);
  assert.equal(get('mission-status').textContent, 'MISSION ACTIVE');
  frame(0);
  frame(16);
  // V must not change the camera or consume the browser's key event.
  window.emit('keydown', { code: 'KeyV', preventDefault() { assert.fail('V is not a game key'); } });
  window.emit('keydown', { code: 'KeyP' });
  assert.equal(get('screen').hidden, false);
  assert.equal(get('screen-title').textContent, 'Paused');
  assert.deepEqual(labels(), ['Resume', 'Save game', 'Restart this map', 'Quit to title']);
  clickButton(0);
  assert.equal(get('screen').hidden, true);
  window.emit('blur');
  assert.equal(get('screen-title').textContent, 'Paused');
  assert.equal(get('screen').hidden, false);
  clickButton(3);
  assert.equal(get('screen-title').textContent, 'Castle Noobenstein');

  // The difficulty button steps round normal -> hard -> easy -> normal.
  clickButton(3);
  assert.equal(labels()[3], 'Difficulty: Hard');
  clickButton(3);
  assert.equal(labels()[3], 'Difficulty: Easy');
  clickButton(3);
  assert.equal(labels()[3], 'Difficulty: Normal');

  clickButton(4);
  assert.equal(get('screen-title').textContent, 'High scores');
  clickButton(0);
  assert.equal(get('screen-title').textContent, 'Castle Noobenstein');
  clickButton(1);
  assert.match(get('mission-label').textContent, /THE ARMORY/);
  frame(32);
  assert.equal(get('screen').hidden, true);
});
