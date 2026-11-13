// 05 · Commodity market

import { html, attr } from '../html.js';
import { fmt, signed, pctOf } from '../format.js';
import { store, uiState, act } from '../store.js';
import { stationShell, bar } from '../components/chrome.js';
import { repaint } from '../router.js';

const QTY = [['1', '×1'], ['5', '×5'], ['max', 'Max']];

function state() {
  return uiState('market', { sel: null, qty: '1' });
}

function quantity(mode, max) {
  if (mode === 'max') return max;
  return Math.min(Number(mode), max);
}

export default {
  name: 'market',
  title: () => `${store.game.location.name} market · Void Merchant`,
  needsGame: true,
  statuses: ['docked'],
  render() {
    const g = store.game;
    const m = g.market;
    const s = state();
    if (!s.sel || !m.rows.some((r) => r.id === s.sel)) s.sel = (m.rows.find((r) => r.held) || m.rows.find((r) => r.canBuy) || m.rows[0]).id;
    const sel = m.rows.find((r) => r.id === s.sel);

    const rows = m.rows.map((r) => {
      const buyQty = quantity(s.qty, r.maxBuy);
      const sellQty = quantity(s.qty, r.held);
      const bestText = r.illegal && !r.canSell
        ? (r.best ? `${r.best.system} black market` : 'Black markets only')
        : r.best ? `${r.best.system} · ${fmt(r.best.price)}${r.margin !== null ? ` (${signed(r.margin)})` : ''}` : 'No prices seen yet';
      const bestTone = r.illegal ? 't-red' : r.margin !== null && r.margin > Math.max(20, (r.buy || 0) * 0.15) ? 't-green' : 'muted';
      return html`<div class="mkt-row ${r.id === s.sel ? 'sel' : ''}">
        <button type="button" class="rowbtn" data-action="pick" data-id="${r.id}" aria-pressed="${String(r.id === s.sel)}">
          ${r.name}
          ${r.event === 'shortage' ? html`<span class="tag t-green" title="Shortage: prices are high here">Short</span>` : ''}
          ${r.event === 'glut' ? html`<span class="tag t-cyan" title="Glut: prices are low here">Glut</span>` : ''}
        </button>
        <span class="right num">${r.illegal && !r.canBuy ? html`<span class="t-red">Illegal</span>` : r.buy === null ? '—' : fmt(r.buy)}</span>
        <span class="right num muted">${r.sell === null ? '—' : fmt(r.sell)}</span>
        <span class="right num muted">${r.canBuy ? (r.stock || '0') : '—'}</span>
        <span class="right num t-cyan">${r.held || '—'}</span>
        <span class="small ${bestTone}">${bestText}</span>
        <div class="trade">
          <button type="button" class="qb" data-action="sell" data-id="${r.id}" data-qty="${sellQty}" aria-label="Sell ${sellQty} ${r.name}"${attr('disabled', !r.canSell || !r.held)}>Sell</button>
          <button type="button" class="qb" data-action="buy" data-id="${r.id}" data-qty="${buyQty}" aria-label="Buy ${buyQty} ${r.name}"${attr('disabled', !r.canBuy || r.maxBuy < 1)}>Buy</button>
        </div>
      </div>`;
    });

    const here = sel.buy || sel.sell || 0;
    const intel = [{ system: `${g.location.name} (here)`, price: here, age: 'now', here: true }, ...sel.intel];
    const max = Math.max(1, ...intel.map((i) => i.price));
    const free = m.freeCargo;
    const affordable = sel.buy ? sel.maxBuy : 0;
    const potential = sel.margin !== null ? sel.margin * affordable : null;

    const main = html`<div class="market-main">
      <section class="panel" style="display:flex;flex-direction:column;min-width:0">
        <div class="panel-head wrap">
          <h1 style="font-size:24px;font-weight:600">${g.location.name} market</h1>
          <div class="row wrap" style="gap:12px">
            <span class="small muted">Trading skill ${m.trading} · prices −${m.discountPct}%</span>
            <div class="qty-pills" role="group" aria-label="Trade quantity">
              ${QTY.map(([v, l]) => html`<button type="button" class="pill pill-sm" data-action="qty" data-id="${v}" aria-pressed="${String(s.qty === v)}">${l}</button>`)}
            </div>
          </div>
        </div>
        <div class="scroll-x">
          <div class="mkt-table" role="table" aria-label="Goods">
            <div class="mkt-row head lbl" role="row">
              <span>Good</span><span class="right">Buy</span><span class="right">Sell</span><span class="right">Stock</span><span class="right">Hold</span><span>Best price seen</span><span class="right">Trade</span>
            </div>
            ${rows}
          </div>
        </div>
      </section>

      <aside class="stack" style="gap:16px">
        <section class="panel panel-pad stack" style="gap:14px" aria-label="Price intel">
          <span class="lbl t-amber">Price intel</span>
          <h2 style="font-size:22px;font-weight:600">${sel.name}</h2>
          <span class="small muted">${sel.held ? `You hold ${sel.held} t${sel.avgPaid ? `, paid ${fmt(sel.avgPaid)}/t on average` : ' (salvaged)'}.` : 'Last prices you saw across the galaxy.'}</span>
          ${intel.length > 1 || here
            ? intel.map((i) => html`<div class="stack-sm" style="gap:5px">
                <div class="list-row"><span>${i.system}</span><span>${fmt(i.price)} cr <span class="dim">· ${i.age}${i.tip ? ' (tip)' : ''}</span></span></div>
                ${bar(pctOf(i.price, max), i.here ? 'amber' : '')}
              </div>`)
            : ''}
          ${!sel.intel.length ? html`<span class="small dim">Visit other systems (or buy a trader's tip) to compare prices.</span>` : ''}
        </section>
        <section class="panel panel-pad stack" style="gap:10px" aria-label="Profit estimate">
          <span class="lbl">If you fill the hold</span>
          <div class="list-row"><span class="muted">Free space</span><span>${free} t</span></div>
          <div class="list-row"><span class="muted">You can afford</span><span>${sel.buy ? `${affordable} t` : '—'}</span></div>
          <div class="list-row"><span class="muted">Margin per unit</span><span>${sel.margin !== null ? `${signed(sel.margin)} cr` : 'n/a'}</span></div>
          <div class="row-baseline divider-top">
            <span class="muted" style="font-size:13px">Potential profit</span>
            <span class="display" style="font-size:24px;font-weight:700;color:${potential !== null && potential < 0 ? 'var(--red)' : 'var(--green)'}">${potential !== null ? `${signed(potential)} cr` : '—'}</span>
          </div>
        </section>
      </aside>
    </div>`;
    return stationShell(g, 'market', main);
  },
  actions: {
    pick({ id }) {
      state().sel = id;
      repaint();
    },
    qty({ id }) {
      state().qty = id;
      repaint();
    },
    buy({ id, qty }) {
      state().sel = id;
      const n = Number(qty);
      if (n > 0) act('/market/buy', { good: id, qty: n });
    },
    sell({ id, qty }) {
      state().sel = id;
      const n = Number(qty);
      if (n > 0) act('/market/sell', { good: id, qty: n });
    }
  }
};
