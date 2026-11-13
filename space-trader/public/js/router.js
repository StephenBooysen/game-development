// Hash router + rendering loop + delegated events.
//
// A screen is { name, title, render(), load?(), after?(root), leave?(),
//   needsGame?, statuses?, accepts?(game), actions?, inputs?, keys? }.
// `render` returns html; buttons declare data-action="name" (and data-id) and
// the router calls screen.actions[name](dataset, root, element).

import { store, subscribe, loadGame } from './store.js';
import { toast } from './toast.js';

let screens = {};
let current = null;
let root = null;
let showToken = 0;

/** The screen a game in its current state belongs on. */
export function homeRoute(game) {
  switch (game && game.status) {
    case 'docked': return 'station';
    case 'travel': return 'travel';
    case 'encounter': return game.encounter && game.encounter.kind === 'trader' ? 'trader' : 'encounter';
    case 'combat': return 'combat';
    case 'victory': return 'victory';
    case 'over': return 'gameover';
    default: return '';
  }
}

function parseRoute() {
  return location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
}

function accepts(screen, game) {
  if (!screen.needsGame) return true;
  if (!game) return false;
  if (screen.statuses && !screen.statuses.includes(game.status)) return false;
  return screen.accepts ? screen.accepts(game) : true;
}

/** Goes to a route. `replace` swaps the history entry instead of adding one. */
export function navigate(route, replace = false) {
  const hash = `#/${route}`;
  if (location.hash === hash || (route === '' && (location.hash === '' || location.hash === '#'))) {
    show();
  } else if (replace) {
    history.replaceState(null, '', hash);
    show();
  } else {
    location.hash = hash;
  }
}

async function show() {
  const token = ++showToken;
  const route = parseRoute();
  const screen = screens[route] || screens[''];

  if (screen.needsGame && !store.game) {
    try { await loadGame(); } catch { /* fall through to the title */ }
    if (token !== showToken) return;
    if (!store.game) { navigate('', true); return; }
  }
  if (screen.needsGame && !accepts(screen, store.game)) {
    navigate(homeRoute(store.game), true);
    return;
  }
  if (screen.load) {
    try { await screen.load(); } catch (err) { toast(err.message, 'error'); }
    if (token !== showToken) return;
  }

  const changed = !current || current.screen !== screen;
  if (changed && current && current.screen.leave) current.screen.leave();
  current = { route, screen };
  paint();
  if (changed) {
    window.scrollTo(0, 0);
    if (screen.enter) screen.enter(root);
  }
}

/** Re-renders the current screen (after local UI state changes). */
export function repaint() {
  if (current) paint();
}

function focusSelector(el) {
  if (!el || !root.contains(el)) return null;
  if (el.dataset && el.dataset.action) {
    return `[data-action="${CSS.escape(el.dataset.action)}"]${el.dataset.id ? `[data-id="${CSS.escape(el.dataset.id)}"]` : ''}`;
  }
  if (el.id) return `#${CSS.escape(el.id)}`;
  return null;
}

function paint() {
  const screen = current.screen;
  const focusSel = focusSelector(document.activeElement);
  const scrolls = {};
  root.querySelectorAll('[data-scroll]').forEach((el) => { scrolls[el.dataset.scroll] = el.scrollTop; });

  root.innerHTML = screen.render().toString();
  document.title = typeof screen.title === 'function' ? screen.title() : screen.title;

  root.querySelectorAll('[data-scroll]').forEach((el) => {
    if (scrolls[el.dataset.scroll] !== undefined) el.scrollTop = scrolls[el.dataset.scroll];
  });
  if (focusSel) {
    const el = root.querySelector(focusSel);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  if (screen.after) screen.after(root);
}

/**
 * Boots the router.
 * @param {HTMLElement} rootEl
 * @param {Object<string, Object>} screenMap route name → screen ('' is the title)
 */
export function start(rootEl, screenMap) {
  root = rootEl;
  screens = screenMap;

  window.addEventListener('hashchange', show);

  // Game state changed (after an action): follow the game to its screen, or redraw.
  subscribe(() => {
    if (!current) return;
    const screen = current.screen;
    if (screen.needsGame && store.game && !accepts(screen, store.game)) navigate(homeRoute(store.game), true);
    else repaint();
  });

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = current && current.screen.actions && current.screen.actions[el.dataset.action];
    if (fn) {
      e.preventDefault();
      fn(el.dataset, root, el, e);
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    const fn = el && current && current.screen.inputs && current.screen.inputs[el.dataset.input];
    if (fn) fn(el.value, root, el);
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    const fn = current && current.screen.keys && current.screen.keys[e.key.toLowerCase()];
    if (fn) {
      e.preventDefault();
      fn(root);
    }
  });

  show();
}
