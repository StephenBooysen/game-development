import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextures } from '../public/textures.js';
import { fakeCanvas } from './helpers.js';

// Replay the flat pixel rectangles so tests check what remains visible after
// overlapping body, weapon, hands and flash layers have all been painted.
function pixels(canvas) {
  const result = new Map();
  let color;
  for (const [method, ...args] of canvas.calls) {
    if (method === 'set fillStyle') color = args[0];
    if (method !== 'fillRect') continue;
    const [x, y, width, height] = args;
    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        assert.ok(col >= 0 && col < canvas.width && row >= 0 && row < canvas.height, 'art stays inside the sprite');
        result.set(`${col},${row}`, color);
      }
    }
  }
  return result;
}

for (const who of ['guard', 'ss', 'boss']) {
  test(`${who} holds a visible gun in idle, walking, aiming and firing poses`, () => {
    const textures = createTextures(fakeCanvas);
    for (const pose of ['stand', 'walk1', 'walk2', 'aim', 'fire', 'pain', 'dying']) {
      for (const back of ['', 'Back']) {
        const image = pixels(textures.sprite(`${who}.${pose}${back}`));
        const y = (['aim', 'fire'].includes(pose) ? 26 : 35) + (pose === 'dying' ? 16 : pose === 'pain' ? 2 : 0);
        const muzzle = who === 'guard' ? 50 : 55;
        assert.equal(image.get(`38,${y - 1}`), '#9aa9ad', 'metal slide remains visible');
        assert.equal(image.get(`${muzzle},${y + 1}`), '#080b0e', 'barrel tip is outside the body');
        assert.equal(image.get(`35,${y + 6}`), '#e0ac7d', 'trigger hand grips the weapon');
        assert.equal(image.get(`45,${y + (who === 'boss' ? 9 : 5)}`), '#e0ac7d', 'other hand supports the weapon');
      }
    }
  });

  test(`${who} muzzle flash starts at the barrel rather than the chest`, () => {
    const textures = createTextures(fakeCanvas);
    const muzzle = who === 'guard' ? 50 : 55;
    for (const back of ['', 'Back']) {
      const aiming = pixels(textures.sprite(`${who}.aim${back}`));
      const firing = pixels(textures.sprite(`${who}.fire${back}`));
      const flashColors = new Set(['#fff3a0', '#ffb020', '#ffffff']);
      const flash = [...firing].filter(([, color]) => flashColors.has(color));
      assert.ok(flash.length > 0);
      for (const [key] of flash) {
        const [x, y] = key.split(',').map(Number);
        assert.ok(x >= muzzle + 1 && x <= muzzle + 7 && y >= 24 && y <= 32, 'flash stays next to the muzzle');
      }
      assert.equal(firing.get(`${muzzle + 2},28`), '#ffffff', 'bright flash core meets the barrel');
      assert.ok(![...aiming.values()].some((color) => flashColors.has(color)), 'no flash while aiming');
      for (const [key, color] of aiming) {
        if (Number(key.split(',')[0]) <= muzzle) assert.equal(firing.get(key), color, 'firing does not cover the gun or chest');
      }
    }
  });
}
