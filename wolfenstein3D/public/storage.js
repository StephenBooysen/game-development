// Keeping things after the page is closed: high scores, a saved game and the map
// made in the editor. Browsers offer `localStorage` for this: a small store of
// text values under text keys, kept per website. Values must be text, so everything
// is turned into JSON on the way in and back on the way out.
//
// The store is always passed in, so the tests can hand over a plain object instead.

/** The keys this game uses in localStorage. */
export const KEYS = Object.freeze({
  scores: 'noobenstein.scores',
  save: 'noobenstein.save',
  customMap: 'noobenstein.customMap',
  difficulty: 'noobenstein.difficulty',
});

/** The browser's localStorage, or null when there is none (Node, or blocked by privacy settings). */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some browsers throw when storage is blocked
  }
}

/** Reads a JSON value. Missing, unreadable or broken values give `fallback`. */
export function readJson(storage, key, fallback = null) {
  try {
    const text = storage?.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

/** Stores a value as JSON. Returns false if it could not be stored (no storage, or it is full). */
export function writeJson(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Forgets a value. */
export function remove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // nothing to do
  }
}

/** A stand-in for localStorage that keeps values in memory (used by the tests). */
export function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
