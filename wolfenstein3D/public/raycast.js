// Ray casting: follow a straight line across the tile grid until it hits a wall.
// This one function does three jobs: drawing the walls (one ray per screen column),
// checking whether a guard can see the player, and working out what a bullet hits.
// It also handles secret walls while they slide, which sit between two tiles.

/** The key a door is stored under in world.doors. */
export function tileKey(world, col, row) {
  return row * world.width + col;
}

/**
 * Casts a ray from (ox, oy) in the direction `angle` (radians).
 * `world` needs { width, height, walls, doors } and may have `movers` (sliding walls).
 * Returns the first wall or closed door hit: { dist, wall, side, u, col, row, door }.
 *   dist = distance travelled, wall = texture name (null if nothing was hit),
 *   side = 0 when an east/west face was hit, 1 for north/south (used for shading),
 *   u    = how far across the tile the hit is (0..1), to pick the texture column.
 *
 * The algorithm is called DDA: instead of creeping forward in tiny steps, it jumps
 * straight from one grid line to the next, so no tile is ever skipped.
 */
export function castRay(world, ox, oy, angle, maxDist = 64) {
  const hit = castGrid(world, ox, oy, angle, maxDist);
  if (!world.movers?.length) return hit;
  // A sliding wall is not in the grid: it is a 1x1 box at an in-between position.
  // Check each one directly and keep whichever hit is nearest.
  let best = hit;
  for (const mover of world.movers) {
    const boxHit = hitBox(ox, oy, angle, mover.col + mover.dc * mover.offset, mover.row + mover.dr * mover.offset);
    if (boxHit && boxHit.dist < best.dist && boxHit.dist <= maxDist) {
      best = { ...boxHit, wall: mover.texture, col: mover.col, row: mover.row, door: null };
    }
  }
  return best;
}

/**
 * Where a ray enters the square box with its top-left corner at (bx, by), or null.
 * This is the "slab" method: work out when the ray is between the box's left and right
 * edges, and when it is between its top and bottom edges. Where those two time spans
 * overlap, the ray is inside the box, and the start of the overlap is the hit.
 */
export function hitBox(ox, oy, angle, bx, by) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const span = (origin, dir, low) => {
    if (Math.abs(dir) < 1e-12) return origin >= low && origin <= low + 1 ? [-Infinity, Infinity] : null;
    const a = (low - origin) / dir;
    const b = (low + 1 - origin) / dir;
    return a < b ? [a, b] : [b, a];
  };
  const xs = span(ox, dx, bx);
  const ys = span(oy, dy, by);
  if (!xs || !ys) return null;
  const enter = Math.max(xs[0], ys[0]);
  const exit = Math.min(xs[1], ys[1]);
  if (enter > exit || enter < 0) return null;
  const side = xs[0] > ys[0] ? 0 : 1;
  let u = side === 0 ? oy + enter * dy - by : ox + enter * dx - bx;
  if ((side === 0 && dx < 0) || (side === 1 && dy > 0)) u = 1 - u;
  return { dist: enter, side, u };
}

// The DDA walk across the grid itself.
function castGrid(world, ox, oy, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let col = Math.floor(ox);
  let row = Math.floor(oy);
  const stepX = dx < 0 ? -1 : 1;
  const stepY = dy < 0 ? -1 : 1;
  // How far along the ray you must go to cross one whole tile in x (or in y).
  const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  // Distance along the ray to the next vertical and horizontal grid line.
  let nextX = dx === 0 ? Infinity : (dx < 0 ? ox - col : col + 1 - ox) * deltaX;
  let nextY = dy === 0 ? Infinity : (dy < 0 ? oy - row : row + 1 - oy) * deltaY;
  let dist = 0;
  let side = 0;

  while (dist <= maxDist) {
    if (nextX < nextY) {
      dist = nextX;
      nextX += deltaX;
      col += stepX;
      side = 0;
    } else {
      dist = nextY;
      nextY += deltaY;
      row += stepY;
      side = 1;
    }
    if (dist > maxDist || col < 0 || row < 0 || col >= world.width || row >= world.height) break;

    const wall = world.walls[row][col];
    if (wall) {
      let u = side === 0 ? oy + dist * dy - row : ox + dist * dx - col;
      // Flip so a texture reads the same way round from both sides of a wall.
      if ((side === 0 && dx < 0) || (side === 1 && dy > 0)) u = 1 - u;
      return { dist, wall, side, u, col, row, door: null };
    }

    const door = world.doors.get(tileKey(world, col, row));
    if (door && door.open < 1) {
      // A door is a thin panel across the middle of its tile, so the ray has to
      // travel half a tile further to reach it. As the door opens it slides
      // sideways, leaving a gap the ray can pass through.
      const doorDist = door.vertical ? (col + 0.5 - ox) / dx : (row + 0.5 - oy) / dy;
      if (Number.isFinite(doorDist) && doorDist >= dist && doorDist <= maxDist) {
        const across = door.vertical ? oy + doorDist * dy - row : ox + doorDist * dx - col;
        if (across >= door.open && across < 1) {
          return {
            dist: doorDist,
            wall: door.locked ? 'doorLocked' : 'door',
            side: door.vertical ? 0 : 1,
            u: across - door.open,
            col,
            row,
            door,
          };
        }
      }
    }
  }
  return { dist: maxDist, wall: null, side, u: 0, col, row, door: null };
}
