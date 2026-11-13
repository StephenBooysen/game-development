// 02 · New commander & skill points

import { html, attr } from '../html.js';
import { fmt } from '../format.js';
import { store, uiState, loadSetup, createGame } from '../store.js';
import { segments } from '../components/chrome.js';
import { navigate, repaint } from '../router.js';
import { toast } from '../toast.js';

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'\-]{0,15}$/u;
const COLORS = { navigation: '#5CC8FF', battle: '#FF7A6B', trading: '#FFB547' };

function state() {
  return uiState('newCommander', { name: '', difficulty: 'normal', skills: { navigation: 6, battle: 6, trading: 6 }, submitting: false });
}

function pointsLeft(s, pool) {
  return pool - Object.values(s.skills).reduce((a, b) => a + b, 0);
}

function nameValid(name) {
  return NAME_PATTERN.test(name.trim().replace(/\s+/g, ' '));
}

export default {
  name: 'newCommander',
  title: 'New commander · Void Merchant',
  async load() {
    await loadSetup();
  },
  render() {
    const setup = store.setup;
    const s = state();
    const pool = setup.skills.pool;
    const left = pointsLeft(s, pool);
    const diff = setup.difficulties.find((d) => d.id === s.difficulty);
    const valid = nameValid(s.name);
    return html`<div class="page sky">
      <main class="page-inner" id="main">
        <header class="page-head">
          <div class="stack-sm">
            <span class="lbl t-cyan">Step 1 of 2 · Commander registration</span>
            <h1 class="page-title">Create your commander</h1>
          </div>
          <a href="#/" class="small">‹ Back to title</a>
        </header>

        <div class="nc-grid">
          <section class="panel" aria-label="Commander details">
            <div class="stack" style="gap:10px">
              <label for="cmdr" class="lbl">Commander name</label>
              <input id="cmdr" class="text-input" type="text" maxlength="16" autocomplete="off" spellcheck="false"
                value="${s.name}" data-input="name" placeholder="Your name" aria-describedby="cmdr-help"
                aria-invalid="${s.name && !valid ? 'true' : 'false'}">
              <span id="cmdr-help" class="small dim">Up to 16 characters. Shown on the hall of fame.</span>
            </div>
            <div class="stack" style="gap:10px">
              <span class="lbl" id="difflbl">Difficulty</span>
              <div role="group" aria-labelledby="difflbl" class="pills" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                ${setup.difficulties.map((d) => html`<button type="button" class="pill pill-solid" data-action="difficulty" data-id="${d.id}" aria-pressed="${String(d.id === s.difficulty)}">${d.label}</button>`)}
              </div>
              <span class="small muted" style="line-height:1.5">${diff.note}</span>
            </div>
            <div class="mt-auto panel-dashed stack-sm" style="padding:16px;gap:8px">
              <span class="lbl">Starting package</span>
              <div class="list-row" style="font-size:14px"><span class="muted">Credits</span><span class="t-amber">${fmt(diff.credits)} cr</span></div>
              <div class="list-row" style="font-size:14px"><span class="muted">Ship</span><span>${setup.starterShip.name}</span></div>
              <div class="list-row" style="font-size:14px"><span class="muted">Home system</span><span>${setup.home.name}</span></div>
            </div>
          </section>

          <section class="panel" aria-label="Skill points">
            <div class="row-between">
              <div class="stack-xs" style="gap:4px">
                <h2 style="font-size:24px;font-weight:600">Assign skill points</h2>
                <span class="small muted" style="font-size:13px">Each skill starts at ${setup.skills.min} and caps at ${setup.skills.max}.</span>
              </div>
              <div class="stack-xs" style="align-items:flex-end">
                <span class="lbl">Points left</span>
                <span class="points-left" style="color:${left === 0 ? 'var(--green)' : 'var(--amber)'}" aria-live="polite">${left}</span>
              </div>
            </div>
            <div>
              ${setup.skills.defs.map((d) => {
                const v = s.skills[d.id];
                return html`<div class="skill-row">
                  <div class="skill-glyph" aria-hidden="true" style="color:${COLORS[d.id]}">${d.glyph}</div>
                  <div class="stack-sm" style="gap:8px;min-width:0">
                    <div class="row wrap" style="align-items:baseline;gap:4px 12px"><span class="display strong" style="font-size:19px;font-weight:600">${d.name}</span><span class="small muted">${d.effect}</span></div>
                    ${segments(v, COLORS[d.id])}
                  </div>
                  <div class="stepper">
                    <button type="button" class="sq" data-action="dec" data-id="${d.id}" aria-label="Decrease ${d.name}"${attr('disabled', v <= setup.skills.min)}>−</button>
                    <span class="stepper-value" aria-label="${d.name} ${v}">${v}</span>
                    <button type="button" class="sq" data-action="inc" data-id="${d.id}" aria-label="Increase ${d.name}"${attr('disabled', left <= 0 || v >= setup.skills.max)}>+</button>
                  </div>
                </div>`;
              })}
            </div>
            <div class="mt-auto row-between wrap">
              <button type="button" class="btn btn-ghost" data-action="reset">Reset points</button>
              <div class="row wrap" style="justify-content:flex-end">
                ${left > 0 ? html`<span class="small t-amber">${left} point${left === 1 ? '' : 's'} unspent</span>` : ''}
                <button type="button" class="btn btn-solid" data-action="register" data-register${attr('disabled', !valid || s.submitting)}>Register &amp; launch ›</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>`;
  },
  after(root) {
    const input = root.querySelector('#cmdr');
    if (input && !state().name) input.focus();
  },
  inputs: {
    name(value, root) {
      const s = state();
      s.name = value;
      const valid = nameValid(value);
      const btn = root.querySelector('[data-register]');
      if (btn) btn.disabled = !valid || s.submitting;
      const input = root.querySelector('#cmdr');
      if (input) input.setAttribute('aria-invalid', value && !valid ? 'true' : 'false');
    }
  },
  actions: {
    difficulty({ id }) {
      state().difficulty = id;
      repaint();
    },
    inc({ id }) {
      const s = state();
      if (pointsLeft(s, store.setup.skills.pool) > 0 && s.skills[id] < store.setup.skills.max) s.skills[id] += 1;
      repaint();
    },
    dec({ id }) {
      const s = state();
      if (s.skills[id] > store.setup.skills.min) s.skills[id] -= 1;
      repaint();
    },
    reset() {
      const s = state();
      for (const k of Object.keys(s.skills)) s.skills[k] = store.setup.skills.min;
      repaint();
    },
    async register() {
      const s = state();
      if (!nameValid(s.name) || s.submitting) return;
      s.submitting = true;
      repaint();
      try {
        await createGame({ name: s.name.trim(), difficulty: s.difficulty, skills: { ...s.skills } });
        navigate('ship');
      } catch (err) {
        toast(err.message, 'error');
        s.submitting = false;
        repaint();
      }
    }
  }
};
