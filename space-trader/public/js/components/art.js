// Line-art ships and scenery, drawn as inline SVG. All shapes are static strings.

import { html, raw, escape } from '../html.js';

/** Side profiles of the player's ship types (200 x 70 viewBox). */
const SHIP_PATHS = {
  kestrel: { hull: 'M20 35 L70 20 L150 22 L185 35 L150 48 L70 50 Z', detail: 'M80 21 L95 6 L120 22 M80 49 L95 64 L120 48', engine: 20 },
  mule: { hull: 'M15 22 L160 22 L185 35 L160 48 L15 48 Z', detail: 'M40 22 L40 48 M75 22 L75 48 M110 22 L110 48', engine: 15 },
  falcon: { hull: 'M20 35 L90 28 L185 35 L90 42 Z', detail: 'M70 30 L110 4 L125 30 M70 40 L110 66 L125 40', engine: 20 },
  atlas: { hull: 'M10 35 L40 12 L160 12 L190 35 L160 58 L40 58 Z', detail: 'M60 12 L60 58 M100 12 L100 58 M140 12 L140 58', engine: 10 }
};

/**
 * The player's ship in profile.
 * @param {string} type ship id
 * @param {{stroke?: string, fill?: string, label?: string, width?: number, flame?: boolean, className?: string}} [opts]
 */
export function playerShip(type, { stroke = '#D8E1EE', fill = '#0B1019', label = '', width = 260, flame = true, className = '' } = {}) {
  const p = SHIP_PATHS[type] || SHIP_PATHS.kestrel;
  const e = p.engine;
  const role = label ? raw(` role="img" aria-label="${escape(label)}"`) : raw(' aria-hidden="true"');
  return html`<svg class="${className}" width="${width}" viewBox="-20 0 220 70" fill="none" stroke-linejoin="round"${role}>
    <path d="${p.hull}" fill="${fill}" stroke="${stroke}" stroke-width="2"></path>
    <path d="${p.detail}" stroke="${stroke}" stroke-width="2" opacity=".85"></path>
    ${flame ? raw(`<path d="M${e} 30 L${e - 26} 27 M${e} 40 L${e - 26} 43" stroke="#FFB547" stroke-width="3"></path>`) : ''}
    <circle cx="168" cy="35" r="3.5" fill="#5CC8FF" stroke="none"></circle>
  </svg>`;
}

/** Shipyard card outline (no flame, tinted). */
export function shipCard(type, tint) {
  const p = SHIP_PATHS[type] || SHIP_PATHS.kestrel;
  return html`<svg aria-hidden="true" viewBox="0 0 200 70" preserveAspectRatio="xMidYMid meet" fill="none" stroke="${tint}" stroke-width="2" stroke-linejoin="round"><path d="${p.hull} ${p.detail}"></path></svg>`;
}

/** Pirate raider (also used, in amber, for bounty hunters). */
export function raider({ stroke = '#FF8A7A', fill = '#160B0D', label = 'Hostile ship', width = 260 } = {}) {
  return html`<svg role="img" aria-label="${label}" width="${width}" viewBox="0 0 260 140" fill="none" stroke-linejoin="round">
    <path d="M230 70 L170 40 L120 46 L60 30 L20 70 L60 110 L120 94 L170 100 Z" fill="${fill}" stroke="${stroke}" stroke-width="2"></path>
    <path d="M120 46 L100 10 L80 34 M120 94 L100 130 L80 106" stroke="${stroke}" stroke-width="2"></path>
    <path d="M20 70 L0 64 M20 70 L0 76" stroke="${stroke}" stroke-width="3"></path>
    <circle cx="70" cy="70" r="6" fill="${stroke}"></circle>
  </svg>`;
}

/** Free trader bulk hauler. */
export function hauler(label) {
  return html`<svg role="img" aria-label="${label}" viewBox="0 0 384 150" fill="none" stroke-linejoin="round">
    <path d="M20 50 L300 50 L360 75 L300 100 L20 100 Z" fill="#0B1520" stroke="#5CC8FF" stroke-width="2"></path>
    <path d="M80 50 L80 100 M140 50 L140 100 M200 50 L200 100 M250 50 L250 100" stroke="#5CC8FF" stroke-width="1" opacity=".6"></path>
    <path d="M260 50 L280 24 L320 24 L330 58" stroke="#5CC8FF" stroke-width="2"></path>
    <path d="M20 60 L0 58 M20 90 L0 92" stroke="#FFB547" stroke-width="3"></path>
  </svg>`;
}

/** Top-view schematic of the starter ship with callouts. */
export function kestrelSchematic(cargo) {
  return html`<svg role="img" aria-label="Kestrel Mk I light freighter, top view" viewBox="0 0 560 300" fill="none" stroke-linejoin="round">
    <g stroke="#5CC8FF" stroke-width="2">
      <path d="M60 150 L170 104 L360 96 L470 126 L520 150 L470 174 L360 204 L170 196 Z"></path>
      <path d="M200 102 L250 40 L330 40 L350 98"></path>
      <path d="M200 198 L250 260 L330 260 L350 202"></path>
      <rect x="220" y="120" width="120" height="60"></rect>
      <path d="M220 150 L340 150 M260 120 L260 180 M300 120 L300 180" stroke-width="1" opacity=".6"></path>
      <path d="M420 132 L470 142 L470 158 L420 168 Z"></path>
      <path d="M60 136 L30 136 L30 164 L60 164"></path>
    </g>
    <path d="M30 142 L0 142 M30 158 L0 158" stroke="#FFB547" stroke-width="3"></path>
    <g stroke="#8B97AB" stroke-width="1" stroke-dasharray="3 4">
      <path d="M280 120 L280 20 L400 20"></path>
      <path d="M445 150 L445 280 L520 280"></path>
      <path d="M290 250 L120 280"></path>
    </g>
    <g font-family="IBM Plex Mono, monospace" font-size="12" fill="#A9B4C6" stroke="none">
      <text x="406" y="24">CARGO BAY · ${cargo} t</text>
      <text x="452" y="276">BRIDGE</text>
      <text x="20" y="284">PULSE LASER MOUNT</text>
    </g>
  </svg>`;
}

/** The ship on the title screen. */
export const titleShip = raw(`<svg aria-hidden="true" width="150" height="80" viewBox="-24 0 174 80" fill="none" stroke="#D8E1EE" stroke-width="2" stroke-linejoin="round"><path d="M10 40 L60 22 L120 30 L140 40 L120 50 L60 58 Z"></path><path d="M60 22 L74 6 L92 26"></path><path d="M60 58 L74 74 L92 54"></path><path d="M10 40 L-20 36 M10 40 L-20 44" stroke="#FFB547"></path><circle cx="112" cy="40" r="4" fill="#5CC8FF" stroke="none"></circle></svg>`);

/** Wreckage after a won fight. */
export const debris = raw(`<svg aria-hidden="true" width="360" height="160" viewBox="0 0 360 160" fill="none" stroke="#FF8A7A" stroke-width="2" stroke-linejoin="round" style="max-width:100%;height:auto">
  <path d="M60 70 L110 50 L140 64 L120 92 Z" opacity=".8"></path>
  <path d="M170 40 L220 30 L232 58 L190 66 Z" opacity=".6"></path>
  <path d="M200 100 L250 92 L262 128 L214 132 Z" opacity=".7"></path>
  <path d="M150 90 L160 120 M140 110 L178 104" stroke="#FFB547"></path>
  <circle cx="300" cy="60" r="3" fill="#FFB547" stroke="none"></circle><circle cx="90" cy="130" r="2" fill="#FFB547" stroke="none"></circle><circle cx="250" cy="20" r="2" fill="#FF8A7A" stroke="none"></circle>
</svg>`);

/** Shaded planet disc. */
export function planetStyle(color, size) {
  return `width:${size}px;height:${size}px;background:radial-gradient(circle at 35% 30%,#ffffffaa,${color} 35%,#0A0F18 85%)`;
}

/** Big station planet background, tinted by the system colour. */
export function heroPlanetStyle(color) {
  return `background:radial-gradient(circle at 60% 40%,#ffffffcc 0%,${color} 32%,${color}55 62%,#081208 82%);box-shadow:0 0 90px ${color}33`;
}
