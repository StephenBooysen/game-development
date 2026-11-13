// 15 · Game over / final score, and the stand-alone hall of fame.

import { html } from '../html.js';
import { fmt, toneClass } from '../format.js';
import { store } from '../store.js';
import { api } from '../api.js';

async function loadHallOfFame() {
  try {
    const { entries } = await api.hallOfFame();
    store.hallOfFame = entries;
  } catch {
    store.hallOfFame = [];
  }
}

function hallOfFamePanel(highlightId) {
  const entries = store.hallOfFame || [];
  return html`<section class="panel report-right" aria-labelledby="hof-h">
    <h2 id="hof-h" style="font-size:24px;font-weight:600">Hall of fame</h2>
    <div class="hof-row head lbl"><span>#</span><span>Commander</span><span>Ending</span><span class="right">Score</span></div>
    ${entries.length
      ? entries.map((e, i) => html`<div class="hof-row ${highlightId && e.gameId === highlightId ? 'me' : ''}">
          <span class="dim">${i + 1}</span>
          <span style="font-weight:600">${e.name}</span>
          <span class="small muted">${e.ending}</span>
          <span class="right num">${fmt(e.score)}</span>
        </div>`)
      : html`<div class="hof-empty">No finished voyages yet. Be the first name on the board.</div>`}
  </section>`;
}

export const gameOver = {
  name: 'gameover',
  title: 'Game over · Void Merchant',
  needsGame: true,
  statuses: ['over'],
  async load() {
    await loadHallOfFame();
  },
  render() {
    const g = store.game;
    const o = g.over;
    const color = o.tone === 'good' ? 'var(--green)' : 'var(--red)';
    return html`<div class="report sky">
      <main class="report-inner" id="main">
        <section class="report-left" style="gap:22px">
          <span class="lbl" style="color:${color}">Game over · Day ${o.day}</span>
          <h1 class="report-title" style="font-size:76px">${o.title}</h1>
          <p class="report-body">${o.body}</p>
          <div class="panel score-box">
            <span class="lbl">Final score</span>
            ${o.rows.map((r) => html`<div class="list-row" style="font-size:14px"><span class="muted">${r.label}</span><span class="${toneClass(r.tone)}">${r.value}</span></div>`)}
            <div class="row-baseline divider-top"><span style="font-size:14px">Score</span><span class="display t-amber" style="font-size:40px;font-weight:700">${fmt(o.score)}</span></div>
          </div>
          <div class="row wrap mt-auto">
            <a class="btn btn-solid btn-lg" href="#/new">New game</a>
            <a class="btn btn-ghost btn-lg" href="#/">Title screen</a>
          </div>
        </section>
        ${hallOfFamePanel(g.id)}
      </main>
    </div>`;
  }
};

export const hallOfFame = {
  name: 'halloffame',
  title: 'Hall of fame · Void Merchant',
  async load() {
    await loadHallOfFame();
  },
  render() {
    const highlight = store.summary && store.summary.over ? store.summary.id : null;
    return html`<div class="report sky">
      <main class="report-inner" id="main">
        <section class="report-left" style="gap:22px">
          <span class="lbl t-cyan">Interstellar Traders’ Guild</span>
          <h1 class="report-title">HALL<br>OF FAME</h1>
          <p class="report-body">The ten best voyages on record. Scores are final net worth plus pirate bounties, scaled by difficulty and by how the voyage ended. Retiring debt-free scores best.</p>
          <div class="row wrap mt-auto">
            <a class="btn btn-solid btn-lg" href="#/new">New game</a>
            <a class="btn btn-ghost btn-lg" href="#/">Title screen</a>
          </div>
        </section>
        ${hallOfFamePanel(highlight)}
      </main>
    </div>`;
  }
};
