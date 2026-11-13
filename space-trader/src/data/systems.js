'use strict';

/**
 * The eight star systems. `x`/`y` are positions on the 940 x 736 star chart;
 * one parsec is 28 chart units.
 *
 * - `cheap` goods are produced in bulk (lower prices, more stock).
 * - `dear` goods are in demand (higher prices).
 * - `police`: 0 none, 1 light, 2 moderate, 3 strong. Drives customs inspections.
 * - `danger`: 0 low, 1 medium, 2 high. Drives encounter odds on the way in.
 * - `blackMarket`: contraband can be traded here.
 */
const SYSTEMS = [
  {
    id: 'solace', name: 'Solace', x: 470, y: 360, color: '#7BC86A',
    economy: 'Agricultural world', government: 'Democracy', tech: 4, population: '2.1 billion',
    police: 2, danger: 0, sector: 2, fuelPrice: 15,
    description: 'Terraced farm belts and grain silos the size of moons. Food and textiles are cheap here; machinery and medicine sell well.',
    cheap: ['food', 'textiles'], dear: ['machinery', 'medicine']
  },
  {
    id: 'kordo', name: 'Kordo', x: 630, y: 270, color: '#D9925A',
    economy: 'Mining colony', government: 'Corporate state', tech: 3, population: '640 million',
    police: 3, danger: 0, sector: 2, fuelPrice: 14,
    description: 'Strip-mined canyons and company towns under a permanent dust haze. Ore and water come cheap; food and medicine are always short.',
    cheap: ['ore', 'water'], dear: ['food', 'medicine', 'machinery']
  },
  {
    id: 'vexis', name: 'Vexis Prime', x: 340, y: 220, color: '#9AA6B8',
    economy: 'Industrial world', government: 'Technocracy', tech: 6, population: '5.4 billion',
    police: 2, danger: 0, sector: 1, fuelPrice: 13,
    description: 'Foundry rings circle a smog-wrapped world. Machinery and robotics roll off the lines; it imports textiles and ore by the megaton.',
    cheap: ['machinery', 'robotics'], dear: ['textiles', 'ore']
  },
  {
    id: 'halcyon', name: 'Halcyon', x: 290, y: 500, color: '#6AB8FF',
    economy: 'Hi-tech world', government: 'Confederacy', tech: 7, population: '3.8 billion',
    police: 1, danger: 1, sector: 3, fuelPrice: 12,
    description: 'Glass arcologies and orbital labs. Robotics and medicine are made here; raw ore and fresh food fetch a premium.',
    cheap: ['robotics', 'medicine'], dear: ['ore', 'food']
  },
  {
    id: 'thrane', name: 'Thrane', x: 690, y: 450, color: '#C46A6A',
    economy: 'Frontier outpost', government: 'Anarchy', tech: 2, population: '90 million',
    police: 0, danger: 2, sector: 4, fuelPrice: 20, blackMarket: true,
    description: 'A lawless rock of salvage yards and bars. Weapons, entertainment and anything illegal sell for a fortune, if you get here in one piece.',
    cheap: ['ore'], dear: ['weapons', 'entertainment', 'contraband', 'medicine']
  },
  {
    id: 'dunmere', name: 'Dunmere', x: 580, y: 590, color: '#C9B98A',
    economy: 'Desert world', government: 'Monarchy', tech: 3, population: '410 million',
    police: 2, danger: 1, sector: 4, fuelPrice: 16,
    description: 'Endless dune seas ruled from a palace oasis. Water is worth more than gold; ore and textiles from its mines and looms are cheap.',
    cheap: ['ore', 'textiles'], dear: ['water', 'food']
  },
  {
    id: 'mirela', name: 'Mirela', x: 160, y: 330, color: '#B88AE0',
    economy: 'Resort world', government: 'Plutocracy', tech: 5, population: '1.2 billion',
    police: 3, danger: 0, sector: 1, fuelPrice: 18,
    description: 'Coral beaches, casinos and private moons for the very rich. Entertainment, fine food and medicine sell at resort prices.',
    cheap: ['water', 'textiles'], dear: ['entertainment', 'food', 'medicine']
  },
  {
    id: 'ostara', name: 'Ostara', x: 800, y: 140, color: '#8AE0D2',
    economy: 'Ice moon', government: 'Dictatorship', tech: 4, population: '260 million',
    police: 3, danger: 1, sector: 3, fuelPrice: 17, blackMarket: true,
    description: 'A frozen penal colony where everything is rationed, except what the guards sell on the side. Water ice is cheap; food, machinery and weapons are scarce.',
    cheap: ['water', 'contraband'], dear: ['food', 'machinery', 'weapons']
  }
];

/** Decorative space lanes drawn on the star chart. Travel is point to point. */
const LANES = [
  ['solace', 'kordo'], ['solace', 'vexis'], ['solace', 'halcyon'], ['solace', 'thrane'],
  ['solace', 'dunmere'], ['vexis', 'mirela'], ['kordo', 'ostara'], ['thrane', 'dunmere'],
  ['halcyon', 'mirela']
];

const TECH_NAMES = ['Primitive', 'Agrarian', 'Frontier', 'Early industrial', 'Industrial', 'Post-industrial', 'Advanced', 'Hi-tech'];
const POLICE_NAMES = ['None', 'Light', 'Moderate', 'Strong'];
const DANGER_NAMES = ['Low', 'Medium', 'High'];

const SYSTEMS_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

/** Chart units per parsec. */
const UNITS_PER_PARSEC = 28;

module.exports = { SYSTEMS, SYSTEMS_BY_ID, LANES, TECH_NAMES, POLICE_NAMES, DANGER_NAMES, UNITS_PER_PARSEC };
