'use strict';

const { BANK } = require('../../data/rules');
const { dailyRate, availableCredit, overdueDays } = require('../../engine/bank');
const { addLog } = require('../../engine/world');
const { reject, requireStatus } = require('../errors');

const fmt = (n) => n.toLocaleString('en-US');

/**
 * Takes out (or tops up) a loan. The whole balance becomes due `term` days from today.
 * @param {Object} game
 * @param {{amount: number, term: number}} input
 * @return {{notice: Object}}
 */
function borrow(game, { amount, term }) {
  requireStatus(game, 'docked');
  if (!BANK.terms.includes(term)) reject(`Choose a term of ${BANK.terms.join(', ')} days.`);
  if (overdueDays(game) > 0) reject('The bank won’t lend more while your loan is overdue.');
  const available = availableCredit(game);
  if (amount < 100) reject('The smallest loan is 100 cr.');
  if (amount > available) reject(`You can borrow up to ${fmt(available)} cr.`);
  const rate = dailyRate(game);
  if (game.loan) {
    game.loan.principal += amount;
    game.loan.owed += amount;
    game.loan.rate = rate;
    game.loan.dueDay = game.day + term;
  } else {
    game.loan = { principal: amount, owed: amount, rate, takenDay: game.day, dueDay: game.day + term };
  }
  game.credits += amount;
  addLog(game, `Loan of ${fmt(amount)} cr from the Interstellar Credit Union.`, { value: `+${fmt(amount)} cr`, tone: 'warn' });
  return { notice: { tone: 'info', text: `${fmt(amount)} cr added to your account. Due on day ${game.loan.dueDay}.` } };
}

/**
 * Pays back part or all of the loan.
 * @param {Object} game
 * @param {{amount: (number|'all')}} input
 * @return {{notice: Object}}
 */
function repay(game, { amount }) {
  requireStatus(game, 'docked');
  if (!game.loan) reject('You don’t owe the bank anything.');
  const pay = amount === 'all' ? Math.min(game.loan.owed, game.credits) : Math.min(amount, game.loan.owed);
  if (pay <= 0) reject('You have no credits to repay with.');
  if (pay > game.credits) reject(`You only have ${fmt(game.credits)} cr.`);
  game.credits -= pay;
  game.loan.owed -= pay;
  game.loan.principal = Math.min(game.loan.principal, game.loan.owed);
  addLog(game, 'Loan repayment to the Interstellar Credit Union.', { value: `−${fmt(pay)} cr`, tone: 'bad' });
  if (game.loan.owed <= 0) {
    const onTime = game.day <= game.loan.dueDay;
    game.creditScore = Math.min(100, Math.max(0, game.creditScore + (onTime ? 10 : -5)));
    game.loan = null;
    addLog(game, onTime ? 'Loan repaid in full and on time.' : 'Overdue loan finally cleared.', { tone: onTime ? 'good' : 'warn' });
    return { notice: { tone: 'good', text: onTime ? 'Debt free. Your credit rating improves.' : 'Debt cleared. The bank calls off its hunters.' } };
  }
  return { notice: { tone: 'info', text: `Repaid ${fmt(pay)} cr. ${fmt(game.loan.owed)} cr still owed.` } };
}

module.exports = { borrow, repay };
