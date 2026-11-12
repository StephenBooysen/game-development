import { World } from '../../shared/world.js';
import { makeRng, makeNoise } from '../../core/rng.js';
import { WORLD } from '../../core/config.js';
import { T } from './config.js';

/**
 * Builds the Hollow: terrain, the treeline that fences the map in, the pond,
 * the cabin, the general store, and every tuft of grass in between.
 *
 * Generation is a pure function of the seed, so a save only has to store what
 * the player changed — chopped trees, tilled soil, planted crops — and the
 * scenery comes back identically on load.
 */
export class FarmWorld extends World {
  generate(seed) {
    const rng = makeRng(seed);
    const noise = makeNoise(seed);
    const g = this.grid;

    g.terrain.fill(T.GRASS);
    g.solid.fill(0);

    this.carveTreeline(rng, noise);
    this.carvePond(34, 32, 4.6, noise);
    this.carvePond(13, 13, 3.2, noise);

    const house = { x: 24, z: 15, w: 2, d: 3 };
    const plot = { x0: 20, z0: 20, x1: 29, z1: 26 };
    const shop = { x: 34, z: 20 };
    const bin = { x: 27, z: 18 };
    const spawn = { x: 24, z: 18 };
    const doorTile = { x: house.x, z: house.z + house.d - 1 };

    this.layPath(24, 18, 34, 18);
    this.layPath(34, 18, 34, 19);

    this.buildHouse(house);
    this.buildPlotFence(plot, rng);
    this.buildStore(shop);
    this.buildBin(bin);

    this.scatter(rng, noise, { house, plot, shop, bin });

    this.landmarks = { house, plot, shop, bin, spawn, doorTile };
    this.applyPhase('spring');
    return this.landmarks;
  }

  /** Impassable forest around the whole map — the world's edge, in-fiction. */
  carveTreeline(rng, noise) {
    const g = this.grid;
    const size = g.size;
    const b = WORLD.border;

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const edge = Math.min(x, z, size - 1 - x, size - 1 - z);
        // A noisy inner boundary keeps the treeline from reading as a box.
        const wobble = noise.fbm(x * 0.09, z * 0.09, 3) * 3.2;
        if (edge >= b + wobble) continue;

        const i = g.idx(x, z);
        g.terrain[i] = T.FOREST;
        g.solid[i] = 1;

        if (edge < 1) continue;
        const density = 1 - edge / (b + 3);
        if (!rng.chance(0.42 * density + 0.14)) continue;

        const kind = rng.pick([
          'tree_default', 'tree_default', 'tree_oak', 'tree_small',
          'tree_pineDefaultA', 'tree_pineTallA', 'tree_pineRoundB', 'tree_thin', 'tree_fat',
        ]);
        this.addTree(x + rng.range(-0.28, 0.28), z + rng.range(-0.28, 0.28), kind, {
          scale: rng.range(0.85, 1.3),
          ry: rng.angle(),
        });
      }
    }
  }

  /** A rough disc of water with a sand rim. */
  carvePond(cx, cz, radius, noise) {
    const g = this.grid;
    const r2 = radius * radius;
    for (const { x, z, i } of g.around(cx, cz, Math.ceil(radius) + 2)) {
      if (g.terrain[i] === T.FOREST) continue;
      const dx = x - cx;
      const dz = z - cz;
      // Warping the radius with noise gives an organic edge for free.
      const wobble = 1 + (noise.fbm(x * 0.22, z * 0.22, 2) - 0.5) * 0.55;
      const d2 = (dx * dx + dz * dz) / (wobble * wobble);
      if (d2 <= r2) {
        g.terrain[i] = T.WATER;
        g.solid[i] = 0;
      } else if (d2 <= (radius + 1.15) * (radius + 1.15)) {
        g.terrain[i] = T.SAND;
      }
    }
  }

  layPath(x0, z0, x1, z1) {
    const g = this.grid;
    const dx = Math.sign(x1 - x0);
    const dz = Math.sign(z1 - z0);
    let x = x0;
    let z = z0;
    for (let guard = 0; guard < 200; guard++) {
      if (g.inBounds(x, z) && g.terrain[g.idx(x, z)] !== T.WATER) g.setTerrain(x, z, T.PATH);
      if (x === x1 && z === z1) break;
      if (x !== x1) x += dx;
      else if (z !== z1) z += dz;
    }
  }

  /**
   * The cabin. Town-kit walls are edge panels on a cell's +X face, so each
   * perimeter cell gets a panel rotated to face outward; the roof is two rows
   * of slope pieces meeting over the middle of the 2-cell width.
   */
  buildHouse({ x: hx, z: hz, w, d }) {
    const g = this.grid;

    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const i = g.idx(hx + dx, hz + dz);
        g.terrain[i] = T.PATH;
        g.solid[i] = 1;
      }
    }

    const HALF = Math.PI / 2;
    for (let dz = 0; dz < d; dz++) {
      const side = dz === 1 ? 'wall-wood-window-shutters' : 'wall-wood';
      this.prop('town', side, hx, hz + dz, { ry: Math.PI, y: 0 });       // -X face
      this.prop('town', side, hx + w - 1, hz + dz, { ry: 0, y: 0 });     // +X face
    }
    for (let dx = 0; dx < w; dx++) {
      this.prop('town', 'wall-wood', hx + dx, hz, { ry: HALF, y: 0 });   // back (-Z)
      this.prop('town', dx === 0 ? 'wall-wood-door' : 'wall-wood-window-shutters',
        hx + dx, hz + d - 1, { ry: -HALF, y: 0 });                       // front (+Z)
    }

    // Roof: ridge runs along Z at x = hx + 0.5.
    for (let dz = 0; dz < d; dz++) {
      this.prop('town', 'roof', hx, hz + dz, { ry: 0, y: 1 });
      this.prop('town', 'roof', hx + w - 1, hz + dz, { ry: Math.PI, y: 1 });
    }
    // Gable ends: the A-frame piece squashed to a thin triangular cap.
    for (const z of [hz - 0.32, hz + d - 1 + 0.32]) {
      this.prop('town', 'roof-gable', hx + 0.5, z, { y: 1, sx: 1.95, sy: 1.1, sz: 0.34 });
    }
    this.prop('town', 'chimney', hx + w - 1, hz, { ry: 0, y: 0 });

    // Porch dressing. The lanterns carry real lights that come up after dark.
    for (const lx of [hx - 0.55, hx + w - 1 + 0.55]) {
      const lz = hz + d - 1 + 0.55;
      this.prop('town', 'lantern', lx, lz, { y: 0, scale: 0.9 });
      this.addLamp(lx, lz, 1.35);
    }
    this.prop('nature', 'pot_small', hx + 0.62, hz + d - 1 + 0.5);
    this.prop('survival', 'barrel', hx + w - 1 - 0.35, hz - 0.55, { y: 0 });

    // The door doubles as the bed: click it to turn in for the night.
    g.addObject(hx, hz + d - 1, {
      kind: 'door', persist: false, breakable: false, label: 'Cabin door',
    });
  }

  buildPlotFence({ x0, z0, x1, z1 }, rng) {
    const g = this.grid;
    const fx0 = x0 - 1;
    const fx1 = x1 + 1;
    const fz0 = z0 - 1;
    const fz1 = z1 + 1;
    const gate = { x: 24, z: fz0 };
    const HALF = Math.PI / 2;

    const post = (x, z, ry, model) => {
      if (!g.inBounds(x, z)) return;
      const i = g.idx(x, z);
      if (g.terrain[i] === T.WATER || g.terrain[i] === T.FOREST) return;
      g.solid[i] = model === 'fence_gate' ? 0 : 1;
      this.prop('nature', model, x, z, { ry });
    };

    for (let x = fx0; x <= fx1; x++) {
      post(x, fz0, 0, x === gate.x ? 'fence_gate' : 'fence_simple');
      post(x, fz1, Math.PI, 'fence_simple');
    }
    for (let z = fz0 + 1; z < fz1; z++) {
      post(fx0, z, HALF, 'fence_simple');
      post(fx1, z, -HALF, 'fence_simple');
    }

    // A couple of weathered signs so the plot reads as somebody's plot.
    this.prop('nature', 'sign', gate.x + 0.75, fz0 - 0.1, { ry: rng.range(-0.2, 0.2) });
    this.plotGate = gate;
  }

  buildStore({ x, z }) {
    const g = this.grid;
    g.setTerrain(x, z, T.PATH);
    this.prop('town', 'stall-red', x, z, { ry: Math.PI, y: 0 });
    this.prop('town', 'lantern', x - 1.5, z + 0.6, { y: 0, scale: 0.9 });
    this.addLamp(x - 1.5, z + 0.6, 1.35);
    this.prop('town', 'stall-bench', x - 0.75, z, { ry: 0, y: 0 });
    this.prop('town', 'stall-stool', x + 0.8, z + 0.4, { y: 0 });
    this.prop('town', 'cart', x + 1.6, z - 0.6, { ry: -0.5, y: 0 });
    this.prop('survival', 'box', x - 0.8, z - 0.7, { y: 0 });
    this.prop('survival', 'box', x - 0.55, z - 0.95, { y: 0, scale: 0.85 });

    for (const dx of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        const i = g.idx(x + dx, z + dz);
        if (g.inBounds(x + dx, z + dz) && g.terrain[i] === T.GRASS) g.terrain[i] = T.PATH;
      }
    }

    g.addObject(x, z, { kind: 'shop', persist: false, breakable: false, label: 'General store' });
  }

  buildBin({ x, z }) {
    this.grid.setTerrain(x, z, T.PATH);
    this.prop('survival', 'chest', x, z, { y: 0, scale: 1.35, ry: Math.PI });
    this.prop('survival', 'signpost', x + 0.7, z + 0.1, { y: 0, scale: 0.9 });
    this.grid.addObject(x, z, {
      kind: 'bin', persist: false, breakable: false, label: 'Shipping bin',
    });
  }

  // --- scenery -------------------------------------------------------------

  scatter(rng, noise, { plot }) {
    const g = this.grid;
    const size = g.size;

    const insidePlot = (x, z) => x >= plot.x0 && x <= plot.x1 && z >= plot.z0 && z <= plot.z1;
    const open = (x, z) => {
      if (!g.inBounds(x, z)) return false;
      const i = g.idx(x, z);
      return g.terrain[i] === T.GRASS && !g.solid[i] && !g.objects.has(i);
    };

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (!open(x, z)) continue;
        const lush = noise.fbm(x * 0.11 + 9, z * 0.11 + 9, 3);
        const farm = insidePlot(x, z);

        // Ground cover — dense, cheap, and the thing that sells "meadow".
        // Thinner inside the plot so tilled rows stay legible.
        if (rng.chance(farm ? 0.16 : 0.34 + lush * 0.34)) {
          const tuft = rng.pick(['grass', 'grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge']);
          const n = farm ? 1 : rng.int(1, 3);
          for (let k = 0; k < n; k++) {
            this.prop('nature', tuft, x + rng.range(-0.4, 0.4), z + rng.range(-0.4, 0.4), {
              ry: rng.angle(), scale: rng.range(0.7, 1.25), wind: true, castShadow: false,
            });
          }
        }

        if (!farm && rng.chance(0.05 + lush * 0.05)) {
          this.prop('nature', rng.pick([
            'flower_redA', 'flower_redB', 'flower_purpleA', 'flower_purpleC',
            'flower_yellowA', 'flower_yellowB',
          ]), x + rng.range(-0.35, 0.35), z + rng.range(-0.35, 0.35), {
            ry: rng.angle(), scale: rng.range(0.8, 1.2), wind: true, castShadow: false,
          });
        }

        // Interactables. The plot gets weeds to clear; outside gets the good stuff.
        if (farm) {
          // Clearable weeds are always plant_bush* so they never read as the
          // decorative grass tufts the player can't do anything with.
          if (rng.chance(0.09)) {
            this.placeObject(x, z, {
              kind: 'weed', model: rng.pick(['plant_bush', 'plant_bushSmall']),
              scale: rng.range(0.9, 1.2), ry: rng.angle(),
              hp: 1, maxHp: 1, breakable: true, needs: 'clear', solid: false,
              drops: 'fibre', dropCount: 1, label: 'Weeds',
            });
          }
          continue;
        }

        if (rng.chance(0.014 + lush * 0.03)) {
          this.addTree(x, z, rng.pick(['tree_default', 'tree_oak', 'tree_small', 'tree_fat']), {
            scale: rng.range(0.9, 1.25), ry: rng.angle(), breakable: true,
          });
        } else if (rng.chance(0.016)) {
          this.placeObject(x, z, {
            kind: 'rock', model: rng.pick(['rock_largeA', 'rock_largeC', 'rock_tallA', 'stone_largeB']),
            scale: rng.range(0.8, 1.15), ry: rng.angle(),
            hp: 3, maxHp: 3, breakable: true, needs: 'break', solid: true,
            drops: 'stone', dropCount: 2, label: 'Rock',
          });
        } else if (rng.chance(0.02)) {
          this.placeObject(x, z, {
            kind: 'weed', model: rng.pick(['plant_bush', 'plant_bushDetailed', 'plant_bushLarge']),
            scale: rng.range(0.85, 1.2), ry: rng.angle(),
            hp: 1, maxHp: 1, breakable: true, needs: 'clear', solid: false,
            drops: 'fibre', dropCount: 1, label: 'Brush',
          });
        } else if (rng.chance(0.012 + lush * 0.02)) {
          const wild = rng.chance(0.55);
          this.placeObject(x, z, {
            kind: 'forage',
            model: wild
              ? rng.pick(['mushroom_red', 'mushroom_redGroup', 'mushroom_tan', 'mushroom_tanTall'])
              : rng.pick(['flower_redB', 'flower_purpleC', 'flower_yellowA']),
            scale: rng.range(0.9, 1.3), ry: rng.angle(),
            hp: 1, maxHp: 1, breakable: true, solid: false,
            drops: wild ? 'mushroom' : 'flower',
            label: wild ? 'Mushrooms' : 'Wildflowers',
          });
        } else if (rng.chance(0.008)) {
          this.prop('nature', rng.pick(['log', 'log_stack', 'stump_round', 'stump_old', 'rock_smallA', 'rock_smallB', 'stone_smallA']),
            x + rng.range(-0.3, 0.3), z + rng.range(-0.3, 0.3), { ry: rng.angle(), scale: rng.range(0.85, 1.15) });
        }
      }
    }

    // Lily pads soften the pond edges.
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (g.terrain[g.idx(x, z)] !== T.WATER) continue;
        if (!rng.chance(0.07)) continue;
        this.prop('nature', rng.chance(0.5) ? 'lily_small' : 'lily_large',
          x + rng.range(-0.3, 0.3), z + rng.range(-0.3, 0.3),
          { y: 0.01, ry: rng.angle(), castShadow: false });
      }
    }
  }

  /** Trees are tracked separately so the season can restyle them. */
  addTree(x, z, base, o = {}) {
    if (o.breakable) {
      const obj = this.placeObject(Math.round(x), Math.round(z), {
        kind: 'tree', model: this.variantName(base), base,
        scale: o.scale ?? 1, ry: o.ry ?? 0,
        hp: 3, maxHp: 3, breakable: true, needs: 'fell', solid: true,
        drops: 'wood', dropCount: 3, label: 'Tree',
        // A felled tree leaves its stump behind; it reads much better than a gap.
        leaves: ['nature', 'stump_round'],
      });
      if (obj) this.trackVariant(obj);
      return obj;
    }

    const record = this.prop('nature', this.variantName(base), x, z, {
      scale: o.scale ?? 1, ry: o.ry ?? 0,
    });
    return this.trackVariant({
      x, z, base, kit: 'nature', scale: o.scale ?? 1, ry: o.ry ?? 0, record, decor: true,
    });
  }
}
