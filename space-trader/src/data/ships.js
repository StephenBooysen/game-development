'use strict';

/**
 * Ship hulls for sale. `slots` is how many weapon / shield / gadget fittings it takes.
 * `minTech` is the lowest tech level of shipyard that sells it.
 */
const SHIPS = {
  kestrel: {
    id: 'kestrel', name: 'Kestrel Mk I', cls: 'Light freighter', maker: 'Talon Yards',
    price: 6400, hull: 100, cargo: 15, fuel: 12, speed: 4, crew: 2,
    slots: { weapon: 2, shield: 1, gadget: 1 }, minTech: 2
  },
  mule: {
    id: 'mule', name: 'Mule', cls: 'Bulk hauler', maker: 'Brannock Heavy',
    price: 14800, hull: 140, cargo: 35, fuel: 10, speed: 3, crew: 3,
    slots: { weapon: 1, shield: 1, gadget: 2 }, minTech: 3
  },
  falcon: {
    id: 'falcon', name: 'Falcon', cls: 'Interceptor', maker: 'Aeris Dynamics',
    price: 22500, hull: 160, cargo: 8, fuel: 15, speed: 8, crew: 2,
    slots: { weapon: 3, shield: 2, gadget: 1 }, minTech: 5
  },
  atlas: {
    id: 'atlas', name: 'Atlas', cls: 'Heavy trader', maker: 'Meridian Lines',
    price: 68000, hull: 260, cargo: 60, fuel: 14, speed: 5, crew: 6,
    slots: { weapon: 3, shield: 3, gadget: 3 }, minTech: 6
  }
};

const SHIP_ORDER = ['kestrel', 'mule', 'falcon', 'atlas'];

/**
 * Fittings. Weapons roll `damage` per volley (plus the pilot's Battle skill);
 * `piercing` damage skips shields. Shields add `shield` points and `regen` per combat turn.
 */
const EQUIPMENT = {
  pulse: { id: 'pulse', name: 'Pulse laser', type: 'weapon', price: 1200, minTech: 2, damage: [10, 20], desc: '10–20 damage per volley' },
  beam: { id: 'beam', name: 'Beam laser', type: 'weapon', price: 2400, minTech: 4, damage: [18, 32], desc: '18–32 damage per volley' },
  missile: { id: 'missile', name: 'Missile rack', type: 'weapon', price: 3900, minTech: 5, damage: [14, 24], piercing: true, desc: '14–24 damage that ignores shields' },
  deflector1: { id: 'deflector1', name: 'Deflector I', type: 'shield', price: 1800, minTech: 3, shield: 40, regen: 0, desc: '40 shield points' },
  deflector2: { id: 'deflector2', name: 'Deflector II', type: 'shield', price: 4200, minTech: 5, shield: 80, regen: 10, desc: '80 shield points, recharges 10 per turn' },
  cargopods: { id: 'cargopods', name: 'Cargo pods', type: 'gadget', price: 1600, minTech: 2, cargo: 5, desc: '+5 tonnes cargo capacity' },
  navcomp: { id: 'navcomp', name: 'Nav computer', type: 'gadget', price: 2800, minTech: 5, navigation: 2, desc: '+2 Navigation: longer odds of fleeing, fuel savings' },
  targeting: { id: 'targeting', name: 'Targeting array', type: 'gadget', price: 2600, minTech: 5, battle: 2, desc: '+2 Battle: better hit chance and damage' }
};

const EQUIPMENT_ORDER = ['pulse', 'beam', 'missile', 'deflector1', 'deflector2', 'cargopods', 'navcomp', 'targeting'];

/** The ship every new commander is given. */
const STARTER_SHIP = { type: 'kestrel', equipment: ['pulse', 'deflector1'] };

module.exports = { SHIPS, SHIP_ORDER, EQUIPMENT, EQUIPMENT_ORDER, STARTER_SHIP };
