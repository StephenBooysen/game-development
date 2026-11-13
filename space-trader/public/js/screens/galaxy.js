// 08 · Galaxy map

import { html, raw } from '../html.js';
import { fmt, signed, plural } from '../format.js';
import { store, uiState, act } from '../store.js';
import { statusBar, stats } from '../components/chrome.js';
import { planetStyle } from '../components/art.js';
import { repaint } from '../router.js';

const W = 940;
const H = 736;
const DANGER_COLORS = ['var(--green)', 'var(--amber)', 'var(--red)'];

function state() {
  return uiState('galaxy', { sel: null });
}

function defaultSelection(systems) {
  const profit = (x) => (x.prices && x.prices.best ? x.prices.best.profit : 0);
  const reachable = systems.filter((s) => s.inRange).sort((a, b) => profit(b) - profit(a) || a.dist - b.dist);
  return (reachable[0] || systems.filter((s) => !s.here).sort((a, b) => a.dist - b.dist)[0]).id;
}

function sourceLabel(p) {
  if (p.source === 'typical') return 'Typical prices · not visited yet';
  const when = p.ageDays <= 0 ? 'today' : `${plural(p.ageDays, 'day')} ago`;
  return p.source === 'tip' ? `From a trader’s tip · ${when}` : `Prices seen ${when}`;
}

function bestRun(p, free) {
  const b = p.best;
  if (!b) return html`<div class="panel run-best"><span class="lbl">Best buy here</span><span class="muted">Nothing on sale here sells for more there.</span></div>`;
  if (!b.qty) {
    const why = free <= 0 ? 'your hold is full' : 'you can’t afford a tonne';
    return html`<div class="panel run-best"><span class="lbl">Best buy here</span><strong>${b.good} · ${signed(b.margin)} cr/t</strong><span class="muted">But ${why}.</span></div>`;
  }
  return html`<div class="panel run-best"><span class="lbl">Best buy here</span>
    <strong>${b.qty} t ${b.good} → <span class="t-green">${signed(b.profit)} cr</span></strong>
    <span class="muted">${signed(b.margin)} cr a tonne, with the credits and hold space you have.${b.illegal ? ' Contraband: customs may seize it.' : ''}</span>
  </div>`;
}

function priceTable(sel) {
  const rows = sel.prices.rows.map((r) => {
    const tone = r.margin === null ? '' : r.margin > 0 ? 't-green' : r.margin < 0 ? 't-red' : 'muted';
    return html`<tr class="${r.margin === null ? 'off' : ''}">
      <th scope="row"><span>${r.name}</span>${r.illegal ? html`<span class="tag t-red">Illegal</span>` : ''}${r.aboard ? html`<span class="dest-sub">${r.aboard} t aboard · paid ${fmt(r.paid)} cr</span>` : ''}</th>
      <td>${fmt(r.buyHere)}</td>
      <td>${fmt(r.sellThere)}</td>
      <td class="${tone}">${r.margin === null ? '—' : signed(r.margin)}</td>
    </tr>`;
  });
  return html`<table class="dest-table">
    <caption class="sr-only">Prices for a run to ${sel.name}, in credits per tonne</caption>
    <thead><tr><th scope="col">Good</th><th scope="col">Buy here</th><th scope="col">Sell there</th><th scope="col">Profit /t</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export default {
  name: 'galaxy',
  title: 'Galaxy map · Void Merchant',
  needsGame: true,
  statuses: ['docked'],
  render() {
    const g = store.game;
    const map = g.galaxy;
    const s = state();
    const byId = Object.fromEntries(map.systems.map((x) => [x.id, x]));
    if (!s.sel || !byId[s.sel] || byId[s.sel].here) s.sel = defaultSelection(map.systems);
    const here = byId[map.here];
    const sel = byId[s.sel];

    const lanes = map.lanes.map(([a, b]) => `M${byId[a].x} ${byId[a].y} L${byId[b].x} ${byId[b].y}`).join(' ');
    const route = sel && !sel.here ? `M${here.x} ${here.y} L${sel.x} ${sel.y}` : '';

    const systems = map.systems.map((x) => {
      const on = x.id === s.sel;
      const size = x.here ? 18 : 14;
      const ring = on ? '0 0 0 4px #070A10,0 0 0 6px #FFB547' : x.here ? '0 0 0 4px #070A10,0 0 0 6px #FFB54788' : 'none';
      const labelColor = x.here ? 'var(--amber)' : x.inRange ? '#E6ECF5' : 'var(--dim)';
      const sub = x.here ? 'You are here' : `${x.dist} ps${x.pirate ? ' ▲' : ''}`;
      const aria = `${x.name}, ${x.here ? 'current system' : `${x.dist} parsecs, ${x.inRange ? 'in range' : 'out of range'}, ${x.dangerName.toLowerCase()} danger${x.pirate ? ', pirate activity' : ''}`}`;
      return html`<button type="button" class="sys" data-action="pick" data-id="${x.id}" aria-pressed="${String(on)}" aria-label="${aria}"
        style="left:${(x.x / W) * 100}%;top:${(x.y / H) * 100}%;color:${labelColor}">
        <span class="sys-dot" style="width:${size}px;height:${size}px;background:${x.color};opacity:${x.inRange || x.here ? 1 : 0.5};box-shadow:${ring}"></span>
        <span>${x.name}</span>
        <span class="sys-sub">${sub}</span>
      </button>`;
    });

    const h = g.header;
    return html`<div class="galaxy">
      ${statusBar({
        left: html`<a href="#/station" class="small">‹ Back to ${g.location.name}</a><span class="brand">GALAXY MAP</span>`,
        items: [stats.day(h), stats.credits(h), stats.fuel(h), stats.cargo(h), stats.navigation(h)]
      })}
      <div class="galaxy-body">
        <section class="chart sky sky-dim" aria-label="Star chart">
          <div class="chart-frame">
            <svg aria-hidden="true" viewBox="0 0 ${W} ${H}" fill="none">
              <circle cx="${here.x}" cy="${here.y}" r="${map.rangeUnits}" fill="#5CC8FF" fill-opacity=".04"></circle>
              <circle cx="${here.x}" cy="${here.y}" r="${map.rangeUnits}" stroke="#5CC8FF" stroke-opacity=".45" stroke-dasharray="6 6"></circle>
              <path d="${lanes}" stroke="#2E3B57" stroke-width="1"></path>
              ${route ? raw(`<path d="${route}" stroke="#FFB547" stroke-width="2"></path>`) : ''}
            </svg>
            ${systems}
          </div>
          <div class="legend">
            <span><span class="t-cyan">- - -</span> Fuel range ${map.fuel} ps</span>
            <span><span class="t-amber">●</span> You are here</span>
            <span><span class="t-red">▲</span> Pirate activity</span>
          </div>
        </section>

        <aside class="galaxy-aside" aria-label="Selected system">
          <span class="lbl" style="color:${DANGER_COLORS[sel.danger]}">${sel.economy}${sel.pirate ? ' · Pirates reported' : ''}</span>
          <div class="row" style="gap:16px">
            <div class="planet-sm" aria-hidden="true" style="${planetStyle(sel.color, 64)}"></div>
            <div class="stack-xs" style="gap:4px"><h1 style="font-size:32px;line-height:1;font-weight:700">${sel.name}</h1><span class="muted" style="font-size:13px">${sel.government} · ${sel.techName}</span></div>
          </div>
          <div class="facts-2">
            <div class="panel"><span class="lbl">Distance</span><span>${sel.dist} parsecs</span></div>
            <div class="panel"><span class="lbl">Fuel after</span><span class="${sel.fuelAfter < 0 ? 't-red' : ''}">${sel.fuelAfter >= 0 ? `${sel.fuelAfter} / ${map.fuelMax} ps` : 'Not enough'}</span></div>
            <div class="panel"><span class="lbl">Travel time</span><span>${sel.days} day${sel.days === 1 ? '' : 's'}</span></div>
            <div class="panel"><span class="lbl">Danger</span><span style="color:${DANGER_COLORS[sel.danger]}">${sel.dangerName}</span></div>
          </div>
          <div class="stack-sm" style="gap:10px">
            <span class="lbl t-amber">${sourceLabel(sel.prices)}</span>
            ${bestRun(sel.prices, map.free)}
            ${priceTable(sel)}
            <span class="small dim">Prices drift during the ${plural(sel.days, 'day')} in warp. — means not on sale here, or not bought there.${sel.prices.source === 'typical' ? ' News of shortages and gluts moves prices away from typical.' : ''}</span>
          </div>
          <div class="mt-auto stack-sm" style="gap:8px">
            ${sel.inRange
              ? html`<button type="button" class="cta" data-action="warp" data-id="${sel.id}">Warp to ${sel.name} ›</button>`
              : html`<span class="cta-static">${sel.here ? 'You are docked here' : 'Out of fuel range'}</span>`}
            ${!sel.inRange && !sel.here ? html`<a href="#/shipyard" class="small" style="text-align:center">Refuel at the shipyard</a>` : ''}
          </div>
        </aside>
      </div>
    </div>`;
  },
  actions: {
    pick({ id }) {
      state().sel = id;
      repaint();
    },
    warp({ id }) {
      act('/travel', { to: id }, { quiet: true });
    }
  },
  keys: {
    escape: () => { location.hash = '#/station'; },
    w: (root) => { const b = root.querySelector('[data-action="warp"]'); if (b) b.click(); }
  }
};
