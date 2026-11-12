import { WORLD } from '../core/config.js';

/**
 * Tile data for a whole map, in terms no game owns.
 *
 * Terrain state lives in typed arrays (compact, fast, trivial to serialise);
 * anything with structure — a growing crop, a running drill rig, a breakable
 * boulder — lives in a Map keyed by the same tile index.
 *
 * The layer names are deliberately neutral, because both games want the same
 * two extra bits per tile and only disagree about what they mean:
 *
 *   prepared  the tile has been worked into a bed for something
 *             (farm: hoed soil · moon: surveyed deposit)
 *   charge    the consumable that lets whatever is planted there advance today
 *             (farm: soil moisture · moon: power in the rig's cell)
 *
 * Which terrain kinds block movement is a game's business, so the set is
 * injected rather than assumed.
 */
export class Grid {
  /**
   * @param {object} opts
   * @param {number} opts.size tiles per side
   * @param {Iterable<number>} opts.blocked terrain kinds that can't be walked on
   * @param {number} opts.ground default terrain kind to fill with
   */
  constructor({ size = WORLD.size, blocked = [], ground = 0 } = {}) {
    this.size = size;
    this.blocked = new Set(blocked);
    this.ground = ground;
    const n = size * size;

    this.terrain = new Uint8Array(n).fill(ground);
    /** 1 when worked into a bed — hoed soil, surveyed deposit. */
    this.prepared = new Uint8Array(n);
    /** Units of charge left; a plot only advances on a charged day. */
    this.charge = new Uint8Array(n);
    /** 1 when something solid stands here (tree, boulder, building, fence). */
    this.solid = new Uint8Array(n);
    /** Per-tile colour jitter, baked once at generation for a painterly ground. */
    this.shade = new Float32Array(n);

    /** @type {Map<number, object>} growing things by tile index */
    this.plots = new Map();
    /** @type {Map<number, object>} harvestable/decor objects by tile index */
    this.objects = new Map();

    /** Tiles whose ground colour changed and need re-uploading this frame. */
    this.dirtyTiles = new Set();
  }

  idx(x, z) {
    return z * this.size + x;
  }

  xOf(i) {
    return i % this.size;
  }

  zOf(i) {
    return (i / this.size) | 0;
  }

  inBounds(x, z) {
    return x >= 0 && z >= 0 && x < this.size && z < this.size;
  }

  /** Can the player stand on this tile? */
  walkable(x, z) {
    if (!this.inBounds(x, z)) return false;
    const i = this.idx(x, z);
    if (this.solid[i]) return false;
    return !this.blocked.has(this.terrain[i]);
  }

  /** True when the tile's terrain is one of `kinds`. */
  terrainIs(x, z, ...kinds) {
    if (!this.inBounds(x, z)) return false;
    return kinds.includes(this.terrain[this.idx(x, z)]);
  }

  markDirty(x, z) {
    if (this.inBounds(x, z)) this.dirtyTiles.add(this.idx(x, z));
  }

  setTerrain(x, z, kind) {
    if (!this.inBounds(x, z)) return;
    this.terrain[this.idx(x, z)] = kind;
    this.markDirty(x, z);
  }

  setPrepared(x, z, on) {
    if (!this.inBounds(x, z)) return;
    const i = this.idx(x, z);
    this.prepared[i] = on ? 1 : 0;
    if (!on) this.charge[i] = 0;
    this.markDirty(x, z);
  }

  setCharge(x, z, units) {
    if (!this.inBounds(x, z)) return;
    this.charge[this.idx(x, z)] = units;
    this.markDirty(x, z);
  }

  plotAt(x, z) {
    return this.inBounds(x, z) ? this.plots.get(this.idx(x, z)) : undefined;
  }

  objectAt(x, z) {
    return this.inBounds(x, z) ? this.objects.get(this.idx(x, z)) : undefined;
  }

  addObject(x, z, obj) {
    if (!this.inBounds(x, z)) return null;
    const i = this.idx(x, z);
    obj.x = x;
    obj.z = z;
    obj.tile = i;
    this.objects.set(i, obj);
    if (obj.solid !== false) this.solid[i] = 1;
    return obj;
  }

  removeObject(x, z) {
    const i = this.idx(x, z);
    const obj = this.objects.get(i);
    if (!obj) return null;
    this.objects.delete(i);
    this.solid[i] = 0;
    return obj;
  }

  /** Iterate tiles in a square radius, clipped to bounds. */
  *around(cx, cz, r) {
    for (let z = Math.max(0, cz - r); z <= Math.min(this.size - 1, cz + r); z++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(this.size - 1, cx + r); x++) {
        yield { x, z, i: this.idx(x, z) };
      }
    }
  }

  /** Nearest walkable tile to (x,z), searched in rings. Used for spawning. */
  nearestWalkable(x, z, maxR = 12) {
    if (this.walkable(x, z)) return { x, z };
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = x + dx;
          const nz = z + dz;
          if (this.walkable(nx, nz)) return { x: nx, z: nz };
        }
      }
    }
    return { x, z };
  }

  // --- persistence -------------------------------------------------------

  serialize() {
    return {
      size: this.size,
      terrain: Array.from(this.terrain),
      prepared: Array.from(this.prepared),
      charge: Array.from(this.charge),
      plots: Array.from(this.plots.entries()).map(([i, p]) => [i, plain(p)]),
      // Only objects the player can change are worth saving; pure decor is
      // regenerated from the seed. Everything about them is copied except the
      // live scene handles, so an object type can gain fields (a well's
      // readiness, say) without this needing to know about them.
      objects: Array.from(this.objects.entries())
        .filter(([, o]) => o.persist !== false)
        .map(([i, o]) => [i, plain(o)]),
    };
  }

  /**
   * Restores the tile layers. Accepts the pre-split field names too, so a farm
   * saved before the two games were pulled apart still loads.
   */
  loadTerrain(data) {
    if (!data) return;
    if (data.terrain) this.terrain.set(data.terrain);
    const prepared = data.prepared ?? data.tilled;
    const charge = data.charge ?? data.moisture;
    if (prepared) this.prepared.set(prepared);
    if (charge) this.charge.set(charge);
    for (let i = 0; i < this.terrain.length; i++) this.dirtyTiles.add(i);
  }

  /** Plot entries from a save, under either the new or the legacy key. */
  static plotsFrom(data) {
    return new Map(data?.plots || data?.crops || []);
  }
}

/**
 * Data-only copy of a world object: drops the live instance/scene handles.
 * Instance records point back at their pool, so letting one through would make
 * the save graph circular as well as useless.
 */
const LIVE_FIELDS = new Set(['record', 'fruitRecord', 'markerRecord', 'pool', 'mesh', 'group']);
function plain(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (LIVE_FIELDS.has(k) || typeof v === 'function') continue;
    if (v && typeof v === 'object' && ('pool' in v || v.isObject3D)) continue;
    out[k] = v;
  }
  return out;
}
