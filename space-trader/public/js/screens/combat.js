// 12 · Combat turn

import { html, raw, attr } from '../html.js';
import { pctOf, toneClass } from '../format.js';
import { store, act } from '../store.js';
import { statusBar, bar } from '../components/chrome.js';

const LOG_TONES = { me: 't-amber', enemy: 't-red', shield: 't-cyan', good: 't-green', info: 'muted' };

function side(name, sub, color, border, sh, shMax, hull, hullMax) {
  return html`<section class="panel" style="border-color:${border}">
    <div class="row-baseline"><span class="display" style="font-size:20px;font-weight:700;color:${color}">${name}</span><span class="small muted">${sub}</span></div>
    <div class="meter"><span class="muted">Shields</span><div class="bar bar-10" aria-hidden="true"><span style="width:${pctOf(sh, shMax)}%;background:${color}"></span></div><span class="right num">${sh} / ${shMax}</span></div>
    <div class="meter"><span class="muted">Hull</span>${bar(pctOf(hull, hullMax), 'light', 'bar-10')}<span class="right num">${hull} / ${hullMax}</span></div>
  </section>`;
}

export default {
  name: 'combat',
  title: 'Combat · Void Merchant',
  needsGame: true,
  statuses: ['combat'],
  render() {
    const g = store.game;
    const c = g.combat;
    const me = c.me;
    const en = c.enemy;
    const a = c.actions;
    const shieldGlow = me.shields > 0 ? (0.15 + (me.shields / Math.max(1, me.shieldMax)) * 0.6).toFixed(2) : '0';
    const key = `t${c.turn}`;
    const playerBeam = c.last.player === 'hit' ? 'M246 150 L520 150' : c.last.player === 'miss' ? 'M246 150 L560 96' : '';
    const enemyBeam = c.last.enemy === 'hit' ? 'M488 160 L270 158' : '';

    return html`<div class="screen-col">
      ${statusBar({
        variant: 'hostile',
        left: html`<span class="brand red">COMBAT</span><span class="muted" style="font-size:13px">vs ${en.name} · Turn ${c.turn}</span>`
      })}
      <div class="combat-sides">
        ${side(me.name, `You · Battle ${me.battle}`, '#5CC8FF', '#5CC8FF55', me.shields, me.shieldMax, me.hull, me.hullMax)}
        ${side(en.name, `${en.cls}${en.bounty ? ` · Bounty ${en.bounty} cr` : ''}`, '#FF8A7A', '#FF8A7A55', en.shields, en.shieldMax, en.hull, en.hullMax)}
      </div>
      <div class="combat-body">
        <div class="battle-col">
          <section class="battle-view sky" aria-label="Battle view">
            <svg aria-hidden="true" viewBox="0 0 740 300" preserveAspectRatio="xMidYMid meet" fill="none" stroke-linejoin="round" data-turn="${key}">
              <g transform="translate(60 100)" class="${c.last.enemy === 'hit' ? 'hit' : ''}">
                <path d="M30 50 L80 30 L150 34 L184 50 L150 66 L80 70 Z" fill="#0B1019" stroke="#5CC8FF" stroke-width="2"></path>
                <path d="M80 30 L94 10 L120 32 M80 70 L94 90 L120 68" stroke="#5CC8FF" stroke-width="2"></path>
                <ellipse cx="110" cy="50" rx="100" ry="58" stroke="#5CC8FF" stroke-opacity="${shieldGlow}" stroke-width="2"></ellipse>
              </g>
              <g transform="translate(470 90)" class="${c.last.player === 'hit' ? 'hit' : ''}">
                <path d="M200 60 L150 34 L104 40 L52 26 L18 60 L52 94 L104 80 L150 86 Z" fill="#160B0D" stroke="#FF8A7A" stroke-width="2"></path>
                <path d="M104 40 L86 8 L70 30 M104 80 L86 112 L70 90" stroke="#FF8A7A" stroke-width="2"></path>
              </g>
              ${playerBeam ? raw(`<path class="beam" d="${playerBeam}" stroke="#FFB547" stroke-width="3"></path>`) : ''}
              ${enemyBeam ? raw(`<path class="beam" d="${enemyBeam}" stroke="#FF8A7A" stroke-width="2" stroke-dasharray="10 6"></path>`) : ''}
            </svg>
          </section>
          <div class="actions4" role="group" aria-label="Combat actions">
            <button type="button" class="act" data-action="turn" data-id="fire"${attr('disabled', !a.fire.possible)}><span class="act-title t-amber">Fire lasers<kbd>1</kbd></span><span class="tiny muted">${a.fire.possible ? `${a.fire.damage[0]}–${a.fire.damage[1]} damage · ${a.fire.hitPct}% hit` : 'No weapons fitted'}</span></button>
            <button type="button" class="act" data-action="turn" data-id="evade"><span class="act-title">Evasive<kbd>2</kbd></span><span class="tiny muted">Halve incoming fire</span></button>
            <button type="button" class="act" data-action="turn" data-id="shield"${attr('disabled', !a.shield.possible)}><span class="act-title">Boost shields<kbd>3</kbd></span><span class="tiny muted">${a.shield.none ? 'No shield generator' : `+${a.shield.boost} shields`}</span></button>
            <button type="button" class="act" data-action="turn" data-id="flee"><span class="act-title">Flee<kbd>4</kbd></span><span class="tiny muted">${a.flee.pct}% escape</span></button>
          </div>
        </div>
        <section class="panel combat-log" aria-label="Combat log">
          <span class="lbl">Combat log</span>
          <div class="entries" aria-live="polite">
            ${c.log.map((l) => html`<div class="log-row compact"><span class="dim">T${l.turn}</span><span class="${LOG_TONES[l.tone] || toneClass(l.tone)}">${l.text}</span></div>`)}
          </div>
        </section>
      </div>
    </div>`;
  },
  actions: {
    turn({ id }) {
      act('/combat', { action: id }, { quiet: true });
    }
  },
  keys: {
    1: (root) => root.querySelector('[data-id="fire"]')?.click(),
    2: (root) => root.querySelector('[data-id="evade"]')?.click(),
    3: (root) => root.querySelector('[data-id="shield"]')?.click(),
    4: (root) => root.querySelector('[data-id="flee"]')?.click(),
    f: (root) => root.querySelector('[data-id="fire"]')?.click()
  }
};
