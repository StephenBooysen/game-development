// Moon lander physics: pure functions, no DOM, so the same code runs in the browser and in tests.
// Units are real-world: metres, seconds, degrees. y points UP (altitude); the renderer flips it.

export const MOON_GRAVITY = 1.62; // m/s², the real value on the Moon
export const THRUST = 4.5; // m/s² of push from the engine, about 2.8× lunar gravity
export const ROTATE_SPEED = 110; // degrees per second while an arrow key is held
export const FUEL_MAX = 100;
export const FUEL_BURN = 4; // fuel units per second of thrust (25 s from a full tank)
export const REFUEL = 50; // fuel gained the first time you land on a level 1 platform
export const REFUEL_HARD = 70; // the same on the last level, where a hop costs about half as much again

// Safe touchdown limits.
export const MAX_LANDING_VY = 4; // m/s downward
export const MAX_LANDING_VX = 2.5; // m/s sideways
export const MAX_LANDING_ANGLE = 15; // degrees from upright

export const LEVELS = 10;
export const PLATFORMS_PER_LEVEL = 10; // 10 levels × 10 platforms = 100 platforms

// Lander shape in local metres, origin at the centre, y up. Feet are what should touch down.
export const FEET = Object.freeze([
  { x: -3.2, y: -3.6 },
  { x: 3.2, y: -3.6 },
]);
// The outline of the whole lander, going once round its six corners. Rock anywhere inside is a hit.
const OUTLINE = [
  FEET[0],
  FEET[1],
  { x: 2.9, y: 0 },
  { x: 2.4, y: 3.6 },
  { x: -2.4, y: 3.6 },
  { x: -2.9, y: 0 },
];

const toRad = (deg) => (deg * Math.PI) / 180;

/** Seeded random numbers, so the moon surface is the same every game. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * What makes a level hard. Level 1 is gentle; by level 10 the pads are small, the hops are long
 * and the rocks are tall. Later pads give more fuel, because longer and higher hops burn more.
 */
export function difficulty(level) {
  const t = (level - 1) / (LEVELS - 1); // 0 at level 1, 1 at the last level
  const mix = (easy, hard) => easy + (hard - easy) * t;
  return {
    padWidth: Math.round(mix(18, 9)), // the lander's feet are 6.4 m apart
    gapMin: mix(35, 60), // empty distance to the next pad, in metres
    gapMax: mix(50, 85),
    padTop: mix(40, 80), // pads sit between 12 m and this height
    peak: mix(30, 70), // how far the rocks can rise above the 6 m floor
    refuel: Math.round(mix(REFUEL, REFUEL_HARD)),
  };
}

/** Lays out all 100 platforms from left to right. The same seed always gives the same world. */
export function buildPlatforms(seed = 1969) {
  const random = seededRandom(seed + 1);
  const platforms = [];
  let x = 10;
  for (let i = 0; i < LEVELS * PLATFORMS_PER_LEVEL; i++) {
    const level = Math.floor(i / PLATFORMS_PER_LEVEL) + 1;
    const { padWidth, gapMin, gapMax, padTop } = difficulty(level);
    if (i > 0) x += Math.round(gapMin + random() * (gapMax - gapMin));
    const y = i === 0 ? 22 : Math.round(12 + random() * (padTop - 12));
    platforms.push({ id: i + 1, level, x, width: padWidth, y });
    x += padWidth;
  }
  return platforms;
}

export const PLATFORMS = Object.freeze(buildPlatforms());

const lastPlatform = PLATFORMS[PLATFORMS.length - 1];
export const WORLD = Object.freeze({ width: lastPlatform.x + lastPlatform.width + 40, height: 150 });

/** Builds the jagged surface as a list of {x, y} points, flat across each platform. */
export function buildTerrain(platforms = PLATFORMS, world = WORLD, seed = 1969) {
  const random = seededRandom(seed);
  const points = [];
  let x = 0;
  let peak = difficulty(1).peak;
  for (const platform of [...platforms].sort((a, b) => a.x - b.x)) {
    peak = difficulty(platform.level ?? 1).peak; // the rocks before a pad belong to that pad's level
    while (x < platform.x - 3) {
      points.push({ x, y: 6 + random() * peak });
      x += 3 + random() * 5;
    }
    points.push({ x: platform.x, y: platform.y }, { x: platform.x + platform.width, y: platform.y });
    x = platform.x + platform.width + 3;
  }
  while (x < world.width) {
    points.push({ x, y: 6 + random() * peak });
    x += 3 + random() * 5;
  }
  points.push({ x: world.width, y: 6 + random() * peak });
  return points;
}

/** Height of the surface at x, by straight-line interpolation between terrain points. */
export function groundHeight(terrain, x) {
  const last = terrain.length - 1;
  if (x <= terrain[0].x) return terrain[0].y;
  if (x >= terrain[last].x) return terrain[last].y;
  const i = pointBefore(terrain, x);
  const a = terrain[i];
  const b = terrain[i + 1];
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
}

// The index of the last terrain point at or left of x (never the very last point).
function pointBefore(terrain, x) {
  let low = 0;
  let high = terrain.length - 1;
  // Binary search: the points are sorted by x, so halve the range until the two points around x
  // are left. With over a thousand points that takes about 10 looks instead of hundreds.
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (terrain[mid].x <= x) low = mid;
    else high = mid;
  }
  return low;
}

// Which side of the line from a to b is point c on? Positive = left, negative = right, 0 = on it.
const sideOf = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Do the straight lines a–b and c–d cross? True when each one has its ends on both sides of the other. */
export function segmentsCross(a, b, c, d) {
  return sideOf(a, b, c) * sideOf(a, b, d) < 0 && sideOf(c, d, a) * sideOf(c, d, b) < 0;
}

/**
 * Is any part of the lander in the rock? Two checks:
 * 1. a corner of the lander is at or below the surface;
 * 2. the surface line cuts through an edge of the lander. This catches a thin peak that pokes
 *    up between two corners (for example between the feet), which check 1 alone would miss.
 */
export function touchesGround(lander, terrain) {
  const corners = OUTLINE.map((point) => toWorld(lander, point));
  if (corners.some((corner) => corner.y <= groundHeight(terrain, corner.x))) return true;

  // Only the few pieces of surface under the lander can cut it, so start at its left end.
  const left = Math.min(...corners.map((corner) => corner.x));
  const right = Math.max(...corners.map((corner) => corner.x));
  for (let i = pointBefore(terrain, left); i < terrain.length - 1 && terrain[i].x < right; i++) {
    for (let c = 0; c < corners.length; c++) {
      const nextCorner = corners[(c + 1) % corners.length];
      if (segmentsCross(terrain[i], terrain[i + 1], corners[c], nextCorner)) return true;
    }
  }
  return false;
}

/** Turns a point on the lander into world coordinates. Positive angle = tilted clockwise (right). */
export function toWorld(lander, point) {
  const r = toRad(lander.angle);
  return {
    x: lander.x + point.x * Math.cos(r) + point.y * Math.sin(r),
    y: lander.y - point.x * Math.sin(r) + point.y * Math.cos(r),
  };
}

/** The platform under both feet, or null. */
export function platformUnder(lander, platforms = PLATFORMS) {
  const [left, right] = FEET.map((foot) => toWorld(lander, foot));
  return platforms.find((p) => left.x >= p.x && right.x <= p.x + p.width) ?? null;
}

const restOn = (platform) => ({
  x: platform.x + platform.width / 2,
  y: platform.y - FEET[0].y,
  vx: 0,
  vy: 0,
  angle: 0,
});

/** A new game: parked on the first platform with a full tank. */
export function createGame(platforms = PLATFORMS) {
  const start = platforms[0];
  return {
    lander: restOn(start),
    fuel: FUEL_MAX,
    status: 'landed', // 'landed' | 'flying' | 'crashed' | 'won'
    platformId: start.id,
    visited: [start.id],
    checkpoint: { platformId: start.id, fuel: FUEL_MAX }, // where R takes you back to
    message: 'Hold SPACE to lift off.',
    thrusting: false,
    time: 0,
  };
}

/**
 * Puts the lander back on the last new platform it reached, with the fuel it had there.
 * Visited platforms stay visited. After a win it starts a whole new game instead.
 */
export function retry(game, platforms = PLATFORMS) {
  if (game.status === 'won') return createGame(platforms);
  const platform = platforms.find((p) => p.id === game.checkpoint.platformId);
  return {
    ...game,
    lander: restOn(platform),
    fuel: game.checkpoint.fuel,
    status: 'landed',
    platformId: platform.id,
    thrusting: false,
    message: `Back on platform ${platform.id}. Hold SPACE to lift off.`,
  };
}

/** Is this touchdown gentle enough? Returns a reason string if not. */
export function landingProblem(lander, platform) {
  if (!platform) return 'You missed the platform.';
  if (Math.abs(lander.angle) > MAX_LANDING_ANGLE) return 'You came down at too steep an angle.';
  if (-lander.vy > MAX_LANDING_VY) return 'You hit the ground too hard.';
  if (Math.abs(lander.vx) > MAX_LANDING_VX) return 'You were sliding sideways too fast.';
  return null;
}

/**
 * Advances the game by dt seconds. input = { left, right, thrust } (booleans).
 * Returns a new state; the old one is not changed.
 */
export function step(game, input, dt, { terrain, platforms = PLATFORMS, world = WORLD } = {}) {
  if (game.status === 'crashed' || game.status === 'won') return { ...game, thrusting: false };

  const fuel = game.fuel;
  const firing = Boolean(input.thrust) && fuel > 0;
  const burned = firing ? Math.min(fuel, FUEL_BURN * dt) : 0;
  const time = game.time + dt;

  if (game.status === 'landed') {
    // On the pad you can't tip over; you can only lift straight up.
    if (!firing) return { ...game, thrusting: false, time };
    return {
      ...game,
      status: 'flying',
      lander: { ...game.lander, vy: (THRUST - MOON_GRAVITY) * dt },
      fuel: fuel - burned,
      thrusting: true,
      message: 'Fly to another platform and land gently.',
      time,
    };
  }

  // Flying: rotate, then apply thrust and gravity (simple Euler integration).
  let { x, y, vx, vy, angle } = game.lander;
  if (input.left) angle -= ROTATE_SPEED * dt;
  if (input.right) angle += ROTATE_SPEED * dt;
  angle = ((((angle + 180) % 360) + 360) % 360) - 180; // keep within -180..180

  const push = firing ? THRUST : 0;
  vx += push * Math.sin(toRad(angle)) * dt;
  vy += (push * Math.cos(toRad(angle)) - MOON_GRAVITY) * dt;
  x += vx * dt;
  y += vy * dt;

  // Invisible walls at the sides and a ceiling.
  if (x < 4) [x, vx] = [4, Math.max(0, vx)];
  if (x > world.width - 4) [x, vx] = [world.width - 4, Math.min(0, vx)];
  if (y > world.height + 20) [y, vy] = [world.height + 20, Math.min(0, vy)];

  const lander = { x, y, vx, vy, angle };
  const next = { ...game, lander, fuel: fuel - burned, thrusting: firing, time };
  if (input.thrust && fuel - burned <= 0 && fuel > 0) next.message = 'Out of fuel!';

  if (!touchesGround(lander, terrain)) return next;

  const platform = platformUnder(lander, platforms);
  const problem = landingProblem(lander, platform);
  if (problem) return { ...next, status: 'crashed', thrusting: false, message: `${problem} Press R to retry.` };

  const firstVisit = !game.visited.includes(platform.id);
  const visited = firstVisit ? [...game.visited, platform.id] : game.visited;
  const refuel = difficulty(platform.level ?? 1).refuel;
  const refuelled = firstVisit ? Math.min(FUEL_MAX, next.fuel + refuel) : next.fuel;
  const won = visited.length === platforms.length;
  let message = `Landed on platform ${platform.id}.`;
  if (firstVisit) message += ` +${refuel} fuel.`;
  message += won ? ' Every platform visited: mission complete! Press R to fly again.' : ' Hold SPACE to lift off.';

  return {
    ...next,
    lander: { ...restOn(platform), x: lander.x },
    status: won ? 'won' : 'landed',
    platformId: platform.id,
    visited,
    checkpoint: firstVisit ? { platformId: platform.id, fuel: refuelled } : game.checkpoint,
    fuel: refuelled,
    thrusting: false,
    message,
  };
}
