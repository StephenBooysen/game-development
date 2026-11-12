import { GAMES } from './games/registry.js';
import { Session } from './shared/session.js';
import { makeSaveStore } from './shared/saves.js';

/**
 * The lobby, and the only thing that knows more than one game exists.
 *
 * It shows a card per entry in the registry, asks each one's save store whether
 * there's a run to come back to, and on a pick fetches that module and hands it
 * to a Session. Everything after that is the game's own business.
 */

const lobby = document.getElementById('lobby');
const shelf = document.getElementById('shelf');
const canvas = document.getElementById('viewport');

/** Small enough to be worth showing on the card: how far along a run is. */
function describeSave(data) {
  const state = data?.state;
  if (!state) return null;
  const day = state.day ?? 1;
  const gold = state.gold ?? 0;
  const when = data.savedAt ? new Date(data.savedAt) : null;
  const stamp = when && !Number.isNaN(when.valueOf())
    ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return `day ${day} · ${gold.toLocaleString()} banked${stamp ? ` · ${stamp}` : ''}`;
}

function card(game, save) {
  const el = document.createElement('article');
  el.className = 'game-card';
  el.dataset.game = game.theme;
  el.innerHTML = `
    <div class="game-art" aria-hidden="true"><span class="game-mark"></span></div>
    <div class="game-body">
      <h2 class="game-name"></h2>
      <p class="game-tagline"></p>
      <p class="game-blurb"></p>
      <ul class="game-bullets"></ul>
      <p class="game-save" hidden></p>
      <div class="game-actions">
        <button class="btn btn-primary" data-act="continue" hidden>Continue</button>
        <button class="btn" data-act="new">New game</button>
      </div>
    </div>`;

  el.querySelector('.game-mark').textContent = game.icon;
  el.querySelector('.game-name').textContent = game.name;
  el.querySelector('.game-tagline').textContent = game.tagline;
  el.querySelector('.game-blurb').textContent = game.blurb;
  const list = el.querySelector('.game-bullets');
  for (const line of game.bullets) {
    const li = document.createElement('li');
    li.textContent = line;
    list.append(li);
  }

  const cont = el.querySelector('[data-act="continue"]');
  const fresh = el.querySelector('[data-act="new"]');
  const note = el.querySelector('.game-save');
  const summary = describeSave(save);

  if (summary) {
    cont.hidden = false;
    note.hidden = false;
    note.textContent = summary;
    // With a run in progress, starting over is the deliberate choice.
    fresh.classList.remove('btn-primary');
    fresh.textContent = 'Start over';
  } else {
    fresh.classList.add('btn-primary');
  }

  cont.addEventListener('click', () => start(game, save));
  fresh.addEventListener('click', () => {
    if (summary && !confirm(`Start ${game.name} over? The run in progress will be lost.`)) return;
    start(game, null, { wipe: !!summary });
  });

  return el;
}

let starting = false;

async function start(descriptor, save, { wipe = false } = {}) {
  if (starting) return;
  starting = true;
  lobby.hidden = true;
  location.hash = descriptor.id;

  // Starting over has to take effect before the first frame, not at the first
  // autosave — otherwise quitting straight out of a fresh run leaves the old
  // one on disk and the lobby offers to continue something you discarded.
  if (wipe) {
    try {
      await makeSaveStore(descriptor.slot, descriptor.legacyKeys).clear();
    } catch { /* a stale save is better than a dead start button */ }
  }

  const module = await descriptor.load();
  const session = new Session(module, canvas);
  window.game = session; // handy from the console while tuning

  if (!await session.boot()) return;
  if (save?.state) session.startFrom(save);
  else session.startNew();
}

async function showLobby() {
  document.body.dataset.game = 'lobby';
  shelf.innerHTML = '';

  // Ask every game whether it has something to come back to, in parallel —
  // one slow slot shouldn't hold up the whole shelf.
  const saves = await Promise.all(GAMES.map(async (game) => {
    try {
      return await makeSaveStore(game.slot, game.legacyKeys).read();
    } catch {
      return null;
    }
  }));

  GAMES.forEach((game, i) => shelf.append(card(game, saves[i])));
  lobby.hidden = false;
}

// A direct link (or a reload from inside a game) drops you back in the lobby
// unless the hash names a game that actually exists.
const wanted = GAMES.find((g) => g.id === location.hash.slice(1));
if (wanted) {
  makeSaveStore(wanted.slot, wanted.legacyKeys).read()
    .then((save) => start(wanted, save))
    .catch(() => showLobby());
} else {
  showLobby();
}
