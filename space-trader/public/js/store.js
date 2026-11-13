// Client state: the current game view (from the server), static setup data,
// and per-screen UI state that never needs to reach the server.

import { api } from './api.js';
import { notify, toast } from './toast.js';

const SAVE_KEY = 'voidMerchant.gameId';

const listeners = new Set();

export const store = {
  game: null,
  setup: null,
  summary: null,
  hallOfFame: null,
  busy: false,
  /** Screen-local UI state, keyed by screen name. */
  ui: {}
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn(store);
}

/** UI state bucket for a screen, created with defaults on first use. */
export function uiState(screen, defaults = {}) {
  if (!store.ui[screen]) store.ui[screen] = { ...defaults };
  return store.ui[screen];
}

export function resetUi(...screens) {
  for (const s of screens) delete store.ui[s];
}

export function savedGameId() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function rememberGame(id) {
  try {
    if (id) localStorage.setItem(SAVE_KEY, id);
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage blocked (private mode): the game still works for this session.
  }
}

export function setGame(game) {
  store.game = game;
  if (game) {
    rememberGame(game.id);
    store.summary = { id: game.id, name: game.name, day: game.day, location: game.location.name, status: game.status, over: game.status === 'over' };
  }
  emit();
}

export async function loadSetup() {
  if (!store.setup) store.setup = await api.setup();
  return store.setup;
}

/** Loads the saved game summary for the title screen. */
export async function loadSummary() {
  const id = savedGameId();
  if (!id) return null;
  try {
    const { summary } = await api.summary(id);
    store.summary = summary;
  } catch (err) {
    if (err.status === 404) rememberGame(null);
    store.summary = null;
  }
  emit();
  return store.summary;
}

/** Loads the full saved game (Continue). */
export async function loadGame() {
  const id = (store.game && store.game.id) || savedGameId();
  if (!id) return null;
  const { game } = await api.game(id);
  setGame(game);
  return game;
}

export async function createGame(input) {
  const { game } = await api.createGame(input);
  store.ui = {};
  setGame(game);
  return game;
}

let queue = Promise.resolve();

/**
 * Sends a player action. Actions are queued so rapid clicks apply in order.
 * @param {string} path e.g. '/market/buy'
 * @param {Object} [body]
 * @param {{method?: string, quiet?: boolean}} [opts]
 * @return {Promise<Object|null>} the new game view, or null on error
 */
export function act(path, body = {}, opts = {}) {
  const run = async () => {
    if (!store.game) return null;
    store.busy = true;
    try {
      const result = await api.act(store.game.id, path, body, opts.method || 'POST');
      setGame(result.game);
      if (!opts.quiet) notify(result.notice);
      return result.game;
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 409) {
        try { await loadGame(); } catch { /* keep the old view */ }
      }
      return null;
    } finally {
      store.busy = false;
    }
  };
  queue = queue.then(run, run);
  return queue;
}
