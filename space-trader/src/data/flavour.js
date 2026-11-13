'use strict';

/** Names and text used to dress up encounters and news. */

const PIRATE_NAMES = [
  'Rust Jackal', 'Grey Widow', 'Black Lantern', 'Scrap Hound', 'Red Mantis', 'Bone Kite',
  'Iron Leech', 'Cinder Wasp', 'Hollow Crown', 'Gutter Saint', 'Vanta Moth', 'Rot Fang'
];

const PIRATE_LINES = [
  'Nice hold you’ve got there, {ship}. Dump the cargo and we’ll forget we saw you.',
  'Engines off, {ship}. You’re carrying more than you can defend.',
  'This lane has a toll, {ship}. Pay it in credits, cargo or hull plating.',
  'We’ve been watching you since {from}. Let’s make this quick.'
];

const HUNTER_NAMES = ['Final Notice', 'Writ of Seizure', 'Due Diligence', 'Collector IX', 'Lien Holder'];

const HUNTER_LINES = [
  'Interstellar Credit Union recovery, {ship}. Your loan is {overdue} days overdue. Settle up or we take it out of your hull.',
  'Commander, the bank has a claim on your ship. Pay something now and we’ll file for an extension.'
];

const TRADER_SHIPS = ['Margo’s Bounty', 'Lucky Seventh', 'Patient Ox', 'Quiet Harvest', 'Long Haul', 'Second Wind', 'Copper Gull'];
const TRADER_CAPTAINS = ['Margo Teal', 'Idris Vane', 'Oona Pike', 'Teodor Hask', 'Bea Moreno', 'Kit Sallow', 'Ines Okafor'];

const TRADER_LINES = [
  '{ship}, you look like you’re heading to {to}. I’ve got a few things to deal. Interested?',
  'Good to see a friendly transponder out here. Want to trade before we both move on?',
  'Hold on, {ship}. I’m running heavy and I’d rather sell here than haul it all the way.'
];

/**
 * World events that move prices at one system. `mult` > 1 means demand (prices up);
 * < 1 means a glut (prices down).
 */
const MARKET_EVENTS = [
  { good: 'food', mult: 2, text: 'Drought on {sys}: food prices there have doubled.' },
  { good: 'food', mult: 0.55, text: 'Bumper harvest on {sys}. Food prices have crashed.' },
  { good: 'medicine', mult: 2.1, text: 'Plague outbreak on {sys}. Medicine is in desperate demand.' },
  { good: 'weapons', mult: 1.9, text: 'Border skirmishes near {sys}. Weapons prices are soaring.' },
  { good: 'entertainment', mult: 1.8, text: 'Curfew on {sys} has the population starved for entertainment.' },
  { good: 'water', mult: 1.9, text: 'Reservoir contamination on {sys}: clean water prices up sharply.' },
  { good: 'robotics', mult: 1.7, text: 'Robotics shortage on {sys} after a factory fire. Prices climbing.' },
  { good: 'machinery', mult: 1.8, text: 'Industrial accident on {sys}. Machinery wanted urgently.' },
  { good: 'ore', mult: 0.5, text: 'Ore glut on {sys} after a rich new seam was struck.' },
  { good: 'textiles', mult: 1.7, text: 'Fashion craze on {sys}. Textile buyers are paying over the odds.' }
];

module.exports = {
  PIRATE_NAMES, PIRATE_LINES, HUNTER_NAMES, HUNTER_LINES,
  TRADER_SHIPS, TRADER_CAPTAINS, TRADER_LINES, MARKET_EVENTS
};
