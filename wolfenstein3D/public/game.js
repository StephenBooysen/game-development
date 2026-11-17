// The rules of the game: moving, shooting, doors, secret walls, pickups and the guards' AI.
// Nothing in this file touches the screen, the keyboard or the speakers. It only
// changes a plain `state` object, which is why it can be tested in Node.
// Things the player should see or hear are recorded in state.events for app.js.
import { MAPS, parseMap, BLOCKING_ITEMS } from './maps.js';
import { castRay, tileKey } from './raycast.js';

export const MAX_HEALTH = 100;
export const MAX_AMMO = 99;
export const PLAYER_RADIUS = 0.25;
const WALK_SPEED = 3; // tiles per second
const RUN_SPEED = 5;
const TURN_SPEED = 2.6; // radians per second with the arrow keys
const PICKUP_RANGE = 0.55;
const USE_RANGE = 1.5;
const ITEM_RADIUS = 0.3; // barrels and pillars
const DOOR_SPEED = 1.8; // a door takes a bit over half a second to slide open
const DOOR_PASSABLE = 0.8; // how far open a door must be before you fit through
const DOOR_STAYS_OPEN = 4; // seconds
const HEARING_RANGE = 9; // tiles a gunshot carries, measured along the corridors
const PUSH_SPEED = 1.2; // tiles per second for a sliding secret wall
const PUSH_DISTANCE = 2; // tiles a secret wall slides, if nothing is in the way
export const START_LIVES = 3;
export const MAX_LIVES = 9;

/** All four weapons share one pool of bullets, as in the original game. */
export const WEAPONS = Object.freeze({
  knife: { name: 'Knife', usesAmmo: false, rate: 0.35, damage: [8, 20], range: 1.4, spread: 0, loud: false },
  pistol: { name: 'Pistol', usesAmmo: true, rate: 0.38, damage: [14, 28], range: 40, spread: 0.015, loud: true },
  machinegun: { name: 'Machine gun', usesAmmo: true, rate: 0.14, damage: [12, 24], range: 40, spread: 0.04, loud: true },
  chaingun: { name: 'Chaingun', usesAmmo: true, rate: 0.07, damage: [12, 24], range: 40, spread: 0.06, loud: true },
});

/** Weapons from weakest to strongest; keys 1-4 pick them in this order. */
export const WEAPON_ORDER = Object.freeze(['knife', 'pistol', 'machinegun', 'chaingun']);

/**
 * What makes each kind of enemy different. Times are in seconds.
 * Dogs are `melee`: they have no gun, so instead of aim and fire they run up and bite.
 * aimTime is then the moment between leaping and biting, and `reach` how close they must be.
 */
export const ENEMY_TYPES = Object.freeze({
  guard: { health: 25, speed: 1.5, radius: 0.3, reaction: 0.35, aimTime: 0.55, burst: 1, burstGap: 0.2, cooldown: [0.9, 1.8], accuracy: 0.75, damage: [4, 11], score: 100, drop: 'clip', flinches: true },
  ss: { health: 50, speed: 1.9, radius: 0.3, reaction: 0.25, aimTime: 0.4, burst: 3, burstGap: 0.13, cooldown: [0.8, 1.5], accuracy: 0.7, damage: [4, 10], score: 500, drop: 'machinegun', flinches: true },
  boss: { health: 600, speed: 1.2, radius: 0.4, reaction: 0.2, aimTime: 0.6, burst: 8, burstGap: 0.09, cooldown: [1.2, 2], accuracy: 0.6, damage: [4, 9], score: 5000, drop: 'chaingun', flinches: false },
  dog: { health: 15, speed: 3.4, radius: 0.25, reaction: 0.15, aimTime: 0.3, melee: true, reach: 1.2, cooldown: [0.5, 0.9], accuracy: 0.8, damage: [6, 12], score: 200, drop: null, flinches: false },
});

/**
 * How hard the enemies are. The numbers multiply the values in ENEMY_TYPES:
 * damage = how much a hit hurts, accuracy = the chance to hit, reaction = how long a
 * guard takes to notice you (bigger is slower). On easy, every `leaveOut`-th enemy
 * (never a boss) is left out of the map.
 */
export const DIFFICULTIES = Object.freeze({
  easy: { name: 'Easy', damage: 0.5, accuracy: 0.8, reaction: 1.6, leaveOut: 3 },
  normal: { name: 'Normal', damage: 1, accuracy: 1, reaction: 1, leaveOut: 0 },
  hard: { name: 'Hard', damage: 1.4, accuracy: 1.15, reaction: 0.6, leaveOut: 0 },
});

const randomBetween = (state, [low, high]) => low + state.random() * (high - low);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** The smallest turn (in radians, -PI..PI) that takes angle `from` to angle `to`. */
export function angleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Builds a fresh game state for one map.
 * `carry` is what the player brings from the previous map (health, ammo, weapons, score, lives).
 * `random` can be replaced in tests so that "luck" is predictable.
 * `maps` is the list to pick from: normally MAPS, or a single map made in the editor.
 */
export function createState(mapIndex = 0, { random = Math.random, carry = null, difficulty = null, maps = MAPS } = {}) {
  const level = parseMap(maps[mapIndex]);
  const chosen = difficulty ?? carry?.difficulty ?? 'normal';
  const rules = DIFFICULTIES[chosen] || DIFFICULTIES.normal;
  // On easy, some enemies stay home. The boss always turns up.
  const enemies = level.enemies.filter(
    (enemy, index) => !rules.leaveOut || enemy.type === 'boss' || (index + 1) % rules.leaveOut !== 0,
  );
  const state = {
    mapIndex,
    name: level.name,
    difficulty: DIFFICULTIES[chosen] ? chosen : 'normal',
    width: level.width,
    height: level.height,
    walls: level.walls,
    ceiling: level.ceiling,
    floor: level.floor,
    ceilingTexture: level.ceilingTexture,
    floorTexture: level.floorTexture,
    doors: new Map(),
    secrets: new Map(), // secret walls that have not been found yet, by tile
    movers: [], // secret walls sliding right now
    items: level.items.map((item) => ({ ...item })),
    enemies: [],
    effects: [], // short-lived puffs and blood splashes
    events: [], // things that just happened, for sounds and screen flashes
    message: null, // { text, time } shown on screen for a moment
    random,
    time: 0,
    status: 'playing', // 'playing' | 'dead' | 'complete'
    field: null, // walking distances to the player, see distanceField()
    player: {
      x: level.start.x,
      y: level.start.y,
      angle: level.start.angle,
      health: carry?.health ?? MAX_HEALTH,
      ammo: carry?.ammo ?? 16,
      weapons: [...(carry?.weapons ?? ['knife', 'pistol'])],
      weapon: carry?.weapon ?? 'pistol',
      keys: 0,
      score: carry?.score ?? 0,
      lives: carry?.lives ?? START_LIVES,
      cooldown: 0, // time until the weapon can fire again
      sinceShot: 9, // time since the last shot, for the muzzle flash
      walked: 0, // distance walked, for the walking animation
      speed: 0,
      hurt: 0, // 1 right after being hit, fading to 0 (red screen flash)
      hitAngle: null, // the direction the last hit came from, for the red edge on screen
      glow: 0, // same idea for pickups (gold flash)
    },
    stats: {
      kills: 0,
      enemies: enemies.length,
      treasure: 0,
      treasures: level.items.filter((item) => item.kind === 'treasure').length,
      secrets: 0,
      secretsTotal: level.secrets.length,
      shots: 0,
    },
  };
  for (const door of level.doors) {
    state.doors.set(tileKey(state, door.col, door.row), { ...door, open: 0, phase: 'closed', timer: 0 });
  }
  for (const secret of level.secrets) state.secrets.set(tileKey(state, secret.col, secret.row), { ...secret });
  state.enemies = enemies.map((enemy, id) => ({
    id,
    type: enemy.type,
    x: enemy.x,
    y: enemy.y,
    patrol: enemy.patrol,
    angle: 0,
    health: ENEMY_TYPES[enemy.type].health,
    state: enemy.patrol ? 'patrol' : 'stand', // stand | patrol | chase | aim | fire | bite | pain | dead
    timer: 0, // time spent in the current state
    noticed: 0, // how long the player has been in view
    cooldown: 0, // time until the next attack
    shotsLeft: 0,
    shotTimer: 0,
    sinceShot: 9,
    walked: 0,
  }));
  for (const enemy of state.enemies) enemy.angle = longestView(state, enemy);
  return state;
}

/** What the player takes along to the next map. Keys stay behind. */
export function carryOver(state) {
  const { health, ammo, weapons, weapon, score, lives } = state.player;
  return { health, ammo, weapons: [...weapons], weapon, score, lives, difficulty: state.difficulty };
}

/**
 * After dying: what to restart the map with, or null when there are no lives left
 * ("game over"). You get back what you had when you entered the map, minus one life.
 */
export function retryCarry(state, entryCarry = null) {
  const lives = state.player.lives - 1;
  if (lives <= 0) return null;
  return { ...entryCarry, lives, difficulty: state.difficulty };
}

// A guard starts out facing the direction it can see furthest, so guards
// naturally watch corridors and doors instead of staring at a wall.
function longestView(state, enemy) {
  let best = 0;
  let bestDist = -1;
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const { dist } = castRay(state, enemy.x, enemy.y, angle);
    if (dist > bestDist) {
      best = angle;
      bestDist = dist;
    }
  }
  return best;
}

function say(state, text) {
  state.message = { text, time: state.time };
}

// ---------------------------------------------------------------- the world

/** The door on a tile, if there is one. */
export function doorAt(state, col, row) {
  return state.doors.get(tileKey(state, col, row)) || null;
}

/** True when a sliding secret wall fills (part of) this tile. */
export function moverAt(state, col, row) {
  return state.movers.some(
    (mover) => (mover.col === col && mover.row === row) || (mover.offset > 0 && mover.col + mover.dc === col && mover.row + mover.dr === row),
  );
}

/** True when a tile cannot be entered: a wall, the edge of the map, or a door that is not open yet. */
export function isSolid(state, col, row) {
  if (col < 0 || row < 0 || col >= state.width || row >= state.height) return true;
  if (state.walls[row][col]) return true;
  if (moverAt(state, col, row)) return true;
  const door = doorAt(state, col, row);
  return Boolean(door && door.open < DOOR_PASSABLE);
}

/**
 * True when a body of the given radius cannot stand at (x, y).
 * `self` is the enemy that is moving (or null for the player), so it does not block itself.
 */
export function isBlocked(state, x, y, radius, self = null) {
  for (let row = Math.floor(y - radius); row <= Math.floor(y + radius); row++) {
    for (let col = Math.floor(x - radius); col <= Math.floor(x + radius); col++) {
      if (isSolid(state, col, row)) return true;
    }
  }
  for (const item of state.items) {
    if (BLOCKING_ITEMS.has(item.kind) && Math.hypot(item.x - x, item.y - y) < radius + ITEM_RADIUS) return true;
  }
  for (const enemy of state.enemies) {
    if (enemy === self || enemy.state === 'dead') continue;
    if (Math.hypot(enemy.x - x, enemy.y - y) < radius + ENEMY_TYPES[enemy.type].radius) return true;
  }
  if (self && Math.hypot(state.player.x - x, state.player.y - y) < radius + PLAYER_RADIUS) return true;
  return false;
}

// Moves a body by (dx, dy). The two directions are tried separately, so walking
// into a wall at an angle slides along it instead of stopping dead.
function moveBody(state, body, dx, dy, radius, self = null) {
  let moved = 0;
  if (dx !== 0 && !isBlocked(state, body.x + dx, body.y, radius, self)) {
    body.x += dx;
    moved += Math.abs(dx);
  }
  if (dy !== 0 && !isBlocked(state, body.x, body.y + dy, radius, self)) {
    body.y += dy;
    moved += Math.abs(dy);
  }
  body.walked += moved;
  return moved;
}

/** Starts opening a door. Returns false when it is locked and the opener has no key. */
export function openDoor(state, door, byPlayer = false) {
  if (door.locked) {
    if (!byPlayer) return false;
    if (state.player.keys === 0) {
      state.events.push({ type: 'locked' });
      say(state, 'This door is locked. Find the gold key.');
      return false;
    }
    door.locked = false; // once unlocked, a door stays unlocked
    state.field = null; // guards can now walk through it too
    say(state, 'You unlock the door.');
  }
  if (door.phase === 'closed' || door.phase === 'closing') {
    door.phase = 'opening';
    state.events.push({ type: 'door', x: door.col + 0.5, y: door.row + 0.5 });
  }
  return true;
}

// True when the player or a living enemy is (partly) standing on a tile.
function tileIsOccupied(state, col, row) {
  const inTile = (body, radius) => Math.abs(body.x - (col + 0.5)) < 0.5 + radius && Math.abs(body.y - (row + 0.5)) < 0.5 + radius;
  if (inTile(state.player, PLAYER_RADIUS)) return true;
  return state.enemies.some((enemy) => enemy.state !== 'dead' && inTile(enemy, ENEMY_TYPES[enemy.type].radius));
}

const doorwayIsOccupied = (state, door) => tileIsOccupied(state, door.col, door.row);

function updateDoors(state, dt) {
  for (const door of state.doors.values()) {
    if (door.phase === 'opening') {
      door.open = Math.min(1, door.open + dt * DOOR_SPEED);
      if (door.open === 1) {
        door.phase = 'open';
        door.timer = DOOR_STAYS_OPEN;
      }
    } else if (door.phase === 'open') {
      door.timer -= dt;
      // A door never closes on someone standing in it.
      if (door.timer <= 0 && !doorwayIsOccupied(state, door)) door.phase = 'closing';
    } else if (door.phase === 'closing') {
      if (doorwayIsOccupied(state, door)) {
        door.phase = 'opening';
      } else {
        door.open = Math.max(0, door.open - dt * DOOR_SPEED);
        if (door.open === 0) door.phase = 'closed';
      }
    }
  }
}

// A secret wall can only slide into an empty floor tile: no wall, door, item or body.
function canSlideInto(state, col, row) {
  if (col < 0 || row < 0 || col >= state.width || row >= state.height) return false;
  if (state.walls[row][col] || doorAt(state, col, row) || moverAt(state, col, row)) return false;
  if (state.items.some((item) => Math.floor(item.x) === col && Math.floor(item.y) === row)) return false;
  return !tileIsOccupied(state, col, row);
}

/**
 * Pushes a secret wall one way: (dc, dr) is east (1, 0), west (-1, 0), south (0, 1) or north (0, -1).
 * It leaves the wall grid and becomes a "mover" that slides until it has gone
 * PUSH_DISTANCE tiles or something is in the way. Returns false if it cannot move at all.
 */
export function pushSecret(state, secret, dc, dr) {
  if (!canSlideInto(state, secret.col + dc, secret.row + dr)) {
    state.events.push({ type: 'nothing' });
    return false;
  }
  state.secrets.delete(tileKey(state, secret.col, secret.row));
  state.walls[secret.row][secret.col] = null;
  state.movers.push({ col: secret.col, row: secret.row, dc, dr, offset: 0, tilesLeft: PUSH_DISTANCE, texture: secret.texture });
  state.stats.secrets += 1;
  state.field = null;
  state.events.push({ type: 'secret', x: secret.col + 0.5, y: secret.row + 0.5 });
  say(state, 'You found a secret!');
  return true;
}

function updateMovers(state, dt) {
  for (const mover of [...state.movers]) {
    mover.offset += dt * PUSH_SPEED;
    if (mover.offset < 1) continue;
    // It has fully entered the next tile.
    mover.col += mover.dc;
    mover.row += mover.dr;
    mover.offset = 0;
    mover.tilesLeft -= 1;
    state.movers.splice(state.movers.indexOf(mover), 1); // take it out while checking the way ahead
    if (mover.tilesLeft > 0 && canSlideInto(state, mover.col + mover.dc, mover.row + mover.dr)) {
      state.movers.push(mover);
    } else {
      state.walls[mover.row][mover.col] = mover.texture; // it stops and is an ordinary wall again
      state.field = null;
    }
  }
}

// ---------------------------------------------------------------- the player

/** The strongest gun the player owns (the knife if there is none). */
export function bestWeapon(player) {
  return [...WEAPON_ORDER].reverse().find((name) => player.weapons.includes(name)) || 'knife';
}

/** Switches weapon if the player owns it. Guns cannot be chosen with no bullets left. */
export function selectWeapon(state, name) {
  const player = state.player;
  if (!player.weapons.includes(name) || player.weapon === name) return false;
  if (WEAPONS[name].usesAmmo && player.ammo === 0) return false;
  player.weapon = name;
  state.events.push({ type: 'switch', weapon: name });
  return true;
}

function nextWeapon(state) {
  const player = state.player;
  const owned = WEAPON_ORDER.filter((name) => player.weapons.includes(name));
  for (let i = 1; i <= owned.length; i++) {
    const name = owned[(owned.indexOf(player.weapon) + i) % owned.length];
    if (selectWeapon(state, name)) return;
  }
}

/**
 * What a perfectly straight shot from the player would hit.
 * Returns { dist, enemy, wall }: the nearest living enemy on the line, or the wall behind.
 * The renderer uses this too, to draw the crosshair where the bullet will really land.
 */
export function aimTarget(state, angle = state.player.angle, range = 40) {
  const player = state.player;
  const hit = castRay(state, player.x, player.y, angle);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let dist = Math.min(hit.dist, range);
  let target = null;
  for (const enemy of state.enemies) {
    if (enemy.state === 'dead') continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const along = dx * cos + dy * sin; // how far in front of the player
    const aside = Math.abs(dy * cos - dx * sin); // how far off the line of fire
    if (along > 0 && along < dist && aside < ENEMY_TYPES[enemy.type].radius) {
      dist = along;
      target = enemy;
    }
  }
  return { dist, enemy: target, wall: target || hit.dist > range ? null : hit.wall };
}

function fireWeapon(state) {
  const player = state.player;
  const weapon = WEAPONS[player.weapon];
  if (weapon.usesAmmo) {
    if (player.ammo === 0) {
      player.weapon = 'knife';
      return;
    }
    player.ammo -= 1;
  }
  player.cooldown = weapon.rate;
  player.sinceShot = 0;
  state.stats.shots += 1;
  state.events.push({ type: 'fire', weapon: player.weapon });

  // Fast guns are less accurate: each bullet leaves at a slightly random angle.
  const angle = player.angle + (state.random() - 0.5) * 2 * weapon.spread;
  const shot = aimTarget(state, angle, weapon.range);
  const x = player.x + Math.cos(angle) * (shot.dist - 0.05);
  const y = player.y + Math.sin(angle) * (shot.dist - 0.05);
  if (shot.enemy) {
    state.effects.push({ kind: 'blood', x, y, age: 0 });
    hurtEnemy(state, shot.enemy, Math.round(randomBetween(state, weapon.damage)));
  } else if (shot.wall) {
    state.effects.push({ kind: 'puff', x, y, age: 0 });
  }
  if (weapon.loud) makeNoise(state);
  if (weapon.usesAmmo && player.ammo === 0) say(state, 'Out of bullets!');
}

// `from` is where the attack came from, so the screen can show which side you were hit on.
function hurtPlayer(state, amount, from = null) {
  const player = state.player;
  player.health = Math.max(0, player.health - amount);
  player.hurt = 1;
  if (from) player.hitAngle = Math.atan2(from.y - player.y, from.x - player.x);
  state.events.push({ type: 'hurt', amount });
  if (player.health === 0) {
    state.status = 'dead';
    state.events.push({ type: 'die' });
  }
}

function addAmmo(state, amount) {
  const player = state.player;
  if (player.ammo >= MAX_AMMO) return false;
  const wasEmpty = player.ammo === 0;
  player.ammo = Math.min(MAX_AMMO, player.ammo + amount);
  // Out of bullets and holding the knife? Go back to the best gun automatically.
  if (wasEmpty && player.weapon === 'knife') player.weapon = bestWeapon(player);
  return true;
}

function heal(state, amount) {
  const player = state.player;
  if (player.health >= MAX_HEALTH) return false;
  player.health = Math.min(MAX_HEALTH, player.health + amount);
  return true;
}

function takeGun(state, name) {
  const player = state.player;
  if (player.weapons.includes(name)) return addAmmo(state, 6);
  player.weapons.push(name);
  player.ammo = Math.min(MAX_AMMO, player.ammo + 6);
  player.weapon = name;
  return true;
}

// What each pickup does. A pickup returns false when it is not needed
// (full health, full ammo), and then it stays on the floor for later.
const PICKUPS = {
  medkit: { text: 'First aid kit: +25 health', take: (state) => heal(state, 25) },
  food: { text: 'Hot meal: +10 health', take: (state) => heal(state, 10) },
  ammo: { text: 'Ammo box: +8 bullets', take: (state) => addAmmo(state, 8) },
  clip: { text: 'Clip: +4 bullets', take: (state) => addAmmo(state, 4) },
  machinegun: { text: 'Machine gun!', take: (state) => takeGun(state, 'machinegun') },
  chaingun: { text: 'Chaingun!', take: (state) => takeGun(state, 'chaingun') },
  oneup: {
    text: 'Extra life! Full health and +25 bullets',
    take: (state) => {
      const player = state.player;
      player.lives = Math.min(MAX_LIVES, player.lives + 1);
      player.health = MAX_HEALTH;
      addAmmo(state, 25);
      return true;
    },
  },
  key: {
    text: 'Gold key',
    take: (state) => {
      state.player.keys += 1;
      return true;
    },
  },
  treasure: {
    text: 'Treasure: +500 points',
    take: (state) => {
      state.player.score += 500;
      state.stats.treasure += 1;
      return true;
    },
  },
};

function collectItems(state) {
  const player = state.player;
  state.items = state.items.filter((item) => {
    const pickup = PICKUPS[item.kind];
    if (!pickup || Math.hypot(item.x - player.x, item.y - player.y) > PICKUP_RANGE) return true;
    if (!pickup.take(state)) return true;
    player.glow = 1;
    say(state, pickup.text);
    state.events.push({ type: 'pickup', kind: item.kind });
    return false;
  });
}

// The "use" key: opens the door, pushes the secret wall or presses the elevator
// switch right in front of you.
function useAhead(state) {
  const player = state.player;
  const hit = castRay(state, player.x, player.y, player.angle, USE_RANGE);
  const secret = hit.wall && !hit.door ? state.secrets.get(tileKey(state, hit.col, hit.row)) : null;
  if (hit.door) {
    openDoor(state, hit.door, true);
  } else if (secret) {
    // The wall moves away from you: east/west if you hit its east or west face, otherwise north/south.
    const dc = hit.side === 0 ? Math.sign(Math.cos(player.angle)) : 0;
    const dr = hit.side === 1 ? Math.sign(Math.sin(player.angle)) : 0;
    pushSecret(state, secret, dc, dr);
  } else if (hit.wall === 'exit') {
    state.status = 'complete';
    state.events.push({ type: 'exit' });
  } else {
    state.events.push({ type: 'nothing' });
  }
}

function updatePlayer(state, input, dt) {
  const player = state.player;
  player.angle += (input.turn || 0) * TURN_SPEED * dt + (input.look || 0);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.sinceShot += dt;
  player.hurt = Math.max(0, player.hurt - dt * 2);
  player.glow = Math.max(0, player.glow - dt * 3);

  const forward = clamp(input.forward || 0, -1, 1);
  const strafe = clamp(input.strafe || 0, -1, 1);
  const length = Math.hypot(forward, strafe);
  player.speed = 0;
  if (length > 0) {
    const speed = input.run ? RUN_SPEED : WALK_SPEED;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    // Divide by the length so that walking diagonally is not faster.
    const scale = (speed * dt) / Math.max(1, length);
    const dx = (cos * forward - sin * strafe) * scale;
    const dy = (sin * forward + cos * strafe) * scale;
    player.speed = moveBody(state, player, dx, dy, PLAYER_RADIUS) / dt;
  }

  if (input.weapon) selectWeapon(state, input.weapon);
  if (input.nextWeapon) nextWeapon(state);
  if (input.use) useAhead(state);
  if (input.fire && player.cooldown === 0 && state.status === 'playing') fireWeapon(state);
  collectItems(state);
}

// ---------------------------------------------------------------- the guards

/**
 * For every tile: how many steps it is from the player, walking around walls.
 * (-1 means "cannot get there".) It is built with a breadth-first search that
 * spreads out from the player's tile one step at a time.
 *
 * One search serves every guard: to chase the player, a guard just steps onto
 * the neighbouring tile with the smallest number. It is only redone when the
 * player moves to another tile.
 */
export function distanceField(state) {
  const startCol = Math.floor(state.player.x);
  const startRow = Math.floor(state.player.y);
  const start = tileKey(state, startCol, startRow);
  if (state.field && state.field.key === start) return state.field.dist;

  const dist = new Int16Array(state.width * state.height).fill(-1);
  const blocked = new Set();
  for (const item of state.items) {
    if (BLOCKING_ITEMS.has(item.kind)) blocked.add(tileKey(state, Math.floor(item.x), Math.floor(item.y)));
  }
  dist[start] = 0;
  const queue = [[startCol, startRow]];
  for (let i = 0; i < queue.length; i++) {
    const [col, row] = queue[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= state.width || r >= state.height || state.walls[r][c] || moverAt(state, c, r)) continue;
      const key = tileKey(state, c, r);
      // Closed doors count as open here because guards can open them. Locked ones cannot be passed.
      if (dist[key] !== -1 || blocked.has(key) || doorAt(state, c, r)?.locked) continue;
      dist[key] = dist[tileKey(state, col, row)] + 1;
      queue.push([c, r]);
    }
  }
  state.field = { key: start, dist };
  return dist;
}

function setEnemyState(enemy, name) {
  enemy.state = name;
  enemy.timer = 0;
}

function alertEnemy(state, enemy) {
  if (enemy.state !== 'stand' && enemy.state !== 'patrol') return;
  setEnemyState(enemy, 'chase');
  enemy.cooldown = randomBetween(state, [0.2, 0.7]);
  state.events.push({ type: 'alert', enemy: enemy.type });
}

// A gunshot wakes every idle guard within earshot. Distance is measured along
// the corridors (using the distance field), so sound does not pass through walls.
function makeNoise(state) {
  const field = distanceField(state);
  for (const enemy of state.enemies) {
    const steps = field[tileKey(state, Math.floor(enemy.x), Math.floor(enemy.y))];
    if (steps >= 0 && steps <= HEARING_RANGE) alertEnemy(state, enemy);
  }
}

function hurtEnemy(state, enemy, amount) {
  const type = ENEMY_TYPES[enemy.type];
  enemy.health -= amount;
  if (enemy.health > 0) {
    state.events.push({ type: 'enemyPain', enemy: enemy.type });
    alertEnemy(state, enemy);
    // Half the time a hit makes a guard flinch, which interrupts its shot. The boss and dogs never flinch.
    if (type.flinches && state.random() < 0.5) setEnemyState(enemy, 'pain');
    return;
  }
  enemy.health = 0;
  setEnemyState(enemy, 'dead');
  state.player.score += type.score;
  state.stats.kills += 1;
  state.events.push({ type: 'enemyDie', enemy: enemy.type });
  // Guards drop a clip. Officers drop their gun, unless you already have one like it. Dogs drop nothing.
  if (!type.drop) return;
  const isGun = Boolean(WEAPONS[type.drop]);
  const kind = isGun && state.player.weapons.includes(type.drop) ? 'clip' : type.drop;
  state.items.push({ kind, x: enemy.x, y: enemy.y });
}

/** True when no wall or closed door is between the enemy and the player. */
export function hasLineOfSight(state, enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  return castRay(state, enemy.x, enemy.y, Math.atan2(dy, dx), dist + 0.1).dist >= dist;
}

const rulesFor = (state) => DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;

function enemyShoots(state, enemy, type, dist, sees) {
  const rules = rulesFor(state);
  enemy.sinceShot = 0;
  state.events.push({ type: 'enemyFire', enemy: enemy.type, dist });
  if (!sees) return; // the player ducked behind a wall in time
  // Far-away and running targets are harder to hit.
  let chance = clamp(type.accuracy * rules.accuracy - dist * 0.05, 0.1, 0.95);
  if (state.player.speed > WALK_SPEED + 0.5) chance *= 0.7;
  if (state.random() >= chance) return;
  let damage = randomBetween(state, type.damage) * rules.damage;
  if (dist < 2) damage *= 1.5;
  else if (dist > 6) damage *= 0.6;
  hurtPlayer(state, Math.max(1, Math.round(damage)), enemy);
}

// A dog's bite: it only lands if you are still within reach when the jaws close.
function enemyBites(state, enemy, type, dist, sees) {
  const rules = rulesFor(state);
  enemy.sinceShot = 0;
  state.events.push({ type: 'bite', enemy: enemy.type });
  if (!sees || dist > type.reach + 0.2) return; // you backed away in time
  if (state.random() >= clamp(type.accuracy * rules.accuracy, 0.1, 0.95)) return;
  hurtPlayer(state, Math.max(1, Math.round(randomBetween(state, type.damage) * rules.damage)), enemy);
}

function patrol(state, enemy, type, dt) {
  const distance = type.speed * 0.6 * dt;
  const moved = moveBody(state, enemy, Math.cos(enemy.angle) * distance, Math.sin(enemy.angle) * distance, type.radius, enemy);
  if (moved < distance * 0.5) enemy.angle = angleDiff(0, enemy.angle + Math.PI); // blocked: turn around
}

function chase(state, enemy, type, dt, dist, toPlayer) {
  const field = distanceField(state);
  const col = Math.floor(enemy.x);
  const row = Math.floor(enemy.y);
  const here = field[tileKey(state, col, row)];
  let targetX = state.player.x;
  let targetY = state.player.y;

  if (here < 0) {
    enemy.angle = toPlayer; // no way through (a locked door): stand and watch
    return;
  }
  if (here <= 1) {
    if (dist < 1.1) {
      enemy.angle = toPlayer; // close enough, do not crowd the player
      return;
    }
  } else {
    // Step "downhill" on the distance field: the neighbour tile nearest to the player.
    let best = here;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const steps = field[tileKey(state, col + dc, row + dr)];
      if (steps >= 0 && steps < best) {
        best = steps;
        targetX = col + dc + 0.5;
        targetY = row + dr + 0.5;
      }
    }
    const door = doorAt(state, Math.floor(targetX), Math.floor(targetY));
    if (door && door.open < DOOR_PASSABLE) openDoor(state, door);
  }
  enemy.angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  const distance = type.speed * dt;
  moveBody(state, enemy, Math.cos(enemy.angle) * distance, Math.sin(enemy.angle) * distance, type.radius, enemy);
}

// Each guard is a small "state machine": it is always in exactly one state, and
// each state has its own rules for what to do and when to switch to another.
//   stand/patrol -> (sees or hears the player) -> chase -> aim -> fire -> chase ...
//   pain is a short flinch after being hit; dead is the end.
// Dogs use a smaller machine with no gun: stand/patrol -> chase -> bite -> chase ...
function updateEnemy(state, enemy, dt) {
  const type = ENEMY_TYPES[enemy.type];
  enemy.timer += dt;
  enemy.sinceShot += dt;
  if (enemy.state === 'dead') return;

  const player = state.player;
  const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const toPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const sees = hasLineOfSight(state, enemy);

  if (enemy.state === 'stand' || enemy.state === 'patrol') {
    // An idle guard only notices what is in front of it, or right next to it.
    const inView = Math.abs(angleDiff(enemy.angle, toPlayer)) < 1.3 || dist < 1.5;
    enemy.noticed = sees && inView ? enemy.noticed + dt : 0;
    if (enemy.noticed >= type.reaction * rulesFor(state).reaction) alertEnemy(state, enemy);
    else if (enemy.state === 'patrol') patrol(state, enemy, type, dt);
  } else if (enemy.state === 'pain') {
    if (enemy.timer >= 0.25) setEnemyState(enemy, 'chase');
  } else if (enemy.state === 'chase' && type.melee) {
    enemy.cooldown -= dt;
    if (sees && enemy.cooldown <= 0 && dist <= type.reach) {
      enemy.angle = toPlayer;
      setEnemyState(enemy, 'bite');
    } else {
      chase(state, enemy, type, dt, dist, toPlayer);
    }
  } else if (enemy.state === 'bite') {
    enemy.angle = toPlayer;
    if (enemy.timer >= type.aimTime) {
      enemyBites(state, enemy, type, dist, sees);
      enemy.cooldown = randomBetween(state, type.cooldown);
      setEnemyState(enemy, 'chase');
    }
  } else if (enemy.state === 'chase') {
    enemy.cooldown -= dt;
    if (sees && enemy.cooldown <= 0) {
      enemy.angle = toPlayer;
      setEnemyState(enemy, 'aim');
    } else {
      chase(state, enemy, type, dt, dist, toPlayer);
    }
  } else if (enemy.state === 'aim') {
    enemy.angle = toPlayer;
    if (enemy.timer >= type.aimTime) {
      if (sees) {
        setEnemyState(enemy, 'fire');
        enemy.shotsLeft = type.burst;
        enemy.shotTimer = 0;
      } else {
        setEnemyState(enemy, 'chase'); // lost sight of the player while aiming
      }
    }
  } else if (enemy.state === 'fire') {
    enemy.angle = toPlayer;
    enemy.shotTimer -= dt;
    if (enemy.shotsLeft > 0 && enemy.shotTimer <= 0) {
      enemy.shotsLeft -= 1;
      enemy.shotTimer = type.burstGap;
      enemyShoots(state, enemy, type, dist, sees);
    } else if (enemy.shotsLeft === 0 && enemy.shotTimer <= 0) {
      enemy.cooldown = randomBetween(state, type.cooldown);
      setEnemyState(enemy, 'chase');
    }
  }
}

// ---------------------------------------------------------------- one frame

/**
 * Advances the game by `dt` seconds. `input` describes what the player is doing:
 *   forward, strafe: -1..1     turn: -1..1 (arrow keys)   look: radians (mouse)
 *   run, fire: true while held   use, nextWeapon: true once per key press
 *   weapon: the name of a weapon to switch to
 */
export function step(state, input = {}, dt = 1 / 60) {
  if (state.status !== 'playing') return state;
  // After a long pause (a hidden tab), do not let everything jump across the map.
  dt = Math.min(dt, 0.05);
  state.time += dt;
  updatePlayer(state, input, dt);
  updateDoors(state, dt);
  updateMovers(state, dt);
  for (const enemy of state.enemies) {
    if (state.status === 'playing') updateEnemy(state, enemy, dt);
  }
  for (const effect of state.effects) effect.age += dt;
  state.effects = state.effects.filter((effect) => effect.age < 0.25);
  return state;
}
