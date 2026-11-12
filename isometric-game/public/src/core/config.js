/**
 * Engine-level defaults.
 *
 * Only things with no opinion about *which* game is running live here. A game
 * spreads over these in its own config (see `games/<id>/config.js`), so a
 * shared module can read a sensible number even for a field the game never
 * mentioned.
 *
 * Anything that names a crop, an ore, a season or a phase belongs to a game,
 * not to this file.
 */

export const WORLD = {
  /** Map is SIZE x SIZE tiles, each 1 world unit across. */
  size: 56,
  tile: 1,
  /** Everything outside this inset is impassable border. */
  border: 6,
};

export const CAMERA = {
  /** Half-height of the orthographic frustum; smaller = more zoomed in. */
  zoom: 11,
  zoomMin: 5,
  zoomMax: 30,
  /** Classic 2:1 dimetric look, tilted a little for readability. */
  pitch: 35.264 * (Math.PI / 180),
  yawSteps: 4,
  far: 400,
};

export const TIME = {
  /** Real seconds per in-game day (overridable in settings). */
  dayLength: 420,
  /** Days in one phase of the calendar — a season, a lunar cycle, whatever. */
  daysPerPhase: 14,
  /** Day starts at 06:00 and you fall over at 02:00. */
  wakeHour: 6,
  collapseHour: 26,
};

export const PLAYER = {
  speed: 4.6,
  runSpeed: 7.4,
  maxEnergy: 100,
  /** Reach in tiles for using a tool. */
  reach: 2.6,
  actionCooldown: 0.34,
};

export const ECONOMY = {
  startingGold: 500,
  /** Fraction of base price you get when selling. */
  sellRate: 1,
};

/** Hotbar slots. The HUD and the number-row bindings both read this. */
export const HOTBAR_SLOTS = 8;
