'use strict';

/**
 * Trade goods.
 *
 * - `base`: galactic average price in credits per tonne.
 * - `produceTech`: minimum tech level for a system to produce (and so sell) the good.
 * - `useTech`: minimum tech level for a system to want (and so buy) the good.
 * - `variance`: random day-to-day price swing, as a fraction of the price.
 * - `stock`: typical stock in tonnes at a system that produces it.
 * - `illegal`: only traded on black markets; police confiscate it.
 */
const GOODS = [
  { id: 'water', name: 'Water', base: 34, produceTech: 0, useTech: 0, variance: 0.08, stock: 50 },
  { id: 'textiles', name: 'Textiles', base: 72, produceTech: 1, useTech: 0, variance: 0.08, stock: 40 },
  { id: 'food', name: 'Food', base: 56, produceTech: 1, useTech: 0, variance: 0.1, stock: 50 },
  { id: 'ore', name: 'Ore', base: 120, produceTech: 2, useTech: 2, variance: 0.1, stock: 30 },
  { id: 'entertainment', name: 'Entertainment', base: 240, produceTech: 3, useTech: 1, variance: 0.12, stock: 16 },
  { id: 'weapons', name: 'Weapons', base: 860, produceTech: 3, useTech: 1, variance: 0.12, stock: 8 },
  { id: 'medicine', name: 'Medicine', base: 580, produceTech: 4, useTech: 1, variance: 0.1, stock: 10 },
  { id: 'machinery', name: 'Machinery', base: 470, produceTech: 4, useTech: 3, variance: 0.1, stock: 12 },
  { id: 'robotics', name: 'Robotics', base: 1500, produceTech: 6, useTech: 4, variance: 0.12, stock: 6 },
  { id: 'contraband', name: 'Contraband', base: 1700, produceTech: 0, useTech: 0, variance: 0.15, stock: 6, illegal: true }
];

const GOODS_BY_ID = Object.fromEntries(GOODS.map((g) => [g.id, g]));

module.exports = { GOODS, GOODS_BY_ID };
