// Turns "which keys are down" into "what the player wants to do".
// Keeping this apart from the browser events means it can be tested without a keyboard.

const WEAPON_KEYS = { Digit1: 'knife', Digit2: 'pistol', Digit3: 'machinegun', Digit4: 'chaingun' };

/** Keys the game uses. The page stops the browser's own reaction to them (such as scrolling). */
export const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyN', 'KeyP',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight',
  ...Object.keys(WEAPON_KEYS),
]);

/**
 * Builds the input object that step() in game.js expects.
 *   held    = keys that are down right now (for moving and firing)
 *   pressed = keys that went down since the last frame (for one-off actions like "use")
 *   look    = how far the mouse turned the player, in radians
 * Key names are KeyboardEvent.code values, which describe the position of a key,
 * so W A S D work the same on any keyboard layout.
 */
export function readInput({ held, pressed, look = 0, mouseFire = false }) {
  const any = (codes) => codes.some((code) => held.has(code));
  const axis = (plus, minus) => (any(plus) ? 1 : 0) - (any(minus) ? 1 : 0);
  let weapon = null;
  for (const code of pressed) weapon = WEAPON_KEYS[code] || weapon;
  return {
    forward: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    strafe: axis(['KeyD'], ['KeyA']),
    turn: axis(['ArrowRight'], ['ArrowLeft']),
    look,
    run: any(['ShiftLeft', 'ShiftRight']),
    fire: mouseFire || held.has('Space'),
    use: pressed.has('KeyE') || pressed.has('Enter'),
    nextWeapon: pressed.has('KeyQ'),
    weapon,
  };
}
