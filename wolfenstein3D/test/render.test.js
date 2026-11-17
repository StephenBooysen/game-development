import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../public/game.js';
import { createTextures, POSES, DOG_POSES } from '../public/textures.js';
import { createRenderer, cameraFor, weaponSway, hitSide, SCREEN_WIDTH, SCREEN_HEIGHT } from '../public/render.js';
import { floorTexture, FLOOR_NAMES, FLOOR_SIZE, SHADES } from '../public/floors.js';
import { fakeCanvas, testState, place, run, HALL_GUARD } from './helpers.js';

// A renderer drawing onto a pretend canvas, which also notes which sprites were asked for.
function setup() {
  const textures = createTextures(fakeCanvas);
  const used = new Set();
  const spy = {
    wall: textures.wall,
    sprite(name) {
      used.add(name);
      return textures.sprite(name);
    },
  };
  const canvas = fakeCanvas();
  return { canvas, used, renderer: createRenderer(canvas, spy) };
}

const countOf = (canvas, method) => canvas.calls.filter(([name]) => name === method).length;

test('textures are painted once and then reused', () => {
  const textures = createTextures(fakeCanvas);
  assert.equal(textures.wall('stone'), textures.wall('stone'));
  assert.notEqual(textures.wall('stone'), textures.wall('stone', true));
  assert.equal(textures.sprite('medkit'), textures.sprite('medkit'));
  assert.equal(textures.sprite('medkit').width, 64);
  assert.equal(textures.sprite('view.pistol.fire').width, 96);
});

test('every wall, soldier pose, item and weapon picture can be painted', () => {
  const textures = createTextures(fakeCanvas);
  for (const wall of ['stone', 'blueStone', 'wood', 'brick', 'moss', 'stoneFlag', 'door', 'doorLocked', 'exit']) {
    assert.ok(textures.wall(wall).calls.length > 5, wall);
  }
  for (const who of ['guard', 'ss', 'boss']) {
    for (const pose of POSES) {
      assert.ok(textures.sprite(`${who}.${pose}`).calls.length > 3, `${who}.${pose}`);
      assert.ok(textures.sprite(`${who}.${pose}Back`).calls.length > 3, `${who}.${pose}Back`);
    }
  }
  for (const pose of DOG_POSES) {
    assert.ok(textures.sprite(`dog.${pose}`).calls.length > 3, `dog.${pose}`);
    assert.ok(textures.sprite(`dog.${pose}Back`).calls.length > 3, `dog.${pose}Back`);
  }
  for (const item of ['medkit', 'food', 'ammo', 'clip', 'machinegun', 'chaingun', 'key', 'treasure', 'oneup', 'barrel', 'pillar', 'lamp', 'puff', 'blood']) {
    assert.ok(textures.sprite(item).calls.length > 1, item);
  }
  for (const weapon of ['knife', 'pistol', 'machinegun', 'chaingun']) {
    assert.ok(textures.sprite(`view.${weapon}.fire`).calls.length >= textures.sprite(`view.${weapon}`).calls.length, weapon);
  }
});

test('the renderer sizes the canvas and draws a wall slice for every screen column', () => {
  const { canvas, renderer } = setup();
  assert.deepEqual([canvas.width, canvas.height], [SCREEN_WIDTH, SCREEN_HEIGHT]);
  renderer.draw(testState());
  assert.ok(countOf(canvas, 'drawImage') >= SCREEN_WIDTH);
  assert.ok(renderer.depths.every((depth) => depth > 0 && depth < 30));
});

test('the camera stays at the player eyes in open rooms and beside walls', () => {
  for (const state of [place(testState(), 14.5, 6.5, 1.2), testState()]) {
    const camera = cameraFor(state);
    assert.equal(camera.x, state.player.x);
    assert.equal(camera.y, state.player.y);
    assert.equal(camera.angle, state.player.angle);
    assert.equal(camera.height, 0.5);
  }
});

test('the default view shows a held weapon and never a player body', () => {
  const { used, renderer } = setup();
  renderer.draw(place(testState(), 14.5, 6.5));
  renderer.draw(testState());
  assert.ok(used.has('view.pistol'));
  assert.ok(![...used].some((name) => name.startsWith('player.')));
});

test('first-person view shows the held weapon and its muzzle flash', () => {
  const state = place(testState(), 14.5, 6.5);
  const { used, renderer } = setup();
  renderer.draw(state);
  assert.ok(used.has('view.pistol'));
  run(state, step, 1 / 60, { fire: true });
  renderer.draw(state);
  assert.ok(used.has('view.pistol.fire'));
});

test('guards are drawn in the pose that matches what they are doing', () => {
  const state = place(testState(0, { keep: [HALL_GUARD], random: () => 0 }), 5.5, 5.5);
  const { used, renderer } = setup();
  for (let i = 0; i < 180; i++) {
    step(state, {}, 1 / 60);
    renderer.draw(state);
  }
  assert.ok(used.has('guard.stand'), 'standing, facing us');
  assert.ok(used.has('guard.aim'));
  assert.ok(used.has('guard.fire'));

  state.enemies[0].health = 1;
  place(state, 5.5, 5.5);
  for (let i = 0; i < 60; i++) {
    step(state, { fire: true }, 1 / 60);
    renderer.draw(state);
  }
  assert.ok(used.has('guard.dying') && used.has('guard.dead'));
  assert.ok(used.has('clip'), 'the dropped clip is drawn');
});

test('a guard with its back to the camera is drawn from behind', () => {
  const state = place(testState(0, { keep: [HALL_GUARD] }), 10.5, 5.5, Math.PI); // east of the guard, looking west at its back
  state.enemies[0].x = 6.5;
  const { used, renderer } = setup();
  renderer.draw(state);
  assert.ok(used.has('guard.standBack'));
});

test('the crosshair stays centred at both near and far wall distances', () => {
  for (const state of [testState(), place(testState(), 14.5, 6.5)]) {
    const { canvas, renderer } = setup();
    renderer.draw(state);
    const x = SCREEN_WIDTH / 2;
    const y = cameraFor(state).horizon;
    for (const rect of [[x - 6, y, 4, 1], [x + 3, y, 4, 1], [x, y - 6, 1, 4], [x, y + 3, 1, 4]]) {
      assert.ok(canvas.calls.some(([name, ...args]) => name === 'fillRect' && JSON.stringify(args) === JSON.stringify(rect)));
    }
  }
});

test('all four weapons are visible in first person and hidden after death', () => {
  for (const weapon of ['knife', 'pistol', 'machinegun', 'chaingun']) {
    const state = testState();
    state.player.weapon = weapon;
    const { used, renderer } = setup();
    renderer.draw(state);
    assert.ok(used.has(`view.${weapon}`));
    used.clear();
    state.status = 'dead';
    renderer.draw(state);
    assert.ok(![...used].some((name) => name.startsWith('view.')));
  }
});

test('low health has a text warning as well as a coloured gauge', () => {
  const state = testState();
  state.player.health = 20;
  const { canvas, renderer } = setup();
  renderer.draw(state);
  const texts = canvas.calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
  assert.ok(texts.includes('CRITICAL'));
  assert.ok(texts.includes('20%'));
  assert.ok(canvas.calls.some(([name, x, y, width, height]) => name === 'fillRect' && x === 160 && width === 12.4 && height === 2));
});

test('the status bar shows health, ammo and the weapon, and the minimap can be turned off', () => {
  const state = testState();
  state.player.health = 42;
  const { canvas, renderer } = setup();
  renderer.draw(state, { minimap: false });
  const texts = canvas.calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
  for (const text of ['1/3', '42%', '16', 'PISTOL', 'HEALTH', 'LIVES', '3']) assert.ok(texts.includes(text), text);
  const without = countOf(canvas, 'fillRect');
  canvas.calls.length = 0;
  renderer.draw(state, { minimap: true });
  assert.ok(countOf(canvas, 'fillRect') > without + 100, 'the minimap adds a square per wall');
});

test('dog art stays inside its sprite, and from behind it is the same dog mirrored', () => {
  const textures = createTextures(fakeCanvas);
  for (const pose of DOG_POSES) {
    for (const back of ['', 'Back']) {
      for (const [method, x, y, w, h] of textures.sprite(`dog.${pose}${back}`).calls) {
        if (method === 'fillRect') assert.ok(x >= 0 && y >= 0 && x + w <= 64 && y + h <= 64, `dog.${pose}${back}`);
      }
    }
  }
  const rects = (name) => textures.sprite(name).calls.filter(([method]) => method === 'fillRect');
  const front = rects('dog.stand');
  const behind = rects('dog.standBack');
  assert.equal(front.length, behind.length);
  front.forEach(([, x, y, w, h], i) => assert.deepEqual(behind[i].slice(1), [64 - x - w, y, w, h]));
});

test('a biting dog is drawn with its jaws open', () => {
  const state = place(testState(2, { keep: [0] }), 6.5, 2.5, 0);
  state.enemies[0].state = 'bite';
  const { used, renderer } = setup();
  renderer.draw(state);
  assert.ok(used.has('dog.bite'));
});

test('every floor pattern has 16 shades, each darker than the last', () => {
  for (const name of FLOOR_NAMES) {
    const shades = floorTexture(name);
    assert.equal(shades.length, SHADES);
    assert.ok(shades.every((pixels) => pixels.length === FLOOR_SIZE * FLOOR_SIZE));
    const red = (pixel) => pixel & 0xff;
    const total = (pixels) => pixels.reduce((sum, pixel) => sum + red(pixel), 0);
    assert.ok(total(shades[0]) > total(shades[8]) && total(shades[8]) > total(shades[15]), name);
    assert.ok(shades[0].every((pixel) => pixel >>> 24 === 255), 'fully opaque');
  }
  assert.equal(floorTexture('stone'), null, 'unknown patterns fall back to flat colours');
  assert.equal(floorTexture('dirt'), floorTexture('dirt'), 'made once and reused');
});

test('textured floors and ceilings are cast into a block of pixels', () => {
  const { canvas, renderer } = setup();
  const state = testState();
  renderer.draw(state);
  const put = canvas.calls.find(([name]) => name === 'putImageData');
  assert.ok(put, 'the pixels were put on the canvas');
  const pixels = new Uint32Array(put[1].data.buffer);
  assert.ok(pixels.every((pixel) => pixel !== 0), 'every pixel of floor and ceiling was filled');
  const floor = floorTexture('flagstone');
  const ceiling = floorTexture('plaster');
  const bottom = pixels[pixels.length - SCREEN_WIDTH / 2]; // right under your feet
  const top = pixels[SCREEN_WIDTH / 2];
  assert.ok(floor[0].includes(bottom), 'the bottom row is the floor at full brightness');
  assert.ok(ceiling.some((shade) => shade.includes(top)), 'the top row is the ceiling');

  // A map without patterns (from the editor) keeps the flat colours.
  const plain = setup();
  state.floorTexture = null;
  plain.renderer.draw(state);
  assert.ok(!plain.canvas.calls.some(([name]) => name === 'putImageData'));
});

test('the weapon sways side to side and bobs while walking, and is still when standing', () => {
  assert.deepEqual(weaponSway({ speed: 0, walked: 3 }), { sway: 0, bob: 0 });
  const swings = [0.3, 0.9].map((walked) => weaponSway({ speed: 3, walked }));
  assert.ok(swings[0].sway > 0 && swings[1].sway > 0 && swings[0].bob > 0);
  assert.ok(weaponSway({ speed: 3, walked: 1.6 }).sway < 0, 'and then the other way');
});

test('the red edge shows which side a hit came from', () => {
  const at = (hitAngle) => hitSide({ angle: 0, hitAngle });
  assert.equal(at(0.2), 'front');
  assert.equal(at(Math.PI / 2), 'right', 'facing east, south is on your right');
  assert.equal(at(-Math.PI / 2), 'left');
  assert.equal(at(Math.PI), 'behind');
  assert.equal(hitSide({ angle: Math.PI, hitAngle: -Math.PI + 0.1 }), 'front', 'works across the -PI/PI seam');

  const state = testState();
  Object.assign(state.player, { hurt: 1, hitAngle: Math.PI / 2 });
  const { canvas, renderer } = setup();
  renderer.draw(state);
  const reds = canvas.calls.filter(([name, x, , w]) => name === 'fillRect' && w === 4 && x >= SCREEN_WIDTH - 24);
  assert.equal(reds.length, 6, 'six fading bands down the right edge');
  assert.ok(!canvas.calls.some(([name, x, , w]) => name === 'fillRect' && w === 4 && x === 0), 'none on the left');
});
