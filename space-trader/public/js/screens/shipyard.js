// 06 · Shipyard, fuel & repairs

import { html, attr } from '../html.js';
import { fmt, cr, pctOf } from '../format.js';
import { store, uiState, act } from '../store.js';
import { stationShell, bar } from '../components/chrome.js';
import { shipCard } from '../components/art.js';
import { repaint } from '../router.js';

const slotText = (s) => `${s.weapon}W ${s.shield}S ${s.gadget}G`;

function state() {
  return uiState('shipyard', { confirmShip: null });
}

export default {
  name: 'shipyard',
  title: () => `${store.game.location.name} shipyard · Void Merchant`,
  needsGame: true,
  statuses: ['docked'],
  leave() {
    state().confirmShip = null;
  },
  render() {
    const g = store.game;
    const y = g.shipyard;
    const s = state();
    const free = y.slotsFree;
    const freeText = ['weapon', 'shield', 'gadget'].filter((t) => free[t] > 0).map((t) => `${free[t]} ${t}`).join(' · ') || 'none';

    const main = html`<div class="yard">
      <div class="yard-top">
        <section class="panel service" aria-label="Refuel">
          <span class="lbl t-cyan">Refuel</span><span></span>
          <div class="stack-sm" style="gap:8px">
            <span class="display" style="font-size:20px;font-weight:600">${y.fuel.current} / ${y.fuel.max} parsecs</span>
            ${bar(pctOf(y.fuel.current, y.fuel.max), '', 'bar-8')}
            <span class="small muted">${y.fuel.price} cr per parsec</span>
          </div>
          <button type="button" class="btn" data-action="refuel"${attr('disabled', y.fuel.missing <= 0 || g.header.credits < y.fuel.price)}>${y.fuel.missing > 0 ? `Fill · ${fmt(y.fuel.cost)} cr` : 'Full'}</button>
        </section>
        <section class="panel service" aria-label="Hull repair">
          <span class="lbl t-red">Hull repair</span><span></span>
          <div class="stack-sm" style="gap:8px">
            <span class="display" style="font-size:20px;font-weight:600">${y.repair.current} / ${y.repair.max} hull</span>
            ${bar(pctOf(y.repair.current, y.repair.max), 'red', 'bar-8')}
            <span class="small muted">${y.repair.price} cr per point</span>
          </div>
          <button type="button" class="btn" data-action="repair"${attr('disabled', y.repair.missing <= 0 || g.header.credits < y.repair.price)}>${y.repair.missing > 0 ? `Repair · ${fmt(y.repair.cost)} cr` : 'Sound'}</button>
        </section>
      </div>

      <section class="stack">
        <div class="row-baseline wrap"><h2 style="font-size:22px;font-weight:600">Ships for sale</h2><span class="small muted">Trade-in value of your ${y.shipName}: ${cr(y.tradeIn)}</span></div>
        <div class="ships">
          ${y.ships.map((ship) => {
            const confirming = s.confirmShip === ship.id;
            const label = ship.owned ? 'Owned' : confirming ? 'Confirm' : 'Buy';
            const priceText = ship.owned ? 'Your ship' : ship.net >= 0 ? `${cr(ship.net)} after trade-in` : `+${cr(-ship.net)} back`;
            return html`<article class="ship-card ${ship.owned ? 'owned' : ''}">
              ${shipCard(ship.id, ship.owned ? '#FFB547' : '#5CC8FF')}
              <div class="row-baseline"><span class="display strong" style="font-size:18px;font-weight:600">${ship.name}</span><span class="tiny dim">${ship.cls}</span></div>
              <div class="ship-specs">
                <span>Cargo <b>${ship.cargo} t</b></span><span>Hull <b>${ship.hull}</b></span>
                <span>Range <b>${ship.range} ps</b></span><span>Slots <b>${slotText(ship.slots)}</b></span>
                <span>Speed <b>${ship.speed}</b></span><span>List <b>${fmt(ship.price)}</b></span>
              </div>
              ${confirming && ship.sold.length ? html`<span class="tiny t-amber">Sells ${ship.sold.join(', ')} (no slot)</span>` : ''}
              <div class="row-between mt-auto" style="gap:8px">
                <span class="small t-amber">${ship.blocker && !ship.owned ? ship.blocker : priceText}</span>
                <button type="button" class="btn btn-sm ${confirming ? 'btn-solid' : ''}" data-action="ship" data-id="${ship.id}"${attr('disabled', ship.owned || !!ship.blocker)}>${label}</button>
              </div>
            </article>`;
          })}
        </div>
      </section>

      <section class="panel" style="display:flex;flex-direction:column;min-height:0" aria-label="Equipment">
        <div class="panel-head"><h2 style="font-size:18px;font-weight:600">Equipment</h2><span class="small muted">Free slots: ${freeText}</span></div>
        ${y.installed.map((e) => html`<div class="gear-row fitted">
          <span class="lbl t-cyan">Fitted ${e.type}</span>
          <span style="font-weight:600">${e.name}</span>
          <span class="small muted desc">${e.desc}</span>
          <span class="right t-green">+${fmt(e.resale)} cr</span>
          <button type="button" class="btn btn-sm btn-ghost" data-action="sellGear" data-id="${e.id}">Sell</button>
        </div>`)}
        ${y.equipment.map((e) => html`<div class="gear-row">
          <span class="lbl">${e.type}</span>
          <span style="font-weight:600">${e.name}</span>
          <span class="small muted desc">${e.desc}</span>
          <span class="right t-amber">${fmt(e.price)} cr</span>
          <button type="button" class="btn btn-sm" data-action="buyGear" data-id="${e.id}" title="${e.blocker || ''}"${attr('disabled', !!e.blocker)}>${e.blocker === 'Not sold here' ? 'N/A' : 'Buy'}</button>
        </div>`)}
      </section>
    </div>`;
    return stationShell(g, 'shipyard', main);
  },
  actions: {
    refuel() {
      act('/shipyard/refuel', {});
    },
    repair() {
      act('/shipyard/repair', {});
    },
    async ship({ id }) {
      const s = state();
      if (s.confirmShip !== id) {
        s.confirmShip = id;
        repaint();
        return;
      }
      s.confirmShip = null;
      await act('/shipyard/ship', { ship: id });
    },
    buyGear({ id }) {
      act('/shipyard/equipment', { item: id });
    },
    sellGear({ id }) {
      act(`/shipyard/equipment/${encodeURIComponent(id)}`, {}, { method: 'DELETE' });
    }
  }
};
