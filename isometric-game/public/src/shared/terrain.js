import * as THREE from 'three';

const _c = new THREE.Color();
const _base = new THREE.Color();
const _mix = new THREE.Color();

/**
 * The ground: one flat, vertex-coloured mesh covering every tile.
 *
 * Flat at y = 0 on purpose. Both games are read as a grid, and a flat plane
 * means cursor picking is exact, props never float, and re-colouring a tile
 * when it's worked or charged is a four-value write instead of a rebuild.
 *
 * What colour a tile *is* comes from the paint rules a game hands in, not from
 * anything here. The rules cover the two cases both games share — a base colour
 * per terrain kind, and one family of tiles that drifts with the calendar
 * (grass through the seasons, regolith through the lunar cycle).
 */
export class Terrain {
  /**
   * @param {Grid} grid
   * @param {(x:number, y:number) => number} noise
   * @param {object} paint
   * @param {Record<number, number>} paint.colors base colour per terrain kind
   * @param {{dry: number, wet: number}} paint.prepared colour of a worked tile
   * @param {number[]} paint.tinted kinds that follow the phase colour
   * @param {Record<number, number>} [paint.tintScale] per-kind brightness off it
   * @param {{kinds: number[], color: number, amount: number}} [paint.dust]
   */
  constructor(grid, noise, paint) {
    this.grid = grid;
    this.noise = noise;
    this.paint = {
      colors: {},
      prepared: { dry: 0x7a5334, wet: 0x46301d },
      tinted: [],
      tintScale: {},
      dust: null,
      ...paint,
    };
    this.tint = new THREE.Color(this.paint.colors[this.paint.tinted[0]] ?? 0x6fae4a);
    this.mesh = this.build();
  }

  build() {
    const { size } = this.grid;
    const tiles = size * size;

    const position = new Float32Array(tiles * 4 * 3);
    const normal = new Float32Array(tiles * 4 * 3);
    const color = new Float32Array(tiles * 4 * 3);
    const index = new Uint32Array(tiles * 6);

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const t = this.grid.idx(x, z);
        const v = t * 4;
        const p = v * 3;

        // Corners of tile (x,z), centre at (x, 0, z).
        const x0 = x - 0.5, x1 = x + 0.5;
        const z0 = z - 0.5, z1 = z + 0.5;
        position[p + 0] = x0; position[p + 1] = 0; position[p + 2] = z0;
        position[p + 3] = x1; position[p + 4] = 0; position[p + 5] = z0;
        position[p + 6] = x1; position[p + 7] = 0; position[p + 8] = z1;
        position[p + 9] = x0; position[p + 10] = 0; position[p + 11] = z1;

        for (let k = 0; k < 4; k++) {
          normal[p + k * 3 + 0] = 0;
          normal[p + k * 3 + 1] = 1;
          normal[p + k * 3 + 2] = 0;
        }

        const o = t * 6;
        index[o + 0] = v + 0; index[o + 1] = v + 2; index[o + 2] = v + 1;
        index[o + 3] = v + 0; index[o + 4] = v + 3; index[o + 5] = v + 2;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    this.colorAttr = new THREE.BufferAttribute(color, 3);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('color', this.colorAttr);
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'terrain';
    mesh.renderOrder = -1;
    return mesh;
  }

  /** Baked per-tile brightness jitter so the ground isn't a flat slab. */
  bakeShade(spread = 0.22) {
    const { size, shade } = this.grid;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const n = this.noise.fbm(x * 0.17, z * 0.17, 3);
        const fine = this.noise(x * 0.9 + 40, z * 0.9 + 40);
        shade[this.grid.idx(x, z)] = 0.86 + n * spread + fine * 0.08;
      }
    }
    this.repaintAll();
  }

  tileColor(i, out) {
    const g = this.grid;
    const kind = g.terrain[i];
    const paint = this.paint;

    if (g.prepared[i]) {
      _base.setHex(g.charge[i] > 0 ? paint.prepared.wet : paint.prepared.dry);
    } else if (paint.tinted.includes(kind)) {
      _base.copy(this.tint);
      const scale = paint.tintScale[kind];
      if (scale !== undefined) _base.multiplyScalar(scale);
    } else {
      _base.setHex(paint.colors[kind] ?? 0x808080);
    }

    const s = g.shade[i] || 1;
    out.copy(_base).multiplyScalar(s);
    // A touch of desaturation on trodden ground reads as dust.
    if (paint.dust && paint.dust.kinds.includes(kind)) {
      out.lerp(_mix.setHex(paint.dust.color), paint.dust.amount);
    }
    return out;
  }

  writeTile(i) {
    this.tileColor(i, _c);
    const arr = this.colorAttr.array;
    const p = i * 4 * 3;
    for (let k = 0; k < 4; k++) {
      arr[p + k * 3 + 0] = _c.r;
      arr[p + k * 3 + 1] = _c.g;
      arr[p + k * 3 + 2] = _c.b;
    }
  }

  repaintAll() {
    const n = this.grid.size * this.grid.size;
    for (let i = 0; i < n; i++) this.writeTile(i);
    this.colorAttr.needsUpdate = true;
    this.grid.dirtyTiles.clear();
  }

  /** Flush only the tiles that changed since the last frame. */
  refresh() {
    if (this.grid.dirtyTiles.size === 0) return;
    for (const i of this.grid.dirtyTiles) this.writeTile(i);
    this.colorAttr.needsUpdate = true;
    this.grid.dirtyTiles.clear();
  }

  /** A new phase recolours every tinted tile at once. */
  setTint(hex) {
    this.tint.setHex(hex);
    this.repaintAll();
  }
}
