// 11 · Encounter: pirate (or bank recovery agents)

import { html, attr } from '../html.js';
import { fmt } from '../format.js';
import { store, act } from '../store.js';
import { statusBar } from '../components/chrome.js';
import { playerShip, raider } from '../components/art.js';

export default {
  name: 'encounter',
  title: 'Hostile contact · Void Merchant',
  needsGame: true,
  statuses: ['encounter'],
  accepts: (game) => game.encounter && game.encounter.kind !== 'trader',
  render() {
    const g = store.game;
    const e = g.encounter;
    const t = g.travel;
    const enemy = e.enemy;
    const o = e.options;
    const hunter = e.kind === 'hunter';
    const color = hunter ? '#FFB547' : '#FF8A7A';

    return html`<div class="screen-col">
      ${statusBar({
        variant: 'hostile',
        left: html`<span class="dot" aria-hidden="true" style="background:var(--red)"></span><span class="brand red">${hunter ? 'BANK RECOVERY' : 'HOSTILE CONTACT'}</span><span class="muted" style="font-size:13px">${t.from.name} → ${t.to.name} lane · Day ${g.day}</span>`
      })}
      <section class="tactical sky sky-deep" aria-label="Tactical view">
        <svg class="lane" aria-hidden="true" viewBox="0 0 1280 360" preserveAspectRatio="none" fill="none"><path d="M350 200 L880 180" stroke="#8B97AB" stroke-dasharray="4 8" vector-effect="non-scaling-stroke"></path></svg>
        <div class="me">${playerShip(g.ship.type, { stroke: '#5CC8FF', label: `Your ship, ${g.ship.name}`, width: 220 })}</div>
        <div class="them">${raider({ stroke: color, label: `${enemy.cls} ${enemy.name}` })}</div>
        <span class="range">${fmt(e.distanceKm)} km · closing</span>
        <div class="me-label stack-xs"><span class="display" style="font-size:16px;font-weight:600">${g.ship.name}</span><span class="small muted">Hull ${e.me.hull} · Shields ${e.me.shields}</span></div>
        <div class="them-label stack-xs" style="align-items:flex-end"><span class="display" style="font-size:16px;font-weight:600;color:${color}">${enemy.name}</span><span class="small muted">${enemy.cls}${enemy.bounty ? ` · Bounty ${fmt(enemy.bounty)} cr` : ''}</span></div>
      </section>

      <div class="enc-body">
        <section class="stack" style="gap:14px">
          <div class="panel panel-warn stack-sm" style="padding:16px 18px;gap:8px">
            <span class="lbl t-red">Incoming transmission</span>
            <p class="quote">“${e.line}”</p>
          </div>
          <div class="panel kv" style="padding:16px 18px">
            <span class="lbl" style="grid-column:1 / -1">Scan results</span>
            <span class="muted">Hull <b>${enemy.hull}</b></span><span class="muted">Shields <b>${enemy.shields}</b></span>
            <span class="muted">Weapons <b>${enemy.weapons}</b></span><span class="muted">Speed <b>${enemy.speed} / 10</b></span>
            <span class="muted">Threat <b class="t-red">${enemy.threat}</b></span><span class="muted">Crew <b>${enemy.crew}</b></span>
          </div>
        </section>
        <section class="enc-options" aria-label="Your options">
          <button type="button" class="opt opt-primary" data-action="choose" data-id="attack"${attr('disabled', !o.attack.weapons)}>
            <div class="row-between"><span class="opt-title t-amber">Attack</span><span style="font-size:13px">${o.attack.winPct}% win</span></div>
            <span class="small muted">${o.attack.weapons ? `Battle ${o.attack.battle} vs their crew of ${enemy.crew}.` : 'You have no weapons fitted.'} ${enemy.bounty ? `Win the ${fmt(enemy.bounty)} cr bounty and any cargo they drop.` : 'No bounty: they are licensed by the bank.'}</span>
          </button>
          <button type="button" class="opt" data-action="choose" data-id="flee">
            <div class="row-between"><span class="opt-title">Flee</span><span style="font-size:13px">${o.flee.pct}% escape</span></div>
            <span class="small muted">Navigation ${o.flee.navigation} vs their speed ${o.flee.enemySpeed}. If it fails, they get a free shot.</span>
          </button>
          <button type="button" class="opt" data-action="choose" data-id="pay"${attr('disabled', !o.pay.affordable)}>
            <div class="row-between"><span class="opt-title">${hunter ? 'Pay the bank' : 'Pay them off'}</span><span style="font-size:13px">−${fmt(o.pay.cost)} cr</span></div>
            <span class="small muted">${hunter
              ? 'A quarter of your debt, paid now. The bank extends your due date by 10 days.'
              : o.pay.base > o.pay.cost ? `Trading ${o.pay.trading} talks the price down from ${fmt(o.pay.base)}. They leave you alone.` : 'They leave you alone.'}${o.pay.affordable ? '' : ' You can’t afford it.'}</span>
          </button>
          <button type="button" class="opt" data-action="choose" data-id="surrender"${attr('disabled', !o.surrender.possible)}>
            <div class="row-between"><span class="opt-title">Surrender cargo</span><span style="font-size:13px" class="t-red">−${o.surrender.tonnes} t</span></div>
            <span class="small muted">${o.surrender.possible ? `Lose your whole hold, worth about ${fmt(o.surrender.value)} cr. Your ship stays safe.` : 'Your hold is empty: nothing to hand over.'}</span>
          </button>
        </section>
      </div>
    </div>`;
  },
  actions: {
    choose({ id }) {
      act('/encounter', { action: id });
    }
  },
  keys: {
    a: (root) => root.querySelector('[data-id="attack"]')?.click(),
    f: (root) => root.querySelector('[data-id="flee"]')?.click(),
    p: (root) => root.querySelector('[data-id="pay"]')?.click()
  }
};
