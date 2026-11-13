'use strict';

/** Difficulty presets chosen on the new-commander screen. */
const DIFFICULTY = {
  easy: {
    id: 'easy', label: 'Easy', credits: 2000, interest: 0.006, creditLimit: 15000,
    encounterMult: 0.7, enemyStrength: 0.8, volatility: 0.8, scoreMult: 0.75,
    note: 'Cheaper loans, fewer pirates. Good for learning the lanes.'
  },
  normal: {
    id: 'normal', label: 'Normal', credits: 1000, interest: 0.01, creditLimit: 12000,
    encounterMult: 1, enemyStrength: 1, volatility: 1, scoreMult: 1,
    note: 'Balanced prices, pirates and police. The intended game.'
  },
  hard: {
    id: 'hard', label: 'Hard', credits: 500, interest: 0.015, creditLimit: 8000,
    encounterMult: 1.3, enemyStrength: 1.25, volatility: 1.3, scoreMult: 1.5,
    note: 'Steep interest, aggressive pirates and volatile markets.'
  }
};

const SKILLS = {
  pool: 18,
  min: 1,
  max: 10,
  defs: [
    { id: 'navigation', name: 'Navigation', glyph: 'N', effect: 'Fuel savings, better odds of fleeing' },
    { id: 'battle', name: 'Battle', glyph: 'B', effect: 'Hit chance and damage in combat' },
    { id: 'trading', name: 'Trading', glyph: 'T', effect: 'Better buy/sell prices and loan rates' }
  ]
};

const HOME_SYSTEM = 'solace';

const RANKS = [
  { min: -Infinity, name: 'Drifter' },
  { min: 5000, name: 'Peddler' },
  { min: 15000, name: 'Merchant' },
  { min: 35000, name: 'Broker' },
  { min: 75000, name: 'Magnate' },
  { min: 150000, name: 'Tycoon' }
];

const BANK = {
  amounts: [1000, 2500, 5000],
  terms: [10, 20, 40],
  repayOptions: [500, 1000],
  graceDays: 10,
  startingCreditScore: 70
};

const SHIPYARD = {
  repairPerPoint: 12
};

const ENCOUNTER_CHANCE = [0.18, 0.32, 0.5];

module.exports = { DIFFICULTY, SKILLS, HOME_SYSTEM, RANKS, BANK, SHIPYARD, ENCOUNTER_CHANCE };
