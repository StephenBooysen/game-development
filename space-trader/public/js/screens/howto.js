// How to play

import { html } from '../html.js';

export default {
  name: 'howto',
  title: 'How to play · Void Merchant',
  render() {
    return html`<div class="page sky">
      <main class="page-inner howto" id="main">
        <header class="page-head">
          <div class="stack-sm">
            <span class="lbl t-cyan">Flight manual</span>
            <h1 class="page-title">How to play</h1>
          </div>
          <a href="#/" class="small">‹ Back to title</a>
        </header>
        <div class="howto-grid">
          <section class="panel">
            <h2>Trade</h2>
            <p>Every system makes some goods cheaply and pays well for others. Buy where a good is cheap, carry it to where it is in demand, and sell. The market shows the best price you have seen elsewhere, and clicking a system on the galaxy map lists every good with its profit per tonne for that run. Systems you have not visited show their typical prices until you go there or buy a trader’s tip.</p>
            <p>Watch the station news: droughts, plagues and wars send prices soaring for a few days.</p>
          </section>
          <section class="panel">
            <h2>Travel</h2>
            <ul>
              <li>Each jump burns one parsec of fuel per parsec travelled and takes days.</li>
              <li>Prices drift, interest accrues and news breaks while you are in warp.</li>
              <li>Dangerous lanes attract pirates. Rumoured pirate activity makes it worse.</li>
            </ul>
          </section>
          <section class="panel">
            <h2>Encounters</h2>
            <p>A contact on the scanner might be a pirate or a friendly trader. Scan or hail it to find out, or try to slip away. Pirates can be fought, outrun, paid off, or handed your cargo. Traders offer deals and tips.</p>
            <p>Attacking traders ruins your police record.</p>
          </section>
          <section class="panel">
            <h2>Combat</h2>
            <ul>
              <li><b class="strong">Fire</b>: damage from every weapon fitted, plus your Battle skill.</li>
              <li><b class="strong">Evasive</b>: halves incoming damage for a turn.</li>
              <li><b class="strong">Boost shields</b>: +15 shield points.</li>
              <li><b class="strong">Flee</b>: Navigation and speed decide your odds.</li>
            </ul>
          </section>
          <section class="panel">
            <h2>Ships &amp; the bank</h2>
            <p>Upgrade weapons, shields and gadgets at the shipyard, or trade in for a bigger hull. The bank lends against your credit rating. Miss the due date and bounty hunters come calling; ten days overdue and your ship is seized.</p>
          </section>
          <section class="panel">
            <h2>Winning</h2>
            <p>There is no clock. Retire from the Commander page whenever you like: your score is your net worth plus a bonus for pirates beaten, scaled by difficulty. Retire debt-free for the best ending.</p>
          </section>
        </div>
        <div><a class="btn btn-solid" href="#/new">Start a new game ›</a></div>
      </main>
    </div>`;
  }
};
