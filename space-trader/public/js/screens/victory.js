// 13 · Victory & loot

import { html, attr } from '../html.js';
import { fmt, pctOf } from '../format.js';
import { store, uiState, act, resetUi } from '../store.js';
import { bar } from '../components/chrome.js';
import { debris } from '../components/art.js';
import { repaint } from '../router.js';

/** Default selection: take everything that fits, most valuable per tonne first. */
function defaultTake(v) {
  const free = v.cargoCap - v.cargoUsed;
  let used = 0;
  const taken = {};
  const items = [...v.loot].sort((a, b) => (b.value / Math.max(1, b.tonnes)) - (a.value / Math.max(1, a.tonnes)));
  for (const item of items) {
    if (used + item.tonnes <= free) {
      taken[item.id] = true;
      used += item.tonnes;
    }
  }
  return taken;
}

function state(v) {
  const s = uiState('victory', { key: null, taken: {} });
  const key = v.loot.map((l) => l.id + l.qty).join('|') + v.enemy.name;
  if (s.key !== key) {
    s.key = key;
    s.taken = defaultTake(v);
  }
  return s;
}

export default {
  name: 'victory',
  title: 'Target destroyed · Void Merchant',
  needsGame: true,
  statuses: ['victory'],
  render() {
    const g = store.game;
    const v = g.victory;
    const s = state(v);
    const used = v.cargoUsed + v.loot.reduce((t, l) => t + (s.taken[l.id] ? l.tonnes : 0), 0);
    const free = v.cargoCap - used;
    const value = v.loot.reduce((t, l) => t + (s.taken[l.id] ? l.value : 0), 0);
    const trader = v.enemy.kind === 'trader';

    return html`<div class="report sky">
      <main class="report-inner" id="main">
        <section class="report-left">
          <span class="lbl t-green">Combat report · ${v.turns} turn${v.turns === 1 ? '' : 's'}</span>
          <h1 class="report-title">TARGET<br>DESTROYED</h1>
          <p class="report-body">The ${v.enemy.name} broke apart on the lane to ${v.destination.name}. ${trader ? 'The guild will hear about this.' : 'Salvage is drifting in the debris field.'}</p>
          ${debris}
          <div class="report-stats">
            <div class="panel"><span class="lbl">Bounty</span><span class="value ${v.bounty ? 't-green' : 'dim'}">${v.bounty ? `+${fmt(v.bounty)} cr` : 'None'}</span></div>
            <div class="panel"><span class="lbl">Damage taken</span><span class="value t-red">${v.damageTaken ? `−${v.damageTaken} hull` : 'None'}</span></div>
            <div class="panel"><span class="lbl">Battle XP</span><span class="value t-amber">${v.leveled ? `Battle ${v.battle}!` : v.xp.maxed ? 'Maxed' : `${v.xp.now} / ${v.xp.need}`}</span></div>
          </div>
        </section>

        <section class="panel report-right" aria-labelledby="salvage-h">
          <div class="row-baseline wrap"><h2 id="salvage-h" style="font-size:24px;font-weight:600">Salvage</h2><span class="${free === 0 ? 't-red' : 'muted'}" style="font-size:13px">Hold space: ${free} t free</span></div>
          ${bar(pctOf(used, v.cargoCap), '', 'bar-8')}
          <div>
            ${v.loot.map((l) => {
              const on = !!s.taken[l.id];
              const blocked = !on && l.tonnes > free;
              return html`<div class="loot-row">
                <div class="stack-xs" style="gap:3px"><span class="display" style="font-size:17px;font-weight:600">${l.name}</span><span class="small muted">${l.note}${l.tonnes ? ` · ${l.tonnes} t` : ''}</span></div>
                <button type="button" class="tg" data-action="toggle" data-id="${l.id}" aria-pressed="${String(on)}"${attr('disabled', blocked)}>${on ? 'Taken' : blocked ? 'No room' : 'Take'}</button>
              </div>`;
            })}
          </div>
          <div class="list-row" style="padding-top:4px"><span class="muted">Est. value of salvage taken</span><span class="t-green">${fmt(value)} cr</span></div>
          <button type="button" class="cta mt-auto" data-action="resume">Resume course to ${v.destination.name} ›</button>
        </section>
      </main>
    </div>`;
  },
  actions: {
    toggle({ id }) {
      const v = store.game.victory;
      const s = state(v);
      const item = v.loot.find((l) => l.id === id);
      if (!item) return;
      if (s.taken[id]) {
        delete s.taken[id];
      } else {
        const used = v.cargoUsed + v.loot.reduce((t, l) => t + (s.taken[l.id] ? l.tonnes : 0), 0);
        if (used + item.tonnes <= v.cargoCap) s.taken[id] = true;
      }
      repaint();
    },
    async resume() {
      const s = state(store.game.victory);
      const take = Object.keys(s.taken);
      const game = await act('/loot', { take });
      if (game) resetUi('victory');
    }
  },
  keys: {
    enter: (root) => root.querySelector('[data-action="resume"]')?.click()
  }
};
