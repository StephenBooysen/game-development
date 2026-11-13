// 03 · Starter ship assigned

import { html } from '../html.js';
import { fmt, cr, pctOf } from '../format.js';
import { store } from '../store.js';
import { kestrelSchematic } from '../components/art.js';
import { bar } from '../components/chrome.js';

const SLOT_LABEL = { weapon: 'Weapon', shield: 'Shield', gadget: 'Gadget' };

export default {
  name: 'shipAssigned',
  title: 'Your ship · Void Merchant',
  needsGame: true,
  statuses: ['docked'],
  render() {
    const g = store.game;
    const s = g.ship;
    const specs = [
      ['Hull', `${s.hull} / ${s.hullMax}`, pctOf(s.hullMax, 260)],
      ['Shields', `${s.shields} / ${s.shieldMax}`, pctOf(s.shieldMax, 160)],
      ['Cargo hold', `${s.cargoCap} tonnes`, pctOf(s.cargoCap, 60)],
      ['Fuel range', `${s.fuelMax} parsecs`, pctOf(s.fuelMax, 15)],
      ['Speed', `${s.speed} / 10`, s.speed * 10],
      ['Crew quarters', `1 of ${s.crew}`, pctOf(1, s.crew)]
    ];
    const slots = [];
    for (const type of ['weapon', 'shield', 'gadget']) {
      const fitted = s.equipment.filter((e) => e.type === type);
      for (let i = 0; i < s.slots[type]; i++) {
        const item = fitted[i];
        slots.push(item
          ? html`<div class="slot">${SLOT_LABEL[type]}<span class="t-cyan">${item.name}</span></div>`
          : html`<div class="slot empty">${SLOT_LABEL[type]}<br>Empty</div>`);
      }
    }
    return html`<div class="page" style="background:var(--bg)">
      <main class="page-inner" id="main">
        <header class="page-head">
          <div class="stack-sm">
            <span class="lbl t-cyan">Step 2 of 2 · Hangar 3, ${g.location.name} Orbital</span>
            <h1 class="page-title">Welcome aboard, Commander ${g.name}</h1>
          </div>
        </header>
        <div class="sa-grid">
          <section class="schematic grid-bg" aria-label="Ship schematic">
            <span class="lbl t-cyan corner-tl">Schematic · top view</span>
            <span class="lbl corner-tr">Reg. ${s.registration}</span>
            ${kestrelSchematic(s.cargoCap)}
            <div class="corner-bl stack-xs">
              <span class="display strong" style="font-size:30px;font-weight:700;text-transform:uppercase">${s.name}</span>
              <span class="muted" style="font-size:13px">${s.cls} · ${s.maker} · Value ${cr(s.value)}</span>
            </div>
          </section>
          <aside class="panel" style="padding:24px;display:flex;flex-direction:column;gap:18px">
            <h2 style="font-size:20px;font-weight:600">Ship specifications</h2>
            <div class="stack">
              ${specs.map(([k, v, p]) => html`<div class="stack-sm">
                <div class="list-row"><span class="muted">${k}</span><span class="strong">${v}</span></div>
                ${bar(p)}
              </div>`)}
            </div>
            <div class="stack-sm" style="gap:8px">
              <span class="lbl">Equipment slots</span>
              <div class="slots">${slots}</div>
            </div>
            <div class="mt-auto stack" style="gap:10px">
              <a class="cta" href="#/station">Enter ${g.location.name} station ›</a>
              <span class="small dim" style="text-align:center">Fuel tanks full · ${fmt(g.header.credits)} cr in your account</span>
            </div>
          </aside>
        </div>
      </main>
    </div>`;
  }
};
