/**
 * Grid A* for click-to-move.
 *
 * Without it, walking to a spot behind the cabin means steering around it by
 * hand, which is miserable with an orthographic camera. The map is 56×56, so
 * even a worst-case search is a few thousand nodes — no need for anything
 * cleverer than a binary heap.
 */

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

class Heap {
  constructor() {
    this.items = [];
  }

  push(node, cost) {
    this.items.push({ node, cost });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].cost <= this.items[i].cost) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let best = i;
        if (l < this.items.length && this.items[l].cost < this.items[best].cost) best = l;
        if (r < this.items.length && this.items[r].cost < this.items[best].cost) best = r;
        if (best === i) break;
        [this.items[best], this.items[i]] = [this.items[i], this.items[best]];
        i = best;
      }
    }
    return top;
  }

  get size() {
    return this.items.length;
  }
}

/**
 * @returns {{x: number, z: number}[]} tiles to walk through, start excluded.
 *   Empty when there's no route.
 */
export function findPath(grid, from, to, budget = 6000) {
  const start = grid.idx(from.x, from.z);
  let goalTile = to;
  if (!grid.walkable(to.x, to.z)) goalTile = grid.nearestWalkable(to.x, to.z, 4);
  const goal = grid.idx(goalTile.x, goalTile.z);
  if (start === goal) return [];

  const n = grid.size * grid.size;
  const cameFrom = new Int32Array(n).fill(-1);
  const gScore = new Float32Array(n).fill(Infinity);
  const closed = new Uint8Array(n);
  const open = new Heap();

  const heuristic = (i) => {
    const dx = Math.abs(grid.xOf(i) - goalTile.x);
    const dz = Math.abs(grid.zOf(i) - goalTile.z);
    // Octile distance — admissible for 8-way movement.
    return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };

  gScore[start] = 0;
  open.push(start, heuristic(start));
  let expanded = 0;

  while (open.size) {
    const { node: current } = open.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === goal) return unwind(grid, cameFrom, current);
    if (++expanded > budget) break;

    const cx = grid.xOf(current);
    const cz = grid.zOf(current);
    for (const [dx, dz, cost] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.walkable(nx, nz)) continue;
      // Never squeeze between two diagonal blockers.
      if (dx && dz && (!grid.walkable(cx + dx, cz) || !grid.walkable(cx, cz + dz))) continue;

      const next = grid.idx(nx, nz);
      if (closed[next]) continue;
      const tentative = gScore[current] + cost;
      if (tentative >= gScore[next]) continue;
      gScore[next] = tentative;
      cameFrom[next] = current;
      open.push(next, tentative + heuristic(next));
    }
  }

  return [];
}

function unwind(grid, cameFrom, end) {
  const out = [];
  let node = end;
  while (node !== -1) {
    out.push({ x: grid.xOf(node), z: grid.zOf(node) });
    node = cameFrom[node];
  }
  out.pop(); // drop the tile the player is already standing on
  return out.reverse();
}
