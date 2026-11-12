import * as THREE from 'three';

/**
 * Everything a world does that isn't deciding what to put where.
 *
 * Placing props, tracking interactable objects, re-skinning them as the
 * calendar turns, running the lamps after dark, and restoring what the player
 * changed on top of freshly generated scenery — all of that is the same job in
 * a valley and in a crater. `generate()` is the hole a game fills.
 *
 * Generation is expected to be a pure function of the seed, so a save only has
 * to store what the player changed and the scenery comes back identically.
 */
export class World {
  /**
   * @param {object} ctx
   * @param {object} ctx.opts
   * @param {number} ctx.opts.skirtColor colour of the ground beyond the map
   * @param {Set<string>} [ctx.opts.variantModels] models with per-phase variants
   * @param {Record<string,string>} [ctx.opts.variantSuffix] phase key → suffix
   * @param {Record<string,string[]>} [ctx.opts.hiddenPools] phase key → pool keys
   * @param {Record<string,number>} [ctx.opts.skirtByPhase] phase key → colour
   * @param {Record<string,number>} [ctx.opts.kitBaseY] kit → y inset
   */
  constructor({ grid, props, assets, scene, opts = {} }) {
    this.grid = grid;
    this.props = props;
    this.assets = assets;
    this.scene = scene;
    this.opts = {
      skirtColor: 0x3d5c33,
      skirtSize: 700,
      variantModels: new Set(),
      variantSuffix: {},
      hiddenPools: {},
      skirtByPhase: {},
      kitBaseY: { nature: 0.05 },
      ...opts,
    };

    /** Props that need re-instancing when the phase turns. */
    this.variants = [];
    /** Lights that come up after dusk. */
    this.lamps = [];
    this.landmarks = null;
    this.phase = null;
    this.skirt = this.buildSkirt();
  }

  /** Kit base offsets: the nature pack sinks its models 0.05 below the origin. */
  baseY(kit) {
    return this.opts.kitBaseY[kit] ?? 0;
  }

  /**
   * A wide plane under everything.
   *
   * The tile grid stops at its border and the edge props are only knee-high
   * from an isometric angle, so without this the map visibly ends in empty
   * space whenever the player looks toward a corner.
   */
  buildSkirt() {
    const size = this.opts.skirtSize;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: this.opts.skirtColor, roughness: 1, metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.grid.size / 2, -0.08, this.grid.size / 2);
    mesh.receiveShadow = false;
    mesh.name = 'skirt';
    mesh.renderOrder = -2;
    this.scene.add(mesh);
    return mesh;
  }

  // --- placement helpers ---------------------------------------------------

  prop(kit, model, x, z, o = {}) {
    return this.props.add(kit, model, {
      x, z,
      y: o.y ?? this.baseY(kit),
      ry: o.ry ?? 0,
      rx: o.rx ?? 0,
      scale: o.scale ?? 1,
      sx: o.sx, sy: o.sy, sz: o.sz,
      wind: o.wind,
      castShadow: o.castShadow,
    });
  }

  /**
   * A world object the player can interact with. `spec.kit`/`spec.model` drive
   * the visual; everything else is game data and rides along into the save.
   */
  placeObject(x, z, spec) {
    const { kit = 'nature', model, scale = 1, ry = 0, ...data } = spec;
    const record = model ? this.prop(kit, model, x, z, { scale, ry }) : null;
    return this.grid.addObject(x, z, { kit, model, scale, ry, ...data, record });
  }

  /** Removes the object at a tile and its instance. Returns the object. */
  removeObject(x, z) {
    const obj = this.grid.objectAt(x, z);
    if (!obj) return null;
    if (obj.record) this.props.remove(obj.record);
    if (obj.markerRecord) this.props.remove(obj.markerRecord);
    this.grid.removeObject(x, z);
    return obj;
  }

  /** Swaps an object's model in place — a growing sapling, a stripped seam. */
  reskinObject(obj, model, opts = {}) {
    if (obj.record) this.props.remove(obj.record);
    obj.model = model;
    if (opts.kit) obj.kit = opts.kit;
    if (opts.scale !== undefined) obj.scale = opts.scale;
    obj.record = this.prop(obj.kit, obj.model, obj.x, obj.z, {
      scale: obj.scale, ry: obj.ry,
    });
  }

  // --- lamps ---------------------------------------------------------------

  /** A point light with no shadow — cheap, and bloom does the rest. */
  addLamp(x, z, y, color = 0xffc07a, distance = 8) {
    const light = new THREE.PointLight(color, 0, distance, 1.7);
    light.position.set(x, y, z);
    this.scene.add(light);
    this.lamps.push(light);
    return light;
  }

  /** Called each frame: lamps fade up as the sun goes down. */
  updateLamps(nightFactor) {
    const intensity = nightFactor * (this.opts.lampIntensity ?? 5.5);
    for (const lamp of this.lamps) lamp.intensity = intensity;
  }

  // --- phase variants ------------------------------------------------------

  /** The model name a variant-carrying prop should be showing this phase. */
  variantName(base) {
    if (!this.opts.variantModels.has(base)) return base;
    return base + (this.opts.variantSuffix[this.phase] || '');
  }

  /** Registers a prop so the phase change can re-instance it. */
  trackVariant(entry) {
    if (this.opts.variantModels.has(entry.base)) this.variants.push(entry);
    return entry;
  }

  /** Re-instances every phase-varying prop and retints the surrounds. */
  applyPhase(phaseKey) {
    const changed = this.phase !== phaseKey;
    this.phase = phaseKey;

    if (changed) {
      for (const entry of this.variants) {
        if (!this.opts.variantModels.has(entry.base)) continue;
        const model = this.variantName(entry.base);
        if (entry.model === model) continue;
        if (entry.record) this.props.remove(entry.record);
        entry.model = model;
        entry.record = this.prop(entry.kit || 'nature', model, entry.x, entry.z, {
          scale: entry.scale, ry: entry.ry,
        });
      }
    }

    // Pools that only belong to certain phases (bright grass under snow, say).
    const hidden = new Set(this.opts.hiddenPools[phaseKey] || []);
    for (const list of Object.values(this.opts.hiddenPools)) {
      for (const key of list) {
        const pool = this.props.pools.get(key);
        if (pool) pool.mesh.visible = !hidden.has(key);
      }
    }

    const tint = this.opts.skirtByPhase[phaseKey];
    if (tint !== undefined) this.skirt.material.color.setHex(tint);
  }

  // --- persistence ---------------------------------------------------------

  /** Rebuilds player-changed objects after a load, on top of fresh scenery. */
  restoreObjects(entries) {
    const g = this.grid;

    // Anything generated as changeable is cleared first — the save is the truth
    // about what's still standing.
    for (const [i, obj] of Array.from(g.objects.entries())) {
      if (obj.persist === false) continue;
      this.removeObject(g.xOf(i), g.zOf(i));
    }
    this.variants = this.variants.filter((v) => v.decor);

    for (const [i, data] of entries || []) {
      const x = g.xOf(i);
      const z = g.zOf(i);
      if (!g.inBounds(x, z)) continue;
      const obj = this.placeObject(x, z, { ...data, x, z });
      if (obj?.base) this.trackVariant(obj);
    }
  }

  /** @abstract Fill the grid and return the map's landmarks. */
  generate() {
    throw new Error('World.generate() must be implemented by a game');
  }
}
