// 04 · Planet / station hub

import { html } from '../html.js';
import { toneClass, pctOf } from '../format.js';
import { store } from '../store.js';
import { stationShell, bar } from '../components/chrome.js';
import { heroPlanetStyle } from '../components/art.js';
import { navigate } from '../router.js';

export default {
  name: 'station',
  title: () => `${store.game.location.name} · Void Merchant`,
  needsGame: true,
  statuses: ['docked'],
  render() {
    const g = store.game;
    const st = g.station;
    const sys = st.system;
    const t = st.tiles;
    const cargo = g.cargo;
    const h = g.header;
    const main = html`<div class="station-main">
      <div class="stack" style="gap:20px;min-width:0">
        <section class="panel planet-hero" aria-labelledby="planet-name">
          <div class="planet-orb" aria-hidden="true" style="${heroPlanetStyle(sys.color)}"></div>
          <div class="planet-info">
            <span class="lbl" style="color:${sys.color}">${sys.economy} · Sector ${sys.sector}${sys.blackMarket ? ' · Black market' : ''}</span>
            <h1 class="planet-name" id="planet-name">${sys.name}</h1>
            <p class="muted" style="font-size:14px;line-height:1.6">${sys.description}</p>
            <div class="facts">
              <div class="stack-xs"><span class="lbl">Government</span><span>${sys.government}</span></div>
              <div class="stack-xs"><span class="lbl">Tech level</span><span>${sys.tech} · ${sys.techName}</span></div>
              <div class="stack-xs"><span class="lbl">Population</span><span>${sys.population}</span></div>
              <div class="stack-xs"><span class="lbl">Police</span><span>${sys.police}</span></div>
            </div>
          </div>
        </section>
        <div class="tiles">
          <a class="tile" href="#/market"><span class="lbl">Market</span><span class="tile-title">Trade goods</span><span class="small ${toneClass(t.market.tone)}">${t.market.text}</span></a>
          <a class="tile" href="#/shipyard"><span class="lbl">Shipyard</span><span class="tile-title">Ships &amp; gear</span><span class="small ${toneClass(t.shipyard.tone)}">${t.shipyard.text}</span></a>
          <a class="tile" href="#/bank"><span class="lbl">Bank</span><span class="tile-title">Loans</span><span class="small ${toneClass(t.bank.tone)}">${t.bank.text}</span></a>
          <a class="tile" href="#/galaxy"><span class="lbl">Navigation</span><span class="tile-title">Galaxy map</span><span class="small ${toneClass(t.nav.tone)}">${t.nav.text}</span></a>
        </div>
      </div>
      <aside class="stack" style="gap:20px">
        <section class="panel panel-pad stack" aria-label="Station news">
          <span class="lbl t-amber">Station news</span>
          ${st.news.length ? st.news.map((n) => html`<div class="news-item"><span class="tiny dim">${n.when}</span><span style="font-size:13px;line-height:1.5">${n.text}</span></div>`) : html`<span class="small dim">No news today.</span>`}
        </section>
        <section class="panel panel-pad stack" style="gap:10px" aria-label="Cargo hold">
          <span class="lbl">Cargo hold · ${h.cargoUsed} / ${h.cargoCap} t</span>
          ${cargo.length
            ? cargo.map((c) => html`<div class="list-row"><span>${c.name}${c.illegal ? html` <span class="tag t-red">Illegal</span>` : ''}</span><span class="muted">${c.qty} t${c.avgPaid ? ` · paid ${c.avgPaid}` : ' · salvaged'}</span></div>`)
            : html`<span class="small dim">Your hold is empty.</span>`}
          <div style="margin-top:4px">${bar(pctOf(h.cargoUsed, h.cargoCap), '', 'bar-8')}</div>
        </section>
      </aside>
    </div>`;
    return stationShell(g, 'station', main);
  },
  keys: {
    m: () => navigate('market'),
    s: () => navigate('shipyard'),
    b: () => navigate('bank'),
    c: () => navigate('commander'),
    l: () => navigate('galaxy'),
    g: () => navigate('galaxy')
  }
};
