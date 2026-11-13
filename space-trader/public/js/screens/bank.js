// 07 · Galactic bank & loans

import { html, attr } from '../html.js';
import { fmt, toneClass } from '../format.js';
import { store, uiState, act } from '../store.js';
import { stationShell, bar } from '../components/chrome.js';
import { repaint } from '../router.js';

function state() {
  return uiState('bank', { repay: 'all', amount: null, term: 20 });
}

export default {
  name: 'bank',
  title: 'Bank · Void Merchant',
  needsGame: true,
  statuses: ['docked'],
  render() {
    const g = store.game;
    const b = g.bank;
    const s = state();
    const loan = b.loan;
    const credits = g.header.credits;

    // Repay
    const repayAll = loan ? Math.min(loan.owed, credits) : 0;
    const repayAmount = !loan ? 0 : s.repay === 'all' ? repayAll : Math.min(Number(s.repay), loan.owed);
    const repayOpts = [...b.repayOptions.map((v) => [String(v), fmt(v)]), ['all', 'All I can']];

    // Borrow
    if (!b.amounts.includes(s.amount)) s.amount = b.amounts.includes(2500) ? 2500 : (b.amounts[0] || null);
    const interest = s.amount ? b.quotes[`${s.amount}:${s.term}`] : 0;
    const dueDay = g.day + s.term;

    const main = html`<div>
      <div class="bank-head">
        <div class="stack-xs" style="gap:4px">
          <span class="lbl t-cyan">Interstellar Credit Union · ${g.location.name} branch</span>
          <h1 style="font-size:36px;font-weight:700">Bank &amp; loans</h1>
        </div>
        <div class="row" style="gap:28px;font-size:13px">
          <div class="stack-xs" style="align-items:flex-end"><span class="lbl">Credit rating</span><span class="${toneClass(b.rating.tone)}">${b.rating.grade} · ${b.rating.label}</span></div>
          <div class="stack-xs" style="align-items:flex-end"><span class="lbl">Credit limit</span><span>${fmt(b.limit)} cr</span></div>
        </div>
      </div>

      <div class="bank-grid">
        <section class="panel" aria-labelledby="loan-h">
          <h2 id="loan-h" style="font-size:22px;font-weight:600">Your loan</h2>
          ${loan ? html`
            <div class="row-baseline wrap">
              <span class="bank-big">${fmt(loan.owed)} cr</span>
              <span class="muted" style="font-size:13px">owed today</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-size:13px">
              <div class="stack-xs"><span class="lbl">Principal</span><span>${fmt(loan.principal)} cr · day ${loan.takenDay}</span></div>
              <div class="stack-xs"><span class="lbl">Interest</span><span>${loan.ratePct}% per day</span></div>
              <div class="stack-xs"><span class="lbl">Due</span><span class="${loan.overdue ? 't-red' : ''}">Day ${loan.dueDay}</span></div>
            </div>
            <div class="stack-sm">
              <div class="row-between small muted"><span>Day ${loan.takenDay}</span><span class="${loan.overdue ? 't-red' : 't-amber'}">${loan.overdue ? `Overdue ${loan.overdue} days · ${loan.graceLeft} until seizure` : `Today · ${loan.daysLeft} days left`}</span><span>Day ${loan.dueDay}</span></div>
              ${bar(loan.overdue ? 100 : loan.progressPct, loan.overdue ? 'red' : 'amber', 'bar-10')}
            </div>
            <div class="stack" style="gap:10px">
              <span class="lbl" id="replbl">Repay amount</span>
              <div role="group" aria-labelledby="replbl" class="pills" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                ${repayOpts.map(([v, l]) => html`<button type="button" class="pill" data-action="repayOpt" data-id="${v}" aria-pressed="${String(s.repay === v)}">${l}</button>`)}
              </div>
            </div>
            <button type="button" class="cta" data-action="repay"${attr('disabled', repayAmount <= 0 || repayAmount > credits)}>Repay ${fmt(repayAmount)} cr</button>
          ` : html`
            <div class="debt-free">
              <span class="display t-green" style="font-size:22px;font-weight:600">Debt free</span>
              <span class="muted" style="font-size:13px">No loans outstanding. Repaying on time improves your credit rating.</span>
            </div>
          `}
          <p class="notice-box mt-auto">Miss the due date and the bank sends bounty hunters after your ship. After ${b.graceDays} days overdue, the bank seizes it.</p>
        </section>

        <section class="panel" aria-labelledby="borrow-h">
          <h2 id="borrow-h" style="font-size:22px;font-weight:600">${loan ? 'Borrow more' : 'Take a loan'}</h2>
          ${b.canBorrow && s.amount ? html`
            <div class="stack" style="gap:10px">
              <span class="lbl" id="amtlbl">Amount · ${fmt(b.available)} cr available</span>
              <div role="group" aria-labelledby="amtlbl" class="pills" style="grid-template-columns:repeat(${Math.min(4, b.amounts.length)},minmax(0,1fr))">
                ${b.amounts.map((v) => html`<button type="button" class="pill" data-action="amount" data-id="${v}" aria-pressed="${String(s.amount === v)}">${fmt(v)}</button>`)}
              </div>
            </div>
            <div class="stack" style="gap:10px">
              <span class="lbl" id="termlbl">Term</span>
              <div role="group" aria-labelledby="termlbl" class="pills" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                ${b.terms.map((t) => html`<button type="button" class="pill" data-action="term" data-id="${t}" aria-pressed="${String(s.term === t)}">${t} days</button>`)}
              </div>
            </div>
            <div class="quote-box">
              <div class="list-row"><span class="muted">Daily interest</span><span>${b.ratePct}% ${b.tradingDiscountPct ? html`<span class="t-green">(−${b.tradingDiscountPct}% Trading ${b.trading})</span>` : ''}</span></div>
              <div class="list-row"><span class="muted">Interest if repaid on time</span><span>${fmt(interest)} cr</span></div>
              ${loan ? html`<div class="list-row"><span class="muted">Whole balance becomes due</span><span>Day ${dueDay}</span></div>` : ''}
              <div class="row-baseline divider-top"><span class="muted" style="font-size:13px">Total to repay by day ${dueDay}</span><span class="display t-amber" style="font-size:24px;font-weight:700">${fmt(s.amount + interest)} cr</span></div>
            </div>
            <button type="button" class="cta mt-auto" data-action="borrow">Take loan · +${fmt(s.amount)} cr</button>
          ` : html`
            <div class="debt-free">
              <span class="display t-amber" style="font-size:20px;font-weight:600">${loan && loan.overdue ? 'Lending suspended' : 'Credit limit reached'}</span>
              <span class="muted" style="font-size:13px">${loan && loan.overdue ? 'Clear your overdue balance before borrowing again.' : 'Repay some of your loan to borrow more.'}</span>
            </div>
          `}
        </section>
      </div>
    </div>`;
    return stationShell(g, 'bank', main);
  },
  actions: {
    repayOpt({ id }) {
      state().repay = id;
      repaint();
    },
    amount({ id }) {
      state().amount = Number(id);
      repaint();
    },
    term({ id }) {
      state().term = Number(id);
      repaint();
    },
    repay() {
      const s = state();
      act('/bank/repay', { amount: s.repay === 'all' ? 'all' : Number(s.repay) });
    },
    borrow() {
      const s = state();
      act('/bank/borrow', { amount: s.amount, term: s.term });
    }
  }
};
