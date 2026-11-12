import { World } from '../../shared/world.js';
import { makeRng, makeNoise } from '../../core/rng.js';
import { WORLD } from '../../core/config.js';
import { T } from './config.js';

/**
 * Builds Mare Copernicus: the crater wall that fences the claim in, the solar
 * array field, the permanently shadowed ice crater, the habitat module, the
 * supply depot, and every boulder in between.
 *
 * Generation is a pure function of the seed, so a save only has to store what
 * the operator changed — split boulders, surveyed seams, working rigs — and the
 * terrain comes back identically on load.
 *
 * A note on scale: the survival kit is authored at half the town kit's size —
 * its structure pieces are a 0.54 cell against the town kit's 1.0 — so every
 * piece of the station is placed at scale 2 to sit on the tile grid. Its wall
 * panels also hang on the *-Z* face rather than the town kit's +X, which is why
 * the rotations below run 0 / π/2 / π / -π/2 for back / left / front / right.
 */

const HALF = Math.PI / 2;
/** Survival-kit structures are half-size; this puts them on the tile grid. */
const KIT = 2;

export class LunarWorld extends World {
  generate(seed) {
    const rng = makeRng(seed);
    const noise = makeNoise(seed);
    const g = this.grid;

    g.terrain.fill(T.REGOLITH);
    g.solid.fill(0);

    this.carveCraterWall(rng, noise);
    this.carveArrayField(34, 32, 4.6, noise);
    this.carveIceCrater(13, 13, 3.4, noise, rng);

    const hab = { x: 24, z: 15, w: 2, d: 3 };
    const claim = { x0: 20, z0: 20, x1: 29, z1: 26 };
    const depot = { x: 34, z: 20 };
    const launcher = { x: 27, z: 18 };
    const spawn = { x: 24, z: 18 };
    const doorTile = { x: hab.x, z: hab.z + hab.d - 1 };

    this.layPlate(24, 18, 34, 18);
    this.layPlate(34, 18, 34, 19);

    this.buildHabitat(hab);
    this.buildClaimFence(claim);
    this.buildDepot(depot);
    this.buildLauncher(launcher);

    this.scatter(rng, noise, { claim });

    this.landmarks = { hab, claim, depot, launcher, spawn, doorTile };
    this.applyPhase('dawn');
    return this.landmarks;
  }

  /** The crater rim: impassable, and the edge of the world in-fiction. */
  carveCraterWall(rng, noise) {
    const g = this.grid;
    const size = g.size;
    const b = WORLD.border;

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const edge = Math.min(x, z, size - 1 - x, size - 1 - z);
        // A noisy inner boundary keeps the rim from reading as a box.
        const wobble = noise.fbm(x * 0.09, z * 0.09, 3) * 3.2;
        if (edge >= b + wobble) continue;

        const i = g.idx(x, z);
        g.terrain[i] = T.RILLE;
        g.solid[i] = 1;

        if (edge < 1) continue;
        const density = 1 - edge / (b + 3);
        if (!rng.chance(0.46 * density + 0.16)) continue;

        // Cliff blocks give the rim a hard, layered silhouette; tall stones
        // break it up so it doesn't read as a wall of identical teeth.
        const model = rng.pick([
          'cliff_block_rock', 'cliff_block_stone', 'cliff_blockHalf_rock',
          'cliff_blockSlope_stone', 'cliff_blockDiagonal_rock',
          'stone_tallA', 'stone_tallF', 'rock_tallC', 'rock_largeE',
        ]);
        this.prop('nature', model, x + rng.range(-0.2, 0.2), z + rng.range(-0.2, 0.2), {
          scale: rng.range(0.9, 1.45),
          ry: rng.chance(0.5) ? rng.pick([0, HALF, Math.PI, -HALF]) : rng.angle(),
        });
      }
    }
  }

  /**
   * The solar array field — the claim's only power source, and the thing the
   * whole day is organised around. Impassable, but you recharge from the edge.
   */
  carveArrayField(cx, cz, radius, noise) {
    const g = this.grid;
    const r2 = radius * radius;
    for (const { x, z, i } of g.around(cx, cz, Math.ceil(radius) + 2)) {
      if (g.terrain[i] === T.RILLE) continue;
      const dx = x - cx;
      const dz = z - cz;
      const wobble = 1 + (noise.fbm(x * 0.22, z * 0.22, 2) - 0.5) * 0.4;
      const d2 = (dx * dx + dz * dz) / (wobble * wobble);
      if (d2 <= r2) {
        g.terrain[i] = T.ARRAY;
        g.solid[i] = 0;
        // Panels on a regular lattice — this is the one built thing out here,
        // and its straight rows are what tell it apart from the terrain.
        if ((x + z) % 2 === 0) {
          this.prop('survival', 'metal-panel-screws', x, z, {
            y: 0.42, rx: -0.55, ry: Math.PI, scale: KIT * 0.92,
          });
        }
      } else if (d2 <= (radius + 1.15) * (radius + 1.15)) {
        g.terrain[i] = T.EJECTA;
      }
    }

    // A mast at the centre so the field reads as infrastructure from a distance.
    this.prop('survival', 'signpost', cx, cz, { y: 0, scale: KIT * 1.3 });
    this.addLamp(cx, cz, 2.2, 0x7fd4ff, 11);
  }

  /**
   * A permanently shadowed crater. Sunlight never reaches the floor, so the
   * water ice that collected there over four billion years is still sitting on
   * the surface — which is exactly why the station was sited next to it.
   */
  carveIceCrater(cx, cz, radius, noise, rng) {
    const g = this.grid;
    const r2 = radius * radius;
    for (const { x, z, i } of g.around(cx, cz, Math.ceil(radius) + 2)) {
      if (g.terrain[i] === T.RILLE) continue;
      const dx = x - cx;
      const dz = z - cz;
      const wobble = 1 + (noise.fbm(x * 0.22 + 5, z * 0.22 + 5, 2) - 0.5) * 0.55;
      const d2 = (dx * dx + dz * dz) / (wobble * wobble);
      if (d2 <= r2) {
        g.terrain[i] = T.ICE;
        g.solid[i] = 0;
      } else if (d2 <= (radius + 1.4) * (radius + 1.4)) {
        g.terrain[i] = T.EJECTA;
      }
    }

    // Spires on the crater floor — the reason to come down here with a cutter.
    for (const { x, z, i } of g.around(cx, cz, Math.ceil(radius))) {
      if (g.terrain[i] !== T.ICE || g.objects.has(i)) continue;
      if (!rng.chance(0.16)) continue;
      this.placeObject(x, z, {
        kind: 'spire', model: rng.pick(['crops_wheatStageB', 'crops_wheatStageA']),
        scale: rng.range(1.3, 1.9), ry: rng.angle(),
        hp: 3, maxHp: 3, breakable: true, needs: 'fell', solid: true,
        drops: 'ice', dropCount: 3, label: 'Ice spire',
        leaves: ['nature', 'rock_smallF'],
      });
    }
  }

  layPlate(x0, z0, x1, z1) {
    const g = this.grid;
    const dx = Math.sign(x1 - x0);
    const dz = Math.sign(z1 - z0);
    let x = x0;
    let z = z0;
    for (let guard = 0; guard < 200; guard++) {
      if (g.inBounds(x, z) && g.terrain[g.idx(x, z)] !== T.ARRAY) {
        g.setTerrain(x, z, T.PLATE);
        this.prop('survival', 'floor', x, z, { y: 0.01, scale: KIT });
      }
      if (x === x1 && z === z1) break;
      if (x !== x1) x += dx;
      else if (z !== z1) z += dz;
    }
  }

  /**
   * The habitat module. Survival-kit wall panels sit on a cell's -Z face, so
   * each perimeter cell gets a panel rotated to face outward, and the roof is
   * one block per cell laid on top of the 1-unit walls.
   */
  buildHabitat({ x: hx, z: hz, w, d }) {
    const g = this.grid;

    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const i = g.idx(hx + dx, hz + dz);
        g.terrain[i] = T.PLATE;
        g.solid[i] = 1;
      }
    }

    for (let dz = 0; dz < d; dz++) {
      this.prop('survival', 'structure-metal-wall', hx, hz + dz, { ry: HALF, scale: KIT });        // -X
      this.prop('survival', 'structure-metal-wall', hx + w - 1, hz + dz, { ry: -HALF, scale: KIT }); // +X
    }
    for (let dx = 0; dx < w; dx++) {
      this.prop('survival', 'structure-metal-wall', hx + dx, hz, { ry: 0, scale: KIT });           // -Z
      this.prop('survival', dx === 0 ? 'structure-metal-doorway' : 'structure-metal-wall',
        hx + dx, hz + d - 1, { ry: Math.PI, scale: KIT });                                          // +Z
    }

    // Roof blocks sit directly on the 1-unit walls, squashed to a low cap so
    // the module reads as a pressure can rather than a house.
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        this.prop('survival', 'structure-metal-roof', hx + dx, hz + dz, {
          y: 1, sx: KIT, sy: KIT * 0.55, sz: KIT,
        });
      }
    }

    // Airlock dressing. The floods carry real lights that come up after dusk.
    for (const lx of [hx - 0.6, hx + w - 1 + 0.6]) {
      const lz = hz + d - 1 + 0.55;
      this.prop('survival', 'signpost-single', lx, lz, { y: 0, scale: KIT * 0.85 });
      this.addLamp(lx, lz, 1.5, 0xcfe4ff, 9);
    }
    this.prop('survival', 'barrel', hx + 0.62, hz + d - 1 + 0.5, { y: 0, scale: KIT * 0.8 });
    this.prop('survival', 'box', hx + w - 1 - 0.35, hz - 0.55, { y: 0, scale: KIT * 0.8 });

    // The airlock doubles as the bunk: click it to end the sol.
    g.addObject(hx, hz + d - 1, {
      kind: 'door', persist: false, breakable: false, label: 'Habitat airlock',
    });
  }

  buildClaimFence({ x0, z0, x1, z1 }) {
    const g = this.grid;
    const fx0 = x0 - 1;
    const fx1 = x1 + 1;
    const fz0 = z0 - 1;
    const fz1 = z1 + 1;
    const gate = { x: 24, z: fz0 };

    const post = (x, z, ry, model) => {
      if (!g.inBounds(x, z)) return;
      const i = g.idx(x, z);
      if (g.terrain[i] === T.ARRAY || g.terrain[i] === T.RILLE) return;
      g.solid[i] = model === 'fence-doorway' ? 0 : 1;
      this.prop('survival', model, x, z, { ry, scale: KIT });
    };

    // Panels hang on -Z, so each run faces outward from the claim.
    for (let x = fx0; x <= fx1; x++) {
      post(x, fz0, 0, x === gate.x ? 'fence-doorway' : 'fence');
      post(x, fz1, Math.PI, 'fence');
    }
    for (let z = fz0 + 1; z < fz1; z++) {
      post(fx0, z, HALF, 'fence');
      post(fx1, z, -HALF, 'fence');
    }

    this.prop('survival', 'signpost', gate.x + 0.75, fz0 - 0.1, { y: 0, scale: KIT * 0.9 });
    this.claimGate = gate;
  }

  buildDepot({ x, z }) {
    const g = this.grid;
    g.setTerrain(x, z, T.PLATE);

    // A open-fronted supply bay: back wall, side wall, roof, and a counter.
    this.prop('survival', 'structure-metal-wall', x, z, { ry: 0, scale: KIT });
    this.prop('survival', 'structure-metal-wall', x, z, { ry: HALF, scale: KIT });
    this.prop('survival', 'structure-metal-roof', x, z, { y: 1, sx: KIT, sy: KIT * 0.5, sz: KIT });
    this.prop('survival', 'workbench', x + 0.1, z + 0.45, { y: 0, scale: KIT * 0.95 });
    this.prop('survival', 'box-large', x - 0.7, z - 0.35, { y: 0, scale: KIT * 0.9 });
    this.prop('survival', 'barrel', x + 0.75, z - 0.4, { y: 0, scale: KIT * 0.85 });
    this.prop('survival', 'barrel', x + 0.95, z - 0.15, { y: 0, scale: KIT * 0.7 });
    this.prop('survival', 'signpost-single', x - 1.4, z + 0.55, { y: 0, scale: KIT * 0.85 });
    this.addLamp(x - 1.4, z + 0.55, 1.5, 0xffd9a0, 9);

    for (const dx of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        if (!g.inBounds(x + dx, z + dz)) continue;
        const i = g.idx(x + dx, z + dz);
        if (g.terrain[i] === T.REGOLITH) g.terrain[i] = T.PLATE;
      }
    }

    g.addObject(x, z, { kind: 'shop', persist: false, breakable: false, label: 'Supply depot' });
  }

  buildLauncher({ x, z }) {
    const g = this.grid;
    g.setTerrain(x, z, T.PLATE);
    this.prop('survival', 'floor', x, z, { y: 0.01, scale: KIT });
    this.prop('survival', 'chest', x, z, { y: 0, scale: KIT * 1.2, ry: Math.PI });
    this.prop('survival', 'signpost', x + 0.7, z + 0.1, { y: 0, scale: KIT * 0.85 });
    this.addLamp(x, z, 1.1, 0xffb45e, 7);
    g.addObject(x, z, {
      kind: 'bin', persist: false, breakable: false, label: 'Cargo launcher',
    });
  }

  // --- surface -------------------------------------------------------------

  scatter(rng, noise, { claim }) {
    const g = this.grid;
    const size = g.size;

    const insideClaim = (x, z) => x >= claim.x0 && x <= claim.x1 && z >= claim.z0 && z <= claim.z1;
    const open = (x, z) => {
      if (!g.inBounds(x, z)) return false;
      const i = g.idx(x, z);
      return g.terrain[i] === T.REGOLITH && !g.solid[i] && !g.objects.has(i);
    };

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (!open(x, z)) continue;
        // Where the ejecta blanket is thickest, so is everything on it.
        const rubble = noise.fbm(x * 0.11 + 9, z * 0.11 + 9, 3);
        const onClaim = insideClaim(x, z);

        // Loose gravel — dense, cheap, and the thing that sells "regolith".
        if (rng.chance(onClaim ? 0.14 : 0.30 + rubble * 0.32)) {
          const bit = rng.pick(['rock_smallA', 'rock_smallB', 'rock_smallC',
            'stone_smallA', 'stone_smallFlatA', 'rock_smallFlatB']);
          const n = onClaim ? 1 : rng.int(1, 3);
          for (let k = 0; k < n; k++) {
            this.prop('nature', bit, x + rng.range(-0.4, 0.4), z + rng.range(-0.4, 0.4), {
              ry: rng.angle(), scale: rng.range(0.5, 1.0), castShadow: false,
            });
          }
        }

        // Inside the claim the only clutter is wreckage worth grinding up.
        if (onClaim) {
          if (rng.chance(0.09)) {
            this.placeObject(x, z, {
              kind: 'debris', model: rng.pick(['log', 'stump_old']),
              scale: rng.range(0.8, 1.1), ry: rng.angle(),
              hp: 1, maxHp: 1, breakable: true, needs: 'clear', solid: false,
              drops: 'scrap', dropCount: 1, label: 'Wreckage',
            });
          }
          continue;
        }

        if (rng.chance(0.016 + rubble * 0.028)) {
          this.placeObject(x, z, {
            kind: 'boulder',
            model: rng.pick(['rock_largeA', 'rock_largeC', 'rock_largeD', 'rock_tallA', 'stone_largeB']),
            scale: rng.range(0.9, 1.35), ry: rng.angle(),
            hp: 3, maxHp: 3, breakable: true, needs: 'break', solid: true,
            drops: 'regolith', dropCount: 3, label: 'Boulder',
            leaves: ['nature', 'rock_smallA'],
          });
        } else if (rng.chance(0.016)) {
          this.placeObject(x, z, {
            kind: 'outcrop',
            model: rng.pick(['stone_largeC', 'stone_tallC', 'stone_largeE', 'stone_tallJ']),
            scale: rng.range(0.85, 1.2), ry: rng.angle(),
            hp: 3, maxHp: 3, breakable: true, needs: 'break', solid: true,
            drops: 'basalt', dropCount: 2, label: 'Basalt outcrop',
          });
        } else if (rng.chance(0.018)) {
          this.placeObject(x, z, {
            kind: 'debris', model: rng.pick(['log', 'log_stack', 'stump_old']),
            scale: rng.range(0.8, 1.15), ry: rng.angle(),
            hp: 1, maxHp: 1, breakable: true, needs: 'clear', solid: false,
            drops: 'scrap', dropCount: 1, label: 'Probe wreckage',
          });
        } else if (rng.chance(0.012 + rubble * 0.02)) {
          // Loose finds: click and they come away, no tool needed.
          const shard = rng.chance(0.55);
          this.placeObject(x, z, {
            kind: 'forage',
            model: shard
              ? rng.pick(['rock_smallD', 'rock_smallE', 'stone_smallB', 'stone_smallD'])
              : rng.pick(['flower_purpleC', 'flower_redC', 'flower_yellowC']),
            scale: rng.range(shard ? 0.8 : 1.1, shard ? 1.1 : 1.5), ry: rng.angle(),
            hp: 1, maxHp: 1, breakable: true, solid: false,
            drops: shard ? 'iridium' : 'crystal',
            label: shard ? 'Iridium shard' : 'Vug crystals',
          });
        }
      }
    }

    // A few landing-pad plates scattered near the station read as traffic.
    for (const [px, pz] of [[26, 17], [25, 19], [28, 17]]) {
      if (g.inBounds(px, pz) && g.terrain[g.idx(px, pz)] === T.REGOLITH) {
        g.setTerrain(px, pz, T.EJECTA);
      }
    }
  }
}
