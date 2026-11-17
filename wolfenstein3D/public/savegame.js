// Saving and loading a game. Everything about a game in progress lives in one plain
// `state` object (see createState in game.js), so saving is mostly JSON.stringify.
// Three things need care:
//   - Maps (state.doors, state.secrets) do not survive JSON, so they are written as
//     { $map: [[key, value], ...] } and rebuilt when loading.
//   - state.random is a function, which JSON cannot store; the loader puts one back.
//   - state.field and state.events are only temporary, so they are left out.

/** Bumped whenever the shape of the state changes, so old saves are refused politely. */
export const SAVE_VERSION = 1;

const SKIP = new Set(['random', 'field', 'events']);

function replacer(key, value) {
  if (SKIP.has(key)) return undefined;
  if (value instanceof Map) return { $map: [...value] };
  return value;
}

function reviver(_key, value) {
  if (value && typeof value === 'object' && Array.isArray(value.$map)) return new Map(value.$map);
  return value;
}

/** Turns a game (plus anything else the page wants to keep, `extra`) into text. */
export function serializeGame(state, extra = {}) {
  return JSON.stringify({ version: SAVE_VERSION, state, extra }, replacer);
}

/**
 * Turns saved text back into { state, extra }. Throws an Error with a friendly
 * message if the text is not a save from this version of the game.
 */
export function deserializeGame(text, { random = Math.random } = {}) {
  let data;
  try {
    data = JSON.parse(text, reviver);
  } catch {
    throw new Error('The saved game is damaged and cannot be loaded.');
  }
  if (data?.version !== SAVE_VERSION || !data.state?.player) {
    throw new Error('The saved game is from another version of Castle Noobenstein.');
  }
  const state = { ...data.state, random, field: null, events: [] };
  return { state, extra: data.extra ?? {} };
}
