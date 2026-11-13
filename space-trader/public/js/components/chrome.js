// Shared chrome: the top status bar and the docked-station shell with its side nav.

import { html, raw } from '../html.js';
import { fmt, cr } from '../format.js';

export function stat(label, value, cls = '') {
  return html`<div class="stat"><span class="lbl">${label}</span><span class="stat-value ${cls}">${value}</span></div>`;
}

/** Stat sets used across screens, built from the server's header view. */
export const stats = {
  day: (h) => stat('Day', fmt(h.day)),
  credits: (h) => stat('Credits', cr(h.credits), 't-amber'),
  debt: (h) => stat('Debt', cr(h.debt), h.debt ? 't-red' : 'muted'),
  fuel: (h) => stat('Fuel', `${h.fuel} / ${h.fuelMax} ps`),
  cargo: (h) => stat('Cargo', `${h.cargoUsed} / ${h.cargoCap} t`),
  hull: (h) => stat('Hull', `${h.hullPct}%`, h.hullPct < 40 ? 't-red' : ''),
  shields: (h) => stat('Shields', `${h.shields} / ${h.shieldMax}`, 't-cyan'),
  navigation: (h) => stat('Navigation', fmt(h.navigation), 't-cyan')
};

/**
 * Top status bar.
 * @param {Object} opts
 * @param {*} opts.left content on the left (brand, links)
 * @param {Array} [opts.items] stat blocks on the right
 * @param {string} [opts.variant] '', 'hostile' or 'friendly'
 */
export function statusBar({ left, items = [], variant = '' }) {
  return html`<header class="statusbar ${variant}">
    ${left}
    ${items.length ? html`<div class="stats">${items}</div>` : ''}
  </header>`;
}

const NAV = [
  ['station', 'Overview'],
  ['market', 'Market'],
  ['shipyard', 'Shipyard'],
  ['bank', 'Bank'],
  ['commander', 'Commander']
];

/**
 * The docked layout: status bar, station services nav, and the page content.
 * @param {Object} game
 * @param {string} active route name of the current page
 * @param {*} main page content
 */
export function stationShell(game, active, main) {
  const h = game.header;
  return html`<div class="shell">
    ${statusBar({
      left: html`<span class="brand">VOID MERCHANT</span>`,
      items: [stats.day(h), stats.credits(h), stats.debt(h), stats.fuel(h), stats.cargo(h), stats.hull(h)]
    })}
    <div class="shell-body">
      <nav class="sidenav" aria-label="Station services">
        <span class="lbl">Docked · ${game.location.name}</span>
        ${NAV.map(([route, label]) => html`<a class="navlink" href="#/${route}"${raw(route === active ? ' aria-current="page"' : '')}>${label}</a>`)}
        <div class="sidenav-foot">
          <a class="cta" href="#/galaxy">Launch ›</a>
          <a class="quit" href="#/">Save &amp; quit</a>
        </div>
      </nav>
      <main class="shell-main" id="main">${main}</main>
    </div>
  </div>`;
}

/** A labelled bar: `<div class="bar"><span style="width:x%">`. */
export function bar(percent, cls = '', size = '') {
  return html`<div class="bar ${size} ${cls}" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`;
}

/** Ten-segment skill bar. */
export function segments(value, color, small = false) {
  const parts = [];
  for (let i = 0; i < 10; i++) parts.push(html`<span${raw(i < value ? ` style="background:${color}"` : '')}></span>`);
  return html`<div class="segs ${small ? 'segs-sm' : ''}" aria-hidden="true">${parts}</div>`;
}
