// 01 · Title screen

import { html } from '../html.js';
import { store, loadSummary, loadGame } from '../store.js';
import { titleShip } from '../components/art.js';
import { navigate, homeRoute } from '../router.js';
import { toast } from '../toast.js';

export default {
  name: 'title',
  title: 'Void Merchant',
  async load() {
    await loadSummary();
  },
  render() {
    const s = store.summary;
    const canContinue = s && !s.over;
    return html`<div class="title-screen sky">
      <div class="title-planet" aria-hidden="true"></div>
      <div class="title-ring" aria-hidden="true"></div>
      <div class="title-ship">${titleShip}</div>
      <main class="title-content" id="main">
        <div class="stack" style="gap:12px">
          <span class="lbl t-cyan">A turn-based trading game</span>
          <h1 class="title-h1">VOID<br>MERCHANT</h1>
          <p class="title-blurb">Buy low, sell high, and make it through the lanes between eight star systems. Borrow from the bank if you must, but pay it back before it catches up with you.</p>
        </div>
        <nav aria-label="Main menu" class="menu">
          <a class="menu-btn solid" href="#/new"><span>New game</span><span aria-hidden="true">›</span></a>
          ${canContinue
            ? html`<button type="button" class="menu-btn" data-action="continue"><span>Continue</span><span class="meta">Day ${s.day} · ${s.location}</span></button>`
            : html`<button type="button" class="menu-btn" disabled><span>Continue</span><span class="meta">${s && s.over ? 'Last voyage ended' : 'No saved game'}</span></button>`}
          <a class="menu-btn" href="#/halloffame"><span>Hall of fame</span><span aria-hidden="true">›</span></a>
          <a class="menu-btn" href="#/howto"><span>How to play</span><span aria-hidden="true">›</span></a>
        </nav>
      </main>
      <div class="title-foot">
        <span class="lbl">v0.1 · auto-saved every turn</span>
        <span class="lbl">Press N for a new game</span>
      </div>
    </div>`;
  },
  actions: {
    async continue() {
      try {
        const game = await loadGame();
        if (game) navigate(homeRoute(game));
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  },
  keys: {
    n: () => navigate('new')
  }
};
