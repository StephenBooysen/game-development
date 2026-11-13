'use strict';

const { DIFFICULTY, BANK } = require('../data/rules');
const { shipStats } = require('./ship');

const RATINGS = [
  { min: 85, grade: 'A', label: 'Excellent', factor: 1.25, penalty: 0, tone: 'good' },
  { min: 70, grade: 'B+', label: 'Reliable', factor: 1, penalty: 0, tone: 'good' },
  { min: 55, grade: 'B', label: 'Fair', factor: 0.85, penalty: 0.001, tone: 'neutral' },
  { min: 40, grade: 'C', label: 'Risky', factor: 0.6, penalty: 0.003, tone: 'warn' },
  { min: -Infinity, grade: 'D', label: 'Poor', factor: 0.35, penalty: 0.005, tone: 'bad' }
];

/** The commander's credit rating band. */
function creditRating(game) {
  return RATINGS.find((r) => game.creditScore >= r.min);
}

/** Interest reduction from the Trading skill (0.1% per 3 points). */
function tradingRateDiscount(game) {
  return Math.floor(shipStats(game).trading / 3) * 0.001;
}

/** Daily interest rate offered on new borrowing. */
function dailyRate(game) {
  const base = DIFFICULTY[game.difficulty].interest;
  return Math.max(0.002, base - tradingRateDiscount(game) + creditRating(game).penalty);
}

/** Maximum total debt the bank will allow. */
function creditLimit(game) {
  return Math.round((DIFFICULTY[game.difficulty].creditLimit * creditRating(game).factor) / 100) * 100;
}

/** Credits still available to borrow. */
function availableCredit(game) {
  return Math.max(0, creditLimit(game) - (game.loan ? game.loan.owed : 0));
}

/** Days past the due date (0 when not overdue or no loan). */
function overdueDays(game) {
  if (!game.loan) return 0;
  return Math.max(0, game.day - game.loan.dueDay);
}

/**
 * Interest due on `amount` over `term` days at today's rate.
 * @param {Object} game
 * @param {number} amount
 * @param {number} term
 * @return {number}
 */
function interestQuote(game, amount, term) {
  return Math.round(amount * dailyRate(game) * term);
}

/**
 * Applies one day of interest and overdue penalties.
 * @param {Object} game
 * @return {{overdue: number, seized: boolean}}
 */
function accrueDay(game) {
  if (!game.loan) return { overdue: 0, seized: false };
  const loan = game.loan;
  loan.owed += Math.max(1, Math.round(loan.principal * loan.rate));
  const overdue = overdueDays(game);
  if (overdue > 0) game.creditScore = Math.max(0, game.creditScore - 2);
  return { overdue, seized: overdue >= BANK.graceDays };
}

module.exports = {
  RATINGS, creditRating, tradingRateDiscount, dailyRate, creditLimit, availableCredit,
  overdueDays, interestQuote, accrueDay
};
