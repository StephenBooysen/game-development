// 10 · Commander status & log

import { html } from '../html.js';
import { fmt, toneClass } from '../format.js';
import { store, uiState, act } from '../store.js';
import { stationShell, bar, segments } from '../components/chrome.js';
import { repaint } from '../router.js';

function state() {
  return uiState('commander', { confirmRetire: false });
}

export default {
  name: 'commander',
  title: 'Commander · Void Merchant',
  needsGame: true,
  statuses: ['docked'],
  leave() {
    state().confirmRetire = false;
  },
  render() {
    const g = store.game;
    const c = g.commander;
    const s = state();
    const hist = c.history;
    const max = Math.max(1, ...hist.map((h) => Math.abs(h.worth)));
    const first = hist[0];
    const last = hist[hist.length - 1];
    const rep = c.reputation;
    const retiring = c.retireEnding === 'retired';

    const main = html`<div class="cmdr-grid">
      <section class="panel" style="padding:22px;display:flex;flex-direction:column;gap:18px" aria-label="Commander profile">
        <div class="row" style="gap:14px">
          <div class="avatar" aria-hidden="true">${c.name.charAt(0).toUpperCase()}</div>
          <div class="stack-xs"><h1 style="font-size:26px;font-weight:700">Cmdr. ${c.name}</h1><span class="small muted">Rank: ${c.rank.name} · ${c.difficulty} difficulty</span></div>
        </div>
        <div class="stack-sm">
          <div class="row-between small muted"><span>${c.rank.next ? `Next rank: ${c.rank.next}` : 'Highest rank'}</span><span>${c.rank.progress}%</span></div>
          ${bar(c.rank.progress, 'amber')}
        </div>
        <div class="stack">
          <span class="lbl">Skills</span>
          ${c.skills.map((sk) => html`<div class="skill-mini">
            <span>${sk.name}</span>
            ${segments(Math.min(10, sk.eff), sk.color, true)}
            <span class="right">${sk.eff}${sk.eff !== sk.base ? html`<span class="tiny t-cyan"> (+${sk.eff - sk.base})</span>` : ''}</span>
          </div>`)}
          <span class="tiny dim">Battle experience ${c.battleXp.now} / ${c.battleXp.need} to the next point. Gadget bonuses in blue.</span>
        </div>
        <div class="stack-sm" style="gap:8px">
          <span class="lbl">Reputation</span>
          <div class="list-row"><span class="muted">Police record</span><span class="${toneClass(rep.police.tone)}">${rep.police.label}</span></div>
          <div class="list-row"><span class="muted">Pirate standing</span><span class="${toneClass(rep.pirates.tone)}">${rep.pirates.label}</span></div>
          <div class="list-row"><span class="muted">Traders' guild</span><span class="${toneClass(rep.guild.tone)}">${rep.guild.label}</span></div>
        </div>
        <div class="mt-auto stack-sm divider-top" style="gap:10px">
          <span class="lbl">Retire</span>
          <span class="small muted" style="line-height:1.5">${retiring
            ? 'Sell everything and retire now. Your score is your net worth plus pirate bounties.'
            : 'You still owe the bank. Quitting now ends the game as out of business, with a lower score.'}</span>
          ${s.confirmRetire
            ? html`<div class="row" style="gap:8px"><button type="button" class="btn btn-sm ${retiring ? 'btn-green' : 'btn-red'}" data-action="retire">Confirm</button><button type="button" class="btn btn-sm btn-ghost" data-action="cancelRetire">Keep flying</button></div>`
            : html`<button type="button" class="btn btn-sm ${retiring ? '' : 'btn-danger'}" data-action="askRetire">${retiring ? 'Retire' : 'Quit trading'}</button>`}
        </div>
      </section>

      <div class="stack" style="gap:20px;min-width:0">
        <div class="stat-tiles">
          ${c.stats.map((st) => html`<div class="panel tile-stat"><span class="lbl">${st.k}</span><span class="value ${toneClass(st.tone)}">${st.v}</span><span class="tiny dim">${st.n}</span></div>`)}
        </div>
        <section class="panel panel-pad stack" aria-label="Net worth by day">
          <div class="row-between wrap"><span class="lbl">Net worth by day</span><span class="small muted">Credits + cargo + ship − debt</span></div>
          <div class="chart-bars" role="img" aria-label="Net worth went from ${fmt(first.worth)} on day ${first.day} to ${fmt(last.worth)} on day ${last.day}">
            ${hist.map((h, i) => html`<span class="${i === hist.length - 1 ? 'last' : h.worth < 0 ? 'neg' : ''}" style="height:${Math.max(2, Math.round((Math.abs(h.worth) / max) * 100))}%" title="Day ${h.day}: ${fmt(h.worth)} cr"></span>`)}
          </div>
          <div class="row-between tiny dim"><span>Day ${first.day}</span><span>Day ${last.day}</span></div>
        </section>
        <section class="panel panel-pad stack" style="gap:8px;min-height:0" aria-label="Captain's log">
          <span class="lbl">Captain's log</span>
          <div class="scroll-y" style="max-height:340px" data-scroll="clog">
            ${c.log.map((l) => html`<div class="clog-row"><span class="dim">Day ${l.day}</span><span>${l.text}</span><span class="${toneClass(l.tone)}">${l.value}</span></div>`)}
          </div>
        </section>
      </div>
    </div>`;
    return stationShell(g, 'commander', main);
  },
  actions: {
    askRetire() {
      state().confirmRetire = true;
      repaint();
    },
    cancelRetire() {
      state().confirmRetire = false;
      repaint();
    },
    retire() {
      state().confirmRetire = false;
      act('/retire', {});
    }
  }
};
