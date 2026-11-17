// Shared test helpers. Node has no canvas and no speakers, so these stand in for them.
import { createState } from '../public/game.js';

/**
 * A pretend canvas. Its 2D context accepts any drawing call and records it in
 * `calls`, which is enough to check that the drawing code runs without errors.
 * (A Proxy lets one object answer for every method name, so there is no need to
 * list them all.)
 */
export function fakeCanvas(width = 0, height = 0) {
  const calls = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => gradient;
      // A real block of pixels, so floor casting can be checked.
      if (name === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      return (...args) => {
        calls.push([name, ...args]);
      };
    },
    set(target, name, value) {
      target[name] = value;
      calls.push([`set ${name}`, value]); // settings such as fillStyle are recorded too
      return true;
    },
  });
  return { width, height, calls, getContext: () => ctx };
}

/** A pretend audio context that counts how many sound sources were started. */
export function fakeAudio() {
  const audio = { started: 0, currentTime: 0, sampleRate: 8000, state: 'running', destination: {} };
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
  const node = () => ({
    frequency: param,
    gain: param,
    connect() {},
    stop() {},
    start() {
      audio.started += 1;
    },
  });
  audio.createOscillator = node;
  audio.createGain = node;
  audio.createBiquadFilter = node;
  audio.createBufferSource = node;
  audio.createBuffer = (_channels, length) => ({ getChannelData: () => new Float32Array(length) });
  return audio;
}

// Enemy ids are handed out in reading order of the map text (left to right, top to bottom).
/** Map 1: the guard standing in the hall at 8.5,5.5, looking west. */
export const HALL_GUARD = 1;
/** Map 1: the guard that patrols the hall, starting at 10.5,6.5. */
export const PATROL_GUARD = 2;

/**
 * A game state for tests. "Luck" is fixed (0.5 = a perfectly straight, average shot)
 * and `keep` lists the ids of the enemies to keep, so others cannot interfere.
 */
export function testState(mapIndex = 0, { keep = [], random = () => 0.5, carry = null } = {}) {
  const state = createState(mapIndex, { random, carry });
  state.enemies = state.enemies.filter((enemy) => keep.includes(enemy.id));
  return state;
}

/** Puts the player somewhere, looking in a direction (0 = east, PI/2 = south). */
export function place(state, x, y, angle = 0) {
  Object.assign(state.player, { x, y, angle });
  state.field = null;
  return state;
}

/** Runs the game for a number of seconds with the same input every frame. Returns all events. */
export function run(state, step, seconds, input = {}) {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(state, input, 1 / 60);
    events.push(...state.events);
    state.events.length = 0;
  }
  return events;
}
