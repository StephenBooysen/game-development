// 14 · Encounter: trader in space

import { html, attr } from '../html.js';
import { fmt } from '../format.js';
import { store, uiState, act } from '../store.js';
import { statusBar, stats } from '../components/chrome.js';
import { hauler } from '../components/art.js';
import { repaint } from '../router.js';

const TAG_COLORS = { buy: 'var(--cyan)', sell: 'var(--green)', tip: 'var(--amber)' };

function state() {
  return uiState('trader', { confirmAttack: false });
}

export default {
  name: 'trader',
  title: 'Friendly contact · Void Merchant',
  needsGame: true,
  statuses: ['encounter'],
  accepts: (game) => game.encounter && game.encounter.kind === 'trader',
  leave() {
    state().confirmAttack = false;
  },
  render() {
    const g = store.game;
    const e = g.encounter;
    const t = g.travel;
    const enemy = e.enemy;
    const h = g.header;
    const s = state();

    const offers = e.offers.map((o) => {
      const amount = o.cost > 0 ? `−${fmt(o.cost)} cr` : `+${fmt(-o.cost)} cr`;
      return html`<article class="panel offer">
        <div class="stack-sm">
          <span class="lbl" style="color:${TAG_COLORS[o.type]}">${o.tag}</span>
          <span class="display" style="font-size:20px;font-weight:600">${o.title}</span>
          <span class="small muted">${o.note}</span>
        </div>
        <div class="offer-actions">
          <span class="display" style="font-size:22px;font-weight:700;color:${o.cost > 0 ? 'var(--amber)' : 'var(--green)'}">${amount}</span>
          ${o.status === 'open'
            ? html`<div class="row" style="gap:8px">
                <button type="button" class="btn btn-sm btn-ghost" data-action="decline" data-id="${o.id}">Decline</button>
                <button type="button" class="btn btn-sm btn-solid" data-action="accept" data-id="${o.id}" title="${o.blocker || ''}"${attr('disabled', !!o.blocker)}>Accept</button>
              </div>
              ${o.blocker ? html`<span class="tiny t-red">${o.blocker}</span>` : ''}`
            : html`<span class="small ${o.status === 'accepted' ? 't-green' : 'dim'}">${o.status === 'accepted' ? 'Deal done' : 'Declined'}</span>`}
        </div>
      </article>`;
    });

    return html`<div class="screen-col">
      ${statusBar({
        variant: 'friendly',
        left: html`<span class="dot" aria-hidden="true" style="background:var(--cyan)"></span><span class="brand cyan">FRIENDLY CONTACT</span><span class="muted" style="font-size:13px">${t.from.name} → ${t.to.name} lane · Day ${g.day}</span>`,
        items: [stats.credits(h), stats.cargo(h)]
      })}
      <div class="trader-body">
        <section class="trader-side sky sky-deep" aria-label="Contact details">
          ${hauler(`Free trader ${enemy.name}, a bulk hauler`)}
          <div class="stack-xs" style="gap:4px">
            <span class="lbl t-cyan">${enemy.cls}</span>
            <h1 style="font-size:34px;font-weight:700">${enemy.name}</h1>
            <span class="muted" style="font-size:13px">Captain ${enemy.captain} · Traders’ guild member</span>
          </div>
          <div class="panel stack-sm" style="padding:16px;gap:8px">
            <span class="lbl">Transmission</span>
            <p class="quote">“${e.line}”</p>
          </div>
          <div class="kv">
            <span class="muted">Hull <b>${enemy.hull}</b></span><span class="muted">Weapons <b>${enemy.weapons}</b></span>
            <span class="muted">Cargo <b>${enemy.cargoUsed} / ${enemy.cargoCap} t</b></span><span class="muted">Mood <b class="t-green">Friendly</b></span>
          </div>
        </section>

        <section class="trader-main" aria-labelledby="offers-h">
          <h2 id="offers-h" style="font-size:24px;font-weight:600">Offers</h2>
          ${offers.length ? offers : html`<span class="muted">They have nothing to offer today.</span>`}
          <div class="mt-auto" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
            ${s.confirmAttack
              ? html`<button type="button" class="btn btn-red" data-action="attack">Confirm attack · record drops</button>`
              : html`<button type="button" class="btn btn-danger" data-action="askAttack">Attack them · police record drops</button>`}
            <button type="button" class="btn btn-solid" data-action="leave">Wish them well &amp; continue ›</button>
          </div>
        </section>
      </div>
    </div>`;
  },
  actions: {
    accept({ id }) {
      act('/trader', { action: 'accept', offer: id });
    },
    decline({ id }) {
      act('/trader', { action: 'decline', offer: id }, { quiet: true });
    },
    askAttack() {
      state().confirmAttack = true;
      repaint();
    },
    attack() {
      state().confirmAttack = false;
      act('/trader', { action: 'attack' });
    },
    leave() {
      act('/trader', { action: 'leave' });
    }
  }
};
