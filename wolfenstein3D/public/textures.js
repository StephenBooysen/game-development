// All the artwork, drawn in code. There are no image files: every wall texture and
// sprite is painted onto a small off-screen canvas out of coloured rectangles the
// first time it is needed, and then kept for reuse (a "cache").

/** Wall textures and sprites are 64x64 pixels, as in the original game. */
export const TEXTURE_SIZE = 64;
/** The first-person weapon pictures are a bit bigger. */
export const VIEW_SIZE = 96;

const S = TEXTURE_SIZE;

function box(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// A small random number generator with a seed, so the "random" speckles on a
// wall come out the same every time the game is loaded.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, rng, count) {
  for (let i = 0; i < count; i++) {
    box(ctx, rng() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.08)', Math.floor(rng() * S), Math.floor(rng() * S), 2, 2);
  }
}

function bricks(ctx, rng, { shades, mortar, width, height }) {
  box(ctx, mortar, 0, 0, S, S);
  for (let row = 0; row * height < S; row++) {
    const offset = row % 2 ? width / 2 : 0; // every other row is shifted, like real brickwork
    for (let x = -offset; x < S; x += width) {
      box(ctx, shades[Math.floor(rng() * shades.length)], x + 1, row * height + 1, width - 1, height - 1);
    }
  }
  speckle(ctx, rng, 220);
}

const STONE = { shades: ['#7d7d7d', '#868686', '#747474'], mortar: '#4a4a4a', width: 32, height: 16 };
const BLUE_STONE = { shades: ['#3b4f9c', '#4459ab', '#34468c'], mortar: '#1c2552', width: 32, height: 16 };
const BRICK = { shades: ['#9a3b2c', '#a84434', '#8b3325'], mortar: '#4d2018', width: 16, height: 8 };
const DARK_STONE = { shades: ['#4f564a', '#59604f', '#474d42'], mortar: '#262a22', width: 32, height: 16 };

function door(ctx, rng, { metal, dark, light }) {
  box(ctx, dark, 0, 0, S, S);
  box(ctx, metal, 3, 3, S - 6, S - 6);
  for (const [x, y] of [[8, 8], [34, 8], [8, 34], [34, 34]]) {
    box(ctx, dark, x, y, 22, 22);
    box(ctx, light, x + 2, y + 2, 18, 18);
    box(ctx, metal, x + 4, y + 4, 14, 14);
  }
  box(ctx, '#d8d8d8', 52, 29, 5, 6); // handle
  speckle(ctx, rng, 90);
}

// Each painter fills a 64x64 canvas. `rng` is the seeded generator.
const WALL_PAINTERS = {
  stone: (ctx, rng) => bricks(ctx, rng, STONE),
  blueStone: (ctx, rng) => bricks(ctx, rng, BLUE_STONE),
  brick: (ctx, rng) => bricks(ctx, rng, BRICK),
  wood: (ctx, rng) => {
    box(ctx, '#3d2610', 0, 0, S, S);
    for (let x = 0; x < S; x += 16) {
      box(ctx, ['#7a4f24', '#845728', '#704820'][Math.floor(rng() * 3)], x + 1, 0, 15, S);
      for (let i = 0; i < 5; i++) box(ctx, 'rgba(40,20,5,0.35)', x + 2 + Math.floor(rng() * 12), Math.floor(rng() * 44), 1, 20);
    }
    box(ctx, '#3d2610', 0, 0, S, 3);
    box(ctx, '#3d2610', 0, S - 4, S, 4);
    speckle(ctx, rng, 80);
  },
  stoneFlag: (ctx, rng) => {
    bricks(ctx, rng, STONE);
    box(ctx, '#3a2a10', 16, 5, 32, 3); // the pole
    box(ctx, '#27408a', 19, 8, 26, 40); // a blue banner
    box(ctx, '#1b2c62', 19, 44, 26, 4);
    box(ctx, '#e0b020', 19, 12, 26, 2);
    // A gold castle tower, the emblem of Castle Noobenstein.
    box(ctx, '#e0b020', 26, 24, 12, 16);
    for (const x of [26, 31, 36]) box(ctx, '#e0b020', x, 20, 2, 4);
    box(ctx, '#1b2c62', 30, 32, 4, 8);
  },
  moss: (ctx, rng) => {
    bricks(ctx, rng, DARK_STONE);
    // Green moss creeping down from the top and up from the bottom.
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rng() * S);
      const fromTop = rng() < 0.6;
      const length = 3 + Math.floor(rng() * 14);
      box(ctx, rng() < 0.5 ? '#3f6a2c' : '#557f36', x, fromTop ? 0 : S - length, 2, length);
    }
  },
  door: (ctx, rng) => door(ctx, rng, { metal: '#3f8f8a', dark: '#1f4744', light: '#58aaa4' }),
  doorLocked: (ctx, rng) => {
    door(ctx, rng, { metal: '#a8892c', dark: '#54430f', light: '#cdaa44' });
    box(ctx, '#1a1a1a', 53, 38, 3, 6); // keyhole
  },
  exit: (ctx, rng) => {
    box(ctx, '#565c66', 0, 0, S, S);
    box(ctx, '#6d7480', 3, 3, S - 6, S - 6);
    for (let x = -8; x < S; x += 16) {
      // yellow and black warning stripes along the top and bottom
      box(ctx, '#e0b020', x, 4, 8, 7);
      box(ctx, '#1a1a1a', x + 8, 4, 8, 7);
      box(ctx, '#e0b020', x, 53, 8, 7);
      box(ctx, '#1a1a1a', x + 8, 53, 8, 7);
    }
    box(ctx, '#2a2e35', 20, 16, 24, 32); // the switch plate
    box(ctx, '#30d050', 29, 20, 6, 6); // green light
    box(ctx, '#c8c8c8', 30, 30, 4, 14); // the lever
    box(ctx, '#d02020', 28, 28, 8, 5);
    speckle(ctx, rng, 60);
  },
};

// ---------------------------------------------------------------- soldiers

const SKIN = '#e0ac7d';
const GUN = '#2c2c2c';
const FLASH = '#fff3a0';
const FLASH_CORE = '#ffb020';

/** Uniform colours for each kind of enemy soldier. */
const SOLDIERS = {
  guard: { uniform: '#8a6a3a', dark: '#5e4726', hat: '#4b5a3a', weapon: 'pistol' },
  ss: { uniform: '#3a5fa8', dark: '#27407a', hat: '#1d2f5c', weapon: 'machinegun' },
  boss: { uniform: '#d0d0d0', dark: '#8e8e8e', hat: '#a02828', weapon: 'chaingun' },
};

/** The poses a soldier can be drawn in. Adding "Back" gives the view from behind. */
export const POSES = ['stand', 'walk1', 'walk2', 'aim', 'fire', 'pain', 'dying', 'dead'];

// Keep the barrel outside the torso silhouette so it reads as a held weapon,
// even when this 64px sprite is scaled down in a distant corridor.
function enemyWeapon(ctx, colors, pose, dy) {
  const raised = pose === 'aim' || pose === 'fire';
  const y = (raised ? 26 : 35) + dy;
  const heavy = colors.weapon === 'chaingun';
  const long = colors.weapon !== 'pistol';
  const muzzleX = long ? 55 : 50;

  // Bent sleeves reach the grip and fore-end, rather than merging across the chest.
  box(ctx, colors.dark, 22, y + 5, 13, 4);
  box(ctx, colors.uniform, 24, y + 4, 12, 3);
  box(ctx, colors.dark, 41, y + 3, 5, 7);
  box(ctx, '#101418', 34, y - 2, muzzleX - 33, heavy ? 10 : 7); // outline
  if (long) box(ctx, '#765331', 32, y, 6, 5); // stock
  box(ctx, GUN, 36, y, long ? 10 : 8, heavy ? 6 : 4); // receiver / slide
  box(ctx, '#9aa9ad', 36, y - 1, long ? 12 : 9, 2); // metal highlight
  box(ctx, '#151b20', 36, y + 4, 4, 7); // pistol grip
  if (long) box(ctx, '#444f56', 41, y + 5, heavy ? 7 : 3, 6); // drum / magazine
  box(ctx, '#64727a', 44, y + 1, muzzleX - 44, 3); // visible barrel
  if (heavy) box(ctx, '#9aa9ad', 44, y + 5, muzzleX - 44, 2); // second barrel
  box(ctx, '#080b0e', muzzleX - 1, y, 3, heavy ? 8 : 5); // muzzle
  box(ctx, SKIN, 34, y + 5, 4, 3); // trigger hand
  box(ctx, SKIN, 44, y + (heavy ? 8 : 4), 4, 3); // supporting hand

  if (pose === 'fire') {
    // A compact flash beyond the muzzle leaves the gun and hands visible.
    box(ctx, FLASH_CORE, muzzleX + 2, y - 2, 3, 9);
    box(ctx, FLASH, muzzleX + 1, y + 1, 7, 3);
    box(ctx, '#ffffff', muzzleX + 2, y + 2, 3, 1);
  }
}

function soldier(ctx, colors, pose, back) {
  if (pose === 'dead') {
    box(ctx, '#7a0000', 12, 57, 42, 5); // a pool of blood
    box(ctx, '#222222', 12, 52, 6, 7);
    box(ctx, colors.dark, 18, 53, 12, 6);
    box(ctx, colors.uniform, 30, 52, 14, 7);
    box(ctx, SKIN, 44, 52, 7, 6);
    box(ctx, colors.hat, 50, 51, 4, 8);
    return;
  }
  // One leg is lifted in each walking frame; swapping the two frames looks like walking.
  const lift = pose === 'walk1' ? [4, 0] : pose === 'walk2' ? [0, 4] : [0, 0];
  const dy = pose === 'dying' ? 16 : pose === 'pain' ? 2 : 0;
  if (pose === 'dying') {
    box(ctx, colors.dark, 23, 54, 18, 6); // on its knees
    box(ctx, '#222222', 21, 58, 22, 4);
  } else {
    box(ctx, colors.dark, 25, 40, 6, 17 - lift[0]);
    box(ctx, '#222222', 24, 57 - lift[0], 7, 5);
    box(ctx, colors.dark, 33, 40, 6, 17 - lift[1]);
    box(ctx, '#222222', 33, 57 - lift[1], 7, 5);
  }
  box(ctx, colors.uniform, 23, 22 + dy, 18, 19); // body
  box(ctx, '#222222', 23, 37 + dy, 18, 2); // belt
  box(ctx, colors.uniform, 19, 23 + dy, 4, 13); // arms
  box(ctx, colors.uniform, 41, 23 + dy, 4, 13);
  box(ctx, SKIN, 19, 36 + dy, 4, 3);
  box(ctx, SKIN, 41, 36 + dy, 4, 3);
  box(ctx, SKIN, 27, 12 + dy, 10, 10); // head
  box(ctx, colors.hat, 26, 8 + dy, 12, 6);

  if (back) {
    box(ctx, colors.hat, 26, 8 + dy, 12, 10); // the back of the head
    box(ctx, colors.dark, 26, 24 + dy, 12, 10); // a backpack
    enemyWeapon(ctx, colors, pose, dy);
    return;
  }
  box(ctx, '#222222', 29, 16 + dy, 2, 2); // eyes
  box(ctx, '#222222', 33, 16 + dy, 2, 2);
  box(ctx, '#8a4a3a', 30, 20 + dy, 4, pose === 'pain' || pose === 'dying' ? 2 : 1);
  enemyWeapon(ctx, colors, pose, dy);
  if (pose === 'pain' || pose === 'dying') {
    box(ctx, '#b00000', 28, 26 + dy, 5, 5);
    box(ctx, '#b00000', 34, 31 + dy, 3, 3);
  }
}

// ---------------------------------------------------------------- dogs

/** The poses a guard dog can be drawn in. */
export const DOG_POSES = ['stand', 'walk1', 'walk2', 'bite', 'pain', 'dying', 'dead'];

// A dog seen from the side. Seen from behind ("Back") it faces the other way, so the
// same drawing is mirrored: every rectangle's x is flipped around the middle.
function dog(ctx, pose, back) {
  const fur = '#7a5232';
  const dark = '#4e3220';
  const at = (color, x, y, w, h) => box(ctx, color, back ? S - x - w : x, y, w, h);
  if (pose === 'dead') {
    at('#7a0000', 14, 58, 38, 4);
    at(fur, 16, 53, 30, 6);
    at(dark, 44, 52, 9, 6);
    at(dark, 10, 55, 7, 3);
    return;
  }
  const drop = pose === 'dying' ? 10 : 0;
  // Legs: the walking frames swap which pair is forward.
  const legs = pose === 'walk1' ? [[16, 0], [22, 3], [38, 3], [44, 0]] : pose === 'walk2' ? [[16, 3], [22, 0], [38, 0], [44, 3]] : [[17, 0], [22, 0], [39, 0], [44, 0]];
  if (pose !== 'dying') {
    for (const [x, lift] of legs) {
      at(dark, x, 50 - lift, 4, 10);
      at('#2a1a10', x, 59 - lift, 5, 2);
    }
  }
  at(fur, 14, 38 + drop, 34, 14); // body
  at(dark, 14, 38 + drop, 34, 3); // dark back
  at(fur, 8, 36 + drop, 7, 4); // tail
  // The head leans forward and the jaws open for a bite.
  const lunge = pose === 'bite' ? 4 : 0;
  at(fur, 44 + lunge, 28 + drop, 12, 12); // head
  at(dark, 46 + lunge, 25 + drop, 4, 5); // ear
  at(fur, 53 + lunge, 33 + drop, pose === 'bite' ? 6 : 7, pose === 'bite' ? 3 : 6); // snout (upper jaw)
  if (pose === 'bite') {
    at('#d8d8d8', 54 + lunge, 36, 5, 1); // teeth
    at(fur, 53 + lunge, 38, 6, 3); // lower jaw, wide open
  }
  at('#101010', pose === 'bite' ? 61 : 59, 33 + drop, 2, 2); // nose
  at(pose === 'pain' || pose === 'dying' ? '#ffffff' : '#ffd040', 50 + lunge, 31 + drop, 2, 2); // eye
  if (pose === 'pain' || pose === 'dying') at('#b00000', 28, 42 + drop, 5, 4);
}

// ---------------------------------------------------------------- things

const ITEM_PAINTERS = {
  medkit: (ctx) => {
    box(ctx, '#8a8a8a', 21, 47, 22, 15);
    box(ctx, '#f2f2f2', 22, 46, 20, 14);
    box(ctx, '#d01818', 30, 48, 4, 10);
    box(ctx, '#d01818', 27, 51, 10, 4);
  },
  food: (ctx) => {
    box(ctx, '#d8d8d8', 20, 58, 24, 3);
    box(ctx, '#8a5a2a', 24, 52, 12, 6);
    box(ctx, '#3f9a3f', 36, 54, 5, 4);
  },
  ammo: (ctx) => {
    box(ctx, '#3d5a2a', 22, 49, 20, 13);
    box(ctx, '#2a401c', 22, 49, 20, 3);
    for (let x = 25; x < 40; x += 4) box(ctx, '#e0b020', x, 45, 2, 4);
  },
  clip: (ctx) => {
    box(ctx, '#33383f', 27, 55, 10, 7);
    box(ctx, '#e0b020', 28, 53, 8, 2);
  },
  machinegun: (ctx) => {
    box(ctx, '#5a3a1a', 8, 54, 10, 6);
    box(ctx, '#333333', 16, 54, 36, 4);
    box(ctx, '#1a1a1a', 30, 58, 4, 5);
    box(ctx, '#1a1a1a', 50, 55, 6, 2);
  },
  chaingun: (ctx) => {
    box(ctx, '#2a2a2a', 34, 47, 14, 14);
    box(ctx, '#484848', 8, 50, 28, 3);
    box(ctx, '#484848', 8, 55, 28, 3);
    box(ctx, '#e0b020', 48, 52, 8, 3);
  },
  key: (ctx) => {
    box(ctx, '#e8c020', 20, 51, 10, 10);
    box(ctx, '#6a5400', 23, 54, 4, 4);
    box(ctx, '#e8c020', 30, 55, 16, 3);
    box(ctx, '#e8c020', 40, 58, 2, 3);
    box(ctx, '#e8c020', 44, 58, 2, 3);
  },
  oneup: (ctx) => {
    // A glowing blue orb with a white cross: an extra life.
    box(ctx, 'rgba(120,180,255,0.35)', 20, 38, 24, 24);
    box(ctx, '#2a5cd0', 23, 41, 18, 18);
    box(ctx, '#4a80f0', 25, 43, 14, 14);
    box(ctx, '#ffffff', 30, 44, 4, 12);
    box(ctx, '#ffffff', 26, 48, 12, 4);
  },
  treasure: (ctx) => {
    box(ctx, '#f0c830', 24, 42, 16, 10);
    box(ctx, '#c89a10', 26, 52, 12, 2);
    box(ctx, '#f0c830', 30, 54, 4, 5);
    box(ctx, '#c89a10', 25, 59, 14, 3);
    box(ctx, '#d02020', 27, 45, 3, 3);
    box(ctx, '#2060d0', 34, 45, 3, 3);
  },
  barrel: (ctx) => {
    box(ctx, '#3d6b3d', 22, 34, 20, 28);
    box(ctx, '#5a8f5a', 25, 34, 3, 28);
    box(ctx, '#2a4a2a', 22, 39, 20, 2);
    box(ctx, '#2a4a2a', 22, 54, 20, 2);
    box(ctx, '#557f55', 22, 32, 20, 3);
  },
  pillar: (ctx) => {
    box(ctx, '#c8c8c0', 25, 0, 14, S);
    box(ctx, '#9a9a94', 35, 0, 4, S);
    box(ctx, '#a8a8a0', 21, 0, 22, 7);
    box(ctx, '#a8a8a0', 21, 56, 22, 8);
  },
  lamp: (ctx) => {
    box(ctx, '#555555', 31, 0, 2, 8); // hangs from the ceiling
    box(ctx, '#3f8f3f', 24, 8, 16, 6);
    box(ctx, 'rgba(200,255,160,0.3)', 21, 13, 22, 9);
    box(ctx, '#e4ffc4', 28, 14, 8, 4);
  },
  puff: (ctx) => {
    box(ctx, '#9a9a9a', 28, 30, 9, 9);
    box(ctx, '#e8e8e8', 30, 32, 5, 5);
    box(ctx, '#9a9a9a', 25, 35, 3, 3);
    box(ctx, '#9a9a9a', 38, 28, 3, 3);
  },
  blood: (ctx) => {
    box(ctx, '#c00000', 29, 28, 7, 7);
    box(ctx, '#900000', 25, 33, 4, 4);
    box(ctx, '#c00000', 37, 34, 3, 3);
    box(ctx, '#900000', 33, 24, 3, 3);
  },
};

// ---------------------------------------------------------------- first-person weapons

function muzzleFlash(ctx, x, y) {
  box(ctx, FLASH, x - 11, y - 11, 22, 22);
  box(ctx, FLASH_CORE, x - 6, y - 6, 12, 12);
  box(ctx, '#ffffff', x - 2, y - 2, 4, 4);
}

// What you see of your own weapon at the bottom of the screen in first-person view.
const VIEW_PAINTERS = {
  knife: (ctx, firing) => {
    const lift = firing ? -18 : 0; // a stab: the same picture, pushed forward
    box(ctx, '#d0d0d8', 56, 30 + lift, 6, 38);
    box(ctx, '#f4f4f8', 56, 30 + lift, 2, 38);
    box(ctx, '#444444', 51, 66 + lift, 16, 4);
    box(ctx, SKIN, 51, 70 + lift, 18, 44);
  },
  pistol: (ctx, firing) => {
    if (firing) muzzleFlash(ctx, 48, 34);
    box(ctx, '#3a3a3a', 42, 44, 12, 32);
    box(ctx, '#555555', 42, 44, 3, 32);
    box(ctx, '#1a1a1a', 46, 40, 4, 4);
    box(ctx, SKIN, 38, 70, 20, 26);
  },
  machinegun: (ctx, firing) => {
    if (firing) muzzleFlash(ctx, 48, 24);
    box(ctx, '#1a1a1a', 44, 30, 8, 24);
    box(ctx, '#333333', 38, 50, 20, 46);
    box(ctx, '#4a4a4a', 38, 50, 4, 46);
    box(ctx, '#1a1a1a', 28, 68, 10, 22);
    box(ctx, SKIN, 54, 74, 16, 22);
  },
  chaingun: (ctx, firing) => {
    for (const x of [32, 45, 58]) {
      if (firing) muzzleFlash(ctx, x + 3, 28);
      box(ctx, '#1a1a1a', x, 34, 6, 26);
    }
    box(ctx, '#3a3a3a', 26, 56, 44, 40);
    box(ctx, '#505050', 26, 56, 44, 4);
    box(ctx, '#e0b020', 14, 70, 12, 6);
  },
};

// ---------------------------------------------------------------- the cache

/**
 * Creates the texture store. `makeCanvas(width, height)` must return a canvas;
 * in the browser that is document.createElement('canvas'), in tests a stand-in.
 * Returns { wall(name, dark), sprite(name) }, both of which return a canvas.
 *
 * Sprite names: an item kind ("medkit"), "<soldier>.<pose>" ("guard.walk1",
 * "guard.fireBack"), "dog.<pose>" or "view.<weapon>" / "view.<weapon>.fire".
 */
export function createTextures(makeCanvas) {
  const cache = new Map();

  function paint(key, size, painter) {
    if (!cache.has(key)) {
      const canvas = makeCanvas(size, size);
      painter(canvas.getContext('2d'));
      cache.set(key, canvas);
    }
    return cache.get(key);
  }

  return {
    /** A wall texture. The `dark` version is used for north/south faces, which fakes lighting. */
    wall(name, dark = false) {
      const painter = WALL_PAINTERS[name] || WALL_PAINTERS.stone;
      return paint(`wall:${name}:${dark}`, S, (ctx) => {
        painter(ctx, seeded(name.length * 7919));
        if (dark) box(ctx, 'rgba(0,0,0,0.32)', 0, 0, S, S);
      });
    },
    sprite(name) {
      const [group, pose = 'stand', extra] = name.split('.');
      if (group === 'view') {
        return paint(name, VIEW_SIZE, (ctx) => (VIEW_PAINTERS[pose] || VIEW_PAINTERS.pistol)(ctx, extra === 'fire'));
      }
      if (group === 'dog') {
        const back = pose.endsWith('Back');
        return paint(name, S, (ctx) => dog(ctx, back ? pose.slice(0, -4) : pose, back));
      }
      if (SOLDIERS[group]) {
        const back = pose.endsWith('Back');
        return paint(name, S, (ctx) => soldier(ctx, SOLDIERS[group], back ? pose.slice(0, -4) : pose, back));
      }
      return paint(name, S, ITEM_PAINTERS[name] || ITEM_PAINTERS.puff);
    },
  };
}
