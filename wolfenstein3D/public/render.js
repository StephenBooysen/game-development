// Drawing. Every frame the whole picture is rebuilt from the game state:
// ceiling and floor, then the walls (one ray per screen column), then the sprites,
// then the crosshair and the status bar on top.
import { castRay } from './raycast.js';
import { aimTarget, angleDiff, WEAPONS, MAX_HEALTH } from './game.js';
import { TEXTURE_SIZE, VIEW_SIZE } from './textures.js';
import { floorTexture, FLOOR_SIZE, SHADES } from './floors.js';

// The game is drawn small and stretched by the browser, which gives the chunky
// pixels of an early-90s game and keeps it fast.
export const SCREEN_WIDTH = 480;
export const SCREEN_HEIGHT = 300;
const BAR_HEIGHT = 44; // the status bar at the bottom
const VIEW_HEIGHT = SCREEN_HEIGHT - BAR_HEIGHT;
const PLANE = 0.66; // half the width of the view at distance 1: about a 67 degree field of view
const SCALE = SCREEN_WIDTH / 2 / PLANE; // height in pixels of a wall that is 1 tile away

// Distance fog: far walls are darkened. The colours are made once, not every frame.
const FOG = Array.from({ length: 16 }, (_, i) => `rgba(0,0,0,${(i / 15) * 0.6})`);

/** The camera always looks directly out of the player's eyes. */
export function cameraFor(state) {
  const { x, y, angle } = state.player;
  return { x, y, angle, height: 0.5, horizon: VIEW_HEIGHT / 2 };
}

// Which picture to show for an enemy, from what it is doing and which way it faces.
function enemySprite(enemy, camera) {
  const who = enemy.type;
  if (enemy.state === 'dead') return enemy.timer < 0.25 ? `${who}.dying` : `${who}.dead`;
  if (enemy.state === 'pain') return `${who}.pain`;
  if (enemy.state === 'bite') return `${who}.bite`;
  if (enemy.state === 'aim') return `${who}.aim`;
  if (enemy.state === 'fire') return enemy.sinceShot < 0.08 ? `${who}.fire` : `${who}.aim`;
  const toCamera = Math.atan2(camera.y - enemy.y, camera.x - enemy.x);
  const back = Math.abs(angleDiff(enemy.angle, toCamera)) > Math.PI / 2 ? 'Back' : '';
  const moving = enemy.state === 'patrol' || enemy.state === 'chase';
  const pose = moving ? (Math.floor(enemy.walked * 3) % 2 ? 'walk1' : 'walk2') : 'stand';
  return `${who}.${pose}${back}`;
}

/**
 * Creates the renderer for a canvas. `textures` comes from createTextures().
 * Call draw(state, { minimap }) once per frame.
 */
export function createRenderer(canvas, textures) {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; // keep the pixels sharp when sprites are scaled up
  // For each screen column, how far away the wall is. Sprites are checked against
  // this so that a guard behind a wall is hidden (a "depth buffer").
  const depths = new Float32Array(SCREEN_WIDTH);
  // The floor and ceiling are written straight into an array of pixels, which is far
  // faster than one drawing call per pixel. (null if this canvas cannot do that.)
  const image = ctx.createImageData?.(SCREEN_WIDTH, VIEW_HEIGHT);
  const pixels = image?.data ? new Uint32Array(image.data.buffer) : null;

  // Floor casting. Walls are drawn column by column; floors are drawn row by row.
  // Every pixel in one screen row of the floor is the same distance away: the row
  // just below the horizon is far, the bottom row is right at your feet. So for each
  // row: work out that distance, find the world spot under the left edge of the
  // screen, and step evenly across to the right edge, reading the pattern as you go.
  function castPlane(camera, shades, eye, below) {
    const cos = Math.cos(camera.angle);
    const sin = Math.sin(camera.angle);
    // The directions of the rays at the left and right edges of the screen.
    const leftX = cos + sin * PLANE;
    const leftY = sin - cos * PLANE;
    const rightX = cos - sin * PLANE;
    const rightY = sin + cos * PLANE;
    const first = below ? Math.ceil(camera.horizon) : 0;
    const last = below ? VIEW_HEIGHT : Math.floor(camera.horizon);
    const mask = FLOOR_SIZE - 1;
    for (let y = first; y < last; y++) {
      // How many pixels this row is from the horizon decides how far away it is.
      const fromHorizon = below ? y + 0.5 - camera.horizon : camera.horizon - (y + 0.5);
      const distance = (eye * SCALE) / fromHorizon;
      const shade = shades[Math.min(SHADES - 1, Math.floor(distance * 1.1))];
      const stepX = (distance * (rightX - leftX)) / SCREEN_WIDTH;
      const stepY = (distance * (rightY - leftY)) / SCREEN_WIDTH;
      let worldX = camera.x + distance * leftX + stepX / 2;
      let worldY = camera.y + distance * leftY + stepY / 2;
      const rowStart = y * SCREEN_WIDTH;
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        // The fraction of the tile we are over, as a pixel of the 64x64 pattern.
        // (& mask keeps it in 0..63, which also works across tile edges.)
        const tx = Math.floor(worldX * FLOOR_SIZE) & mask;
        const ty = Math.floor(worldY * FLOOR_SIZE) & mask;
        pixels[rowStart + x] = shade[ty * FLOOR_SIZE + tx];
        worldX += stepX;
        worldY += stepY;
      }
    }
  }

  // Returns false when the map has no patterns (or the canvas cannot do it), so the
  // flat colours are used instead.
  function drawTexturedBackground(state, camera) {
    const floor = floorTexture(state.floorTexture);
    const ceiling = floorTexture(state.ceilingTexture);
    if (!pixels || !floor || !ceiling) return false;
    castPlane(camera, ceiling, 1 - camera.height, false);
    castPlane(camera, floor, camera.height, true);
    ctx.putImageData(image, 0, 0);
    return true;
  }

  function drawBackground(state, camera) {
    if (drawTexturedBackground(state, camera)) return;
    ctx.fillStyle = state.ceiling;
    ctx.fillRect(0, 0, SCREEN_WIDTH, camera.horizon);
    ctx.fillStyle = state.floor;
    ctx.fillRect(0, camera.horizon, SCREEN_WIDTH, VIEW_HEIGHT - camera.horizon);
    // Both get darker towards the horizon, which is where they are furthest away.
    const shade = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    const middle = camera.horizon / VIEW_HEIGHT;
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(middle, 'rgba(0,0,0,0.6)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, SCREEN_WIDTH, VIEW_HEIGHT);
  }

  function drawWalls(state, camera) {
    const cos = Math.cos(camera.angle);
    const sin = Math.sin(camera.angle);
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // -1 at the left edge of the screen, +1 at the right edge.
      const across = ((x + 0.5) / SCREEN_WIDTH) * 2 - 1;
      const rayX = cos - sin * PLANE * across;
      const rayY = sin + cos * PLANE * across;
      const hit = castRay(state, camera.x, camera.y, Math.atan2(rayY, rayX));
      // Use the distance straight ahead, not along the slanted ray. Otherwise a
      // flat wall would look curved (the "fisheye" effect).
      const depth = Math.max(0.01, hit.dist / Math.hypot(rayX, rayY));
      depths[x] = depth;
      if (!hit.wall) continue;
      const height = SCALE / depth;
      const top = camera.horizon - (1 - camera.height) * height;
      const column = Math.min(TEXTURE_SIZE - 1, Math.floor(hit.u * TEXTURE_SIZE));
      ctx.drawImage(textures.wall(hit.wall, hit.side === 1), column, 0, 1, TEXTURE_SIZE, x, top, 1, height);
      const fog = Math.min(FOG.length - 1, Math.floor(depth * 1.1));
      if (fog > 0) {
        ctx.fillStyle = FOG[fog];
        ctx.fillRect(x, top, 1, height);
      }
    }
  }

  // Where a point in the world lands on the screen: depth is how far in front of
  // the camera it is, x the screen column, and size the height of 1 tile there.
  function project(camera, x, y) {
    const relX = x - camera.x;
    const relY = y - camera.y;
    const cos = Math.cos(camera.angle);
    const sin = Math.sin(camera.angle);
    const depth = relX * cos + relY * sin;
    const aside = relY * cos - relX * sin;
    return { depth, x: SCREEN_WIDTH / 2 + (aside * SCALE) / depth, size: SCALE / depth };
  }

  function drawSprite(camera, sprite) {
    const at = project(camera, sprite.x, sprite.y);
    if (at.depth < 0.2) return; // behind the camera, or too close to draw
    const image = textures.sprite(sprite.name);
    const size = at.size * (sprite.scale || 1);
    const left = at.x - size / 2;
    const top = camera.horizon + camera.height * at.size - size; // feet on the floor
    const from = Math.max(0, Math.ceil(left));
    const to = Math.min(SCREEN_WIDTH, Math.floor(left + size));
    // Draw only the columns that are nearer than the wall behind them, in as few pieces as possible.
    let runStart = -1;
    for (let x = from; x <= to; x++) {
      const visible = x < to && depths[x] > at.depth;
      if (visible && runStart < 0) runStart = x;
      if (!visible && runStart >= 0) {
        const pixels = image.width / size; // texture pixels per screen pixel
        ctx.drawImage(image, (runStart - left) * pixels, 0, (x - runStart) * pixels, image.height, runStart, top, x - runStart, size);
        runStart = -1;
      }
    }
  }

  function drawSprites(state, camera) {
    const sprites = [];
    for (const item of state.items) sprites.push({ x: item.x, y: item.y, name: item.kind });
    for (const enemy of state.enemies) {
      sprites.push({ x: enemy.x, y: enemy.y, name: enemySprite(enemy, camera), scale: enemy.type === 'boss' ? 1.25 : 1 });
    }
    for (const effect of state.effects) sprites.push({ x: effect.x, y: effect.y, name: effect.kind });
    // Far sprites first, so that near ones are painted over them.
    const cos = Math.cos(camera.angle);
    const sin = Math.sin(camera.angle);
    const depthOf = (sprite) => (sprite.x - camera.x) * cos + (sprite.y - camera.y) * sin;
    sprites.sort((a, b) => depthOf(b) - depthOf(a));
    for (const sprite of sprites) drawSprite(camera, sprite);
  }

  // In first person the aim stays at the centre, regardless of wall distance.
  function drawCrosshair(state, camera) {
    const player = state.player;
    const aim = aimTarget(state, player.angle, WEAPONS[player.weapon].range);
    const x = SCREEN_WIDTH / 2;
    const y = camera.horizon;
    ctx.fillStyle = '#101411'; // dark backing keeps the reticle visible on pale walls
    ctx.fillRect(x - 7, y - 1, 6, 3);
    ctx.fillRect(x + 2, y - 1, 6, 3);
    ctx.fillRect(x - 1, y - 7, 3, 6);
    ctx.fillRect(x - 1, y + 2, 3, 6);
    ctx.fillStyle = aim.enemy ? '#ff4040' : '#e8ffe8'; // red when a guard is in the line of fire
    ctx.fillRect(x - 6, y, 4, 1);
    ctx.fillRect(x + 3, y, 4, 1);
    ctx.fillRect(x, y - 6, 1, 4);
    ctx.fillRect(x, y + 3, 1, 4);
  }

  function drawHeldWeapon(state) {
    const player = state.player;
    const firing = player.sinceShot < 0.07 ? '.fire' : '';
    const image = textures.sprite(`view.${player.weapon}${firing}`);
    const size = VIEW_SIZE * 2;
    const { sway, bob } = weaponSway(player);
    const kick = player.sinceShot < 0.07 && player.weapon !== 'knife' ? 4 : 0; // recoil
    ctx.drawImage(image, 0, 0, image.width, image.height, (SCREEN_WIDTH - size) / 2 + sway, VIEW_HEIGHT - size + 4 + bob + kick, size, size);
  }

  // A red glow on the edge of the screen the last hit came from: left, right,
  // top (in front of you) or bottom (behind you). It fades with the red flash.
  function drawHitDirection(state) {
    const player = state.player;
    if (player.hurt <= 0 || player.hitAngle === null) return;
    const side = hitSide(player);
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = `rgba(255,30,30,${(player.hurt * 0.7 * (bands - i)) / bands})`;
      const depth = 4 * i;
      if (side === 'left') ctx.fillRect(depth, 0, 4, VIEW_HEIGHT);
      else if (side === 'right') ctx.fillRect(SCREEN_WIDTH - depth - 4, 0, 4, VIEW_HEIGHT);
      else if (side === 'front') ctx.fillRect(0, depth, SCREEN_WIDTH, 4);
      else ctx.fillRect(0, VIEW_HEIGHT - depth - 4, SCREEN_WIDTH, 4);
    }
  }

  function drawFlashes(state) {
    const player = state.player;
    if (player.hurt > 0) {
      ctx.fillStyle = `rgba(200,0,0,${player.hurt * 0.3})`;
      ctx.fillRect(0, 0, SCREEN_WIDTH, VIEW_HEIGHT);
      drawHitDirection(state);
    }
    if (player.glow > 0) {
      ctx.fillStyle = `rgba(255,220,80,${player.glow * 0.2})`;
      ctx.fillRect(0, 0, SCREEN_WIDTH, VIEW_HEIGHT);
    }
    if (state.message && state.time - state.message.time < 2.5) {
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(state.message.text, SCREEN_WIDTH / 2 + 1, 15);
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(state.message.text, SCREEN_WIDTH / 2, 14);
    }
  }

  function drawMinimap(state) {
    const tile = 3;
    const left = SCREEN_WIDTH - state.width * tile - 6;
    const top = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(left - 2, top - 2, state.width * tile + 4, state.height * tile + 4);
    for (let row = 0; row < state.height; row++) {
      for (let col = 0; col < state.width; col++) {
        const wall = state.walls[row][col];
        if (wall) {
          ctx.fillStyle = wall === 'exit' ? '#40e060' : '#8a8a96';
          ctx.fillRect(left + col * tile, top + row * tile, tile, tile);
        }
      }
    }
    for (const door of state.doors.values()) {
      ctx.fillStyle = door.locked ? '#e0b020' : '#3fa8a0';
      ctx.fillRect(left + door.col * tile, top + door.row * tile, tile, tile);
    }
    ctx.fillStyle = '#8a8a96'; // a sliding secret wall (secrets that are still hidden look like any wall)
    for (const mover of state.movers) {
      ctx.fillRect(left + (mover.col + mover.dc * mover.offset) * tile, top + (mover.row + mover.dr * mover.offset) * tile, tile, tile);
    }
    const player = state.player;
    const x = left + player.x * tile;
    const y = top + player.y * tile;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    ctx.fillStyle = '#ff5050'; // a dot showing which way you face
    ctx.fillRect(Math.round(x + Math.cos(player.angle) * 3), Math.round(y + Math.sin(player.angle) * 3), 1, 1);
  }

  function drawStatusBar(state, mapCount) {
    const player = state.player;
    const top = VIEW_HEIGHT;
    ctx.fillStyle = '#151d17';
    ctx.fillRect(0, top, SCREEN_WIDTH, BAR_HEIGHT);
    ctx.fillStyle = '#e8bd66';
    ctx.fillRect(0, top, SCREEN_WIDTH, 1);
    ctx.fillStyle = '#394535';
    for (const x of [44, 84, 150, 232, 294, 358]) ctx.fillRect(x, top + 8, 1, BAR_HEIGHT - 16);
    // A small health gauge supplements the number; low health also has a text warning.
    ctx.fillStyle = '#394535';
    ctx.fillRect(160, top + 39, 62, 2);
    ctx.fillStyle = player.health <= MAX_HEALTH / 4 ? '#ff705f' : '#a9c285';
    ctx.fillRect(160, top + 39, 62 * Math.max(0, Math.min(1, player.health / MAX_HEALTH)), 2);
    const cells = [
      ['MAP', `${state.mapIndex + 1}/${mapCount}`, 22, '#ffffff'],
      ['LIVES', String(player.lives), 64, player.lives === 1 ? '#ff705f' : '#ffffff'],
      ['SCORE', String(player.score), 117, '#ffffff'],
      [player.health <= MAX_HEALTH / 4 ? 'CRITICAL' : 'HEALTH', `${player.health}%`, 192, player.health <= MAX_HEALTH / 4 ? '#ff705f' : '#ffffff'],
      ['AMMO', WEAPONS[player.weapon].usesAmmo ? String(player.ammo) : '-', 262, player.ammo === 0 ? '#ff5050' : '#ffffff'],
      ['KEY', player.keys > 0 ? 'GOLD' : '-', 326, '#f0c830'],
      ['WEAPON', WEAPONS[player.weapon].name.toUpperCase(), 418, '#ffffff'],
    ];
    ctx.textAlign = 'center';
    for (const [label, value, x, color] of cells) {
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#a7b39d';
      ctx.fillText(label, x, top + 14);
      ctx.font = `bold ${value.length > 8 ? 11 : 16}px monospace`;
      ctx.fillStyle = color;
      ctx.fillText(value, x, top + 34);
    }
  }

  /** Draws one first-person frame. Options: minimap, mapCount. */
  function draw(state, { minimap = true, mapCount = 3 } = {}) {
    const camera = cameraFor(state);
    drawBackground(state, camera);
    drawWalls(state, camera);
    drawSprites(state, camera);
    if (state.status !== 'dead') {
      drawHeldWeapon(state);
      drawCrosshair(state, camera);
    }
    drawFlashes(state);
    if (minimap) drawMinimap(state);
    drawStatusBar(state, mapCount);
    return camera;
  }

  return { draw, depths };
}

/**
 * How far the held weapon is pushed sideways (sway) and down (bob) while walking.
 * The sideways swing is half as fast as the up-and-down one, so the weapon traces a
 * figure-of-eight, like a real stride: down on each step, left and right every two.
 */
export function weaponSway(player) {
  if (player.speed <= 0) return { sway: 0, bob: 0 };
  return { sway: Math.sin(player.walked * 2.5) * 7, bob: Math.abs(Math.sin(player.walked * 5)) * 6 };
}

/** Which edge of the screen the last hit came from: 'front', 'behind', 'left' or 'right'. */
export function hitSide(player) {
  // A positive angle is a turn to the right (y grows downwards on the map).
  const turn = angleDiff(player.angle, player.hitAngle);
  if (Math.abs(turn) <= Math.PI / 4) return 'front';
  if (Math.abs(turn) >= (Math.PI * 3) / 4) return 'behind';
  return turn > 0 ? 'right' : 'left';
}
