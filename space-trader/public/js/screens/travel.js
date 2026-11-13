// 09 · Warp in progress

import { html } from '../html.js';
import { fmt, toneClass } from '../format.js';
import { store, act } from '../store.js';
import { statusBar, stats } from '../components/chrome.js';
import { playerShip } from '../components/art.js';

const STREAKS = Array.from({ length: 40 }, (_, i) => ({
  top: (i * 53) % 100,
  width: 40 + ((i * 29) % 160),
  opacity: (20 + ((i * 17) % 70)) / 100,
  duration: 0.6 + ((i * 7) % 10) / 10,
  delay: -((i * 13) % 20) / 10
}));

export default {
  name: 'travel',
  title: 'In warp · Void Merchant',
  needsGame: true,
  statuses: ['travel'],
  render() {
    const g = store.game;
    const t = g.travel;
    const c = t.contact;
    const h = g.header;
    const pending = c && !c.resolved;
    const phase = !c ? 'run' : pending ? 'half' : 'resume';

    let sensor;
    if (pending) sensor = html`<span class="lbl t-red">Sensor contact</span><span class="display t-red" style="font-size:18px;font-weight:600">Unknown vessel · ${fmt(c.distanceKm)} km</span>`;
    else if (c) sensor = html`<span class="lbl t-green">Contact lost</span><span class="display t-green" style="font-size:18px;font-weight:600">Lane clear</span>`;
    else sensor = html`<span class="lbl t-cyan">Long-range scanner</span><span class="display t-cyan" style="font-size:18px;font-weight:600">No contacts</span>`;

    const dayLabel = pending ? `Mid-jump · ${Math.ceil(t.dist / 2)} ps travelled` : `${t.days} day${t.days === 1 ? '' : 's'} · ${t.dist} ps`;

    const choose = html`<section class="panel panel-warn panel-pad stack" style="gap:12px" aria-labelledby="course-h">
      <span class="lbl t-red" id="course-h">Choose your course</span>
      <p class="muted" style="font-size:13px;line-height:1.6">A ship has dropped out of warp on your heading. Its transponder is off.</p>
      <div class="choice-grid mt-auto">
        <button type="button" class="btn btn-solid" data-action="contact" data-id="scan">Scan contact</button>
        <button type="button" class="btn" data-action="contact" data-id="hail">Hail them</button>
        <button type="button" class="btn btn-ghost" data-action="contact" data-id="evade">Evade &amp; continue</button>
        <button type="button" class="btn btn-ghost" data-action="contact" data-id="abort">Abort jump</button>
      </div>
    </section>`;

    const clear = html`<section class="panel panel-pad stack" style="gap:12px" aria-labelledby="arrive-h">
      <span class="lbl t-green" id="arrive-h">${c ? 'Course clear' : 'Clear skies'}</span>
      <p class="muted" style="font-size:13px;line-height:1.6">${c ? `You are back on course for ${t.to.name}.` : `Nothing but empty lanes between here and ${t.to.name}.`} Prices, interest and news move on while you travel.</p>
      <div class="stack mt-auto ${phase === 'run' ? 'reveal-late' : ''}" style="gap:10px">
        <button type="button" class="cta" data-action="arrive">Drop out of warp at ${t.to.name} ›</button>
        ${t.canAbort ? html`<button type="button" class="btn btn-ghost" data-action="contact" data-id="abort">Abort &amp; return to ${t.from.name}</button>` : ''}
      </div>
    </section>`;

    return html`<div class="screen-col" style="--warp-time:1.8s">
      ${statusBar({
        left: html`<span class="brand">IN WARP</span><span class="muted" style="font-size:13px">${t.from.name} → ${t.to.name}</span>`,
        items: [stats.day(h), stats.fuel(h), stats.shields(h), stats.hull(h), stats.cargo(h)]
      })}
      <section class="viewport" aria-label="Viewport">
        ${STREAKS.map((s) => html`<span class="streak" aria-hidden="true" style="top:${s.top}%;width:${s.width}px;opacity:${s.opacity};animation-duration:${s.duration}s;animation-delay:${s.delay}s"></span>`)}
        <div class="warp-ship">${playerShip(g.ship.type, { label: `Your ship, the ${g.ship.name}, in warp`, width: 260 })}</div>
        <div class="sensor">${sensor}</div>
        <div class="progress-wrap">
          <div class="row-between small muted"><span>${t.from.name.toUpperCase()}</span><span class="t-amber">${dayLabel}</span><span>${t.to.name.toUpperCase()}</span></div>
          <div class="progress" aria-hidden="true"><div class="progress-fill ${phase}"></div><span class="progress-marker ${phase}"></span></div>
        </div>
      </section>
      <div class="travel-body">
        <section class="panel panel-pad stack" style="gap:10px;min-height:0" aria-label="Ship's log">
          <span class="lbl">Ship's log</span>
          <div class="stack scroll-y" style="gap:10px;max-height:260px" data-scroll="tlog">
            ${t.log.map((l) => html`<div class="log-row"><span class="dim">Day ${l.day}</span><span class="${l.tone === 'neutral' ? '' : toneClass(l.tone)}">${l.text}</span></div>`)}
          </div>
        </section>
        ${pending ? choose : clear}
      </div>
    </div>`;
  },
  actions: {
    contact({ id }) {
      act('/travel/contact', { action: id });
    },
    arrive() {
      act('/travel/arrive', {});
    }
  },
  keys: {
    enter: (root) => { const b = root.querySelector('[data-action="arrive"]'); if (b) b.click(); },
    s: (root) => { const b = root.querySelector('[data-id="scan"]'); if (b) b.click(); },
    h: (root) => { const b = root.querySelector('[data-id="hail"]'); if (b) b.click(); },
    e: (root) => { const b = root.querySelector('[data-id="evade"]'); if (b) b.click(); }
  }
};

