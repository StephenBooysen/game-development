import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEET,
  FUEL_MAX,
  LEVELS,
  MOON_GRAVITY,
  PLATFORMS,
  PLATFORMS_PER_LEVEL,
  REFUEL,
  THRUST,
  WORLD,
  buildTerrain,
  createGame,
  difficulty,
  groundHeight,
  retry,
  step,
} from './public/physics.js';

const terrain = buildTerrain();
const opts = { terrain };
const idle = { left: false, right: false, thrust: false };
const flying = (lander, extra = {}) => ({ ...createGame(), status: 'flying', lander, ...extra });

test('the game starts parked on platform 1 with a full tank', () => {
  const game = createGame();
  assert.equal(game.status, 'landed');
  assert.equal(game.fuel, FUEL_MAX);
  assert.deepEqual(game.visited, [1]);
});

test('there are 100 platforms in 10 levels, laid out left to right without overlapping', () => {
  assert.equal(PLATFORMS.length, 100);
  assert.equal(LEVELS * PLATFORMS_PER_LEVEL, 100);
  PLATFORMS.forEach((p, i) => {
    assert.equal(p.id, i + 1);
    assert.equal(p.level, Math.floor(i / PLATFORMS_PER_LEVEL) + 1);
    if (i > 0) assert.ok(p.x > PLATFORMS[i - 1].x + PLATFORMS[i - 1].width);
  });
  const last = PLATFORMS[PLATFORMS.length - 1];
  assert.ok(last.x + last.width < WORLD.width);
});

test('later levels have smaller pads, longer hops and taller rocks', () => {
  const easy = difficulty(1);
  const hard = difficulty(LEVELS);
  assert.ok(hard.padWidth < easy.padWidth);
  assert.ok(hard.gapMin > easy.gapMax);
  assert.ok(hard.peak > easy.peak);
  // Even the smallest pad has room for both feet.
  assert.ok(hard.padWidth > FEET[1].x - FEET[0].x);
  assert.equal(PLATFORMS[0].width, easy.padWidth);
  assert.equal(PLATFORMS[99].width, hard.padWidth);
});

test('the terrain is flat across every platform', () => {
  for (const p of PLATFORMS) {
    assert.equal(groundHeight(terrain, p.x + 1), p.y);
    assert.equal(groundHeight(terrain, p.x + p.width - 1), p.y);
  }
});

test('the lander falls with lunar gravity', () => {
  let game = flying({ x: 50, y: 140, vx: 0, vy: 0, angle: 0 });
  for (let i = 0; i < 100; i++) game = step(game, idle, 0.01, opts);
  assert.ok(Math.abs(game.lander.vy + MOON_GRAVITY) < 1e-9);
});

test('holding space lifts off and burns fuel', () => {
  let game = createGame();
  for (let i = 0; i < 50; i++) game = step(game, { ...idle, thrust: true }, 0.01, opts);
  assert.equal(game.status, 'flying');
  assert.ok(game.lander.vy > 0);
  assert.ok(game.fuel < FUEL_MAX);
});

test('the arrow keys rotate the lander, and thrust then pushes sideways', () => {
  let game = flying({ x: 50, y: 140, vx: 0, vy: 0, angle: 0 });
  for (let i = 0; i < 20; i++) game = step(game, { ...idle, right: true }, 0.01, opts);
  assert.ok(game.lander.angle > 0);
  game = step(game, { ...idle, thrust: true }, 0.1, opts);
  assert.ok(game.lander.vx > 0);
});

test('no fuel means no thrust', () => {
  const game = step(flying({ x: 50, y: 140, vx: 0, vy: 0, angle: 0 }, { fuel: 0 }), { ...idle, thrust: true }, 0.1, opts);
  assert.equal(game.thrusting, false);
  assert.ok(game.lander.vy < 0);
});

test('a gentle touchdown on a new platform lands and refuels', () => {
  const pad = PLATFORMS[1];
  const game = step(flying({ x: pad.x + pad.width / 2, y: pad.y + 3.61, vx: 0, vy: -1, angle: 0 }, { fuel: 30 }), idle, 0.02, opts);
  assert.equal(game.status, 'landed');
  assert.equal(game.platformId, pad.id);
  assert.deepEqual(game.visited, [1, pad.id]);
  assert.ok(Math.abs(game.fuel - (30 + REFUEL)) < 1e-9);
  assert.deepEqual(game.checkpoint, { platformId: pad.id, fuel: game.fuel });
});

test('after a crash, retry goes back to the last new platform with the fuel from then', () => {
  const pad = PLATFORMS[4];
  const checkpoint = { platformId: pad.id, fuel: 64 };
  const next = PLATFORMS[5];
  const lander = { x: next.x + next.width / 2, y: next.y + 3.65, vx: 0, vy: -6, angle: 0 }; // far too fast
  const crashed = step(flying(lander, { fuel: 5, visited: [1, 2, 3, 4, 5], checkpoint }), idle, 0.02, opts);
  assert.equal(crashed.status, 'crashed');
  assert.match(crashed.message, /Press R to retry/);

  const game = retry(crashed);
  assert.equal(game.status, 'landed');
  assert.equal(game.platformId, pad.id);
  assert.equal(game.lander.x, pad.x + pad.width / 2);
  assert.equal(game.fuel, 64);
  assert.deepEqual(game.visited, [1, 2, 3, 4, 5]);
});

test('after a win, retry starts a new game', () => {
  assert.deepEqual(retry({ ...createGame(), status: 'won', visited: PLATFORMS.map((p) => p.id) }), createGame());
});

test('a hard or tilted touchdown crashes', () => {
  const pad = PLATFORMS[1];
  const x = pad.x + pad.width / 2;
  const hard = step(flying({ x, y: pad.y + 3.65, vx: 0, vy: -6, angle: 0 }), idle, 0.02, opts);
  assert.equal(hard.status, 'crashed');
  const tilted = step(flying({ x, y: pad.y + 3.61, vx: 0, vy: -1, angle: 25 }), idle, 0.02, opts);
  assert.equal(tilted.status, 'crashed');
});

test('landing off the platforms crashes', () => {
  const x = (PLATFORMS[0].x + PLATFORMS[0].width + PLATFORMS[1].x) / 2; // between platforms 1 and 2
  const game = step(flying({ x, y: groundHeight(terrain, x) + 3.61, vx: 0, vy: -0.5, angle: 0 }), idle, 0.02, opts);
  assert.equal(game.status, 'crashed');
});

// Flat ground at 10 m with one thin spike of rock, 20 m tall, at x = 50. No platforms.
const spike = {
  terrain: [{ x: 0, y: 10 }, { x: 48, y: 10 }, { x: 50, y: 30 }, { x: 52, y: 10 }, { x: 100, y: 10 }],
  platforms: [],
};

test('a spike of rock that pokes up between the feet crashes the lander', () => {
  // Feet 1 m above the flat ground on either side of the spike: no corner of the lander is in rock.
  const game = step(flying({ x: 50, y: 14.6, vx: 0, vy: 0, angle: 0 }), idle, 0.001, spike);
  assert.equal(game.status, 'crashed');
});

test('a spike of rock that cuts through the side of a tilted lander crashes it', () => {
  // Lying on its side, 40 m up: well above the spike tip at 30 m.
  const clear = step(flying({ x: 48.2, y: 40, vx: 0, vy: 0, angle: 90 }), idle, 0.001, spike);
  assert.equal(clear.status, 'flying');
  // Same pose, lower: the tip is now 0.65 m inside the body, halfway between two corners.
  const hit = step(flying({ x: 48.2, y: 32, vx: 0, vy: 0, angle: 90 }), idle, 0.001, spike);
  assert.equal(hit.status, 'crashed');
});

test('flying low over flat ground or beside the spike is not a crash', () => {
  const low = step(flying({ x: 20, y: 13.7, vx: 0, vy: 0, angle: 0 }), idle, 0.001, spike);
  assert.equal(low.status, 'flying');
  const beside = step(flying({ x: 43, y: 14.6, vx: 0, vy: 0, angle: 0 }), idle, 0.001, spike);
  assert.equal(beside.status, 'flying');
});

test('visiting every platform wins the game', () => {
  const pad = PLATFORMS[PLATFORMS.length - 1];
  const visited = PLATFORMS.slice(0, -1).map((p) => p.id);
  const game = step(
    flying({ x: pad.x + pad.width / 2, y: pad.y + 3.61, vx: 0, vy: -1, angle: 0 }, { visited }),
    idle, 0.02, opts,
  );
  assert.equal(game.status, 'won');
});

// A simple autopilot: climb straight up above the rocks, fly across, stop over the next pad and
// come straight down. It hovers a lot, so it burns more fuel than a good player would.
function makePilot() {
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  let target = null;
  let cruise = 0; // the height to fly across at
  let descending = false;
  let duty = 0; // the engine is only on or off, so pulse it to get part of its push
  return (game) => {
    const { x, y, vx, vy, angle } = game.lander;
    const pad = PLATFORMS.find((p) => !game.visited.includes(p.id));
    const dx = pad.x + pad.width / 2 - x;
    if (pad !== target) {
      target = pad;
      descending = false;
      const [from, to] = [Math.min(x, x + dx) - 10, Math.max(x, x + dx) + 10];
      cruise = Math.max(...terrain.filter((p) => p.x >= from && p.x <= to).map((p) => p.y)) + 9;
    }
    if (!descending && Math.abs(dx) < 0.7 && Math.abs(vx) < 0.5) descending = true;
    if (descending && Math.abs(dx) > 2) descending = false; // drifted off: climb and line up again

    // Pick the acceleration we want (ax sideways, ay upward) and how far we may tilt to get it.
    let ax = clamp(-2 * vx, -0.3, 0.3);
    let ay = 2 * (clamp((cruise - y) * 0.6, -3, 8) - vy);
    let maxTilt = 10;
    if (descending) {
      ax = clamp(2 * (clamp(dx * 0.6, -1, 1) - vx), -0.3, 0.3);
      ay = 2 * (-clamp((y - pad.y - 3.6) * 0.35, 1.2, 6) - vy); // slow down near the pad
    } else if (y > cruise - 3) {
      const speed = Math.min(14, 0.5 * Math.abs(dx), Math.sqrt(2 * Math.abs(dx))); // brake in time
      ax = clamp(2 * (Math.sign(dx) * speed - vx), -1.6, 1.6);
      maxTilt = 45;
    }

    // Point the engine along that acceleration (plus gravity) and pulse it for the right strength.
    const up = Math.max(0.2, clamp(ay, -MOON_GRAVITY, THRUST) + MOON_GRAVITY);
    const tilt = clamp((Math.atan2(ax, up) * 180) / Math.PI, -maxTilt, maxTilt);
    duty += ay + MOON_GRAVITY <= 0 ? 0 : Math.min(1, up / Math.cos((tilt * Math.PI) / 180) / THRUST);
    const thrust = duty >= 1;
    if (thrust) duty -= 1;
    return { left: angle > tilt + 1.5, right: angle < tilt - 1.5, thrust };
  };
}

test('an autopilot can land on all 100 platforms, so every hop is possible on the fuel given', (t) => {
  const pilot = makePilot();
  let game = createGame();
  let lowestFuel = FUEL_MAX;
  const twoHours = 2 * 60 * 60 * 60; // in steps of 1/60 s; the flight takes about 50 minutes
  for (let i = 0; i < twoHours && game.status !== 'won' && game.status !== 'crashed'; i++) {
    game = step(game, pilot(game), 1 / 60, opts);
    lowestFuel = Math.min(lowestFuel, game.fuel);
  }
  t.diagnostic(`flight time ${(game.time / 60).toFixed(0)} min, lowest fuel ${lowestFuel.toFixed(1)}`);
  assert.equal(game.status, 'won', game.message);
  assert.equal(game.visited.length, PLATFORMS.length);
});
