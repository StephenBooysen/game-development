// Client state: the current game view (from the server), static setup data,
// and per-screen UI state that never needs to reach the server.

import { api } from './api.js';
import { notify, toast } from './toast.js';

const SAVE_KEY = 'voidMerchant.gameId';
const SAVE_STATE_KEY = 'voidMerchant.savedGame';
const STATUS_KEY = 'voidMerchant.playerStatus';

const listeners = new Set();

const initialStatus = savedPlayerStatus();

export const store = {
  game: null,
  setup: null,
  summary: initialStatus ? {
    id: initialStatus.id,
    name: initialStatus.name,
    day: initialStatus.day,
    location: (initialStatus.location && initialStatus.location.name) || (typeof initialStatus.location === 'string' ? (initialStatus.location.charAt(0).toUpperCase() + initialStatus.location.slice(1)) : 'Solace'),
    status: initialStatus.status,
    over: initialStatus.status === 'over'
  } : null,
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

export function savedGameState() {
  try {
    const raw = localStorage.getItem(SAVE_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savedPlayerStatus() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function rememberGame(id, state = null) {
  try {
    if (id) {
      localStorage.setItem(SAVE_KEY, id);
      if (state) {
        localStorage.setItem(SAVE_STATE_KEY, JSON.stringify(state));
        const status = {
          id: state.id || id,
          name: state.name,
          difficulty: state.difficulty,
          day: state.day,
          status: state.status,
          location: state.location,
          credits: state.credits,
          ship: state.ship ? state.ship.type : null,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(STATUS_KEY, JSON.stringify(status));
      }
    } else {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_STATE_KEY);
      localStorage.removeItem(STATUS_KEY);
    }
  } catch {
    // Storage blocked (private mode): the game still works for this session.
  }
}

export function setGame(game, state = null) {
  store.game = game;
  if (game) {
    const st = state || (game.state ? game.state : null);
    rememberGame(game.id, st);
    store.summary = { id: game.id, name: game.name, day: game.day, location: game.location.name, status: game.status, over: game.status === 'over' };
  }
  emit();
}

export async function loadSetup() {
  if (!store.setup) store.setup = await api.setup();
  return store.setup;
}

/** Loads the saved game summary for the title screen. Restores from localStorage if the server was redeployed. */
export async function loadSummary() {
  const id = savedGameId();
  const state = savedGameState();
  if (!id && !state) {
    store.summary = null;
    emit();
    return null;
  }
  const targetId = id || (state && state.id);
  if (targetId) {
    try {
      const { summary } = await api.summary(targetId);
      store.summary = summary;
      emit();
      return store.summary;
    } catch (err) {
      if (err.status === 404 && state) {
        // Server data was lost or redeployed. Restore player status from browser localStorage.
        try {
          const res = await api.restoreGame(state);
          setGame(res.game, res.state);
          return store.summary;
        } catch {
          rememberGame(null);
          store.summary = null;
        }
      } else {
        if (err.status === 404) rememberGame(null);
        store.summary = null;
      }
    }
  } else if (state) {
    try {
      const res = await api.restoreGame(state);
      setGame(res.game, res.state);
      return store.summary;
    } catch {
      rememberGame(null);
      store.summary = null;
    }
  }
  emit();
  return store.summary;
}

/** Loads the full saved game (Continue). Restores from localStorage if the server was redeployed. */
export async function loadGame() {
  const state = savedGameState();
  const id = (store.game && store.game.id) || savedGameId() || (state && state.id);
  if (!id && !state) return null;

  if (id) {
    try {
      const res = await api.game(id);
      setGame(res.game, res.state);
      return res.game;
    } catch (err) {
      if (err.status !== 404 || !state) throw err;
    }
  }

  if (state) {
    const res = await api.restoreGame(state);
    setGame(res.game, res.state);
    return res.game;
  }
  return null;
}

export async function createGame(input) {
  const res = await api.createGame(input);
  store.ui = {};
  setGame(res.game, res.state);
  return res.game;
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
      setGame(result.game, result.state);
      if (!opts.quiet) notify(result.notice);
      return result.game;
    } catch (err) {
      if (err.status === 404) {
        const state = savedGameState();
        if (state) {
          try {
            const restored = await api.restoreGame(state);
            setGame(restored.game, restored.state);
            const retried = await api.act(restored.game.id, path, body, opts.method || 'POST');
            setGame(retried.game, retried.state);
            if (!opts.quiet) notify(retried.notice);
            return retried.game;
          } catch {
            // Fall through to standard error handling
          }
        }
      }
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
